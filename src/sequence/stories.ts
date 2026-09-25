import type { SpriteName } from '../art/sprites';
import { mulberry32, shuffle } from '../game/rng';
import { sequenceLoadBand, type LoadBand } from '../game/stages';

export const SEQUENCE_RECENT = 2;

export const SEQUENCE_LOAD_COUNT: Record<LoadBand, number> = {
  easy: 3,
  basic: 4,
  puzzle: 5,
};

export type SequenceStep = {
  sprite: SpriteName;
  label: string;
};

export type SequenceStoryId =
  | 'picnic-basic'
  | 'drive-park'
  | 'kid-brush'
  | 'farm-pets'
  | 'farm-pond'
  | 'picnic-shop'
  | 'picnic-spread'
  | 'delivery-short'
  | 'farm-visit'
  | 'farm-barn'
  | 'picnic-full'
  | 'picnic-burger'
  | 'delivery-day'
  | 'farm-day'
  | 'farm-yard';

export type SequenceStory = {
  id: SequenceStoryId;
  steps: readonly SequenceStep[];
  /** Fixed tray narration shown on stage enter. */
  narration: string;
};

export type SequenceDeal = {
  id: SequenceStoryId;
  steps: readonly SequenceStep[];
  tray: SequenceStep[];
  narration: string;
};

export type SequenceSlots = Array<SpriteName | null>;

export type SequenceJudge = 'incomplete' | 'correct' | 'wrong';

function step(sprite: SpriteName, label: string): SequenceStep {
  return { sprite, label };
}

export const EASY_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-basic',
    narration: '先離開屋企，去買漢堡，再去公園玩。',
    steps: [step('home', '家'), step('burger', '漢堡'), step('park', '公園')],
  },
  {
    id: 'drive-park',
    narration: '先離開屋企，坐小車出門，再去到公園。',
    steps: [step('home', '家'), step('car', '小車'), step('park', '公園')],
  },
  {
    id: 'kid-brush',
    narration: '小朋友先準備好，攞起牙刷，再刷牙齒。',
    steps: [step('kid', '小朋友'), step('toothbrush', '牙刷'), step('tooth', '牙齒')],
  },
  {
    id: 'farm-pets',
    narration: '農場先見狗迎接，再摸貓，最後抱兔。',
    steps: [step('dog', '狗'), step('cat', '貓'), step('rabbit', '兔')],
  },
  {
    id: 'farm-pond',
    narration: '水邊先見鴨游水，再見到青蛙，最後見到龜。',
    steps: [step('duck', '鴨'), step('frog', '青蛙'), step('tortoise', '龜')],
  },
];

export const BASIC_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-shop',
    narration: '先離開屋企，去商店買嘢，攞到漢堡，再去公園。',
    steps: [step('home', '家'), step('shop', '商店'), step('burger', '漢堡'), step('park', '公園')],
  },
  {
    id: 'picnic-spread',
    narration: '先離開屋企，坐小車出門，去到公園，再鋪開野餐。',
    steps: [step('home', '家'), step('car', '小車'), step('park', '公園'), step('picnic', '野餐')],
  },
  {
    id: 'delivery-short',
    narration: '貨車先出發，載住包裹，送到屋企，再去公園。',
    steps: [step('truck', '貨車'), step('parcel', '包裹'), step('home', '家'), step('park', '公園')],
  },
  {
    id: 'farm-visit',
    // 語意 v2：雞媽媽先帶路 → 小雞跟住 → 去到水邊先見鴨 → 再見到青蛙。
    narration: '雞媽媽先帶路，小雞跟住媽媽，去到水邊先見鴨，再見到青蛙。',
    steps: [step('chicken', '雞'), step('chick', '小雞'), step('duck', '鴨'), step('frog', '青蛙')],
  },
  {
    id: 'farm-barn',
    narration: '農場門口先見狗，再見到羊，之後見豬，最後見牛。',
    steps: [step('dog', '狗'), step('sheep', '羊'), step('pig', '豬'), step('cow', '牛')],
  },
];

