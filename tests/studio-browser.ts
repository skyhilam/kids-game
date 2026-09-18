import { modelNames, models } from '../src/studio/catalog';
import { originalSprite, renderSprite } from '../src/studio/draw';
import { generateRecipe, initialRecipe, type Recipe } from '../src/studio/recipe';
import { motions, sheetLayout } from '../src/studio/animation';
import { renderSheet, sheetMetadata, sheetPack } from '../src/studio/sheet';

// Real browser Canvas checks: visit /kids-game/tests/studio-browser.html with the Vite dev server.
const failures: string[] = [];
let renders = 0;
const canvas = document.createElement('canvas');
function assert(ok: boolean, description: string) { if (!ok) failures.push(description); }
async function measure(recipe: Recipe) {
  await renderSprite(canvas, recipe); renders++;
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let occupied = 0; let edge = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const alpha = data[(y * canvas.width + x) * 4 + 3]!;
    if (alpha > 20) { occupied++; if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edge++; }
  }
  assert(occupied > canvas.width * canvas.height * .015, `${recipe.sprite}: missing artwork`);
  assert(edge === 0, `${recipe.sprite}: clipped artwork (${recipe.variant}, ${recipe.detail})`);
  assert(occupied < canvas.width * canvas.height * .8, `${recipe.sprite}: transparent background missing`);
  return canvas.toDataURL();
}
async function verify() {
  for (const sprite of modelNames) {
    const base = initialRecipe(sprite);
    const figure = document.createElement('figure'); const preview = document.createElement('canvas');
    await renderSprite(preview, base); figure.append(preview);
    const label = document.createElement('figcaption'); label.textContent = `${models[sprite].label} · ${sprite}`;
    figure.append(label); document.querySelector('#gallery')!.append(figure);
    for (const variant of [0, 1, 2]) for (const detail of [0, 1, 2]) for (const mirror of [false, true]) {
      await measure({ ...base, variant, detail, mirror, scale: 100, size: 64 });
    }
    for (const size of [64, 128, 256, 512] as const) {
      await measure({ ...base, size }); assert(canvas.width === size && canvas.height === size, `${sprite}: output size`);
    }
    const variants = []; for (const variant of [0, 1, 2]) variants.push(await measure({ ...base, variant }));
    assert(new Set(variants).size === 3, `${sprite}: variant control has duplicate results`);
    assert(await measure(generateRecipe(sprite, 42)) === await measure(generateRecipe(sprite, 42)), `${sprite}: seed is not reproducible`);
    const source = await originalSprite(sprite);
    const reference = document.createElement('canvas'); reference.width = 256; reference.height = 256;
    const referenceContext = reference.getContext('2d')!;
    referenceContext.imageSmoothingQuality = 'high';
    referenceContext.translate(128, 128); referenceContext.scale(256 / 128 * .9, 256 / 128 * .9);
    const nativeFit = 112 / Math.max(source.width, source.height);
    referenceContext.drawImage(source, -source.width * nativeFit / 2, -source.height * nativeFit / 2, source.width * nativeFit, source.height * nativeFit);
    assert(await measure(base) === reference.toDataURL(), `${sprite}: original brushwork changed`);
    const recolored = await measure({ ...base, primary: '#649FAE', secondary: '#AF849F' });
    assert(recolored !== await measure(base), `${sprite}: material colors have no effect`);

  }
  await renderSprite(canvas, initialRecipe('car'));
  const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert(bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10', 'PNG signature');
  assert(bytes[25] === 6, 'PNG must contain an alpha channel');
  const raceCanvas = document.createElement('canvas');
  await Promise.all([renderSprite(raceCanvas, initialRecipe('kid')), renderSprite(raceCanvas, initialRecipe('car'))]);
  assert(raceCanvas.toDataURL() === canvas.toDataURL(), 'late atlas load overwrote newer selection');
  let sheets = 0, animationFrames = 0;
  for (const sprite of modelNames) for (const motion of Object.keys(motions) as (keyof typeof motions)[]) for (const frames of [4, 8, 12] as const) {
    const recipe: Recipe = { ...initialRecipe(sprite), size: 64, scale: 100, variant: 2, detail: 2, mirror: true, sheet: { motion, frames, fps: 17, columns: 8 } };
    const sheet = await renderSheet(recipe); sheets++;
    const layout = sheetLayout(recipe.size, recipe.sheet); const metadata = sheetMetadata(recipe, 'sprite.png');
    assert(sheet.width === layout.width && sheet.height === layout.height, `${sprite}: sheet dimensions`);
    const pixels = sheet.getContext('2d')!.getImageData(0, 0, sheet.width, sheet.height).data;
    const fingerprints = [];
    for (let i = 0; i < layout.columns * layout.rows; i++) {
      const left = i % layout.columns * 64, top = Math.floor(i / layout.columns) * 64;
      let occupied = 0, edge = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = pixels[((top + y) * sheet.width + left + x) * 4 + 3]!;
        if (alpha > 20) { occupied++; if (x === 0 || x === 63 || y === 0 || y === 63) edge++; }
      }
      if (i < frames) {
        animationFrames++;
        assert(occupied > 50 && occupied < 64 * 64 * .8, `${sprite}/${motion}/${i}: missing art or alpha`);
        assert(edge === 0, `${sprite}/${motion}/${i}: clipped at cell boundary`);
        const crop = document.createElement('canvas'); crop.width = 64; crop.height = 64;
        crop.getContext('2d')!.drawImage(sheet, left, top, 64, 64, 0, 0, 64, 64); fingerprints.push(crop.toDataURL());
      } else assert(occupied === 0, `${sprite}: unused sheet cell is not transparent`);
    }
    assert(new Set(fingerprints).size === 1 ? motion === 'still' : motion !== 'still', `${sprite}/${motion}: incorrect animation frames`);
    assert(Object.values(metadata.frames).reduce((total, frame) => total + frame.duration, 0) === Math.round(frames * 1000 / 17), 'animation timing drift');
  }
  const pack = await sheetPack(initialRecipe('car'), { game: 'picnic', level: 1 });
  assert(new DataView(await pack.arrayBuffer()).getUint32(0, true) === 0x04034b50, 'sprite pack ZIP header');
  const report = { models: modelNames.length, renders, sheets, animationFrames, pngBytes: png.size, zipBytes: pack.size, failures };
  document.querySelector('#report')!.textContent = JSON.stringify(report, null, 2);
  document.querySelector('#status')!.textContent = failures.length ? `FAIL: ${failures.length} checks failed` : `PASS: ${modelNames.length} models / ${renders} renders / ${sheets} sheets / ${animationFrames} animation frames`;
  document.body.dataset.result = failures.length ? 'fail' : 'pass';
}
verify().catch(error => { document.querySelector('#status')!.textContent = `FAIL: ${String(error)}`; document.body.dataset.result = 'fail'; });
