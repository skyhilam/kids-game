import { firstValid, generateGridMaze, type Grid } from './gridMaze';
import { makeGraph } from './graph';
import { mixSeed, mulberry32, shuffle } from './rng';
import { findSolution } from './rules';
import { mazeLoadBand } from './stages';
import type { LevelDef, NodeId, Point } from './types';

export type MazeKind = 'picnic' | 'tooth';

type Title = { name: string; short: string };

const PICNIC_TITLES: Title[] = [
  { name: '新的小路', short: '新路' },
  { name: '彎來彎去', short: '彎彎' },
  { name: '漢堡在哪', short: '找店' },
  { name: '繞去公園', short: '繞園' },
  { name: '再探一轉', short: '再探' },
  { name: '慢慢選擇', short: '選擇' },
];

const TOOTH_TITLES: Title[] = [
  { name: '新的小路', short: '新路' },
  { name: '蟲蟲在旁', short: '蟲旁' },
  { name: '小心選擇', short: '小心' },
  { name: '再探一探', short: '再探' },
  { name: '彎彎刷牙', short: '彎彎' },
  { name: '亮晶晶路', short: '亮晶' },
];

const GRID_3x2: Grid = { xs: [135, 435, 685], ys: [215, 500] };
const GRID_3x3: Grid = { xs: [135, 435, 685], ys: [155, 345, 545] };
const GRID_4x3: Grid = { xs: [120, 320, 520, 720], ys: [155, 345, 545] };

