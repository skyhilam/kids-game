import type { LevelDef } from './types';

/** Original enlarged maps. A road is an undirected edge. */
export const LEVELS: readonly LevelDef[] = [
  {
    name: '跟住小路走',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p']],
  },
  {
    name: '記得買漢堡',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p'],['a','c'],['c','d'],['d','p']],
  },
  {
    name: '小小探路家',
    nodes: {s:[135,155],a:[135,345],h:[435,345],b:[685,345],p:[685,545],c:[135,545],d:[435,545],u:[685,155],v:[540,155]},
    edges: [['s','a'],['a','h'],['h','b'],['b','p'],['a','c'],['c','d'],['d','h'],['d','p'],['b','u'],['u','v']],
  },
];
