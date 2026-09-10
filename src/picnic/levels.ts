import { generateMaze } from '../game/generate';
import { randomSeed } from '../game/rng';
import type { LevelDef } from '../game/types';

export const LEVELS: readonly LevelDef[] = [
  {
    name: '沿路前行',
    short: '沿路',
    start: 's',
    collect: 'h',
    goal: 'p',
    tutorial: true,
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p']],
  },
  {
    name: '先購漢堡',
    short: '選擇',
    start: 's',
    collect: 'h',
    goal: 'p',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p'],['a','c'],['c','d'],['d','p']],
  },
  {
    name: '小小探路家',
    short: '探路',
    start: 's',
    collect: 'h',
    goal: 'p',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545],u:[685,155],v:[540,155]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p'],['a','c'],['c','d'],['d','h'],['d','p'],['b','u'],['u','v']],
  },
  {
    name: '繞路尋店',
    short: '繞路',
    start: 's',
    collect: 'h',
    goal: 'p',
    nodes: {s:[135,155],a:[135,345],h:[435,155],m:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545]},
    edges: [['s','a'],['a','m'],['m','b'],['b','p'],['s','h'],['h','m'],['a','c'],['c','d'],['d','p'],['m','d']],
  },
  {
    name: '雙路並行',
    short: '雙路',
    start: 's',
    collect: 'h',
    goal: 'p',
    nodes: {s:[135,155],h:[435,155],k:[685,155],a:[135,345],m:[435,345],b:[685,345],c:[135,545],d:[435,545],p:[685,545]},
    edges: [['s','h'],['h','k'],['k','b'],['s','a'],['a','m'],['m','b'],['b','p'],['a','c'],['c','d'],['d','p'],['h','m'],['m','d']],
  },
  {
    name: '盡頭探險',
    short: '盡頭',
    start: 's',
    collect: 'h',
    goal: 'p',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545],u:[685,155],v:[540,155],w:[280,155],x:[280,545]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p'],['a','c'],['c','d'],['d','h'],['d','p'],['b','u'],['u','v'],['s','w'],['c','x'],['h','u']],
  },
];

export function picnicLevel(index: number, seed = 0): LevelDef {
  const level = generateMaze('picnic', index, seed);
  return index === 0 ? { ...level, tutorial: true } : level;
}

/** One random shuffle per call; the same index stays the same map until remount. */
export function picnicCatalog(seed = randomSeed()): (index: number) => LevelDef {
  return (index) => picnicLevel(index, seed);
}