function hypot(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return hypot([px, py], a);
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

function onExistingRoad(
  nodes: Record<NodeId, Point>,
  edges: [string, string][],
  point: Point,
  minDist = 58,
): boolean {
  return edges.some(([a, b]) => distToSegment(point[0], point[1], nodes[a]!, nodes[b]!) < minDist);
}

function gridFor(kind: MazeKind, index: number, rand: () => number): Grid {
  const roll = rand();
  const band = mazeLoadBand(index);
  if (band === 'easy') return GRID_3x2;
  if (band === 'basic') return roll < 0.42 ? GRID_3x2 : GRID_3x3;
  if (kind === 'picnic' && roll > 0.7) return GRID_4x3;
  if (kind === 'tooth' && roll > 0.78) return GRID_4x3;
  if (roll < 0.2) return GRID_3x2;
  return GRID_3x3;
}

function addSpur(
  nodes: Record<NodeId, Point>,
  edges: [string, string][],
  from: string,
  rand: () => number,
): string | null {
  const at = nodes[from];
  if (!at) return null;
  const id = 'spur';
  const options = shuffle(rand, [
    [at[0] + 110, at[1]],
    [at[0] - 110, at[1]],
    [at[0], at[1] + 100],
    [at[0], at[1] - 100],
  ] as Point[]);
  for (const point of options) {
    if (point[0] < 90 || point[0] > 750 || point[1] < 140 || point[1] > 600) continue;
    if (Object.values(nodes).some((other) => hypot(point, other) < 90)) continue;
    if (onExistingRoad(nodes, edges, point)) continue;
    nodes[id] = point;
    edges.push([from, id]);
    return id;
  }
  return null;
}

function placeSpur(
  nodes: Record<NodeId, Point>,
  edges: [string, string][],
  hosts: string[],
  rand: () => number,
): string | null {
  for (const from of shuffle(rand, hosts)) {
    const id = addSpur(nodes, edges, from, rand);
    if (id) return id;
  }
  return null;
}

function valid(level: LevelDef, kind: MazeKind): boolean {
  if (level.edges.length > 24) return false;
  const graph = makeGraph([level], 0);
  const path = findSolution(graph, graph.start, graph.collect === null, new Set());
  if (!path || path[path.length - 1] !== graph.goal) return false;
  if (kind === 'picnic') {
    if (!graph.collect || !path.includes(graph.collect)) return false;
    if (graph.collect === graph.start || graph.collect === graph.goal) return false;
    return true;
  }
  return graph.hazards.length > 0;
}

function fallback(kind: MazeKind, index: number): LevelDef {
  const title = (kind === 'picnic' ? PICNIC_TITLES : TOOTH_TITLES)[index % 6]!;
  const nodes: Record<NodeId, Point> = {
    r0c0: [135, 155], r0c1: [435, 155], r0c2: [685, 155],
    r1c0: [135, 345], r1c1: [435, 345], r1c2: [685, 345],
    r2c0: [135, 545], r2c1: [435, 545], r2c2: [685, 545],
  };
  if (kind === 'picnic') {
    return {
      ...title,
      start: 'r1c0',
      collect: 'r0c1',
      goal: 'r2c2',
      nodes,
      edges: [
        ['r1c0', 'r0c0'], ['r0c0', 'r0c1'], ['r0c1', 'r0c2'], ['r0c2', 'r1c2'], ['r1c2', 'r2c2'],
        ['r1c0', 'r1c1'], ['r1c1', 'r1c2'], ['r1c0', 'r2c0'], ['r2c0', 'r2c1'], ['r2c1', 'r2c2'],
        ['r1c1', 'r2c1'], ['r0c1', 'r1c1'],
      ],
    };
  }
  return {
    ...title,
    start: 'r1c0',
    goal: 'r1c2',
    hazards: ['r0c1', 'r2c1'],
    nodes,
    edges: [
      ['r1c0', 'r1c1'], ['r1c1', 'r1c2'],
      ['r1c0', 'r0c0'], ['r0c0', 'r0c1'],
      ['r1c0', 'r2c0'], ['r2c0', 'r2c1'],
      ['r1c1', 'r0c1'], ['r1c1', 'r2c1'],
      ['r1c2', 'r0c2'], ['r1c2', 'r2c2'],
    ],
  };
}

function mazeSalt(kind: MazeKind, index: number): number {
  return (index + 1) * 10007 + (kind === 'picnic' ? 17 : 41);
}

function attempt(kind: MazeKind, index: number, attemptNo: number, seed: number): LevelDef | null {
  const rand = mulberry32(mixSeed(seed, mazeSalt(kind, index), attemptNo));
  const grid = gridFor(kind, index, rand);
  const maze = generateGridMaze(
    rand,
    grid,
    () => 1 + Math.min(kind === 'picnic' ? 4 : 3, Math.floor(index / 4) + (rand() > 0.5 ? 1 : 0)),
  );
  if (!maze) return null;
  const { ids, nodes, edges, start, goal } = maze;
  const title = (kind === 'picnic' ? PICNIC_TITLES : TOOTH_TITLES)[index % 6]!;

  if (kind === 'picnic') {
    const mids = shuffle(rand, ids.filter((id) => id !== start && id !== goal));
    const collect = mids.find((id) => {
      const point = nodes[id]!;
      return hypot(point, nodes[start]!) >= 240 && hypot(point, nodes[goal]!) >= 240;
    }) ?? mids[0];
    if (!collect) return null;
    const level: LevelDef = {
      ...title,
      start,
      collect,
      goal,
      nodes,
      edges,
    };
    return valid(level, 'picnic') ? level : null;
  }

  const draft: LevelDef = { ...title, start, goal, nodes, edges };
  const graph = makeGraph([draft], 0);
  const path = findSolution(graph, graph.start, true, new Set());
  if (!path || !path.length) return null;
  const onPath = new Set<string>([start, ...path]);
  const spare = shuffle(rand, ids.filter((id) => !onPath.has(id)));
  let hazards = spare.slice(0, Math.min(spare.length, 1 + (index % 3)));
  if (!hazards.length) {
    const spur = placeSpur(nodes, edges, [...onPath], rand);
    if (spur) hazards = [spur];
  }
  if (!hazards.length) return null;
  const level: LevelDef = { ...draft, nodes, edges, hazards };
  return valid(level, 'tooth') ? level : null;
}

export function generateMaze(kind: MazeKind, index: number, seed = 0): LevelDef {
  return firstValid(64, (attemptNo) => attempt(kind, index, attemptNo, seed), () => fallback(kind, index));
}
