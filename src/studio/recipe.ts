import { mulberry32 } from '../game/rng';
import { kits, models, type ModelName, type StudioContext } from './catalog';
import { materials } from './materials';
import { defaultSheet, migrateSheet, parseSheet, type SheetSettings } from './animation';

export const palettes = {
  original: { label: '遊戲原色', primary: '#E66F51', secondary: '#7F9653', light: '#F5D491' },
  picnic: { label: '草地野餐', primary: '#D77F65', secondary: '#87965F', light: '#F5D491' },
  sea: { label: '海邊晴天', primary: '#649FAE', secondary: '#9DBB9C', light: '#CDE9E5' },
  berry: { label: '莓果花園', primary: '#AF849F', secondary: '#88A181', light: '#F3DAAC' },
  honey: { label: '蜂蜜森林', primary: '#C99F63', secondary: '#839568', light: '#F4DFC0' },
} as const;
export type PaletteName = keyof typeof palettes;
export type Recipe = {
  version: 4; sprite: ModelName; seed: number; palette: PaletteName;
  primary: string; secondary: string; variant: number; detail: number;
  size: 64 | 128 | 256 | 512; scale: number; mirror: boolean; sheet: SheetSettings;
};
export type Lockable = 'palette' | 'variant' | 'detail';
export const lockable: Lockable[] = ['palette', 'variant', 'detail'];
export function paletteColors(sprite: ModelName, palette: PaletteName) {
  return palette === 'original' ? { primary: materials[sprite].primary.color, secondary: materials[sprite].secondary.color }
    : { primary: palettes[palette].primary, secondary: palettes[palette].secondary };
}
export function generateRecipe(sprite: ModelName, seed: number, previous?: Recipe, locks: readonly Lockable[] = []): Recipe {
  const rand = mulberry32(seed);
  const paletteNames = Object.keys(palettes) as PaletteName[];
  const palette = paletteNames[Math.floor(rand() * paletteNames.length)]!;
  const next: Recipe = {
    version: 4, sprite, seed: seed >>> 0, palette, ...paletteColors(sprite, palette),
    variant: Math.floor(rand() * 3), detail: Math.floor(rand() * 3),
    size: previous?.size ?? 256, scale: previous?.scale ?? 90, mirror: previous?.mirror ?? false,
    sheet: previous ? { ...previous.sheet } : defaultSheet(sprite),
  };
  if (previous) for (const key of locks) {
    if (key === 'palette') { next.palette = previous.palette; next.primary = previous.primary; next.secondary = previous.secondary; }
    else next[key] = previous[key];
  }
  return next;
}
export function initialRecipe(sprite: ModelName): Recipe {
  return { version: 4, sprite, seed: 20260918, palette: 'original', ...paletteColors(sprite, 'original'), variant: 0, detail: 0, size: 256, scale: 90, mirror: false, sheet: defaultSheet(sprite) };
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const owns = (object: object, key: unknown): key is string => typeof key === 'string' && Object.hasOwn(object, key);
export function parseRecipe(value: unknown): Recipe {
  if (!isObject(value) || ![1, 2, 3, 4].includes(value.version as number) || !owns(models, value.sprite) || !owns(palettes, value.palette)
    || !integer(value.seed, 0, 0xffffffff) || !integer(value.variant, 0, 2) || !integer(value.detail, 0, 2) || !integer(value.scale, 60, 100)
    || ![64, 128, 256, 512].includes(value.size as number) || typeof value.mirror !== 'boolean'
    || ![value.primary, value.secondary].every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error('設計檔格式不正確，請使用素材工房匯出的 JSON。');
  }
  // Old geometric shapes/expressions have no painted equivalent. Retain identity, seed,
  // output settings and completion keys, restoring the original illustration's appearance.
  if (value.version === 1) return { ...initialRecipe(value.sprite as ModelName), seed: value.seed, size: value.size as Recipe['size'], scale: value.scale, mirror: value.mirror };
  const sheet = value.version === 4 ? parseSheet(value.sheet) : value.version === 3 ? migrateSheet(value.sheet, value.sprite) : defaultSheet(value.sprite);
  return {
    version: 4, sprite: value.sprite as ModelName, seed: value.seed, palette: value.palette as PaletteName,
    primary: (value.primary as string).toUpperCase(), secondary: (value.secondary as string).toUpperCase(),
    variant: value.variant, detail: value.detail, size: value.size as Recipe['size'], scale: value.scale, mirror: value.mirror,
    sheet,
  };
}
export function parseContext(value: unknown): StudioContext {
  if (!isObject(value) || !owns(kits, value.game) || !integer(value.level, 1, 9999)) throw new Error('關卡設定不正確。');
  return { game: value.game as StudioContext['game'], level: value.level };
}
export function parseDesign(value: unknown): { context: StudioContext; recipe: Recipe } {
  if (!isObject(value) || value.format !== 'picnic-sprite' || ![1, 2, 3, 4].includes(value.version as number)) throw new Error('這不是素材工房的設計檔。');
  const context = parseContext(value.context); const recipe = parseRecipe(value.recipe);
  if (!(kits[context.game].sprites as readonly string[]).includes(recipe.sprite)) throw new Error('素材與遊戲不相符。');
  return { context, recipe };
}
export function exportDesign(context: StudioContext, recipe: Recipe): string {
  return JSON.stringify({ format: 'picnic-sprite', version: 4, style: 'original-storybook', context, recipe,
    frame: [0, 0, recipe.size, recipe.size], background: 'transparent', anchor: [0.5, 0.5] }, null, 2);
}
export function recipeKey(recipe: Recipe): string { return JSON.stringify(parseRecipe(recipe)); }
export function fileStem(context: StudioContext, recipe: Recipe): string {
  return `${context.game}-L${context.level}-${recipe.sprite}-${recipe.seed}-${recipe.size}`;
}
