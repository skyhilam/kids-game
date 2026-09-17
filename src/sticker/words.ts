import type { SpriteName } from '../art/sprites';
import { mulberry32, shuffle } from '../game/rng';

export const WORD_IDS = ['burger', 'car', 'home', 'tree', 'flower', 'sun'] as const satisfies readonly SpriteName[];

export type WordId = (typeof WORD_IDS)[number];

export type PlacedMap = Partial<Record<WordId, WordId>>;

export type StickerDeal = {
  slots: WordId[];
  tray: WordId[];
};

export type PlaceResult =
  | { kind: 'correct'; placed: PlacedMap; cleared: boolean }
  | { kind: 'wrong' }
  | { kind: 'blocked' };

export const WORD_ZH: Record<WordId, string> = {
  burger: '漢堡',
  car: '小車',
  home: '房子',
  tree: '樹',
  flower: '花',
  sun: '太陽',
};

export function dealBoard(seed: number): StickerDeal {
  const rand = mulberry32(seed);
  return {
    slots: shuffle(rand, WORD_IDS),
    tray: shuffle(rand, WORD_IDS),
  };
}

export function slotOf(placed: PlacedMap, sticker: WordId): WordId | null {
  for (const slot of WORD_IDS) {
    if (placed[slot] === sticker) return slot;
  }
  return null;
}

export function lift(placed: PlacedMap, sticker: WordId): PlacedMap {
  const next = { ...placed };
  const slot = slotOf(next, sticker);
  if (slot) delete next[slot];
  return next;
}

export function isCleared(placed: PlacedMap): boolean {
  return WORD_IDS.every((id) => placed[id] === id);
}

export function placedCount(placed: PlacedMap): number {
  return WORD_IDS.filter((id) => placed[id] === id).length;
}

export function tryPlace(placed: PlacedMap, slot: WordId, sticker: WordId): PlaceResult {
  const occupant = placed[slot];
  if (occupant && occupant !== sticker) return { kind: 'blocked' };
  if (slot !== sticker) return { kind: 'wrong' };
  const next = lift(placed, sticker);
  next[slot] = sticker;
  return { kind: 'correct', placed: next, cleared: isCleared(next) };
}
