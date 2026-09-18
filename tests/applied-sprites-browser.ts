import { createApp, h, nextTick } from 'vue';
import GameSprite from '../src/components/GameSprite.vue';
import PicnicBoard from '../src/components/PicnicBoard.vue';
import { createGame } from '../src/game/rules';
import { LEVELS } from '../src/picnic/levels';
import { initialRecipe } from '../src/studio/recipe';
import { importAnimation, sourceKey } from '../src/studio/generation';
import { activeSprites, applySprite, library, restoreSprite, STORAGE_KEY, storageWarning } from '../src/studio/store';

// Exercise the real board and renderer with labelled local poses, without an AI request.
export async function verifyAppliedPlayback(images: string[], assert: (ok: boolean, message: string) => void) {
  const saved = localStorage.getItem(STORAGE_KEY), previousLibrary = library.value;
  const previousSprites = activeSprites.value, previousWarning = storageWarning.value;
  const recipe = initialRecipe('car-top');
  recipe.sheet = { ...recipe.sheet, frames: 8, fps: 12, columns: 4, generationId: 'a'.repeat(64) };
  recipe.sheet.sourceKey = sourceKey(recipe);
  const host = document.createElement('div'); document.body.append(host);
  const { graph, state } = createGame(LEVELS);
  const app = createApp({ render: () => h('div', [
    h(PicnicBoard, { graph, state, interactive: false, narrow: false, facing: 0, hintNode: null, inFlight: null }),
    h(GameSprite, { name: 'car-top', original: true, label: 'Original comparison' }),
  ]) });
  try {
    await importAnimation({ id: recipe.sheet.generationId, status: 'completed', sprite: 'car-top', action: 'browser playback fixture', frames: 8, createdAt: new Date().toISOString(), images }, recipe);
    app.mount(host);
    await applySprite(recipe); await nextTick();
    const player = host.querySelector<SVGSVGElement>('#carBody [data-sprite="car-top"]')!;
    assert(player.dataset.animated === 'true', 'applied action missing from the actual picnic board');
    assert(!host.querySelector('[aria-label="Original comparison"]')!.hasAttribute('data-generated'), 'original comparison used an applied animation');
    const seen = new Set<number>(); const begin = performance.now();
    await new Promise<void>((resolve, reject) => {
      function observe() {
        if (document.hidden) { reject(new Error('Playback verification requires a visible document')); return; }
        const frame = Number(player.dataset.frame); seen.add(frame);
        assert(frame >= 0 && frame < 8, 'playback used an invalid frame during mount');
        const expected = [frame % 4 * 128, Math.floor(frame / 4) * 128, 128, 128];
        assert(player.getAttribute('viewBox') === expected.join(' '), 'board did not crop the current animation cell');
        const clip = player.querySelector('clipPath rect')!;
        assert(['x', 'y', 'width', 'height'].every((key, i) => Number(clip.getAttribute(key)) === expected[i]), 'wide board viewport exposes adjacent cells');
        if (performance.now() - begin >= 850) resolve(); else requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    assert(seen.size === 8, `board action did not loop at 12 FPS: saw ${[...seen]}`);
    // Rasterize the SVG crop too: changing data-frame alone must not count as visible playback.
    const snapshot = player.cloneNode(true) as SVGSVGElement;
    snapshot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    snapshot.setAttribute('width', '100'); snapshot.setAttribute('height', '66');
    const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(snapshot))}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 66;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 100, 66).data;
    assert(pixels.some((v, i) => i % 4 === 3 && v > 20), 'animated board SVG renders blank');
    assert(!pixels.some((v, i) => i % 4 === 3 && (Math.floor(i / 4) % 100 < 17 || Math.floor(i / 4) % 100 >= 83) && v > 20), 'neighboring frames bleed into the board viewport');
    restoreSprite('car-top'); await nextTick();
    assert(!player.hasAttribute('data-generated') && !player.hasAttribute('data-frame'), 'restore did not stop playback and return original art');
    assert(!library.value.active['car-top'], 'restore left a persisted animation override');
  } finally {
    app.unmount(); host.remove();
    library.value = previousLibrary; activeSprites.value = previousSprites; storageWarning.value = previousWarning;
    if (saved === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, saved);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('picnic-action-frames-v1', 1);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('actions', 'readwrite'); tx.objectStore('actions').delete(recipe.sheet.generationId!); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = reject; };
      request.onerror = reject;
    });
  }
}
