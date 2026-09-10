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
  goal: '終點',
  hazard: '蛀牙蟲',
  junction: '路口',
  deadend: '小路盡頭',
};

export const START_GUIDE = {
  tutorial: {
    main: '輕觸光圈，沿小路前進。',
    sub: '請走到終點，途中不要遇到蛀牙蟲。',
    announce: '請輕觸發光圓圈，走向終點。同一路段僅可通行一次。',
  },
  standard: {
    main: '請走到終點，並避開蛀牙蟲。',
    announce: '請走到終點。途中不可遇到蛀牙蟲，同一路段僅可通行一次。',
  },
} as const;

export const ARRIVAL_GUIDE = {
  won: {
    main: '已到達終點，牙齒亮晶晶。',
    sub: '你避開了蛀牙蟲，完成這次刷牙之路。',
  },
  stuckDeadend: {
    main: '此路已經走到盡頭。',
    sub: '請由起點再出發，避開蛀牙蟲。',
  },
  stuckHazard: {
    main: '途中遇到蛀牙蟲了。',
    sub: '請避開蛀牙蟲，改選其他路線。',
  },
  fork: {
    main: '已到達路口，哪一條路沒有蛀牙蟲？',
    sub: '請輕觸光圈，選擇要走的道路。',
  },
  path: {
    main: '請沿小路繼續前進。',
    sub: '同一路段僅可通行一次，途中不可遇到蛀牙蟲。',
  },
} as const;

export const HINT_GUIDE = {
  main: '請輕觸綠色光圈。',
  sub: '沿此路線可避開蛀牙蟲，走到終點。',
} as const;

export const SPEECH = {
  welcome: '開始遊戲。請走到終點，途中不要遇到蛀牙蟲。',
  rescue: '此路線無法安全到達終點。請重新出發，改選其他小路。',
  stuckDeadend: '此路已經走到盡頭。沒有關係，一起再試一次。',
  stuckHazard: '途中遇到蛀牙蟲了。請避開牠們，再試一次。',
  win: '已到達終點。牙齒亮晶晶。',
  winAllDone: '已到達終點。所有關卡均已完成。',
} as const;

export type ArrivalKind = keyof typeof ARRIVAL_GUIDE;

export function startGuide(graph: Graph, levelIndex: number): GuideLine & { announce: string } {
  return startGuideFrom(START_GUIDE, graph, levelIndex);
}

export function hintGuide(_collected: boolean): GuideLine {
  return HINT_GUIDE;
}

export function arrivalKind(graph: Graph, result: MoveOk, used: Set<string>): ArrivalKind {
  if (result.won) return 'won';
  if (result.stalled === 'hazard') return 'stuckHazard';
  if (result.stalled === 'deadend') return 'stuckDeadend';
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
  stuck: {
    hazard: SPEECH.stuckHazard,
    deadend: SPEECH.stuckDeadend,
  },
};

export const confettiPalette = ['#e89d7d', '#e9c465', '#9fb983', '#9fc3bf', '#8b7bb8'] as const;

export const overlayCopy: OverlayCopy = {
  welcome: {
    eyebrow: '保護牙齒 · 走避蛀蟲',
    title: '打敗蛀牙蟲',
    body: '從出發處走到終點。<br>途中不可遇到蛀牙蟲，同一路段也不可走兩次。',
  },
  stuck: {
    eyebrow: '從容再試',
    title: (reason) => {
      if (reason === 'hazard') return '途中遇到蛀牙蟲';
      if (reason === 'deadend') return '此路已經走到盡頭';
      return '請再試一次';
    },
    body: (reason) => (reason === 'hazard'
      ? '請避開蛀牙蟲，<br>改選其他路線。'
      : '沒有關係，請改選其他路線。<br>可由起點重新出發。'),
    footnote: '沒有扣分，可從容再試。',
  },
  win: {
    eyebrow: (level) => `第 ${level + 1} 關 · 刷牙完成`,
    title: '牙齒亮晶晶',
    body: (allDone) => `已安全走到終點。<br>${allDone ? '所有關卡均已完成。' : '繼續保持，天天刷牙。'}`,
    stamps: ['避開蛀牙蟲', '到達終點', '沒有重複通行'] as const,
  },
  help: {
    task: '從出發處走到終點。<strong>途中不可遇到蛀牙蟲</strong>，同一路段也不可重複通行。走過的道路會變成橙色。不計時、不扣分。',
    controls: '輕觸發光圓圈前進。按「提示」會以綠色圓圈標示可安全到達終點的下一步。',
  },
  rescue: {
    title: '此路線無法安全到達終點',
    body: '在不重複通行、不遇到蛀牙蟲的規則下，<br>請由起點再試。',
  },
};
