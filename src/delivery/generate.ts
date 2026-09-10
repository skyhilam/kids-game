import { firstValid, generateGridMaze, type Grid, type GridMaze } from '../game/gridMaze';
import { mixSeed, mulberry32, randomSeed } from '../game/rng';
import {
  createRouteState,
  findRouteSolution,
  type RouteMission,
} from '../game/routeMission';
import { DELIVERY_MISSION } from './mission';

const GRID_3x3: Grid = { xs: [160, 420, 680], ys: [170, 370, 570] };
const GRID_4x3: Grid = { xs: [140, 340, 540, 740], ys: [170, 370, 570] };
const DELIVERY_SALT = 91;

function extraRoads(leftover: number, rand: () => number): number {
  return Math.max(0, leftover - (rand() > 0.5 ? 1 : 2));
}

function dist(maze: GridMaze, a: string, b: string): number {
  const pa = maze.nodes[a]!;
  const pb = maze.nodes[b]!;
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

function pickHouses(maze: GridMaze, count: number): string[] | null {
  const taken = new Set([maze.start, maze.goal]);
  const houses: string[] = [];
  for (let n = 0; n < count; n += 1) {
    let best: string | undefined;
    let bestScore = -1;
    for (const id of maze.ids) {
      if (taken.has(id)) continue;
      const score = Math.min(...[...taken].map((other) => dist(maze, id, other)));
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (!best) return null;
    houses.push(best);
    taken.add(best);
  }
  return houses;
}

function asMission(maze: GridMaze, houses: string[]): RouteMission {
  const mapping: Record<string, string> = {
    [maze.start]: 'start',
    [maze.goal]: 'finish',
    [houses[0]!]: 'house1',
    [houses[1]!]: 'house2',
    [houses[2]!]: 'house3',
  };
  const nodes: RouteMission['nodes'] = {};
  Object.entries(maze.nodes).forEach(([id, point]) => {
    nodes[mapping[id] ?? id] = point;
  });
  return {
    name: '送貨員來了',
    width: 840,
    height: 720,
    start: 'start',
    finish: 'finish',
    stops: [
      { node: 'house1', label: '1 號屋' },
      { node: 'house2', label: '2 號屋' },
      { node: 'house3', label: '3 號屋' },
    ],
    nodes,
    edges: maze.edges.map(([a, b]) => [mapping[a] ?? a, mapping[b] ?? b]),
  };
}

function valid(mission: RouteMission): boolean {
  if (mission.stops.length !== 3 || mission.edges.length > 24) return false;
  if (!mission.nodes.start || !mission.nodes.finish) return false;
  if (mission.stops.some((stop) => !mission.nodes[stop.node])) return false;
  const path = findRouteSolution(mission, createRouteState(mission));
  return Boolean(path && path.length);
}

function attempt(seed: number, attemptNo: number): RouteMission | null {
  const rand = mulberry32(mixSeed(seed, DELIVERY_SALT, attemptNo));
  const grid = rand() < 0.42 ? GRID_3x3 : GRID_4x3;
  const maze = generateGridMaze(rand, grid, (leftover) => extraRoads(leftover, rand));
  if (!maze) return null;
  const houses = pickHouses(maze, 3);
  if (!houses) return null;
  for (const first of houses) {
    for (const second of houses) {
      if (second === first) continue;
      for (const third of houses) {
        if (third === first || third === second) continue;
        const mission = asMission(maze, [first, second, third]);
        if (valid(mission)) return mission;
      }
    }
  }
  return null;
}

export function generateDeliveryMission(seed = 0): RouteMission {
  return firstValid(64, (attemptNo) => attempt(seed, attemptNo), () => DELIVERY_MISSION);
}

export function deliveryMission(seed = randomSeed()): RouteMission {
  return generateDeliveryMission(seed);
}
