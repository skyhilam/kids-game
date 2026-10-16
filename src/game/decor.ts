import { DECOR_THEMES, GAME_DECOR_THEMES, type DecorThemeId } from '../art/decorThemes';
import { sprites, type SpriteName } from '../art/sprites';
import { distToSegment, type Segment } from './geometry';
import { mulberry32, pick, shuffle } from './rng';
import type { Point } from './types';

type DecorGame = keyof typeof GAME_DECOR_THEMES;
/** Canvas coordinates, with x/y at the top left. */
export interface Box { x: number; y: number; width: number; height: number }
export interface DecorItem extends Box { id: string; name: SpriteName }
export interface DecorOptions {
  game: DecorGame;
  key: number;
  width: number;
  height: number;
  points: readonly Point[];
  segments: readonly Segment[];
  reserved?: readonly Box[];
  big?: number;
  small?: number;
}

export function decorSprites(game: DecorGame): SpriteName[] {
  return [...new Set(GAME_DECOR_THEMES[game].flatMap((id) => {
    const theme = DECOR_THEMES[id];
    return [...theme.big, ...theme.small, ...theme.sky];
  }))];
}

export function pickDecorTheme(game: DecorGame, key: number): DecorThemeId {
  return pick(mulberry32(key), GAME_DECOR_THEMES[game]);
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointDistance(p: Point, box: Box): number {
  return Math.hypot(Math.max(box.x - p[0], 0, p[0] - box.x - box.width),
    Math.max(box.y - p[1], 0, p[1] - box.y - box.height));
}

/** Exact segment-to-box distance: intersections first, then endpoint/corner distances. */
function roadDistance([a, b]: Segment, box: Box): number {
  let lo = 0;
  let hi = 1;
  for (const [start, delta, min, max] of [
    [a[0], b[0] - a[0], box.x, box.x + box.width],
    [a[1], b[1] - a[1], box.y, box.y + box.height],
  ]) {
    if (delta === 0) {
      if (start < min || start > max) { lo = Infinity; break; }
    } else {
      const t1 = (min - start) / delta;
      const t2 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    }
  }
  if (lo <= hi) return 0;
  return Math.min(pointDistance(a, box), pointDistance(b, box),
    ...[box.x, box.x + box.width].flatMap((x) =>
      [box.y, box.y + box.height].map((y) => distToSegment(x, y, a, b))));
}

/** Normalized candidate grid scales with the board; unavailable placements are omitted. */
export function planDecor({ game, key, width, height, points, segments, reserved = [], big = 4, small = 5 }: DecorOptions): { theme: DecorThemeId; items: DecorItem[] } {
  const theme = pickDecorTheme(game, key);
  const palette = DECOR_THEMES[theme];
  const rand = mulberry32(key);
  const candidates: Point[] = [];
  for (let row = 0; row <= 20; row += 1) {
    for (let col = 0; col <= 20; col += 1) candidates.push([col / 20, row / 20]);
  }
  const shuffled = shuffle(rand, candidates);
  const items: DecorItem[] = [];
  function place(name: SpriteName, size: number, spots: readonly Point[], id: string) {
    const [, , sw, sh] = sprites[name].frame;
    const w = size * sw / Math.max(sw, sh);
    const h = size * sh / Math.max(sw, sh);
    for (const [nx, ny] of spots) {
      const box = { x: nx * (width - w), y: ny * (height - h), width: w, height: h };
      if (box.x < 0 || box.y < 0 || box.x + w > width || box.y + h > height) continue;
      if ([...reserved, ...items].some((other) => overlaps(box, other))) continue;
      if (points.some((p) => pointDistance(p, box) < 58)) continue;
      if (segments.some((segment) => roadDistance(segment, box) < 58)) continue;
      items.push({ id, name, ...box });
      return;
    }
  }
  place(pick(rand, palette.sky), 64, [[0.96, 0.03], [0.86, 0.03], [0.96, 0.13]], 'sky');
  for (const [group, count, size] of [['big', big, 76], ['small', small, 38]] as const) {
    const names = shuffle(rand, palette[group]);
    for (let i = 0; i < count; i += 1) place(names[i % names.length], size, shuffled, `${group}-${i}`);
  }
  return { theme, items };
}
