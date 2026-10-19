import { mixSeed, mulberry32, shuffle } from '../game/rng';
import {
  HARD_OPTION,
  SOFT_OPTION,
  phonicsZone,
  type MouthCue,
  type PhonicsItem,
  type PhonicsZone,
  type PhonicsZoneId,
} from './zones';

/**
 * Sound chips that must not share a question.
 * ai/ay, ea/ee, oa/ow, au/aw, ew/oo, ch/tch and sc/sk are the same sound
 * with two spellings. c/k/q are the same /k/ sound.
 * Silent-letter chips are position ids (`p0`…), so a ck word can still show
 * both letters without offering c and k as rival sound answers.
 */
const SOUND_CLASHES: readonly (readonly string[])[] = [
  ['ai', 'ay'],
  ['ea', 'ee'],
  ['oa', 'ow'],
  ['au', 'aw'],
  ['ew', 'oo'],
  ['ch', 'tch'],
  ['sc', 'sk'],
  ['c', 'k', 'q'],
];

const OPTION_COUNT = 4;

export type PhonicsStars = 0 | 1 | 2 | 3;

export type PhonicsQuestion = {
  zoneId: PhonicsZoneId;
  itemId: string;
  say: string;
  show: string;
  zh: string;
  cue: MouthCue;
  options: readonly string[];
  answer: string;
  /** Other chip ids that also count, used when gh has two silent letters. */
  accept?: readonly string[];
  /** Visible text when the chip id is a letter position. */
  labels?: Readonly<Record<string, string>>;
};

export type PhonicsTap = {
  itemId: string;
  value: string;
};

export type PhonicsRoundScore = {
  passed: boolean;
  stars: PhonicsStars;
  missedItemIds: string[];
};

export function starsFor(total: number, need: number, misses: number): PhonicsStars {
  const safeMisses = Number.isFinite(misses) ? Math.max(0, Math.floor(misses)) : 0;
  if (safeMisses > total - need) return 0;
  if (safeMisses === 0) return 3;
  const twoStarLimit = Math.ceil((total - need) / 2);
  if (safeMisses <= twoStarLimit) return 2;
  return 1;
}

/** One full round. Question count is the zone total. The same seed deals the same round. */
export function dealPhonicsRound(zoneId: PhonicsZoneId, seed: number): PhonicsQuestion[] {
  const zone = phonicsZone(zoneId);
  const rand = mulberry32(mixSeed(seed, zoneId, 1));
  return selectItems(zone, rand).map((item) => buildQuestion(zone, item, rand));
}

