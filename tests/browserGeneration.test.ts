import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserActiveKey, createBrowserGeneration } from '../src/studio/browserGeneration';
import { type GenerationInput, type GenerationJob } from '../src/studio/imageProvider';
import { generationId } from '../server/sprite-generation';
import { serviceStatus } from '../src/studio/generation';

function png(width = 256, height = 256) {
  const bytes = Buffer.alloc(34); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}
const input: GenerationInput = { sprite: 'bear', source: png(), referenceCanvas: png(1536, 768), motion: 'wave', action: 'Wave hello', frames: 8, seed: 42 };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const atlas = { data: [{ b64_json: png(1536, 768).split(',')[1] }] };
let rows: Map<string, GenerationJob>;
let storage: Map<string, string>;
let request: ReturnType<typeof vi.fn<typeof fetch>>;
const store = {
  read: async (id: string) => structuredClone(rows.get(id)),
  save: async (job: GenerationJob) => { rows.set(job.id, structuredClone(job)); },
};
const finish = async (service: ReturnType<typeof createBrowserGeneration>, id: string) => {
  await vi.waitFor(async () => expect((await service.poll(id)).status).not.toBe('processing'));
  return service.poll(id);
};
beforeEach(() => {
  rows = new Map(); storage = new Map(); request = vi.fn<typeof fetch>(); let held = false;
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, options: { ifAvailable: boolean }, work: (lock: object | null) => Promise<unknown>) => {
    expect(options.ifAvailable).toBe(true);
    if (held) return work(null);
    held = true; try { return await work({}); } finally { held = false; }
  } } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('static-site character generation', () => {
  it('reports readiness on the production build without querying the missing local server', async () => {
    vi.stubEnv('PROD', true);
    expect(await serviceStatus()).toMatchObject({ configured: false, provider: 'OpenAI', transport: 'browser', activeId: null });
    expect(request).not.toHaveBeenCalled();
  });
  it('sends the temporary token only to OpenAI and shares deduplication with the local pipeline', async () => {
    let deliver!: (result: Response) => void;
    request.mockImplementation(() => new Promise(resolve => { deliver = resolve; }));
    const service = createBrowserGeneration(store); const token = 'test-only-browser-token';
    const first = await service.submit(input, ` ${token} `);
    expect(first.id).toBe(generationId(input)); expect(first.status).toBe('processing');
    expect((await service.status()).activeStatus).toBe('processing');
    expect((await service.submit(input, token)).id).toBe(first.id);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
    expect(new Headers(options!.headers).get('Authorization')).toBe(`Bearer ${token}`);
    expect(JSON.parse(options!.body as string)).toMatchObject({ n: 1, images: [{ image_url: input.referenceCanvas }, { image_url: input.source }], size: '1536x768' });
    expect(options!.body).not.toContain(token);
    deliver(response(atlas)); expect((await finish(service, first.id)).status).toBe('completed');
    expect((await service.status()).activeId).toBeNull();
    expect((await createBrowserGeneration(store).submit(input)).status).toBe('completed');
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...rows.values(), ...storage.values()])).not.toContain(token);
  });
  it('holds a lock across tabs while the paid request is running', async () => {
    let deliver!: (result: Response) => void;
    request.mockImplementation(() => new Promise(resolve => { deliver = resolve; }));
    const first = createBrowserGeneration(store); const otherTab = createBrowserGeneration(store);
    const job = await first.submit(input, 'test-only');
    expect((await otherTab.status()).activeStatus).toBe('processing');
    await expect(otherTab.submit({ ...input, seed: 43 }, 'test-only')).rejects.toThrow('一張素材');
    await expect(otherTab.releaseUncertain()).rejects.toThrow('另一個頁面');
    expect(request).toHaveBeenCalledTimes(1);
    deliver(response(atlas)); await finish(first, job.id);
  });
  it('turns an interrupted tab into a recoverable uncertain job without automatic resubmission', async () => {
    const id = generationId(input);
    rows.set(id, { id, status: 'processing', sprite: 'bear', frames: 8, action: input.action, createdAt: new Date().toISOString() });
    storage.set(browserActiveKey, id);
    const service = createBrowserGeneration(store);
    expect((await service.status()).activeStatus).toBe('uncertain');
    expect((await service.submit(input, 'test-only')).status).toBe('uncertain');
    await expect(service.submit({ ...input, seed: 43 }, 'test-only')).rejects.toThrow('一張素材');
    expect(request).not.toHaveBeenCalled();
    await service.releaseUncertain(); expect((await service.status()).activeId).toBeNull();
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(response(atlas));
    const retry = await service.submit(input, 'test-only'); await finish(service, retry.id);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([401, 429])('permits an explicit retry after HTTP %s and never echoes upstream credential details', async status => {
    request.mockResolvedValue(response({ error: { code: status === 429 ? 'insufficient_quota' : 'invalid_api_key', message: 'secret-test-only-token' } }, status));
    const service = createBrowserGeneration(store); const first = await service.submit(input, 'secret-test-only-token');
    const failed = await finish(service, first.id);
    expect(failed.status).toBe('failed'); expect(failed.error).not.toContain('secret-test-only-token');
    expect((await service.status()).activeId).toBeNull();
    await expect(service.submit(input)).rejects.toThrow('API token');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(['network', 'server'])('keeps a %s failure locked until the user checks usage', async outcome => {
    if (outcome === 'network') request.mockRejectedValue(new Error('Failed to fetch'));
    else request.mockResolvedValue(response({}, 500));
    const service = createBrowserGeneration(store); const job = await service.submit(input, 'test-only');
    expect((await finish(service, job.id)).status).toBe('uncertain');
    expect((await service.submit(input, 'test-only')).status).toBe('uncertain');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('never starts a paid request if saving its recovery record fails', async () => {
    const service = createBrowserGeneration({ ...store, save: async () => { throw new Error('storage full'); } });
    await expect(service.submit(input, 'test-only')).rejects.toThrow('storage full');
    expect(request).not.toHaveBeenCalled();
  });
});
