import { generatedAtlasLayout, motions, type SheetSettings } from './animation';
import { spritePipelineVersion, type SpritePipeline } from './spritePipeline';

export type GenerationInput = { sprite: string; source: string; referenceCanvas: string; motion: SheetSettings['motion']; action: string; frames: 4 | 8 | 12; seed: number };
export type GeneratedAtlas = { image: string; columns: number; rows: number; width: number; height: number };
export type GenerationJob = { id: string; status: 'submitting' | 'processing' | 'completed' | 'failed' | 'uncertain'; sprite: string; action: string; frames: number; createdAt: string; model?: string; requestId?: string; atlas?: GeneratedAtlas; images?: string[]; pipeline?: SpritePipeline; error?: string };
export const defaultImageModel = 'gpt-image-2.5-sunburst';
export const imageModels = [defaultImageModel, 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst-2026-09-08', 'gpt-image-2.5-flare-2026-09-08', 'gpt-image-2', 'gpt-image-2-2026-04-21'];
const pngPrefix = 'data:image/png;base64,';
function pngInfo(value: unknown, atlas = false) {
  if (typeof value !== 'string' || value.length > (atlas ? 20_000_000 : 2_000_000)) throw new Error('影格 PNG 格式不正確。');
  const raw = value.startsWith(pngPrefix) ? value.slice(pngPrefix.length) : value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('影格 PNG 格式不正確。');
  const bytes = Uint8Array.from(atob(raw), char => char.charCodeAt(0));
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) throw new Error('影格不是 PNG 圖片。');
  const view = new DataView(bytes.buffer); const width = view.getUint32(16), height = view.getUint32(20);
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
export function generationFingerprint(input: GenerationInput, model = defaultImageModel) {
  const { sprite, source, referenceCanvas, motion, action, frames, seed } = input;
  return JSON.stringify({ engine: spritePipelineVersion, model, sprite, source, referenceCanvas, motion, action, frames, seed });
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
export const providerError = (status: number, code?: string) => status === 401 ? 'OpenAI API token 無效，請重新輸入。'
  : code === 'insufficient_quota' || code === 'billing_hard_limit_reached' ? 'OpenAI API 額度不足，請檢查帳戶用量與付款設定。'
  : status === 403 ? 'OpenAI 帳戶未獲准使用此圖像模型。' : status === 404 ? 'OpenAI 帳戶無法使用指定圖像模型，請檢查 OPENAI_IMAGE_MODEL。'
  : status === 429 ? 'OpenAI 請求達到速率限制，請稍後再試。' : `OpenAI 圖像生成失敗（${status}）。`;
export const uncertainMessage = '生成連線中斷，無法確認結果。請先檢查 OpenAI API 用量，確認後再處理此工作，避免重複付費。';