/** One question per known wrong-book id. Unknown ids are skipped. */
export function dealWrongBook(zoneId: PhonicsZoneId, itemIds: readonly string[], seed: number): PhonicsQuestion[] {
  const zone = phonicsZone(zoneId);
  const byId = new Map(zone.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const picked: PhonicsItem[] = [];
  for (const id of itemIds) {
    if (seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    picked.push(item);
  }
  const rand = mulberry32(mixSeed(seed, zoneId, 2));
  return shuffle(rand, picked).map((item) => buildQuestion(zone, item, rand));
}

/**
 * Only the first tap for each item counts.
 * A miss is a wrong first tap, or no tap. Stars are 0 unless the round clears.
 */
export function scoreRound(
  zoneId: PhonicsZoneId,
  questions: readonly PhonicsQuestion[],
  answers: readonly PhonicsTap[],
): PhonicsRoundScore {
  const zone = phonicsZone(zoneId);
  const first = new Map<string, string>();
  for (const tap of answers) {
    if (!first.has(tap.itemId)) first.set(tap.itemId, tap.value);
  }
  const missedItemIds: string[] = [];
  for (const question of questions) {
    const value = first.get(question.itemId);
    if (value === undefined || !tapIsCorrect(question, value)) missedItemIds.push(question.itemId);
  }
  const passed = questions.length === zone.total && missedItemIds.length <= zone.total - zone.need;
  return {
    passed,
    stars: passed ? starsFor(zone.total, zone.need, missedItemIds.length) : 0,
    missedItemIds,
  };
}

export function optionLabel(question: PhonicsQuestion, optionId: string): string {
  return question.labels?.[optionId] ?? optionId;
}

function tapIsCorrect(question: PhonicsQuestion, value: string): boolean {
  return value === question.answer || (question.accept?.includes(value) ?? false);
}

function clashes(left: string, right: string): boolean {
  if (left === right) return true;
  return SOUND_CLASHES.some((group) => group.includes(left) && group.includes(right));
}

function selectItems(zone: PhonicsZone, rand: () => number): PhonicsItem[] {
  if (zone.items.length < zone.total) {
    throw new Error(`Zone ${zone.id} has ${zone.items.length} items, needs ${zone.total}`);
  }
  if (zone.kind === 'hard-soft') return selectHardSoft(zone.items, rand);
  return shuffle(rand, zone.items).slice(0, zone.total);
}

/** Four C and four G, with hard and soft both present for each letter. */
function selectHardSoft(items: readonly PhonicsItem[], rand: () => number): PhonicsItem[] {
  const bucket = (letter: 'c' | 'g', hardness: 'hard' | 'soft') =>
    shuffle(rand, items.filter((item) => item.letter === letter && item.hardness === hardness));
  const cHard = bucket('c', 'hard');
  const cSoft = bucket('c', 'soft');
  const gHard = bucket('g', 'hard');
  const gSoft = bucket('g', 'soft');
  if (cHard.length < 2 || cSoft.length < 2 || gHard.length < 2 || gSoft.length < 2) {
    throw new Error('Zone 2 needs at least two hard and two soft words for both C and G');
  }
  const cFill = shuffle(rand, [...cHard.slice(1), ...cSoft.slice(1)]).slice(0, 2);
  const gFill = shuffle(rand, [...gHard.slice(1), ...gSoft.slice(1)]).slice(0, 2);
  return shuffle(rand, [cHard[0]!, cSoft[0]!, ...cFill, gHard[0]!, gSoft[0]!, ...gFill]);
}

function buildQuestion(zone: PhonicsZone, item: PhonicsItem, rand: () => number): PhonicsQuestion {
  const base = {
    zoneId: zone.id,
    itemId: item.id,
    say: item.say,
    show: item.show,
    zh: item.zh,
    cue: item.cue,
  };
  if (zone.kind === 'hard-soft') {
    return { ...base, options: shuffle(rand, [HARD_OPTION, SOFT_OPTION]), answer: item.answer };
  }
  if (zone.kind === 'short-vowel') {
    return { ...base, options: shuffle(rand, ['a', 'e', 'i', 'o', 'u']), answer: item.answer };
  }
  if (zone.kind === 'long-vowel') {
    if (!item.pair || !item.pair.includes(item.answer)) {
      throw new Error(`Long-vowel item ${item.id} needs a minimal pair`);
    }
    return { ...base, options: shuffle(rand, [...item.pair]), answer: item.answer };
  }
  if (zone.kind === 'silent') {
    const letters = item.letters ?? '';
    const indexes = item.silent ?? [];
    if (letters.length < 2 || indexes.length === 0) {
      throw new Error(`Silent item ${item.id} needs letters and a silent index`);
    }
    const options = shuffle(rand, [...letters].map((_, index) => `p${index}`));
    const labels: Record<string, string> = {};
    [...letters].forEach((letter, index) => {
      labels[`p${index}`] = letter;
    });
    const accept = indexes.slice(1).map((index) => `p${index}`);
    return {
      ...base,
      options,
      answer: `p${indexes[0]}`,
      labels,
      ...(accept.length > 0 ? { accept } : {}),
    };
  }
  const pool = uniqueAnswers(zone);
  const avoid = zone.kind === 'consonant' ? otherLetters(item) : [];
  return { ...base, options: pickOptions(rand, item.answer, pool, OPTION_COUNT, avoid), answer: item.answer };
}

function uniqueAnswers(zone: PhonicsZone): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const item of zone.items) {
    if (seen.has(item.answer)) continue;
    seen.add(item.answer);
    pool.push(item.answer);
  }
  return pool;
}

function otherLetters(item: PhonicsItem): string[] {
  return [...item.show].filter((letter) => letter !== item.answer && /[a-z]/.test(letter));
}

function pickOptions(
  rand: () => number,
  answer: string,
  pool: readonly string[],
  count: number,
  avoid: readonly string[],
): string[] {
  const chosen = [answer];
  const blocked = new Set(avoid);
  const candidates = shuffle(rand, pool.filter((item) => item !== answer));
  const deferred: string[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((item) => clashes(item, candidate))) continue;
    if (blocked.has(candidate)) {
      deferred.push(candidate);
      continue;
    }
    chosen.push(candidate);
  }
  for (const candidate of deferred) {
    if (chosen.length >= count) break;
    if (chosen.some((item) => clashes(item, candidate))) continue;
    chosen.push(candidate);
  }
  return shuffle(rand, chosen);
}
