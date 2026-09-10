import { generateMaze } from '../game/generate';
import { randomSeed } from '../game/rng';
import type { LevelDef } from '../game/types';

export const TOOTH_LEVELS: readonly LevelDef[] = [
  {
    name: '認識小路',
    short: '認識',
    start: 's',
    goal: 'g',
    tutorial: true,
    hazards: ['x'],
    nodes: {s:[140,340],a:[360,340],g:[680,340],x:[360,160]},
    edges: [['s','a'],['a','g'],['a','x']],
  },
  {
    name: '避開蛀蟲',
    short: '避開',
    start: 's',
    goal: 'g',
    hazards: ['b','f'],
    nodes: {
      s:[140,340],a:[300,340],b:[300,160],c:[300,520],
      d:[500,340],e:[500,160],f:[500,520],g:[700,340],
    },
    edges: [
      ['s','a'],['a','b'],['a','c'],['a','d'],
      ['c','d'],['d','e'],['d','f'],['d','g'],['e','g'],
    ],
  },
  {
    name: '同一條路一次',
    short: '一次',
    start: 's',
    goal: 'g',
    hazards: ['b','h1','h2'],
    nodes: {
      s:[140,160],a:[140,340],b:[140,520],e:[360,160],c:[360,340],d:[360,520],
      h1:[580,160],f:[580,340],h2:[580,520],g:[740,340],
    },
    edges: [
      ['s','a'],['a','c'],['c','f'],['f','g'],
      ['s','e'],['e','c'],['a','b'],['c','d'],['d','g'],
      ['e','h1'],['f','h2'],
    ],
  },
];

export function toothLevel(index: number, seed = 0): LevelDef {
  const level = generateMaze('tooth', index, seed);
  return index === 0 ? { ...level, tutorial: true } : level;
}

/** One random shuffle per call; the same index stays the same map until remount. */
export function toothCatalog(seed = randomSeed()): (index: number) => LevelDef {
  return (index) => toothLevel(index, seed);
}
