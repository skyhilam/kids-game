import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { spritePipelineVersion } from '../src/studio/spritePipeline';
import { buildImageRequest, defaultImageModel, generationFingerprint, imageModels, normalizeAtlas, providerError, uncertainMessage, validateInput, type GenerationInput, type GenerationJob } from '../src/studio/imageProvider';
export { buildImageRequest, defaultImageModel, normalizeAtlas, validateInput, type GenerationInput, type GenerationJob, type GeneratedAtlas } from '../src/studio/imageProvider';

const idPattern = /^[a-f0-9]{64}$/;
export function generationId(input: GenerationInput, model = defaultImageModel) {
  return createHash('sha256').update(generationFingerprint(input, model)).digest('hex');
}

/** Local-only middleware. Paid generation requires authenticated hosting before public deployment. */
export function createGenerationService(options: { directory: string; apiKey?: string; model?: string; fetch?: typeof fetch }) {
  const request = options.fetch ?? fetch;
  const model = options.model?.trim() || defaultImageModel;
  const configError = imageModels.includes(model) ? undefined : 'OPENAI_IMAGE_MODEL 必須使用支援本工房圖集尺寸的 GPT Image 2／2.5 模型。';
  let active: string | undefined;
  let operation: Promise<GenerationJob> | undefined;
  const pending = new Map<string, Promise<void>>();
  const path = (id: string) => { if (!idPattern.test(id)) throw new Error('動作紀錄編號不正確。'); return join(options.directory, `${id}.json`); };
  async function load(id: string): Promise<GenerationJob | undefined> {
    try { return JSON.parse(await readFile(path(id), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }
  async function writeJson(file: string, data: unknown) {
    await mkdir(options.directory, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(data)); await rename(`${file}.tmp`, file);
  }
  const save = (job: GenerationJob) => writeJson(path(job.id), job);
  async function setActive(id?: string) { await writeJson(join(options.directory, 'active.json'), { id: id ?? null }); active = id; }
  const initialized = (async () => {
    try { active = JSON.parse(await readFile(join(options.directory, 'active.json'), 'utf8')).id ?? undefined; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!active) return;
    const old = await load(active);
    if (!old || old.status === 'completed' || old.status === 'failed') { await setActive(); return; }
    // Image edits have no resumable provider job endpoint. Never silently resubmit after a restart.
    if (old.status === 'processing' || (old.status as string) === 'submitting') { old.status = 'uncertain'; old.error = uncertainMessage; await save(old); }
  })();
  async function render(job: GenerationJob, input: GenerationInput, apiKey: string) {
    try {
      const response = await request('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': job.requestId! },
        body: JSON.stringify(buildImageRequest(input, model)), signal: AbortSignal.timeout(10 * 60_000),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { error?: { code?: string } };
        throw Object.assign(new Error(providerError(response.status, detail.error?.code)), { definitive: response.status < 500 && response.status !== 408 });
      }
      const output = await response.json();
      try { job.atlas = normalizeAtlas(output, input.frames); }
      catch (error) { throw Object.assign(error as Error, { definitive: true }); }
      job.status = 'completed';
    } catch (error) {
      job.status = (error as { definitive?: boolean }).definitive ? 'failed' : 'uncertain';
      job.error = job.status === 'failed' ? (error as Error).message : uncertainMessage;
    }
    await save(job);
    if (job.status !== 'uncertain' && active === job.id) await setActive();
  }
  async function poll(id: string): Promise<GenerationJob> {
    await initialized;
    const job = await load(id); if (!job) throw new Error('找不到這個角色動作。');
    return job;
  }
  async function submit(raw: unknown, apiToken?: string): Promise<GenerationJob> {
    await initialized;
    if (operation) { await operation; return submit(raw, apiToken); }
    const apiKey = apiToken?.trim() || options.apiKey;
    if (apiKey && (apiKey.length > 4096 || !/^[\x21-\x7e]+$/.test(apiKey))) throw new Error('API token 格式不正確，請重新貼上。');
    const input = validateInput(raw); const id = generationId(input, model);
    const run = (async () => {
      const previous = await load(id);
      if (previous && previous.status !== 'failed') return previous;
      if (active) throw new Error('目前有一張素材正在生成，請完成後再製作下一張。');
      if (configError) throw new Error(configError);
      if (!apiKey) throw new Error('請先輸入 OpenAI API token。');
      const job: GenerationJob = { id, status: 'processing', sprite: input.sprite, action: input.action, frames: input.frames, createdAt: new Date().toISOString(), model, requestId: randomUUID(), pipeline: { version: spritePipelineVersion, motion: input.motion, reference: input.source } };
      await save(job); await setActive(id);
      // Return our local job immediately; the provider call can take several minutes.
      const work = render(job, input, apiKey).catch(() => { /* Keep the persisted active lock if saving fails. */ }).finally(() => pending.delete(id));
      pending.set(id, work);
      return { ...job };
    })();
    operation = run; try { return await run; } finally { operation = undefined; }
  }
  async function status() { await initialized; return { configured: !!options.apiKey && !configError, provider: 'OpenAI', model, error: configError, activeId: active ?? null }; }
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const route = req.url?.split('?')[0] ?? '';
    if (!route.startsWith('/__sprite-studio/')) { next(); return; }
    const json = (code: number, value: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
    // Bind key-backed routes to loopback and same origin, even if Vite is started with --host.
    const host = req.headers.host ?? '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
      || (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`)
      || (req.socket.remoteAddress && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))) { json(403, { error: '生成服務只供本機素材工房使用。' }); return; }
    try {
      if (req.method === 'GET' && route === '/__sprite-studio/status') { json(200, await status()); return; }
      const match = route.match(/^\/__sprite-studio\/jobs\/([a-f0-9]{64})$/);
      if (req.method === 'GET' && match) { json(200, await poll(match[1]!)); return; }
      if (req.method === 'POST' && route === '/__sprite-studio/jobs') {
        if (!req.headers['content-type']?.startsWith('application/json')) { json(415, { error: '請使用 JSON。' }); return; }
        const authorization = req.headers.authorization;
        if (authorization && !/^Bearer [\x21-\x7e]+$/i.test(authorization)) throw new Error('API token 格式不正確，請重新貼上。');
        let body = ''; for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 6_100_000) { json(413, { error: '參考圖太大。' }); return; } }
        json(200, await submit(JSON.parse(body), authorization?.slice(7))); return;
      }
      json(404, { error: '找不到生成服務路徑。' });
    } catch (error) { json(400, { error: error instanceof Error ? error.message : '生成服務暫時無法使用。' }); }
  }
  return { middleware, submit, poll, status };
}
