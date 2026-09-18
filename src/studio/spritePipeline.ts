import { generatedAtlasLayout, motions, type SheetSettings } from './animation';

/** Adapted from OpenAI game-studio's sprite-pipeline. See docs/SPRITE_PIPELINE.md. */
export const spritePipelineVersion = 'openai-sprite-pipeline-v1';
export type SpritePipeline = { version: typeof spritePipelineVersion; motion: SheetSettings['motion']; reference: string; normalized?: boolean };
export type Bounds = { x: number; y: number; width: number; height: number };
type Pixels = { width: number; height: number; data: Uint8ClampedArray };

export function spriteBounds({ width, height, data }: Pixels): Bounds {
  let left = width, top = height, right = -1, bottom = -1, occupied = 0, transparent = 0, edges = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3]!;
    if (alpha === 0) transparent++;
    if (alpha <= 8) continue;
    occupied++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    if (alpha > 40 && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) edges++;
  }
  if (occupied < 16 || transparent < width * height * .05) throw new Error('生成影格缺少角色或透明背景，請調整動作描述後再試。');
  if (edges > 8) throw new Error('角色跨越影格邊界，請調整描述再生成。');
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** One shared scale, never fit each pose separately. Airborne/custom poses keep relative offsets. */
export function normalizationPlan(bounds: Bounds[], anchor: Bounds, motion: SheetSettings['motion'], size = 256) {
  if (!bounds.length) throw new Error('沒有可整理的角色影格。');
  const all = [...bounds, anchor];
  const preserveMotion = motion === 'jump' || motion === 'run' || motion === 'custom';
  const left = Math.min(...all.map(b => b.x)), top = Math.min(...all.map(b => b.y));
  const right = Math.max(...all.map(b => b.x + b.width)), bottom = Math.max(...all.map(b => b.y + b.height));
  const maxWidth = preserveMotion ? right - left : Math.max(...all.map(b => b.width));
  const maxHeight = preserveMotion ? bottom - top : Math.max(...all.map(b => b.height));
  const padding = Math.ceil(size * .08);
  const scale = Math.min((size - 2 * padding) / maxWidth, (size - 2 * padding) / maxHeight);
  const positions = bounds.map(b => ({
    x: preserveMotion ? (size - (right - left) * scale) / 2 - left * scale : (size - b.width * scale) / 2 - b.x * scale,
    y: size - padding - (preserveMotion ? bottom : b.y + b.height) * scale,
  }));
  return { scale, positions, alignment: preserveMotion ? 'shared-origin' as const : 'bottom-center' as const };
}

export function buildReferenceCanvas(reference: HTMLCanvasElement, count: 4 | 8 | 12) {
  const grid = generatedAtlasLayout(count); const canvas = document.createElement('canvas');
  canvas.width = grid.width; canvas.height = grid.height;
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(reference, 0, 0, grid.cellSize, grid.cellSize);
  return canvas;
}

export async function normalizePoseFrames(frames: HTMLCanvasElement[], pipeline: SpritePipeline) {
  if (pipeline.version !== spritePipelineVersion || !Object.hasOwn(motions, pipeline.motion) || typeof pipeline.reference !== 'string' || pipeline.reference.length > 2_000_000
    || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(pipeline.reference)) throw new Error('角色參考影格格式不正確。');
  const image = new Image(); image.src = pipeline.reference; await image.decode();
  if (image.width !== 256 || image.height !== 256) throw new Error('角色參考影格尺寸不正確。');
  const size = frames[0]!.width; const anchor = document.createElement('canvas'); anchor.width = anchor.height = size;
  const ctx = anchor.getContext('2d')!; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, size, size);
  const boundsOf = (frame: HTMLCanvasElement) => spriteBounds(frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height));
  const plan = normalizationPlan(frames.map(boundsOf), boundsOf(anchor), pipeline.motion);
  return frames.map((frame, i) => {
    const output = document.createElement('canvas'); output.width = output.height = 256;
    const context = output.getContext('2d')!; context.imageSmoothingQuality = 'high';
    context.drawImage(frame, plan.positions[i]!.x, plan.positions[i]!.y, frame.width * plan.scale, frame.height * plan.scale);
    return output;
  });
}
