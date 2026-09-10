import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { roadKey } from '../src/game/graph';
import { firstValid, generateGridMaze, type Grid } from '../src/game/gridMaze';
import { mixSeed, mulberry32 } from '../src/game/rng';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRID_3x3: Grid = { xs: [135, 435, 685], ys: [155, 345, 545] };

function reachable(ids: string[], edges: [string, string][], start: string): number {
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen.size;
}

describe('shared grid maze', () => {
  it('mixes seeds with 32-bit imul, not float64 multiply', () => {
    const seed = 0x9e3779b9;
    const salt = 91;
    const attemptNo = 3;
    const imul = (Math.imul(seed >>> 0, 2246822519) + salt + attemptNo * 997) >>> 0;
    const floaty = ((seed >>> 0) * 2246822519 + salt + attemptNo * 997) >>> 0;
    expect(mixSeed(seed, salt, attemptNo)).toBe(imul);
    expect(mixSeed(seed, salt, attemptNo)).not.toBe(floaty);
    expect(mixSeed(1, 17, 0)).not.toBe(mixSeed(1, 91, 0));
  });

  it('builds a connected maze with a corner start, a far goal, and unique roads', () => {
    const maze = generateGridMaze(mulberry32(mixSeed(11, 17, 0)), GRID_3x3, () => 2);
    expect(maze).not.toBeNull();
    expect(maze!.ids).toHaveLength(9);
    expect(maze!.edges.length).toBe(maze!.ids.length - 1 + 2);
    const corners = new Set([
      maze!.nodes[maze!.ids[0]!]!.join(','),
      maze!.nodes['r0c2']!.join(','),
      maze!.nodes['r2c0']!.join(','),
      maze!.nodes['r2c2']!.join(','),
    ]);
    expect(corners.has(maze!.nodes[maze!.start]!.join(','))).toBe(true);
    expect(maze!.goal).not.toBe(maze!.start);
    const [sx, sy] = maze!.nodes[maze!.start]!;
    const [gx, gy] = maze!.nodes[maze!.goal]!;
    expect(Math.hypot(gx - sx, gy - sy)).toBeGreaterThanOrEqual(280);
    const keys = maze!.edges.map(([a, b]) => roadKey(a, b));
    expect(new Set(keys).size).toBe(keys.length);
    expect(reachable(maze!.ids, maze!.edges, maze!.start)).toBe(maze!.ids.length);
  });

  it('honours extra-road count and keeps a seed stable', () => {
    const treeOnly = generateGridMaze(mulberry32(4), GRID_3x3, () => 0);
    const withExtras = generateGridMaze(mulberry32(4), GRID_3x3, () => 2);
    let leftoverSeen = -1;
    const allLeftover = generateGridMaze(mulberry32(4), GRID_3x3, (leftover) => {
      leftoverSeen = leftover;
      return leftover;
    });
    expect(treeOnly!.edges).toHaveLength(treeOnly!.ids.length - 1);
    expect(withExtras!.edges).toHaveLength(withExtras!.ids.length - 1 + 2);
    expect(leftoverSeen).toBe(4);
    expect(allLeftover!.edges).toHaveLength(12);
    expect(generateGridMaze(mulberry32(4), GRID_3x3, () => 2)).toEqual(withExtras);
    expect(generateGridMaze(mulberry32(5), GRID_3x3, () => 2)).not.toEqual(withExtras);
  });

  it('rejects a grid that cannot pick two distinct ends', () => {
    expect(generateGridMaze(mulberry32(1), { xs: [100], ys: [100] }, () => 0)).toBeNull();
  });

  it('returns the first success, then falls back when every attempt fails', () => {
    expect(firstValid(3, (i) => (i === 0 ? 'first' : null), () => 'fb')).toBe('first');
    expect(firstValid(3, (i) => (i === 2 ? 'later' : null), () => 'fb')).toBe('later');
    expect(firstValid(2, () => null, () => 'fb')).toBe('fb');
  });

  it('is the maze primitive picnic, tooth, and delivery share', () => {
    const picnic = readFileSync(join(root, 'src/game/generate.ts'), 'utf8');
    const delivery = readFileSync(join(root, 'src/delivery/generate.ts'), 'utf8');
    expect(picnic).toMatch(/generateGridMaze\(/);
    expect(picnic).toMatch(/firstValid\(/);
    expect(delivery).toMatch(/generateGridMaze\(/);
    expect(delivery).toMatch(/firstValid\(/);
    expect(delivery).toContain('() => DELIVERY_MISSION');
    expect(delivery).not.toMatch(/from '\.\.\/game\/generate'/);
    expect(delivery).not.toMatch(/function fallback/);
    expect(delivery).not.toMatch(/spanningTree/);
    expect(picnic).not.toMatch(/from '\.\.\/delivery\//);
  });
});
