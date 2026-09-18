import { atlases, sprites } from '../art/sprites';
import { mulberry32 } from '../game/rng';
import type { ModelName } from './catalog';
import { materials, recolorPixels } from './materials';
import type { Recipe } from './recipe';

const atlasImages = new Map<string, Promise<HTMLImageElement>>();
const originals = new Map<ModelName, Promise<HTMLCanvasElement>>();
const painted = new Map<string, HTMLCanvasElement>();
const renderJobs = new WeakMap<HTMLCanvasElement, number>();
function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('這個瀏覽器未能啟動 Canvas 2D。');
  return ctx;
}
function loadAtlas(src: string): Promise<HTMLImageElement> {
  const existing = atlasImages.get(src);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { atlasImages.delete(src); reject(new Error('未能載入遊戲原畫，請重新載入後再試。')); };
    image.src = src;
  });
  atlasImages.set(src, promise); return promise;
}
/** Crop exactly the registered frame, preserving alpha, expression and brushwork. */
export function originalSprite(name: ModelName): Promise<HTMLCanvasElement> {
  const existing = originals.get(name);
  if (existing) return existing;
  const promise = (async () => {
    const definition = sprites[name]; const [x, y, width, height] = definition.frame;
    const image = await loadAtlas(atlases[definition.atlas].src);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    getContext(canvas).drawImage(image, x, y, width, height, 0, 0, width, height);
    return canvas;
  })().catch(error => { originals.delete(name); throw error; });
  originals.set(name, promise); return promise;
}
async function materialSprite(recipe: Recipe): Promise<HTMLCanvasElement> {
  const key = `${recipe.sprite}:${recipe.primary}:${recipe.secondary}`;
  const cached = painted.get(key); if (cached) return cached;
  const source = await originalSprite(recipe.sprite);
  const native = materials[recipe.sprite];
  if (recipe.primary.toUpperCase() === native.primary.color && recipe.secondary.toUpperCase() === native.secondary.color) return source;
  const prepared = painted.get(key); if (prepared) return prepared;
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = getContext(canvas); ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorPixels(pixels.data, canvas.width, canvas.height, recipe.sprite, recipe.primary, recipe.secondary);
  ctx.putImageData(pixels, 0, 0);
  if (painted.size >= 48) painted.delete(painted.keys().next().value!);
  painted.set(key, canvas); return canvas;
}
function drawFitted(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, cx: number, cy: number, box: number) {
  const scale = box / Math.max(image.width, image.height);
  const width = image.width * scale, height = image.height * scale;
  ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height);
}
/** Compose the game's painted parts. Latest requested render wins after image loading. */
export async function renderSprite(canvas: HTMLCanvasElement, recipe: Recipe): Promise<void> {
  const job = (renderJobs.get(canvas) ?? 0) + 1; renderJobs.set(canvas, job);
  const snapshot = { ...recipe };
  const [source, ornament] = await Promise.all([
    materialSprite(snapshot),
    snapshot.detail ? originalSprite(snapshot.detail === 1 ? 'flower' : 'sun') : Promise.resolve(null),
  ]);
  if (renderJobs.get(canvas) !== job) return;
  canvas.width = snapshot.size; canvas.height = snapshot.size;
  const ctx = getContext(canvas); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.translate(snapshot.size / 2, snapshot.size / 2);
  const scale = snapshot.size / 128 * snapshot.scale / 100;
  ctx.scale(snapshot.mirror ? -scale : scale, scale);
  const angle = snapshot.variant === 1 ? -.07 : snapshot.variant === 2 ? .07 : 0;
  ctx.save(); ctx.rotate(angle);
  drawFitted(ctx, source, 0, snapshot.detail ? -3 : 0, snapshot.detail ? 98 : 112);
  ctx.restore();
  if (ornament) {
    const rand = mulberry32(snapshot.seed);
    const x = (rand() > .5 ? -1 : 1) * (38 + rand() * 3);
    const y = snapshot.detail === 1 ? 37 : -37;
    ctx.save(); ctx.translate(x, y); ctx.rotate((rand() - .5) * .18);
    drawFitted(ctx, ornament, 0, 0, 23 + rand() * 3); ctx.restore();
  }
}
export async function spriteDataUrl(recipe: Recipe): Promise<string> {
  const canvas = document.createElement('canvas'); await renderSprite(canvas, recipe); return canvas.toDataURL('image/png');
}
