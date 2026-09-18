import { describe, expect, it } from 'vitest';
import { contextKey, kits, levelInfo, modelNames, models } from '../src/studio/catalog';
import { exportDesign, generateRecipe, initialRecipe, parseDesign, parseRecipe, recipeKey } from '../src/studio/recipe';
import { parseLibrary } from '../src/studio/store';
import { sprites } from '../src/art/sprites';
import { materials, recolorPixels } from '../src/studio/materials';
import { WORD_IDS } from '../src/sticker/words';

describe('Canvas sprite studio', () => {
  it('covers every original sprite and the current word pool without duplicate items', () => {
    const originals = Object.entries(sprites).filter(([, sprite]) => ['picnic', 'tooth', 'delivery'].includes(sprite.atlas)).map(([name]) => name);
    expect(new Set(modelNames)).toEqual(new Set(originals));
    expect(new Set(Object.values(kits).flatMap(kit => [...kit.sprites]))).toEqual(new Set(modelNames));
    for (const kit of Object.values(kits)) for (const name of kit.sprites) expect(models).toHaveProperty(name);
    expect(kits.sticker.sprites).toEqual(WORD_IDS);
    expect(new Set(kits.sticker.sprites).size).toBe(kits.sticker.sprites.length);
  });
  it('reproduces a seeded combination and preserves locked parts including custom colors', () => {
    const base = { ...initialRecipe('car'), primary: '#123456', variant: 2 };
    expect(generateRecipe('car', 42)).toEqual(generateRecipe('car', 42));
    expect(generateRecipe('car', 42)).not.toEqual(generateRecipe('car', 43));
    const next = generateRecipe('car', 43, base, ['palette', 'variant']);
    expect(next.primary).toBe('#123456'); expect(next.palette).toBe(base.palette); expect(next.variant).toBe(2);
    expect(next.seed).toBe(43);
  });
  it('exports a portable single-sprite design that round-trips without losing settings', () => {
    for (const sprite of kits.picnic.sprites) {
      const context = { game: 'picnic' as const, level: 9 };
      const recipe = generateRecipe(sprite, 987);
      expect(parseDesign(JSON.parse(exportDesign(context, recipe)))).toEqual({ context, recipe });
    }
  });
  it('rejects malformed or unsupported imported designs before they reach Canvas', () => {
    const recipe = initialRecipe('car');
    for (const patch of [{ version: 4 }, { sprite: '__proto__' }, { palette: 'toString' }, { size: 8192 }, { scale: NaN }, { scale: 101 }, { variant: 1.5 }, { seed: -1 }, { seed: Infinity }, { primary: 'url(https://example.com)' }, { mirror: 'true' }]) {
      expect(() => parseRecipe({ ...recipe, ...patch })).toThrow();
    }
    expect(() => parseDesign({ format: 'picnic-sprite', version: 1, context: { game: 'tooth', level: 1 }, recipe })).toThrow();
    expect(() => parseDesign({ format: 'picnic-sprite', version: 1, context: { game: 'picnic', level: 0 }, recipe })).toThrow();
  });
  it('distinguishes edited versions but normalizes hex color case for completion checks', () => {
    const recipe = initialRecipe('car');
    expect(recipeKey(recipe)).toBe(recipeKey({ ...recipe, primary: recipe.primary.toLowerCase() }));
    expect(recipeKey(recipe)).not.toBe(recipeKey({ ...recipe, scale: 85 }));
    expect(contextKey({ game: 'picnic', level: 1 }, 'home')).not.toBe(contextKey({ game: 'delivery', level: 1 }, 'home'));
  });
  it('validates stored completion identity and applied sprite identity', () => {
    const context = { game: 'picnic' as const, level: 2 }; const recipe = initialRecipe('car');
    const record = { context, recipe, completedAt: '2026-09-18T00:00:00.000Z' };
    const good = { version: 1, records: { 'picnic:2:car': record }, active: { car: recipe } };
    expect(parseLibrary(JSON.stringify(good))).toEqual(good);
    expect(() => parseLibrary(JSON.stringify({ ...good, records: { 'picnic:1:car': record } }))).toThrow();
    expect(() => parseLibrary(JSON.stringify({ ...good, active: { home: recipe } }))).toThrow();
  });
  it('uses actual procedural difficulty rather than the retired hand-built level lists', () => {
    expect(levelInfo({ game: 'picnic', level: 1 }).stage).toBe('簡單');
    expect(levelInfo({ game: 'tooth', level: 8 }).stage).toBe('基礎');
    expect(levelInfo({ game: 'picnic', level: 9 }).stage).toBe('益智');
    expect(levelInfo({ game: 'sticker', level: 1 })).toMatchObject({ stage: '簡單', title: '4 張圖詞配對' });
    expect(levelInfo({ game: 'sticker', level: 2 })).toMatchObject({ stage: '基礎', title: '5 張圖詞配對' });
    expect(levelInfo({ game: 'sticker', level: 100 })).toMatchObject({ stage: '益智', title: '6 張圖詞配對' });
    expect(levelInfo({ game: 'delivery', level: 2 }).title).toBe('路線種子 1');
  });
  it('defaults to the unmodified original painted artwork for every model', () => {
    for (const name of modelNames) {
      const recipe = initialRecipe(name);
      expect(recipe.version).toBe(3); expect(recipe.palette).toBe('original');
      expect(recipe.primary).toBe(materials[name].primary.color);
      expect(recipe.secondary).toBe(materials[name].secondary.color);
      expect(recipe.variant).toBe(0); expect(recipe.detail).toBe(0);
    }
  });
  it('migrates geometric designs to original art without dropping completion identity or output settings', () => {
    const old = { ...initialRecipe('car'), version: 1, palette: 'picnic', variant: 2, detail: 2, expression: 'wink', pixel: true, primary: '#123456', seed: 42, size: 512, mirror: true };
    const parsed = parseRecipe(old);
    expect(parsed).toEqual({ ...initialRecipe('car'), seed: 42, size: 512, mirror: true });
    const data = parseLibrary(JSON.stringify({ version: 1, records: {
      'picnic:2:car': { context: { game: 'picnic', level: 2 }, recipe: old, completedAt: '2026-09-18T00:00:00Z' },
    }, active: { car: old } }));
    expect(Object.keys(data.records)).toEqual(['picnic:2:car']);
    expect(data.active.car).toEqual(parsed);
  });
  it('recolors materials while retaining transparent edges, eyes, whites and shading differences', () => {
    const original = new Uint8ClampedArray([230, 111, 81, 200, 160, 64, 39, 255, 25, 22, 19, 255, 250, 250, 249, 255, 230, 111, 81, 0]);
    const data = original.slice();
    recolorPixels(data, 1, 5, 'car-top', '#649FAE', materials['car-top'].secondary.color);
    expect([...data].filter((_, i) => i % 4 === 3)).toEqual([200, 255, 255, 255, 0]);
    expect(data.slice(0, 3)).not.toEqual(original.slice(0, 3));
    expect(data.slice(8)).toEqual(original.slice(8));
    expect(data[0]! + data[1]! + data[2]!).toBeGreaterThan(data[4]! + data[5]! + data[6]!);
    const noOp = original.slice();
    recolorPixels(noOp, 1, 5, 'car-top', materials['car-top'].primary.color, materials['car-top'].secondary.color);
    expect(noOp).toEqual(original);
  });
  it('keeps the bear passenger cheeks unchanged when recoloring the car body', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    const cheek = (38 * 100 + 39) * 4;
    const panel = (75 * 100 + 39) * 4;
    pixels.set([230, 111, 81, 255], cheek); pixels.set([230, 111, 81, 255], panel);
    recolorPixels(pixels, 100, 100, 'car', '#649FAE', materials.car.secondary.color);
    expect([...pixels.slice(cheek, cheek + 4)]).toEqual([230, 111, 81, 255]);
    expect([...pixels.slice(panel, panel + 3)]).not.toEqual([230, 111, 81]);
  });
});