export const PUZZLE_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-full',
    narration: '先離開屋企，坐小車，去商店，再到公園，最後野餐。',
    steps: [
      step('home', '家'),
      step('car', '小車'),
      step('shop', '商店'),
      step('park', '公園'),
      step('picnic', '野餐'),
    ],
  },
  {
    id: 'picnic-burger',
    narration: '先離開屋企，攞埋漢堡，坐小車出門，去到公園，再野餐。',
    steps: [
      step('home', '家'),
      step('burger', '漢堡'),
      step('car', '小車'),
      step('park', '公園'),
      step('picnic', '野餐'),
    ],
  },
  {
    id: 'delivery-day',
    narration: '貨車先出發，載住包裹，經商店，送到屋企，再去公園。',
    steps: [
      step('truck', '貨車'),
      step('parcel', '包裹'),
      step('shop', '商店'),
      step('home', '家'),
      step('park', '公園'),
    ],
  },
  {
    id: 'farm-day',
    narration: '小朋友先到農場，狗狗迎接，再睇羊，之後見牛，最後見馬。',
    steps: [
      step('kid', '小朋友'),
      step('dog', '狗'),
      step('sheep', '羊'),
      step('cow', '牛'),
      step('horse', '馬'),
    ],
  },
  {
    id: 'farm-yard',
    narration: '院子先見貓，再見雞，去到水邊見鴨同青蛙，最後抬頭見鳥。',
    steps: [
      step('cat', '貓'),
      step('chicken', '雞'),
      step('duck', '鴨'),
      step('frog', '青蛙'),
      step('bird', '鳥'),
    ],
  },
];

export const SEQUENCE_POOL: Record<LoadBand, readonly SequenceStory[]> = {
  easy: EASY_STORIES,
  basic: BASIC_STORIES,
  puzzle: PUZZLE_STORIES,
};

export const SEQUENCE_STORIES: readonly SequenceStory[] = [
  ...EASY_STORIES,
  ...BASIC_STORIES,
  ...PUZZLE_STORIES,
];

export function sequenceStepCount(level = 0): number {
  return SEQUENCE_LOAD_COUNT[sequenceLoadBand(level)];
}

export function rollRecentStories(
  history: readonly SequenceStoryId[],
  storyId: SequenceStoryId,
): SequenceStoryId[] {
  return [...history, storyId].slice(-SEQUENCE_RECENT);
}

export function emptySlots(count: number): SequenceSlots {
  return Array.from({ length: count }, () => null);
}

export function filledCount(slots: readonly (SpriteName | null)[]): number {
  return slots.filter((slot) => slot !== null).length;
}

export function isFull(slots: readonly (SpriteName | null)[]): boolean {
  return slots.length > 0 && slots.every((slot) => slot !== null);
}

export function isOrdered(
  slots: readonly (SpriteName | null)[],
  steps: readonly SequenceStep[],
): boolean {
  return slots.length === steps.length
    && slots.every((sprite, index) => sprite === steps[index]!.sprite);
}

export function placeInLeftmost(
  slots: readonly (SpriteName | null)[],
  sprite: SpriteName,
): SequenceSlots {
  if (slots.includes(sprite)) return [...slots];
  const next = [...slots];
  const empty = next.indexOf(null);
  if (empty === -1) return next;
  next[empty] = sprite;
  return next;
}

export function removeFromSlot(
  slots: readonly (SpriteName | null)[],
  index: number,
): SequenceSlots {
  const next = [...slots];
  if (index >= 0 && index < next.length) next[index] = null;
  return next;
}

/** Judge only when every slot is filled; otherwise stay incomplete. */
export function judgeWhenFull(
  slots: readonly (SpriteName | null)[],
  steps: readonly SequenceStep[],
): SequenceJudge {
  if (slots.length !== steps.length || !isFull(slots)) return 'incomplete';
  return isOrdered(slots, steps) ? 'correct' : 'wrong';
}

export function dealSequence(
  seed: number,
  level = 0,
  recent: readonly SequenceStoryId[] = [],
): SequenceDeal {
  const rand = mulberry32(seed);
  const band = sequenceLoadBand(level);
  const pool = SEQUENCE_POOL[band];
  const recentInPool = new Set(recent.filter((id) => pool.some((story) => story.id === id)));
  const fresh = pool.filter((story) => !recentInPool.has(story.id));
  const chosen = shuffle(rand, fresh.length > 0 ? [...fresh] : [...pool])[0]!;
  return {
    id: chosen.id,
    steps: chosen.steps,
    tray: shuffle(rand, chosen.steps),
    narration: chosen.narration,
  };
}
