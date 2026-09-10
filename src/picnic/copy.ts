import { available } from '../game/rules';
import type { GraphLabels } from '../game/graph';
import {
  startGuideFrom,
  type GuideLine,
  type OverlayCopy,
  type SessionCopy,
} from '../game/copy';
import type { Graph, MoveOk } from '../game/types';

export const NODE_LABELS: GraphLabels = {
  start: '出發',
  collect: '漢堡店',
  goal: '公園',
  junction: '路口',
  deadend: '小路盡頭',
};

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
  beforeCollect: {
    main: '請輕觸綠色光圈。',
    sub: '沿此路線可先到達漢堡店。',
  },
  afterCollect: {
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

export function startGuide(graph: Graph, levelIndex: number): GuideLine & { announce: string } {
  return startGuideFrom(START_GUIDE, graph, levelIndex);
}

export function hintGuide(collected: boolean): GuideLine {
  return collected ? HINT_GUIDE.afterCollect : HINT_GUIDE.beforeCollect;
}

export function arrivalKind(graph: Graph, result: MoveOk, used: Set<string>): ArrivalKind {
  if (result.won) return 'won';
  if (result.stalled === 'missing-collect') return 'stuckBurger';
  if (result.stalled === 'deadend') return 'stuckDeadend';
  if (result.collectedNow) return 'bought';
  if (result.collected) return 'toPark';
  const roads = new Set(used);
  roads.add(result.edgeId);
  if (available(graph, result.to, roads).length > 1) return 'fork';
  return 'path';
}

export function arrivalGuide(graph: Graph, result: MoveOk, used: Set<string>): GuideLine {
  return ARRIVAL_GUIDE[arrivalKind(graph, result, used)];
}

export const sessionCopy: SessionCopy = {
  labels: NODE_LABELS,
  startGuide,
  hintGuide,
  arrivalGuide,
};

export const speech = {
  welcome: SPEECH.welcome,
  rescue: SPEECH.rescue,
  win: SPEECH.win,
  winAllDone: SPEECH.winAllDone,
  collected: ARRIVAL_GUIDE.bought.main,
  stuck: {
    'missing-collect': SPEECH.stuckBurger,
    deadend: SPEECH.stuckDeadend,
  },
};

export const confettiPalette = ['#e89d7d', '#e9c465', '#9fb983', '#9fc3bf', '#d8b5a0'] as const;

export const overlayCopy: OverlayCopy = {
  welcome: {
    eyebrow: '一段小路 · 一次旅程',
    title: '一起去野餐',
    body: '駕駛小車購買漢堡，<br>再前往公園，與小熊野餐。',
  },
  stuck: {
    eyebrow: '從容再試',
    title: (reason) => (reason === 'missing-collect' ? '尚未購買漢堡' : '此路已經走到盡頭'),
    body: (reason) => (reason === 'missing-collect'
      ? '請先前往漢堡店，<br>再前往公園野餐。'
      : '沒有關係，請改選其他路線。<br>可由起點重新出發。'),
    footnote: '小熊會陪伴你，不必著急。',
  },
  win: {
    eyebrow: (level) => `第 ${level + 1} 關 · 小旅行完成`,
    title: '已到達公園',
    body: (allDone) => `漢堡已經帶到，小熊很高興。<br>${allDone ? '所有關卡均已完成。' : '一起坐下野餐。'}`,
    stamps: ['已購漢堡', '已到公園', '沒有重複通行'] as const,
  },
  help: {
    task: '由紅色小車出發，先前往漢堡店，再到藍色箭頭的公園。<strong>同一路段不可重複通行</strong>，走過的道路會變成橙色。不計時、不扣分；若走到盡頭，可重新開始。',
    controls: '輕觸發光圓圈，小車會沿路駛至下一路口；亦可由小車向相鄰光圈輕掃。圓圈只顯示尚未通行的道路。按「提示」會以綠色圓圈標示可完成任務的下一步；若已無法完成，可重新開始。',
  },
  rescue: {
    title: '此路線無法到達目的地',
    body: '在不重複通行的規則下，請由起點再試。<br>一起選擇另一條小路。',
  },
};
