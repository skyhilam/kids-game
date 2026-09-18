import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialRecipe } from '../src/studio/recipe';
import { sourceKey } from '../src/studio/generation';
import { renderSheet } from '../src/studio/sheet';
import { spriteDataUrl } from '../src/studio/draw';

vi.mock('../src/studio/sheet', () => ({ renderSheet: vi.fn() }));
vi.mock('../src/studio/draw', () => ({ spriteDataUrl: vi.fn() }));
const canvas = (image: string) => ({ toDataURL: () => image }) as HTMLCanvasElement;
let saved: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); saved = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  vi.mocked(renderSheet).mockResolvedValue(canvas('data:image/png;base64,animated-sheet'));
  vi.mocked(spriteDataUrl).mockResolvedValue('data:image/png;base64,static-sprite');
});
afterEach(() => vi.unstubAllGlobals());

describe('game sprite overrides', () => {
  it('applies built-in poses with their playback rate and restores them after reload', async () => {
    const store = await import('../src/studio/store'); store.initializeLibrary();
    const recipe = initialRecipe('car'); recipe.sheet.fps = 12; recipe.sheet.columns = 2;
    expect(await store.applySprite(recipe)).toBe(true);
    expect(store.activeSprites.value.car).toMatchObject({ frames: 8, fps: 12, columns: 2, rows: 4 });
    expect(renderSheet).toHaveBeenCalledWith({ ...recipe, size: 256 });
    expect(saved.get(store.STORAGE_KEY)).not.toContain('animated-sheet');
    vi.resetModules(); const reloaded = await import('../src/studio/store'); reloaded.initializeLibrary();
    await vi.waitFor(() => expect(reloaded.activeSprites.value.car).toMatchObject({ frames: 8, fps: 12, columns: 2, rows: 4 }));
  });
  it('applies generated poses to the exact board sprite without overwriting the cover sprite', async () => {
    const store = await import('../src/studio/store');
    const recipe = initialRecipe('car-top'); recipe.sheet.frames = 12; recipe.sheet.columns = 8;
    recipe.sheet = { ...recipe.sheet, generationId: 'a'.repeat(64), sourceKey: sourceKey(recipe) };
    await store.applySprite(recipe);
    expect(store.activeSprites.value['car-top']).toMatchObject({ frames: 12, columns: 8, rows: 2 });
    expect(store.activeSprites.value.car).toBeUndefined();
    expect(spriteDataUrl).not.toHaveBeenCalled();
  });
  it('keeps a static override when no matching action is available and clears an old animation', async () => {
    const store = await import('../src/studio/store'); const recipe = initialRecipe('car');
    await store.applySprite(recipe);
    recipe.sheet.motion = 'wave'; await store.applySprite(recipe);
    expect(store.activeSprites.value.car).toEqual({ image: 'data:image/png;base64,static-sprite', frames: 1, fps: 1, columns: 1, rows: 1 });
  });
  it('does not let an in-flight apply undo restore or replace a newer applied version', async () => {
    const store = await import('../src/studio/store');
    let deliver!: (value: HTMLCanvasElement) => void;
    vi.mocked(renderSheet).mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    const first = store.applySprite(initialRecipe('car'));
    await vi.waitFor(() => expect(renderSheet).toHaveBeenCalledTimes(1));
    store.restoreSprite('car');
    const newer = initialRecipe('car'); newer.sheet.motion = 'wave'; await store.applySprite(newer);
    deliver(canvas('old-sheet')); expect(await first).toBe(false);
    expect(store.activeSprites.value.car?.image).toContain('static-sprite');
    store.restoreSprite('car'); expect(store.activeSprites.value.car).toBeUndefined();
    expect(store.library.value.active.car).toBeUndefined();
  });
  it('does not silently apply a single frame when the requested animation is missing', async () => {
    const store = await import('../src/studio/store');
    vi.mocked(renderSheet).mockRejectedValue(new Error('找不到動作影格'));
    await expect(store.applySprite(initialRecipe('car'))).rejects.toThrow('動作影格');
    expect(store.library.value.active.car).toBeUndefined();
    expect(store.activeSprites.value.car).toBeUndefined();
  });
  it('shows a fallback and recovery message when an old applied animation cannot be loaded', async () => {
    const store = await import('../src/studio/store');
    saved.set(store.STORAGE_KEY, JSON.stringify({ version: 1, records: {}, active: { car: initialRecipe('car') } }));
    vi.mocked(renderSheet).mockRejectedValue(new Error('missing frames'));
    store.initializeLibrary();
    await vi.waitFor(() => expect(store.activeSprites.value.car?.frames).toBe(1));
    expect(store.storageWarning.value).toContain('設計 JSON');
    expect(store.library.value.active.car).toBeDefined();
  });
});
