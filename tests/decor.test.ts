import { describe, expect, it } from 'vitest';
import { DECOR_THEMES, GAME_DECOR_THEMES } from '../src/art/decorThemes';
import { sprites } from '../src/art/sprites';
import { generateDeliveryMission } from '../src/delivery/generate';
import { decorSprites, pickDecorTheme, planDecor, type Box, type DecorOptions } from '../src/game/decor';
import { generateMaze } from '../src/game/generate';
import { distToSegment, mapKey, type Segment } from '../src/game/geometry';
import type { Point } from '../src/game/types';

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function verify(options: DecorOptions) {
  const result = planDecor(options);
  expect(result.items.length).toBeGreaterThan(0);
  expect(planDecor(options)).toEqual(result);
  for (const [index, box] of result.items.entries()) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(options.width);
    expect(box.y + box.height).toBeLessThanOrEqual(options.height);
    for (const other of [...(options.reserved ?? []), ...result.items.slice(0, index)]) {
      expect(overlaps(box, other)).toBe(false);
    }
    // Independently sample the complete box, including its interior and boundary.
    let nearestPoint = Infinity;
    let nearestRoad = Infinity;
    for (let ix = 0; ix <= 10; ix += 1) {
      for (let iy = 0; iy <= 10; iy += 1) {
        const x = box.x + box.width * ix / 10;
        const y = box.y + box.height * iy / 10;
        for (const p of options.points) nearestPoint = Math.min(nearestPoint, Math.hypot(x - p[0], y - p[1]));
        for (const [a, b] of options.segments) nearestRoad = Math.min(nearestRoad, distToSegment(x, y, a, b));
      }
    }
    expect(nearestPoint, `${box.id} near node`).toBeGreaterThanOrEqual(58 - 1e-9);
    expect(nearestRoad, `${box.id} near road`).toBeGreaterThanOrEqual(58 - 1e-9);
  }
  return result;
}

describe('shared board decor', () => {
  it('uses registered sprites and preloads the complete theme union', () => {
    for (const theme of Object.values(DECOR_THEMES)) {
      for (const name of [...theme.big, ...theme.small, ...theme.sky]) expect(sprites[name]).toBeDefined();
    }
    for (const game of ['picnic', 'tooth', 'delivery'] as const) {
      const names = decorSprites(game);
      expect(new Set(names).size).toBe(names.length);
      for (const id of GAME_DECOR_THEMES[game]) {
        const theme = DECOR_THEMES[id];
        for (const name of [...theme.big, ...theme.small, ...theme.sky]) expect(names).toContain(name);
      }
      expect(new Set(Array.from({ length: 20 }, (_, key) => pickDecorTheme(game, key))).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('hashes rounded geometry independently of ordering and road direction', () => {
    const a: Point = [10.1, 20.2];
    const b: Point = [100, 200];
    expect(mapKey([a, b], [[a, b]])).toBe(mapKey([b, [10.2, 20.1]], [[b, a]]));
    expect(mapKey([a, b], [])).not.toBe(mapKey([a, b], [[a, b]]));
    expect(distToSegment(3, 4, [0, 0], [0, 0])).toBe(5);
    expect(distToSegment(0.25, 1, [0, 0], [0.5, 0])).toBe(1);
  });

  it('keeps whole decor boxes clear across 20 seeds per game', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      for (const game of ['picnic', 'tooth', 'delivery'] as const) {
        const map = game === 'delivery' ? generateDeliveryMission(seed) : generateMaze(game, seed, seed);
        const points = Object.values(map.nodes);
        const segments: Segment[] = map.edges.map(([a, b]) => [map.nodes[a], map.nodes[b]]);
        verify({ game, key: mapKey(points, segments), width: 840, height: 720, points, segments,
          reserved: [{ x: 300, y: 0, width: 200, height: 90 }] });
      }
    }
  });

  it('rejects boxes crossed by diagonal roads and respects reserved sky space', () => {
    verify({ game: 'tooth', key: 17, width: 840, height: 720, points: [],
      segments: [[[0, 0], [840, 720]], [[0, 720], [840, 0]]],
      reserved: [{ x: 650, y: 0, width: 190, height: 180 }] });
    expect(planDecor({ game: 'picnic', key: 1, width: 40, height: 40, points: [], segments: [],
      reserved: [{ x: 0, y: 0, width: 40, height: 40 }] }).items).toEqual([]);
  });
});
