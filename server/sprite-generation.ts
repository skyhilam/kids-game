import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generatedAtlasLayout, motions, type SheetSettings } from '../src/studio/animation';
import { spritePipelineVersion, type SpritePipeline } from '../src/studio/spritePipeline';

export type GenerationInput = { sprite: string; source: string; referenceCanvas: string; motion: SheetSettings['motion']; action: string; frames: 4 | 8 | 12; seed: number };
export type GeneratedAtlas = { image: string; columns: number; rows: number; width: number; height: number };
export type GenerationJob = { id: string; status: 'processing' | 'completed' | 'failed' | 'uncertain'; sprite: string; action: string; frames: number; createdAt: string; model?: string; requestId?: string; atlas?: GeneratedAtlas; images?: string[]; pipeline?: SpritePipeline; error?: string };
export const defaultImageModel = 'gpt-image-2.5-sunburst';
const imageModels = [defaultImageModel, 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst-2026-09-08', 'gpt-image-2.5-flare-2026-09-08', 'gpt-image-2', 'gpt-image-2-2026-04-21'];
const pngPrefix = 'data:image/png;base64,';
const idPattern = /^[a-f0-9]{64}$/;
function pngInfo(value: unknown, atlas = false) {
  if (typeof value !== 'string' || value.length > (atlas ? 20_000_000 : 2_000_000)) throw new Error('影格 PNG 格式不正確。');
  const raw = value.startsWith(pngPrefix) ? value.slice(pngPrefix.length) : value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('影格 PNG 格式不正確。');
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('影格不是 PNG 圖片。');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 16 || height < 16 || width > (atlas ? 1536 : 256) || height > (atlas ? 1536 : 256)) throw new Error('生成圖片尺寸不正確。');
  return { width, height, url: pngPrefix + raw };
}
export function validateInput(value: unknown): GenerationInput {
  const v = value as Partial<GenerationInput> | null;
  if (!v || typeof v.sprite !== 'string' || !/^[a-z-]{1,40}$/.test(v.sprite) || typeof v.action !== 'string' || !v.action.trim() || v.action.length > 1000
    || !Object.hasOwn(motions, v.motion ?? '') || ![4, 8, 12].includes(v.frames!) || !Number.isInteger(v.seed) || v.seed! < 0 || v.seed! > 0xffffffff) throw new Error('生成要求不正確。');
  const source = pngInfo(v.source); const canvas = pngInfo(v.referenceCanvas, true); const grid = generatedAtlasLayout(v.frames!);
  if (source.width !== 256 || source.height !== 256 || canvas.url.length > 4_000_000 || canvas.width !== grid.width || canvas.height !== grid.height) throw new Error('角色參考畫布尺寸不正確。');
  return { sprite: v.sprite, source: source.url, referenceCanvas: canvas.url, motion: v.motion!, action: v.action.trim(), frames: v.frames!, seed: v.seed! };
}
export function generationId(input: GenerationInput, model = defaultImageModel) {
  const { sprite, source, referenceCanvas, motion, action, frames, seed } = input;
  return createHash('sha256').update(JSON.stringify({ engine: spritePipelineVersion, model, sprite, source, referenceCanvas, motion, action, frames, seed })).digest('hex');
}
export function buildImageRequest(input: GenerationInput, model = defaultImageModel) {
  const grid = generatedAtlasLayout(input.frames);
  const phases = Array.from({ length: input.frames }, (_, i) => `${i + 1}: ${Math.round(i / input.frames * 100)}%`).join(', ');
  return {
    model, images: [{ image_url: input.referenceCanvas }, { image_url: input.source }], n: 1, size: `${grid.width}x${grid.height}`,
    background: 'transparent', output_format: 'png', quality: 'high',
    prompt: `Edit image 1, a transparent reference canvas with the approved character in its first cell, into one complete 2D animation sequence in a single pass. Image 2 is the same approved character at its original resolution; use it for identity and brushwork, not as another character. Keep pose 1 close to the approved starting pose.\nAction: ${input.action}\n` +
      `The output must be exactly ${grid.width}x${grid.height} pixels, divided into ${grid.columns} columns and ${grid.rows} rows of ${grid.cellSize}x${grid.cellSize} square cells with NO external margin or gaps between cells. ` +
      `Draw exactly ${input.frames} distinct articulated poses, one complete character in each cell, ordered left-to-right then top-to-bottom. Loop phases: ${phases}. ` +
      'The last pose must flow naturally into the first, without duplicating the first frame. Keep the original hand-painted brushwork, identity, clothing, props, lighting, camera and facing direction consistent. ' +
      'Keep subject scale, camera and ground baseline fixed across cells. Airborne poses must actually lift above that baseline. Keep the entire subject inside each cell with at least 8% transparent padding on every side. ' +
      'Retain the soft gouache/storybook texture and antialiased edges of the reference; do not convert it into pixel art, vector art or 3D. ' +
      'Change the actual limb positions and expressions through the action. Never merely move, rotate, stretch or duplicate the whole reference image. Do not invent limbs or faces. ' +
      'Use actual transparent alpha everywhere outside the subject. No background, checkerboard drawing, grid lines, dividers, borders, text, labels, frame numbers, watermarks or extra characters.',
  };
}
export function normalizeAtlas(result: unknown, count: 4 | 8 | 12): GeneratedAtlas {
  const value = result as { data?: { b64_json?: unknown }[] } | null;
  if (!value || !Array.isArray(value.data) || value.data.length !== 1) throw new Error('OpenAI 未回傳動作圖集。');
  const image = pngInfo(value.data[0]?.b64_json, true); const grid = generatedAtlasLayout(count);
  if (image.width !== grid.width || image.height !== grid.height) throw new Error('生成圖集的尺寸與影格排版不相符。');
  return { image: image.url, columns: grid.columns, rows: grid.rows, width: image.width, height: image.height };
}
const providerError = (status: number, code?: string) => status === 401 ? 'OpenAI API token 無效，請重新輸入。'
  : code === 'insufficient_quota' || code === 'billing_hard_limit_reached' ? 'OpenAI API 額度不足，請檢查帳戶用量與付款設定。'
  : status === 403 ? 'OpenAI 帳戶未獲准使用此圖像模型。' : status === 404 ? 'OpenAI 帳戶無法使用指定圖像模型，請檢查 OPENAI_IMAGE_MODEL。'
  : status === 429 ? 'OpenAI 請求達到速率限制，請稍後再試。' : `OpenAI 圖像生成失敗（${status}）。`;
const uncertainMessage = '生成連線中斷，無法確認結果。請先檢查 OpenAI API 用量，確認後再處理此工作，避免重複付費。';

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
