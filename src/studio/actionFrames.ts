import carAtlas from '../assets/picnic/car-drive/sprites.png';
import carAction from '../assets/picnic/car-drive/manifest.json';
import { materials, recolorPixels } from './materials';
import type { Recipe } from './recipe';

let imagePromise: Promise<HTMLImageElement> | undefined;
const frameCache = new Map<string, HTMLCanvasElement[]>();
function loadImage() {
  return imagePromise ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => { imagePromise = undefined; reject(new Error('未能載入小車動作原畫。')); };
    image.src = carAtlas;
  });
}
/** Independent painted poses, registered by chassis position rather than moving hands. */
export async function actionFrames(recipe: Recipe): Promise<HTMLCanvasElement[]> {
  if (recipe.sprite !== 'car' || recipe.sheet.motion !== 'drive') throw new Error('這個素材沒有指定的角色動作。');
  const key = `${recipe.primary.toUpperCase()}:${recipe.secondary.toUpperCase()}`;
  const existing = frameCache.get(key); if (existing) return existing;
  const image = await loadImage();
  const frames = carAction.frames.map(entry => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 480;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('未能啟動 Canvas 2D。');
    const [x, y, width, height] = entry.rect;
    const [left, , right, bottom] = entry.bodyBounds;
    const fit = 472 / (right! - left!);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x!, y!, width!, height!, 256 - (left! + right!) / 2 * fit, 412 - bottom! * fit, width! * fit, height! * fit);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    recolorPixels(pixels.data, canvas.width, canvas.height, 'car', recipe.primary, recipe.secondary, {
      primary: { ...materials.car.primary, area: [0, .45, 1, 1], exclude: [[.42, .38, .28, .24], [.75, .37, .22, .23]] },
      secondary: materials.car.secondary,
    });
    ctx.putImageData(pixels, 0, 0); return canvas;
  });
  if (frameCache.size >= 8) frameCache.delete(frameCache.keys().next().value!);
  frameCache.set(key, frames); return frames;
}
