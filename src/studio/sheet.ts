import { frameTransform, sheetLayout } from './animation';
import { renderSprite } from './draw';
import { exportDesign, parseRecipe, type Recipe } from './recipe';
import type { StudioContext } from './catalog';
import { pngBlob, zipFiles } from './download';

export async function renderSheet(recipe: Recipe): Promise<HTMLCanvasElement> {
  const snapshot = parseRecipe(recipe);
  const base = document.createElement('canvas'); await renderSprite(base, snapshot);
  const canvas = document.createElement('canvas');
  const layout = sheetLayout(snapshot.size, snapshot.sheet);
  canvas.width = layout.width; canvas.height = layout.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('未能啟動 Canvas 2D。');
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < snapshot.sheet.frames; i++) {
    const x = i % layout.columns * snapshot.size, y = Math.floor(i / layout.columns) * snapshot.size;
    const motion = frameTransform(snapshot.sheet, i);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, snapshot.size, snapshot.size); ctx.clip();
    ctx.translate(x + snapshot.size / 2, y + snapshot.size * (.5 + motion.y));
    ctx.rotate(motion.angle); ctx.scale(motion.xScale, motion.yScale);
    ctx.drawImage(base, -snapshot.size / 2, -snapshot.size / 2); ctx.restore();
  }
  return canvas;
}
/** Aseprite-style JSON hash, with fixed full-size frames and a center pivot. */
export function sheetMetadata(recipe: Recipe, image: string) {
  const { size, sheet } = recipe; const layout = sheetLayout(size, sheet);
  const frames = Object.fromEntries(Array.from({ length: sheet.frames }, (_, i) => [
    `${recipe.sprite}-${sheet.motion}-${String(i).padStart(3, '0')}`, {
      frame: { x: i % layout.columns * size, y: Math.floor(i / layout.columns) * size, w: size, h: size },
      rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: size, h: size },
      sourceSize: { w: size, h: size }, pivot: { x: .5, y: .5 },
      duration: Math.round((i + 1) * 1000 / sheet.fps) - Math.round(i * 1000 / sheet.fps),
    },
  ]));
  return { frames, meta: { app: '小小素材工房', version: '1', image, format: 'RGBA8888',
    size: { w: layout.width, h: layout.height }, scale: '1', fps: sheet.fps,
    frameTags: [{ name: sheet.motion, from: 0, to: sheet.frames - 1, direction: 'forward' }],
  } };
}
export async function sheetPack(recipe: Recipe, context: StudioContext): Promise<Blob> {
  const snapshot = parseRecipe(recipe); const destination = { ...context };
  const canvas = await renderSheet(snapshot); const png = await pngBlob(canvas);
  const encode = (text: string) => new TextEncoder().encode(text);
  return zipFiles([
    { name: 'sprite.png', bytes: new Uint8Array(await png.arrayBuffer()) },
    { name: 'sprite.json', bytes: encode(JSON.stringify(sheetMetadata(snapshot, 'sprite.png'), null, 2)) },
    { name: 'design.json', bytes: encode(exportDesign(destination, snapshot)) },
    { name: 'README.txt', bytes: encode(`小小素材工房 · 2D sprite sheet\n\nsprite.png：透明圖集，從左到右、從上到下播放。\nsprite.json：Aseprite JSON hash 格式的影格座標、時間與動畫標籤。\ndesign.json：可載回素材工房的設計檔。\n\n每格 ${snapshot.size} × ${snapshot.size} px，共 ${snapshot.sheet.frames} 格，${snapshot.sheet.fps} FPS。\n固定中心 pivot (0.5, 0.5)，未裁切；多餘格保持透明。\n動作是原插畫的整體位移、旋轉或縮放，不是四方向或骨架動作。\n`) },
  ]);
}
