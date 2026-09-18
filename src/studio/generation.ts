import { ref } from 'vue';
import type { Recipe } from './recipe';
import { renderSprite } from './draw';
import { generatedAtlasLayout } from './animation';
import { buildReferenceCanvas, normalizePoseFrames } from './spritePipeline';
import { createBrowserGeneration } from './browserGeneration';
import type { GenerationJob } from './imageProvider';
export type { GenerationJob } from './imageProvider';
export type ServiceStatus = { configured: boolean; provider: string; model: string; error?: string; activeId: string | null; activeStatus?: GenerationJob['status']; transport?: 'browser' };
export const generationBusy = ref(false);
const frameCache = new Map<string, Promise<HTMLCanvasElement[]>>();
const imported = new Map<string, GenerationJob>();
function savedJob(id: string, value?: GenerationJob): Promise<GenerationJob | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('picnic-action-frames-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('actions', { keyPath: 'id' });
    open.onerror = () => reject(new Error('無法保存角色影格，請先下載素材包。'));
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('actions', value ? 'readwrite' : 'readonly');
      const request = value ? tx.objectStore('actions').put(value) : tx.objectStore('actions').get(id);
      tx.oncomplete = () => { db.close(); resolve(value ?? request.result); };
      tx.onerror = () => { db.close(); reject(new Error('影格儲存空間不足，請先下載素材包。')); };
    };
  });
}
export function sourceKey(recipe: Recipe) {
  const { sheet, size: _size, ...artwork } = recipe;
  return JSON.stringify({ ...artwork, motion: sheet.motion, prompt: sheet.prompt.trim(), frames: sheet.frames });
}
export function hasGeneratedAction(recipe: Recipe) { return !!recipe.sheet.generationId && recipe.sheet.sourceKey === sourceKey(recipe); }
export function hasBuiltInAction(recipe: Recipe) { return recipe.sprite === 'car' && recipe.sheet.motion === 'drive' && recipe.sheet.frames === 8 && !recipe.sheet.prompt.trim() && !recipe.sheet.generationId; }
const descriptions = {
  wave: 'Wave hello: elbow bends, forearm and hand move through a clear waving arc, eyes blink once.',
  walk: 'Walk in place: alternating left and right steps, knees bend, feet lift and plant, opposing arm swing.',
  run: 'Run in place: alternating bent knees and extended legs, clear flight and contact poses, opposing arm swing.',
  jump: 'Jump once: bend knees to crouch, extend legs to take off, tuck limbs in the air, land with bent knees and return to the starting pose.',
  cheer: 'Cheer: raise both arms, open the hands, smile and blink, lower the arms to return to the starting pose.',
  drive: 'Drive in place: wheels turn, the visible driver waves with a bending elbow and moving hand, blinks, and returns the hand to the starting pose. Keep the vehicle chassis anchored.',
  custom: '',
} as const;
export function actionDescription(recipe: Recipe) {
  const { motion, prompt } = recipe.sheet;
  const action = motion === 'custom' ? prompt.trim() : descriptions[motion];
  if (!action) throw new Error('請先描述角色要做的動作。');
  return `${action} ${motion !== 'custom' ? prompt.trim() : ''} Seamless loop. Preserve the reference character, proportions, colors and soft hand-painted storybook brushwork. Fixed camera and facing, transparent background. Draw distinct articulated poses. Do not animate by translating, rotating or scaling the entire image. Do not add limbs or faces that are absent in the reference.`;
}
async function api<T>(path: string, body?: unknown, apiToken?: string): Promise<T> {
  const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};
  if (body && apiToken?.trim()) headers.Authorization = `Bearer ${apiToken.trim()}`;
  const response = await fetch(`/__sprite-studio/${path}`, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60_000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('尚未連接生成服務。請從本機素材工房開啟。');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '生成服務暫時無法使用。');
  return data as T;
}
const browserGeneration = createBrowserGeneration({ read: savedJob, save: job => savedJob(job.id, job) });
export const serviceStatus = (): Promise<ServiceStatus> => import.meta.env.PROD ? browserGeneration.status() : api<ServiceStatus>('status');
export const readJob = async (id: string): Promise<GenerationJob> => imported.get(id) ?? (import.meta.env.PROD ? await browserGeneration.poll(id) : await savedJob(id).catch(() => undefined) ?? await api<GenerationJob>(`jobs/${id}`));
export const releaseUncertainAnimation = () => browserGeneration.releaseUncertain();
export async function submitAnimation(recipe: Recipe, apiToken?: string) {
  const reference = document.createElement('canvas');
  await renderSprite(reference, { ...recipe, size: 256 });
  const referenceCanvas = buildReferenceCanvas(reference, recipe.sheet.frames);
  const input = { sprite: recipe.sprite, source: reference.toDataURL('image/png'), referenceCanvas: referenceCanvas.toDataURL('image/png'), motion: recipe.sheet.motion, action: actionDescription(recipe), frames: recipe.sheet.frames, seed: recipe.seed };
  return import.meta.env.PROD ? browserGeneration.submit(input, apiToken) : api<GenerationJob>('jobs', input, apiToken);
}
export async function waitForAnimation(job: GenerationJob, onProgress: (job: GenerationJob) => void) {
  let current = job; const deadline = Date.now() + 15 * 60_000;
  while (current.status === 'processing' || current.status === 'submitting') {
    onProgress(current);
    if (Date.now() > deadline) throw new Error('生成仍在進行；稍後按「查看生成結果」可繼續讀取，不會重新付費生成。');
    await new Promise(resolve => setTimeout(resolve, 5000)); current = await readJob(current.id);
  }
  if (current.status !== 'completed') throw new Error(current.error || '角色動作生成失敗。');
  return current;
}
async function decodeFrames(job: GenerationJob): Promise<HTMLCanvasElement[]> {
  if (job.status !== 'completed' || ![4, 8, 12].includes(job.frames)) throw new Error('動作影格尚未完成。');
  let urls = job.images;
  if (!urls && job.atlas) {
    const atlas = job.atlas; const grid = generatedAtlasLayout(job.frames as 4 | 8 | 12);
    if (atlas.columns !== grid.columns || atlas.rows !== grid.rows || atlas.width !== grid.width || atlas.height !== grid.height
      || typeof atlas.image !== 'string' || atlas.image.length > 20_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(atlas.image)) throw new Error('生成圖集的排版不正確。');
    const image = new Image(); image.src = atlas.image; await image.decode();
    if (image.width !== grid.width || image.height !== grid.height) throw new Error('生成圖集的尺寸不相符。');
    urls = [];
    for (let i = 0; i < job.frames; i++) {
      const frame = document.createElement('canvas'); frame.width = frame.height = 256;
      const ctx = frame.getContext('2d')!; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, i % grid.columns * grid.cellSize, Math.floor(i / grid.columns) * grid.cellSize, grid.cellSize, grid.cellSize, 0, 0, 256, 256);
      const data = ctx.getImageData(0, 0, 256, 256).data;
      let occupiedEdge = 0;
      for (let j = 0; j < 256; j++) occupiedEdge += Number(data[j * 4 + 3]! > 40) + Number(data[(255 * 256 + j) * 4 + 3]! > 40)
        + Number(data[(j * 256) * 4 + 3]! > 40) + Number(data[(j * 256 + 255) * 4 + 3]! > 40);
      if (occupiedEdge > 8) throw new Error('角色跨越影格邊界，這次圖集未能正確切格，請調整描述再生成。');
      urls.push(frame.toDataURL('image/png'));
    }
  }
  if (!Array.isArray(urls) || urls.length !== job.frames) throw new Error('動作影格數量不正確。');
  let frames: HTMLCanvasElement[] = [];
  for (const url of urls) {
    if (typeof url !== 'string' || url.length > 2_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(url)) throw new Error('動作影格格式不正確。');
    const image = new Image(); image.src = url; await image.decode();
    if (image.width < 16 || image.width > 256 || image.height < 16 || image.height > 256) throw new Error('動作影格尺寸不正確。');
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    let opaque = 0, transparent = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i]! > 20) opaque++; if (data[i]! === 0) transparent++; }
    if (opaque < 16 || transparent < image.width * image.height * .05) throw new Error('生成影格缺少角色或透明背景，請調整動作描述後再試。');
    if (frames[0] && (frames[0].width !== canvas.width || frames[0].height !== canvas.height)) throw new Error('動作影格尺寸不一致。');
    frames.push(canvas);
  }
  const needsNormalization = job.pipeline && !job.pipeline.normalized;
  if (needsNormalization) frames = await normalizePoseFrames(frames, job.pipeline!);
  const frameUrls = frames.map(frame => frame.toDataURL());
  if (new Set(frameUrls).size < 2) throw new Error('影格內容完全相同，未生成角色動作。');
  // Store portable frame images only after every cell passes validation.
  job.images = needsNormalization ? frameUrls : urls; delete job.atlas;
  if (job.pipeline) job.pipeline.normalized = true;
  return frames;
}
export async function generatedFrames(recipe: Recipe) {
  if (!hasGeneratedAction(recipe)) throw new Error('素材或動作已變更，請先生成新的角色動作。');
  const id = recipe.sheet.generationId!;
  if (!frameCache.has(id)) {
    if (frameCache.size >= 8) frameCache.delete(frameCache.keys().next().value!);
    const pending = readJob(id).then(job => { if (job.sprite !== recipe.sprite || job.frames !== recipe.sheet.frames) throw new Error('角色動作與素材不相符。'); return decodeFrames(job).then(async frames => { imported.set(id, job); await savedJob(id, job).catch(() => undefined); return frames; }); });
    frameCache.set(id, pending); pending.catch(() => frameCache.delete(id));
  }
  return frameCache.get(id)!;
}
/** Portable design exports include poses, so reopening them does not need a live provider. */
export async function importAnimation(value: unknown, recipe: Recipe) {
  const job = value as GenerationJob | null;
  if (!job || job.id !== recipe.sheet.generationId || job.sprite !== recipe.sprite || job.frames !== recipe.sheet.frames || !hasGeneratedAction(recipe)) throw new Error('設計檔的角色動作不相符。');
  const frames = await decodeFrames(job); await savedJob(job.id, job); imported.set(job.id, job); frameCache.set(job.id, Promise.resolve(frames));
}
