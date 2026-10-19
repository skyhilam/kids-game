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

/** Spoken hint when English TTS is unavailable: approximate sound · mouth shape. */
export const WORD_HINT: Record<WordId, string> = {
  sun: 'san · 嘴微張',
  car: 'kar · 嘴張大',
  home: 'hom · 嘴圓',
  tree: 'tree · 舌尖輕出',
  flower: 'flau-er · 嘴先圓後開',
  bear: 'bair · 雙唇輕開',
  kid: 'kid · 嘴微開',
  park: 'park · 嘴張大',
  apple: 'a-pl · 嘴先大後合',
  banana: 'be-na-na · 嘴微張',
  cat: 'kat · 嘴微開',
  dog: 'dog · 嘴圓',
  duck: 'duk · 嘴圓',
  fish: 'fish · 門牙輕咬下唇',
  cake: 'keik · 嘴向兩邊',
  star: 'star · 嘴微張',
  burger: 'ber-ger · 嘴圓再開',
  shop: 'shop · 嘴圓',
  truck: 'truk · 嘴圓',
  picnic: 'pik-nik · 嘴先閉後開',
  cow: 'kau · 嘴圓',
  pig: 'pig · 嘴微開',
  sheep: 'sheep · 嘴向兩邊',
  rabbit: 'ra-bit · 嘴微張',
  bee: 'bee · 嘴向兩邊',
  butterfly: 'ba-ter-flai · 嘴先合後開',
  pizza: 'pit-sa · 嘴先閉後開',
  milk: 'milk · 雙唇合住',
  train: 'trein · 嘴向兩邊',
  rocket: 'ro-kit · 嘴圓再開',
  drum: 'drum · 嘴圓',
  guitar: 'gi-tar · 嘴先開後張',
  chicken: 'chi-ken · 嘴微張',
  horse: 'hors · 嘴圓',
  parcel: 'par-sel · 嘴張大',
  tooth: 'tooth · 舌尖輕出',
  toothbrush: 'tooth-brush · 嘴先開後圓',
  'bug-coral': 'bug · 嘴圓',
  dolphin: 'dol-fin · 嘴圓再開',
  octopus: 'ok-te-pus · 嘴先圓後合',
  crab: 'krab · 嘴微開',
  penguin: 'pen-gwin · 嘴先閉後圓',
  ladybug: 'lei-di-bug · 嘴向兩邊',
  sunflower: 'san-flau-er · 嘴先微張後圓',
  excavator: 'eks-ke-vei-ter · 嘴先開後圓',
  'ice-cream': 'ais kreem · 嘴向兩邊',
  tyrannosaurus: 'dai-ne-sor · 嘴微張',
  library: 'lai-brer-i · 嘴微開',
};

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

export type StickerMode = 'callout' | 'free';

export const DEFAULT_STICKER_MODE: StickerMode = 'callout';

/** Only the exact flag `free` leaves call-out. Everything else stays on the default. */
export function parseStickerMode(value: string | null | undefined): StickerMode {
  return value === 'free' ? 'free' : 'callout';
}

/** First slot in board order that does not yet hold its own sticker. */
export function nextCallout(placed: PlacedMap, order: readonly WordId[]): WordId | null {
  return order.find((id) => placed[id] !== id) ?? null;
}

export type CalloutPlaceResult = { kind: 'inactive' } | PlaceResult;

/**
 * Call-out accepts a drop only on the active slot.
 * A different sticker returns `wrong` and does not lock, even if the slot is occupied.
 * The matching sticker reuses `tryPlace`, including its `cleared` check.
 */
export function tryPlaceCallout(
  placed: PlacedMap,
  active: WordId,
  slot: WordId,
  sticker: WordId,
  words: readonly WordId[],
): CalloutPlaceResult {
  if (slot !== active) return { kind: 'inactive' };
  if (sticker !== active) return { kind: 'wrong' };
  return tryPlace(placed, slot, sticker, words);
}

/** Recap follows the word-slot order of this deal. */
export function recapOrder(words: readonly WordId[]): WordId[] {
  return words.slice();
}
