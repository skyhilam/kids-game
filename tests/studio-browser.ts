import { modelNames, models } from '../src/studio/catalog';
import { originalSprite, renderSprite } from '../src/studio/draw';
import { generateRecipe, initialRecipe, type Recipe } from '../src/studio/recipe';
import { generatedAtlasLayout, sheetLayout } from '../src/studio/animation';
import { renderSheet, sheetMetadata, sheetPack } from '../src/studio/sheet';
import { actionFrames } from '../src/studio/actionFrames';
import { importAnimation, generatedFrames, sourceKey } from '../src/studio/generation';
import { buildReferenceCanvas, normalizePoseFrames, spriteBounds, spritePipelineVersion } from '../src/studio/spritePipeline';

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
  const action = initialRecipe('car'); const poses = await actionFrames(action);
  assert(poses.length === 8 && new Set(poses.map(pose => pose.toDataURL())).size === 8, 'missing independent action poses');
  const sample = (index: number) => poses[index]!.getContext('2d')!.getImageData(0, 0, 512, 480).data;
  const up = sample(0), blink = sample(4), out = sample(6);
  function alphaDifference(a: Uint8ClampedArray, b: Uint8ClampedArray, rect: number[]) {
    let changed = 0;
    for (let y = rect[1]!; y < rect[3]!; y++) for (let x = rect[0]!; x < rect[2]!; x++) {
      const i = (y * 512 + x) * 4 + 3; if (Math.abs(a[i]! - b[i]!) > 80) changed++;
    }
    return changed;
  }
  function darkPixels(data: Uint8ClampedArray) {
    let dark = 0;
    for (let y = 120; y < 205; y++) for (let x = 150; x < 300; x++) {
      const i = (y * 512 + x) * 4;
      if (data[i + 3]! > 200 && data[i]! < 90 && data[i + 1]! < 75 && data[i + 2]! < 65) dark++;
    }
    return dark;
  }
  const handChange = alphaDifference(up, out, [320, 90, 500, 255]);
  const openEyePixels = darkPixels(up), closedEyePixels = darkPixels(blink);
  assert(handChange > 1500, `authored waving hand does not change silhouette: ${handChange}`);
  assert(closedEyePixels < openEyePixels * .75, `authored blink is missing: ${openEyePixels}/${closedEyePixels}`);
  for (const index of [0, 4, 6]) {
    const figure = document.createElement('figure'); const preview = document.createElement('canvas');
    preview.width = 256; preview.height = 240; preview.getContext('2d')!.drawImage(poses[index]!, 0, 0, 256, 240);
    const label = document.createElement('figcaption'); label.textContent = ['手臂抬起', '眼睛閉合', '手臂伸出'][[0, 4, 6].indexOf(index)]!;
    figure.append(preview, label); document.querySelector('#gallery')!.append(figure);
  }
  let actionSheets = 0;
  for (const size of [64, 128, 256, 512] as const) for (const columns of [1, 2, 4, 8] as const) for (const mirror of [false, true]) {
    const recipe = { ...action, size, mirror, detail: 1, variant: 2, scale: 100, sheet: { ...action.sheet, columns } };
    const sheet = await renderSheet(recipe); actionSheets++;
    const layout = sheetLayout(size, recipe.sheet); assert(sheet.width === layout.width && sheet.height === layout.height, 'action sheet layout');
    for (let i = 0; i < 8; i++) {
      const data = sheet.getContext('2d')!.getImageData(i % layout.columns * size, Math.floor(i / layout.columns) * size, size, size).data;
      let edges = 0;
      for (let j = 0; j < size; j++) edges += Number(data[j * 4 + 3]! > 20) + Number(data[((size - 1) * size + j) * 4 + 3]! > 20)
        + Number(data[(j * size) * 4 + 3]! > 20) + Number(data[(j * size + size - 1) * 4 + 3]! > 20);
      assert(edges === 0, `action clipped at size ${size}, frame ${i}`);
    }
  }
  const coloredPoses = await actionFrames({ ...action, primary: '#649FAE' });
  assert(coloredPoses[0]!.toDataURL() !== poses[0]!.toDataURL(), 'action palette ignored');
  const pack = await sheetPack(action, { game: 'picnic', level: 1 });
  assert(new DataView(await pack.arrayBuffer()).getUint32(0, true) === 0x04034b50, 'sprite pack ZIP header');
  // Exercise the generated-frame path with explicitly labelled local fixtures, without claiming a live AI generation.
  const generationRecipe = { ...initialRecipe('car'), sheet: { ...initialRecipe('car').sheet, motion: 'wave' as const } };
  generationRecipe.sheet = { ...generationRecipe.sheet, generationId: 'b'.repeat(64), sourceKey: sourceKey(generationRecipe) } as typeof generationRecipe.sheet;
  const fixtureImages = [];
  for (const pose of poses) {
    const frame = document.createElement('canvas'); await renderSprite(frame, action, pose); fixtureImages.push(frame.toDataURL());
  }
  const fixture = { id: 'b'.repeat(64), status: 'completed', sprite: 'car', action: 'browser test fixture', frames: 8, createdAt: new Date().toISOString(), images: fixtureImages };
  await importAnimation(fixture, generationRecipe);
  const generated = await generatedFrames(generationRecipe);
  assert(generated.map(frame => frame.toDataURL()).join() === fixtureImages.join(), 'generated poses altered during decode');
  const generatedSheet = await renderSheet(generationRecipe);
  const firstCrop = document.createElement('canvas'); firstCrop.width = firstCrop.height = 256;
  firstCrop.getContext('2d')!.drawImage(generatedSheet, 0, 0, 256, 256, 0, 0, 256, 256);
  assert(firstCrop.toDataURL() === fixtureImages[0], 'generated frames were transformed again');
  let duplicateRejected = false;
  try { await importAnimation({ ...fixture, images: Array(8).fill(fixtureImages[0]) }, generationRecipe); } catch { duplicateRejected = true; }
  assert(duplicateRejected, 'duplicate static frames accepted as new poses');
  let opaqueRejected = false;
  const opaque = document.createElement('canvas'); opaque.width = opaque.height = 256;
  opaque.getContext('2d')!.fillRect(0, 0, 256, 256);
  try { await importAnimation({ ...fixture, images: [opaque.toDataURL(), ...fixtureImages.slice(1)] }, generationRecipe); } catch { opaqueRejected = true; }
  assert(opaqueRejected, 'opaque background accepted');
  const generatedPack = await sheetPack(generationRecipe, { game: 'picnic', level: 1 });
  const packBytes = new Uint8Array(await generatedPack.arrayBuffer()); const packView = new DataView(packBytes.buffer);
  let offset = 0, designHasPoses = false;
  while (packView.getUint32(offset, true) === 0x04034b50) {
    const length = packView.getUint32(offset + 18, true), nameLength = packView.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(packBytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength;
    if (name === 'design.json') {
      const design = JSON.parse(new TextDecoder().decode(packBytes.slice(start, start + length)));
      designHasPoses = design.animation.images.length === 8 && design.animation.images[0] === fixtureImages[0];
    }
    offset = start + length;
  }
  assert(designHasPoses, 'portable ZIP design lost generated poses');
  // OpenAI returns one atlas; verify row-major splitting for 4/8/12 poses.
  let atlasChecks = 0;
  const atlasIds: string[] = [];
  for (const count of [4, 8, 12] as const) {
    const grid = generatedAtlasLayout(count);
    const poseAtlas = document.createElement('canvas'); poseAtlas.width = grid.width; poseAtlas.height = grid.height;
    const atlasContext = poseAtlas.getContext('2d')!;
    for (let i = 0; i < count; i++) {
      const image = new Image(); image.src = fixtureImages[i % 8]!; await image.decode();
      atlasContext.drawImage(image, i % grid.columns * grid.cellSize, Math.floor(i / grid.columns) * grid.cellSize, grid.cellSize, grid.cellSize);
    }
    const id = String(count === 4 ? 'c' : count === 8 ? 'd' : 'e').repeat(64); atlasIds.push(id);
    const atlasRecipe: Recipe = { ...initialRecipe('car'), sheet: { ...initialRecipe('car').sheet, motion: 'wave', frames: count } };
    atlasRecipe.sheet = { ...atlasRecipe.sheet, generationId: id, sourceKey: sourceKey(atlasRecipe) };
    const atlasJob = { ...fixture, id, frames: count, images: undefined, atlas: { image: poseAtlas.toDataURL(), columns: grid.columns, rows: grid.rows, width: grid.width, height: grid.height } };
    await importAnimation(atlasJob, atlasRecipe);
    const split = await generatedFrames(atlasRecipe);
    assert(split.length === count, `OpenAI atlas lost poses: ${count}`);
    for (let i = 0; i < count; i++) {
      const expected = document.createElement('canvas'); expected.width = expected.height = 256;
      const ctx = expected.getContext('2d')!; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(poseAtlas, i % grid.columns * grid.cellSize, Math.floor(i / grid.columns) * grid.cellSize, grid.cellSize, grid.cellSize, 0, 0, 256, 256);
      // PNG decoding and non-integer downsampling can round premultiplied alpha differently.
      const expectedPixels = ctx.getImageData(0, 0, 256, 256).data;
      const actualPixels = split[i]!.getContext('2d')!.getImageData(0, 0, 256, 256).data;
      let errorSum = 0, samples = 0;
      for (let p = 0; p < expectedPixels.length; p += 4) {
        errorSum += Math.abs(expectedPixels[p + 3]! - actualPixels[p + 3]!); samples++;
        if (Math.min(expectedPixels[p + 3]!, actualPixels[p + 3]!) > 20) for (let channel = 0; channel < 3; channel++) {
          errorSum += Math.abs(expectedPixels[p + channel]! - actualPixels[p + channel]!); samples++;
        }
      }
      assert(errorSum / samples < 1, `OpenAI atlas frame order changed: ${count}/${i}, pixel error ${errorSum / samples}`);
    }
    atlasChecks++;
    // A border-crossing image is rejected rather than exported as clipped poses.
    atlasContext.fillStyle = '#ff0000'; atlasContext.fillRect(0, 0, grid.width, 20);
    let clippedRejected = false;
    try { await importAnimation({ ...atlasJob, images: undefined, atlas: { columns: grid.columns, rows: grid.rows, width: grid.width, height: grid.height, image: poseAtlas.toDataURL() } }, atlasRecipe); } catch (error) { clippedRejected = (error as Error).message.includes('影格邊界'); }
    assert(clippedRejected, `OpenAI atlas clipping accepted: ${count}`);
  }
  // Remove only this harness's fixture from the browser's saved animation database.
  const reference = document.createElement('canvas'); await renderSprite(reference, initialRecipe('bear'));
  let referenceChecks = 0;
  for (const count of [4, 8, 12] as const) {
    const guide = buildReferenceCanvas(reference, count); const grid = generatedAtlasLayout(count);
    const pixels = guide.getContext('2d')!.getImageData(0, 0, guide.width, guide.height).data;
    let firstCell = 0, otherCells = 0;
    for (let y = 0; y < guide.height; y++) for (let x = 0; x < guide.width; x++) if (pixels[(y * guide.width + x) * 4 + 3]! > 8) {
      if (x < grid.cellSize && y < grid.cellSize) firstCell++; else otherCells++;
    }
    assert(firstCell > 100 && otherCells === 0, `reference guide must contain only the approved first frame: ${count}`); referenceChecks++;
  }
  const pixelBounds = (frame: HTMLCanvasElement) => spriteBounds(frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height));
  const jumpPoses = [130, 70].map(y => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d')!.fillRect(80, y, 70, 60); return c; });
  const pipeline = { version: spritePipelineVersion, motion: 'jump' as const, reference: jumpPoses[0]!.toDataURL() };
  const jumped = await normalizePoseFrames(jumpPoses, pipeline);
  assert(pixelBounds(jumped[0]!).y > pixelBounds(jumped[1]!).y + 50, 'normalization flattened the jump');
  const grounded = await normalizePoseFrames(jumpPoses, { ...pipeline, motion: 'wave' });
  assert(JSON.stringify(pixelBounds(grounded[0]!)) === JSON.stringify(pixelBounds(grounded[1]!)), 'grounded frames were not aligned');
  const pipelineRecipe = { ...generationRecipe, sheet: { ...generationRecipe.sheet, generationId: 'f'.repeat(64) } };
  const pipelineJob = { ...fixture, id: 'f'.repeat(64), images: [...fixtureImages], pipeline: { version: spritePipelineVersion, motion: 'wave' as const, reference: fixtureImages[0]! } };
  await importAnimation(pipelineJob, pipelineRecipe); atlasIds.push(pipelineJob.id);
  const normalized = (await generatedFrames(pipelineRecipe)).map(frame => frame.toDataURL());
  await importAnimation(pipelineJob, pipelineRecipe);
  assert(normalized.join() === (await generatedFrames(pipelineRecipe)).map(frame => frame.toDataURL()).join(), 're-import normalized the same frames twice');
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('picnic-action-frames-v1', 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('actions', 'readwrite'); for (const id of [fixture.id, ...atlasIds]) tx.objectStore('actions').delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = reject; };
    request.onerror = reject;
  });
  const report = { models: modelNames.length, renders, actionSheets, handChange, openEyePixels, closedEyePixels, pngBytes: png.size, zipBytes: pack.size, atlasChecks, referenceChecks, pipelineNormalization: true, generatedPackBytes: generatedPack.size, portablePoses: designHasPoses, duplicateRejected, opaqueRejected, failures };
  document.querySelector('#report')!.textContent = JSON.stringify(report, null, 2);
  document.querySelector('#status')!.textContent = failures.length ? `FAIL: ${failures.length} checks failed` : `PASS: ${modelNames.length} models / ${renders} renders / ${actionSheets} action sheets / portable generated-frame fixture`;
  document.body.dataset.result = failures.length ? 'fail' : 'pass';
}
verify().catch(error => { document.querySelector('#status')!.textContent = `FAIL: ${String(error)}`; document.body.dataset.result = 'fail'; });
