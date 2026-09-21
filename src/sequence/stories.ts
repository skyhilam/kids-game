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
  | 'picnic-shop'
  | 'picnic-spread'
  | 'delivery-short'
  | 'picnic-full'
  | 'picnic-burger'
  | 'delivery-day';

export type SequenceStory = {
  id: SequenceStoryId;
  steps: readonly SequenceStep[];
};

export type SequenceDeal = {
  id: SequenceStoryId;
  steps: readonly SequenceStep[];
  tray: SequenceStep[];
};

export type SequenceSlots = Array<SpriteName | null>;

export type SequenceJudge = 'incomplete' | 'correct' | 'wrong';

function step(sprite: SpriteName, label: string): SequenceStep {
  return { sprite, label };
}

export const EASY_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-basic',
    steps: [step('home', '家'), step('burger', '漢堡'), step('park', '公園')],
  },
  {
    id: 'drive-park',
    steps: [step('home', '家'), step('car', '小車'), step('park', '公園')],
  },
  {
    id: 'kid-brush',
    steps: [step('kid', '小朋友'), step('toothbrush', '牙刷'), step('tooth', '牙齒')],
  },
];

export const BASIC_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-shop',
    steps: [step('home', '家'), step('shop', '商店'), step('burger', '漢堡'), step('park', '公園')],
  },
  {
    id: 'picnic-spread',
    steps: [step('home', '家'), step('car', '小車'), step('park', '公園'), step('picnic', '野餐')],
  },
  {
    id: 'delivery-short',
    steps: [step('truck', '貨車'), step('parcel', '包裹'), step('home', '家'), step('park', '公園')],
  },
];

export const PUZZLE_STORIES: readonly SequenceStory[] = [
  {
    id: 'picnic-full',
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
    steps: [
      step('truck', '貨車'),
      step('parcel', '包裹'),
      step('shop', '商店'),
      step('home', '家'),
      step('park', '公園'),
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
  };
}
