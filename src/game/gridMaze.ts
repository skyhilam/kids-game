import { roadKey } from './graph';
import { pick, shuffle } from './rng';
import type { Point } from './types';

export type Grid = { xs: number[]; ys: number[] };

export type GridMaze = {
  grid: Grid;
  ids: string[];
  nodes: Record<string, Point>;
  edges: [string, string][];
  start: string;
  goal: string;
};

function cellId(row: number, col: number): string {
  return `r${row}c${col}`;
}

function hypot(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function spanningTree(
  ids: string[],
  candidates: [string, string][],
  rand: () => number,
): [string, string][] {
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };
  const tree: [string, string][] = [];
  for (const [a, b] of shuffle(rand, candidates)) {
    const pa = find(a);
    const pb = find(b);
    if (pa === pb) continue;
    parent.set(pa, pb);
    tree.push([a, b]);
    if (tree.length === ids.length - 1) break;
  }
  return tree;
}

export function generateGridMaze(
  rand: () => number,
  grid: Grid,
  extraCount: (leftover: number) => number,
): GridMaze | null {
  const nodes: Record<string, Point> = {};
  const ids: string[] = [];
  grid.ys.forEach((y, row) => {
    grid.xs.forEach((x, col) => {
      const id = cellId(row, col);
      ids.push(id);
      nodes[id] = [x, y];
    });
  });
  const candidates: [string, string][] = [];
  grid.ys.forEach((_, row) => {
    grid.xs.forEach((_, col) => {
      if (col + 1 < grid.xs.length) candidates.push([cellId(row, col), cellId(row, col + 1)]);
      if (row + 1 < grid.ys.length) candidates.push([cellId(row, col), cellId(row + 1, col)]);
    });
  });
  const tree = spanningTree(ids, candidates, rand);
  if (tree.length !== ids.length - 1) return null;
  const treeKeys = new Set(tree.map(([a, b]) => roadKey(a, b)));
  const extraPool = candidates.filter(([a, b]) => !treeKeys.has(roadKey(a, b)));
  const extraWanted = Math.max(0, extraCount(extraPool.length));
  const edges: [string, string][] = [...tree, ...shuffle(rand, extraPool).slice(0, extraWanted)];

  const corners = [
    cellId(0, 0),
    cellId(0, grid.xs.length - 1),
    cellId(grid.ys.length - 1, 0),
    cellId(grid.ys.length - 1, grid.xs.length - 1),
  ];
  const start = pick(rand, corners);
  const ranked = ids
    .filter((id) => id !== start)
    .sort((a, b) => hypot(nodes[b]!, nodes[start]!) - hypot(nodes[a]!, nodes[start]!));
  const goal = ranked.find((id) => hypot(nodes[id]!, nodes[start]!) >= 280) ?? ranked[0];
  if (!goal || goal === start) return null;
  return { grid, ids, nodes, edges, start, goal };
}

export function firstValid<T>(
  attempts: number,
  mint: (attemptNo: number) => T | null,
  fallback: () => T,
): T {
  for (let i = 0; i < attempts; i += 1) {
    const value = mint(i);
    if (value) return value;
  }
  return fallback();
}
