import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGenerationService, generationId, normalizeAtlas, buildImageRequest, defaultImageModel, validateInput, type GenerationInput } from '../server/sprite-generation';
import { actionDescription, hasBuiltInAction, hasGeneratedAction, readJob, serviceStatus, sourceKey, submitAnimation } from '../src/studio/generation';
import { initialRecipe } from '../src/studio/recipe';

vi.mock('../src/studio/draw', () => ({ renderSprite: vi.fn().mockResolvedValue(undefined) }));
// Header fixtures exercise protocol validation; actual PNG decoding/alpha is checked in the browser harness.
function png(index = 0, width = 256, height = 256) { const bytes = Buffer.alloc(34); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); bytes[33] = index; return `data:image/png;base64,${bytes.toString('base64')}`; }
const input: GenerationInput = { sprite: 'bear', source: png(), referenceCanvas: png(0, 1536, 768), motion: 'wave', action: 'Wave with articulated arm poses', frames: 8, seed: 42 };
const directories: string[] = [];
async function directory() { const dir = await mkdtemp(join(tmpdir(), 'sprite-generation-test-')); directories.push(dir); return dir; }
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const atlasResult = { data: [{ b64_json: png(1, 1536, 768).split(',')[1] }] };
const finish = async (service: ReturnType<typeof createGenerationService>, id: string) => {
  await vi.waitFor(async () => expect((await service.poll(id)).status).not.toBe('processing'));
  return service.poll(id);
};
async function submitThroughMiddleware(service: ReturnType<typeof createGenerationService>, authorization?: string) {
  const req = Object.assign(Readable.from([JSON.stringify(input)]), {
    method: 'POST', url: '/__sprite-studio/jobs', socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
  });
  let body = ''; const res = { statusCode: 0, setHeader: vi.fn(), end: (value: string) => { body = value; } };
  await service.middleware(req as unknown as IncomingMessage, res as unknown as ServerResponse, vi.fn());
  return { status: res.statusCode, body: JSON.parse(body) };
}

