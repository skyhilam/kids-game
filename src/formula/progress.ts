import {
  ZONE_CATALOG,
  ZONE_IDS,
  isFormulaTag,
  isZoneId,
  type AnswerMode,
  type FormulaQuestion,
  type FormulaTag,
  type RoundResult,
  type RoundStars,
  type ZoneId,
} from './types';

export const FORMULA_STORAGE_KEY = 'kids-formula-island-v1';

export type ZoneProgress = {
  zone: ZoneId;
  bestStars: RoundStars;
  stamped: boolean;
  attempts: number;
  correct: number;
  total: number;
};

export type WrongBookItem = {
  id: string;
  zone: ZoneId;
  mode: AnswerMode;
  prompt: string;
  choices: string[];
  answer: string;
  tag?: FormulaTag;
};

export type FormulaSave = {
  version: 1;
  zones: Record<ZoneId, ZoneProgress>;
  wrongBook: WrongBookItem[];
};

export type ZoneAccuracy = {
  zone: ZoneId;
  title: string;
  unlocked: boolean;
  stamped: boolean;
  bestStars: RoundStars;
  attempts: number;
  correct: number;
  total: number;
  /** Null until the zone has at least one answered question. */
  accuracy: number | null;
};

export type ParentSummary = {
  zones: ZoneAccuracy[];
  review: WrongBookItem[];
};

export function emptyFormulaProgress(): FormulaSave {
  const zones = {} as Record<ZoneId, ZoneProgress>;
  for (const zone of ZONE_IDS) zones[zone] = emptyZone(zone);
  return { version: 1, zones, wrongBook: [] };
}

export function readFormulaProgress(store?: Storage | null): FormulaSave {
  try {
    const raw = (store ?? browserStorage())?.getItem(FORMULA_STORAGE_KEY);
    if (typeof raw !== 'string' || raw.trim() === '') return emptyFormulaProgress();
    return parseSave(raw);
  } catch {
    return emptyFormulaProgress();
  }
}

