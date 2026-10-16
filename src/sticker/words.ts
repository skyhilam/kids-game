import { WORD_BANK } from './wordBank';
import { mulberry32, shuffle } from '../game/rng';
import { stickerLoadBand, type LoadBand } from '../game/stages';

export const WORD_IDS = WORD_BANK.map(({ id }) => id);

export type WordId = (typeof WORD_BANK)[number]['id'];

export type PlacedMap = Partial<Record<WordId, WordId>>;

export type StickerDeal = {
  slots: WordId[];
  tray: WordId[];
};

const BAND_ORDER: readonly LoadBand[] = ['easy', 'basic', 'puzzle'];

function poolUpTo(band: LoadBand): readonly WordId[] {
  return WORD_BANK.filter((entry) => BAND_ORDER.indexOf(entry.band) <= BAND_ORDER.indexOf(band))
    .map(({ id }) => id);
}

export const EASY_POOL = poolUpTo('easy');
export const BASIC_POOL = poolUpTo('basic');
export const PUZZLE_POOL = poolUpTo('puzzle');

export const STICKER_POOL: Record<LoadBand, readonly WordId[]> = {
  easy: EASY_POOL,
  basic: BASIC_POOL,
  puzzle: PUZZLE_POOL,
};

export const STICKER_LOAD_COUNT: Record<LoadBand, number> = {
  easy: 4,
  basic: 5,
  puzzle: 6,
};

/** Prior deals whose words are avoided when the pool still has unused items. */
export const STICKER_RECENT_DEALS = 2;

export function stickerWordCount(level = 0): number {
  return STICKER_LOAD_COUNT[stickerLoadBand(level)];
}

export type PlaceResult =
  | { kind: 'correct'; placed: PlacedMap; cleared: boolean }
  | { kind: 'wrong' }
  | { kind: 'blocked' };

export const WORD_ZH = Object.fromEntries(WORD_BANK.map(({ id, zh }) => [id, zh])) as Record<WordId, string>;

/** English TTS / UI label can differ from the sprite id. */
export const WORD_EN = Object.fromEntries(WORD_BANK.map(({ id, en }) => [id, en])) as Record<WordId, string>;

export function isWordId(id: string): id is WordId {
  return (WORD_IDS as readonly string[]).includes(id);
}

export function rollRecent(history: readonly (readonly WordId[])[], deal: readonly WordId[]): WordId[][] {
  return [...history.map((item) => [...item]), [...deal]].slice(-STICKER_RECENT_DEALS);
}

function pickWords(
  rand: () => number,
  count: number,
  recent: ReadonlySet<WordId>,
  pool: readonly WordId[],
): WordId[] {
  const fresh = pool.filter((id) => !recent.has(id));
  const reused = pool.filter((id) => recent.has(id));
  if (fresh.length >= count) return shuffle(rand, fresh).slice(0, count);
  return [...fresh, ...shuffle(rand, reused).slice(0, count - fresh.length)];
}

export function dealBoard(seed: number, level = 0, recent: readonly WordId[] = []): StickerDeal {
  const rand = mulberry32(seed);
  const band = stickerLoadBand(level);
  const words = pickWords(rand, stickerWordCount(level), new Set(recent), STICKER_POOL[band]);
  return {
    slots: shuffle(rand, words),
    tray: shuffle(rand, words),
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

export function isCleared(placed: PlacedMap, words: readonly WordId[] = WORD_IDS): boolean {
  return words.length > 0 && words.every((id) => placed[id] === id);
}

export function placedCount(placed: PlacedMap, words: readonly WordId[] = WORD_IDS): number {
  return words.filter((id) => placed[id] === id).length;
}

export function tryPlace(
  placed: PlacedMap,
  slot: WordId,
  sticker: WordId,
  words: readonly WordId[] = WORD_IDS,
): PlaceResult {
  const occupant = placed[slot];
  if (occupant && occupant !== sticker) return { kind: 'blocked' };
  if (slot !== sticker) return { kind: 'wrong' };
  const next = lift(placed, sticker);
  next[slot] = sticker;
  return { kind: 'correct', placed: next, cleared: isCleared(next, words) };
}