describe('OpenAI character action generation', () => {
  it('submits one reference-based edit, returns a local job immediately, and reuses completed work', async () => {
    let deliver!: (value: Response) => void;
    const provider = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { deliver = resolve; }));
    const dir = await directory(); const service = createGenerationService({ directory: dir, apiKey: 'test-only', fetch: provider });
    const [first, duplicate] = await Promise.all([service.submit(input), service.submit(input)]);
    expect(first.id).toBe(duplicate.id); expect(first.status).toBe('processing'); expect(provider).toHaveBeenCalledTimes(1);
    const [url, options] = provider.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    const body = JSON.parse(options!.body as string);
    expect(body).toMatchObject({ model: defaultImageModel, images: [{ image_url: input.referenceCanvas }, { image_url: input.source }], n: 1, size: '1536x768', background: 'transparent', output_format: 'png' });
    expect(body.prompt).toContain('approved character in its first cell'); expect(body.prompt).toContain('soft gouache/storybook');
    expect(first.pipeline).toEqual({ version: 'openai-sprite-pipeline-v1', reference: input.source, motion: 'wave' });
    expect(body).not.toHaveProperty('seed'); expect(body.prompt).toContain(input.action); expect(body.prompt).toContain('8 distinct articulated poses');
    await expect(service.submit({ ...input, sprite: 'courier' })).rejects.toThrow('一張素材正在生成');
    expect((await service.poll(first.id)).status).toBe('processing'); expect(provider).toHaveBeenCalledTimes(1);
    deliver(response(atlasResult)); const completed = await finish(service, first.id);
    expect(completed.status).toBe('completed'); expect(completed.atlas).toMatchObject({ columns: 4, rows: 2, width: 1536, height: 768 });
    await vi.waitFor(async () => expect((await service.status()).activeId).toBeNull());
    const restarted = createGenerationService({ directory: dir, apiKey: 'test-only', fetch: provider });
    expect((await restarted.submit(input)).atlas).toEqual(completed.atlas);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('marks interrupted local work uncertain on restart, without calling a nonexistent provider job endpoint', async () => {
    const provider = vi.fn<typeof fetch>(); const dir = await directory(); const id = generationId(input);
    await writeFile(join(dir, 'active.json'), JSON.stringify({ id }));
    await writeFile(join(dir, `${id}.json`), JSON.stringify({ id, status: 'processing', sprite: input.sprite, frames: 8, createdAt: new Date().toISOString() }));
    const restarted = createGenerationService({ directory: dir, apiKey: 'test-only', fetch: provider });
    expect((await restarted.status()).activeId).toBe(id);
    expect((await restarted.poll(id)).status).toBe('uncertain');
    expect((await restarted.submit(input)).status).toBe('uncertain');
    expect(provider).not.toHaveBeenCalled();
  });
  it('reports missing credentials and exhausted quota without pretending generation succeeded', async () => {
    const provider = vi.fn<typeof fetch>(); const dir = await directory();
    const offline = createGenerationService({ directory: dir, fetch: provider });
    expect((await offline.status()).configured).toBe(false);
    await expect(offline.submit(input)).rejects.toThrow('API token'); expect(provider).not.toHaveBeenCalled();
    provider.mockResolvedValueOnce(response({ error: { code: 'insufficient_quota' } }, 429)).mockResolvedValueOnce(response(atlasResult));
    const connected = createGenerationService({ directory: dir, apiKey: 'test-only', fetch: provider });
    const first = await connected.submit(input); expect((await finish(connected, first.id)).error).toContain('額度不足');
    await vi.waitFor(async () => expect((await connected.status()).activeId).toBeNull());
    const retry = await connected.submit(input); expect((await finish(connected, retry.id)).status).toBe('completed');
  });
  it('accepts a token per request without server configuration or persisting credentials', async () => {
    const token = 'test-only-user-token'; const dir = await directory();
    const provider = vi.fn<typeof fetch>().mockResolvedValue(response(atlasResult));
    const service = createGenerationService({ directory: dir, fetch: provider });
    const result = await submitThroughMiddleware(service, `Bearer ${token}`);
    expect(result.status).toBe(200);
    expect(new Headers(provider.mock.calls[0]![1]!.headers).get('Authorization')).toBe(`Bearer ${token}`);
    const completed = await finish(service, result.body.id);
    await vi.waitFor(async () => expect((await service.status()).activeId).toBeNull());
    expect(completed.status).toBe('completed'); expect((await service.status()).configured).toBe(false);
    const files = await Promise.all((await readdir(dir)).map(file => readFile(join(dir, file), 'utf8')));
    expect(JSON.stringify([result, completed, await service.status(), files])).not.toContain(token);
    expect(JSON.stringify(provider.mock.calls[0]![1]!.body)).not.toContain(token);
    await expect(service.submit({ ...input, seed: 43 })).rejects.toThrow('API token');
    expect((await service.submit(input)).status).toBe('completed'); // Reusing finished art needs no token.
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('overrides the server key only for that request and never returns upstream credential details', async () => {
    const provider = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: { message: 'rejected test-only-user-token' } }, 401))
      .mockResolvedValueOnce(response(atlasResult));
    const service = createGenerationService({ directory: await directory(), apiKey: 'test-only-server-token', fetch: provider });
    const first = await service.submit(input, 'test-only-user-token'); const failed = await finish(service, first.id);
    expect(failed.error).toContain('重新輸入'); expect(JSON.stringify(failed)).not.toContain('test-only-user-token');
    await vi.waitFor(async () => expect((await service.status()).activeId).toBeNull());
    const retry = await service.submit(input); expect((await finish(service, retry.id)).status).toBe('completed');
    expect(provider.mock.calls.map(([, options]) => new Headers(options!.headers).get('Authorization'))).toEqual(['Bearer test-only-user-token', 'Bearer test-only-server-token']);
  });
  it('rejects malformed token headers without echoing the token or calling the provider', async () => {
    const provider = vi.fn<typeof fetch>(); const service = createGenerationService({ directory: await directory(), fetch: provider });
    for (const header of ['Basic test-only-token', 'Bearer bad token', `Bearer ${'a'.repeat(4097)}`]) {
      const result = await submitThroughMiddleware(service, header);
      expect(result.status).toBe(400); expect(result.body.error).toContain('格式不正確');
      expect(JSON.stringify(result.body)).not.toContain(header);
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it('sends the browser token only in the submit header, without retaining it for subsequent calls', async () => {
    const token = 'test-only-browser-token'; const recipe = initialRecipe('bear'); const original = JSON.stringify(recipe);
    const job = { id: 'f'.repeat(64), status: 'processing' };
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response(job));
    vi.stubGlobal('fetch', request); vi.stubGlobal('document', { createElement: () => ({ toDataURL: () => png(), getContext: () => ({ drawImage: vi.fn() }) }) });
    await submitAnimation(recipe, ` ${token} `); await serviceStatus(); await readJob(job.id); await submitAnimation(recipe);
    expect(request.mock.calls.map(([, options]) => new Headers(options!.headers).get('Authorization'))).toEqual([`Bearer ${token}`, null, null, null]);
    expect(request.mock.calls.map(([url, options]) => `${url} ${options?.body ?? ''}`).join('\n')).not.toContain(token);
    expect(JSON.stringify(recipe)).toBe(original);
  });
  it('keeps network and server failure outcomes locked to avoid an automatic second charge', async () => {
    for (const outcome of [() => Promise.reject(new Error('network disconnected')), () => Promise.resolve(response({}, 500))]) {
      const provider = vi.fn<typeof fetch>().mockImplementation(outcome);
      const service = createGenerationService({ directory: await directory(), apiKey: 'test-only', fetch: provider });
      const job = await service.submit(input); expect((await finish(service, job.id)).status).toBe('uncertain');
      expect((await service.submit(input)).status).toBe('uncertain');
      await expect(service.submit({ ...input, seed: 43 })).rejects.toThrow('一張素材');
      expect(provider).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects malformed responses and mismatched atlas dimensions', async () => {
    expect(() => normalizeAtlas({ data: [] }, 8)).toThrow('圖集');
    expect(() => normalizeAtlas({ data: [{ b64_json: 'invalid' }] }, 8)).toThrow('PNG');
    expect(() => normalizeAtlas({ data: [{ b64_json: png() }] }, 8)).toThrow('尺寸');
    for (const patch of [{ source: 'https://untrusted.invalid/private' }, { source: png(0, 8192) }, { referenceCanvas: png() }, { referenceCanvas: undefined }, { motion: 'sway' }, { action: '' }, { frames: 999 }, { seed: -1 }]) expect(() => validateInput({ ...input, ...patch })).toThrow();
    expect(generationId(validateInput(input))).toBe(generationId(input));
    const service = createGenerationService({ directory: await directory(), apiKey: 'test-only', fetch: vi.fn<typeof fetch>().mockResolvedValue(response({ data: [] })) });
    const job = await service.submit(input); expect((await finish(service, job.id)).status).toBe('failed');
  });
  it('uses square grid cells for every count and includes the chosen model in deduplication', async () => {
    for (const [frames, size] of [[4, '1024x1024'], [8, '1536x768'], [12, '1536x1152']] as const) {
      const request = buildImageRequest({ ...input, frames }); expect(request.size).toBe(size); expect(request.n).toBe(1);
      expect(request.prompt).toContain(`${frames} distinct articulated poses`);
    }
    expect(generationId(input, 'gpt-image-2.5-flare')).not.toBe(generationId(input));
    const invalid = createGenerationService({ directory: await directory(), apiKey: 'test-only', model: 'text-only-model' });
    expect((await invalid.status()).configured).toBe(false);
    await expect(invalid.submit(input)).rejects.toThrow('OPENAI_IMAGE_MODEL');
  });
  it('invalidates generated art for pose/artwork edits but keeps it for playback, layout and output-size edits', () => {
    const base = initialRecipe('bear'); const key = sourceKey(base);
    const saved = { ...base, sheet: { ...base.sheet, generationId: 'a'.repeat(64), sourceKey: key } };
    expect(hasGeneratedAction(saved)).toBe(true);
    expect(hasGeneratedAction({ ...saved, size: 512, sheet: { ...saved.sheet, columns: 8, fps: 20 } })).toBe(true);
    for (const patch of [{ primary: '#000000' }, { mirror: true }, { seed: 42 }, { sheet: { ...saved.sheet, motion: 'jump' as const } }, { sheet: { ...saved.sheet, frames: 12 as const } }]) expect(hasGeneratedAction({ ...saved, ...patch })).toBe(false);
    expect(hasBuiltInAction(initialRecipe('car'))).toBe(true); expect(hasBuiltInAction(base)).toBe(false);
    expect(() => actionDescription({ ...base, sheet: { ...base.sheet, motion: 'custom' } })).toThrow('描述');
    expect(actionDescription(base)).toContain('articulated poses');
  });
});
