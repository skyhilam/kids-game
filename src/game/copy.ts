import { available } from './rules';
import type { Graph, MoveOk } from './types';

export const START_GUIDE = {
  tutorial: {
    main: '輕觸光圈，小車便會前進。',
    sub: '請先前往漢堡店，再前往公園野餐。',
    announce: '請輕觸發光圓圈，前往購買漢堡。',
  },
  standard: {
    main: '請先尋找漢堡店，再前往公園。',
    announce: '請先前往漢堡店，再前往公園。每段道路僅可通行一次。',
  },
} as const;

export const ARRIVAL_GUIDE = {
  bought: {
    main: '已購得漢堡，請前往公園。',
    sub: '小熊已帶上漢堡，請繼續選擇尚未通行的道路。',
  },
  won: {
    main: '已到達公園，一起享用漢堡。',
    sub: '你已帶領小熊完成這次旅程。',
  },
  stuckBurger: {
    main: '請先前往漢堡店。',
    sub: '沒有扣分，可從容再試。',
  },
  stuckDeadend: {
    main: '請改選其他路線，重新出發。',
    sub: '沒有扣分，可從容再試。',
  },
  toPark: {
    main: '已購得漢堡，請前往公園。',
    sub: '請選擇尚未變成橙色的道路，向公園出發。',
  },
  fork: {
    main: '已到達路口，漢堡店在哪裡？',
    sub: '請輕觸光圈，選擇要走的道路。',
  },
  path: {
    main: '請沿小路繼續前進。',
    sub: '請先購買漢堡，再前往公園。每段道路僅可通行一次。',
  },
} as const;

export const HINT_GUIDE = {
  shop: {
    main: '請輕觸綠色光圈。',
    sub: '沿此路線可先到達漢堡店。',
  },
  park: {
    main: '請輕觸綠色光圈。',
    sub: '沿此路線即可到達公園。',
  },
} as const;

export const SPEECH = {
  welcome: '開始遊戲。請輕觸發光圓圈，前往購買漢堡。',
  rescue: '此路線無法到達目的地。請重新出發，改選其他小路。',
  stuckBurger: '尚未購買漢堡。請先前往漢堡店，再前往公園。',
  stuckDeadend: '此路已經走到盡頭。沒有關係，一起再試一次。',
  win: '已到達公園。小熊很高興，一起享用漢堡。',
  winAllDone: '已到達公園。所有關卡均已完成，一起享用漢堡。',
} as const;

export type ArrivalKind = keyof typeof ARRIVAL_GUIDE;

export function startGuide(graph: Graph, levelIndex: number): {
  main: string;
  sub: string;
  announce: string;
} {
  if (graph.tutorial) return { ...START_GUIDE.tutorial };
  return {
    main: START_GUIDE.standard.main,
    sub: `第 ${levelIndex + 1} 關 · ${graph.name}。橙色道路表示已經通行。`,
    announce: START_GUIDE.standard.announce,
  };
}

export function arrivalKind(graph: Graph, result: MoveOk, used: Set<string>): ArrivalKind {
  if (result.won) return 'won';
  if (result.stalled === 'burger') return 'stuckBurger';
  if (result.stalled === 'deadend') return 'stuckDeadend';
  if (result.boughtNow) return 'bought';
  if (result.burger) return 'toPark';
  const roads = new Set(used);
  roads.add(result.edgeId);
  if (available(graph, result.to, roads).length > 1) return 'fork';
  return 'path';
}