export function writeFormulaProgress(save: FormulaSave, store?: Storage | null): void {
  try {
    (store ?? browserStorage())?.setItem(FORMULA_STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* Persistence is optional. */
  }
}

/** Zone 1 is open. Zone N is open only when every earlier zone is stamped. */
export function isZoneUnlocked(save: FormulaSave, zone: ZoneId): boolean {
  for (const id of ZONE_IDS) {
    if (id === zone) return true;
    if (!save.zones[id]?.stamped) return false;
  }
  return false;
}

/**
 * Records a finished round. Playing rounds and locked zones are ignored.
 * Wrong-book entries are kept by question id (a later miss replaces the prompt).
 */
export function recordRound(
  save: FormulaSave,
  result: RoundResult,
  wrongs: readonly WrongBookItem[] = [],
): FormulaSave {
  if (result.status === 'playing') return save;
  if (!isZoneUnlocked(save, result.zone)) return save;
  if (!Number.isInteger(result.correct) || !Number.isInteger(result.total)) return save;
  if (result.correct < 0 || result.total < result.correct) return save;

  const next = cloneSave(save);
  const zone = next.zones[result.zone] ?? emptyZone(result.zone);
  const gained: RoundStars = result.status === 'passed' ? passStars(result.stars) : 0;
  next.zones[result.zone] = {
    zone: result.zone,
    bestStars: Math.max(zone.bestStars, gained) as RoundStars,
    stamped: zone.stamped || result.status === 'passed',
    attempts: zone.attempts + 1,
    correct: zone.correct + result.correct,
    total: zone.total + result.total,
  };
  next.wrongBook = mergeWrongs(next.wrongBook, wrongs, result.zone);
  return next;
}

/** A correct retry drops that question. A wrong retry leaves the book as it is. */
export function retryWrong(save: FormulaSave, questionId: string, correct: boolean): FormulaSave {
  if (!correct) return save;
  if (!save.wrongBook.some((item) => item.id === questionId)) return save;
  const next = cloneSave(save);
  next.wrongBook = next.wrongBook.filter((item) => item.id !== questionId);
  return next;
}

export function parentSummary(save: FormulaSave): ParentSummary {
  return {
    zones: ZONE_CATALOG.map((zone) => {
      const row = save.zones[zone.id] ?? emptyZone(zone.id);
      return {
        zone: zone.id,
        title: zone.title,
        unlocked: isZoneUnlocked(save, zone.id),
        stamped: row.stamped,
        bestStars: row.bestStars,
        attempts: row.attempts,
        correct: row.correct,
        total: row.total,
        accuracy: row.total === 0 ? null : row.correct / row.total,
      };
    }),
    review: save.wrongBook.map(copyWrong),
  };
}

export function toWrongBookItem(question: FormulaQuestion): WrongBookItem {
  return {
    id: question.id,
    zone: question.zone,
    mode: question.mode,
    prompt: question.prompt,
    choices: question.mode === 'pick' ? [...question.choices] : [],
    answer: question.answer,
    ...(question.tag !== undefined ? { tag: question.tag } : {}),
  };
}

function emptyZone(zone: ZoneId): ZoneProgress {
  return { zone, bestStars: 0, stamped: false, attempts: 0, correct: 0, total: 0 };
}

function passStars(stars: RoundStars): 1 | 2 | 3 {
  if (stars === 2 || stars === 3) return stars;
  return 1;
}

function cloneSave(save: FormulaSave): FormulaSave {
  const zones = {} as Record<ZoneId, ZoneProgress>;
  for (const id of ZONE_IDS) zones[id] = { ...(save.zones[id] ?? emptyZone(id)) };
  return { version: 1, zones, wrongBook: save.wrongBook.map(copyWrong) };
}

function copyWrong(item: WrongBookItem): WrongBookItem {
  return {
    ...item,
    choices: [...item.choices],
    ...(item.tag !== undefined ? { tag: item.tag } : {}),
  };
}

function mergeWrongs(
  book: readonly WrongBookItem[],
  incoming: readonly WrongBookItem[],
  zone: ZoneId,
): WrongBookItem[] {
  const next = book.map(copyWrong);
  for (const item of incoming) {
    if (item.zone !== zone || item.id.trim() === '') continue;
    const clean = copyWrong(item);
    const index = next.findIndex((entry) => entry.id === clean.id);
    if (index === -1) next.push(clean);
    else next[index] = clean;
  }
  return next;
}

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function parseSave(raw: string): FormulaSave {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyFormulaProgress();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyFormulaProgress();
  const root = data as Record<string, unknown>;
  if (root.version !== 1) return emptyFormulaProgress();

  const save = emptyFormulaProgress();
  const zones = root.zones;
  if (zones && typeof zones === 'object' && !Array.isArray(zones)) {
    const table = zones as Record<string, unknown>;
    for (const id of ZONE_IDS) save.zones[id] = parseZone(id, table[String(id)]);
  }
  if (Array.isArray(root.wrongBook)) {
    for (const item of root.wrongBook) {
      const parsed = parseWrong(item);
      if (parsed) save.wrongBook.push(parsed);
    }
  }
  return save;
}

function parseZone(id: ZoneId, raw: unknown): ZoneProgress {
  const blank = emptyZone(id);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank;
  const row = raw as Record<string, unknown>;
  const attempts = nonNegInt(row.attempts);
  const correct = nonNegInt(row.correct);
  const total = nonNegInt(row.total);
  if (attempts === null || correct === null || total === null || correct > total) return blank;
  if (!isStars(row.bestStars)) return blank;
  const stars = row.bestStars;
  if (row.stamped === true && stars === 0) {
    return { zone: id, bestStars: 1, stamped: true, attempts: Math.max(1, attempts), correct, total };
  }
  if (row.stamped !== true && stars > 0) {
    return { zone: id, bestStars: stars, stamped: true, attempts: Math.max(1, attempts), correct, total };
  }
  return { zone: id, bestStars: stars, stamped: row.stamped === true, attempts, correct, total };
}

function parseWrong(raw: unknown): WrongBookItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.trim() === '') return null;
  if (!isZoneId(row.zone)) return null;
  if (row.mode !== 'pick' && row.mode !== 'fill') return null;
  if (typeof row.prompt !== 'string' || typeof row.answer !== 'string') return null;
  const choices = row.choices === undefined ? [] : row.choices;
  if (!Array.isArray(choices) || choices.some((choice) => typeof choice !== 'string')) return null;
  if (row.tag !== undefined && !isFormulaTag(row.tag)) return null;
  return {
    id: row.id,
    zone: row.zone,
    mode: row.mode,
    prompt: row.prompt,
    choices: [...choices],
    answer: row.answer,
    ...(isFormulaTag(row.tag) ? { tag: row.tag } : {}),
  };
}

function nonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function isStars(value: unknown): value is RoundStars {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
