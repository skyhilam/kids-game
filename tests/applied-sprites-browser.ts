import { createApp, h, nextTick } from 'vue';
import GameSprite from '../src/components/GameSprite.vue';
import PicnicBoard from '../src/components/PicnicBoard.vue';
import { createGame } from '../src/game/rules';
import { LEVELS } from '../src/picnic/levels';
import { initialRecipe } from '../src/studio/recipe';
import { importAnimation, sourceKey } from '../src/studio/generation';
import { activeSprites, applySprite, library, restoreSprite, STORAGE_KEY, storageWarning } from '../src/studio/store';

function waitFor(test: () => boolean, message: string, ms = 4000): Promise<void> {
  const begin = performance.now();
  return new Promise((resolve, reject) => {
    function tick() {
      if (test()) { resolve(); return; }
      if (performance.now() - begin > ms) { reject(new Error(message)); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Exercise the real Phaser board and Vue chrome with labelled local poses, without an AI request.
export async function verifyAppliedPlayback(images: string[], assert: (ok: boolean, message: string) => void) {
  const saved = localStorage.getItem(STORAGE_KEY), previousLibrary = library.value;
  const previousSprites = activeSprites.value, previousWarning = storageWarning.value;
  const recipe = initialRecipe('car-top');
  recipe.sheet = { ...recipe.sheet, frames: 8, fps: 12, columns: 4, generationId: 'a'.repeat(64) };
  recipe.sheet.sourceKey = sourceKey(recipe);
  const host = document.createElement('div');
  host.style.width = '840px';
  document.body.append(host);
  const { graph, state } = createGame(LEVELS);
  const app = createApp({ render: () => h('div', [
    h(PicnicBoard, { graph, state, interactive: false, narrow: false, facing: 0, hintNode: null, inFlight: null }),
    h(GameSprite, { name: 'car-top', original: true, label: 'Original comparison' }),
  ]) });
  try {
    await importAnimation({ id: recipe.sheet.generationId, status: 'completed', sprite: 'car-top', action: 'browser playback fixture', frames: 8, createdAt: new Date().toISOString(), images }, recipe);
    app.mount(host);
    await applySprite(recipe); await nextTick();
    await waitFor(() => host.querySelector<HTMLElement>('[data-phaser-ready="true"]') !== null, 'Phaser picnic board did not become ready');
    const board = host.querySelector<HTMLElement>('[data-phaser-ready="true"]')!;
    await waitFor(() => board.dataset.playerSprite === 'car-top' && board.dataset.animated === 'true', 'applied action missing from the Phaser picnic board');
    assert(!host.querySelector('[aria-label="Original comparison"]')!.hasAttribute('data-generated'), 'original comparison used an applied animation');
    const seen = new Set<number>(); const begin = performance.now();
    await new Promise<void>((resolve, reject) => {
      function observe() {
        if (document.hidden) { reject(new Error('Playback verification requires a visible document')); return; }
        const frame = Number(board.dataset.frame);
        seen.add(frame);
        assert(frame >= 0 && frame < 8, 'playback used an invalid frame during mount');
        if (performance.now() - begin >= 850) resolve(); else requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    assert(seen.size === 8, `board action did not loop at 12 FPS: saw ${[...seen]}`);
    const canvas = board.querySelector('canvas');
    assert(!!canvas, 'Phaser board did not render a canvas');
    restoreSprite('car-top'); await nextTick();
    await waitFor(() => board.dataset.animated !== 'true', 'restore did not stop playback and return original art');
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
