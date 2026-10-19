import type { PhonicsRoundScore, PhonicsStars } from './round';
import {
  PHONICS_ZONE_IDS,
  PHONICS_ZONES,
  isPhonicsZoneId,
  phonicsZone,
  type PhonicsZoneId,
} from './zones';

export const PHONICS_STORAGE_KEY = 'kids-phonics-island-v1';

export type ZoneProgress = {
  cleared: boolean;
  bestStars: PhonicsStars;
  /** Question attempts across rounds. */
  attempts: number;
  correct: number;
  rounds: number;
  wrongBook: string[];
};

export type PhonicsSave = {
  version: 1;
  zones: Record<PhonicsZoneId, ZoneProgress>;
};

export type PhonicsZoneSummary = {
  id: PhonicsZoneId;
  order: number;
  nameZh: string;
  nameEn: string;
  /** Null until the zone has been played. */
  accuracy: number | null;
  rounds: number;
  bestStars: PhonicsStars;
  cleared: boolean;
  attempts: number;
  correct: number;
};

export type PhonicsReview = {
  id: PhonicsZoneId;
  nameZh: string;
  /** At most three sounds to revisit. */
  sounds: string[];
};

export type PhonicsParentSummary = {
  zones: PhonicsZoneSummary[];
  /** Zones under 0.8 accuracy, or with a wrong book that is not empty. */
  review: PhonicsReview[];
};

export function emptyPhonicsProgress(): PhonicsSave {
  const zones = {} as Record<PhonicsZoneId, ZoneProgress>;
  for (const id of PHONICS_ZONE_IDS) zones[id] = emptyZone();
  return { version: 1, zones };
}

export function readPhonicsProgress(store?: Storage | null): PhonicsSave {
  try {
    const raw = (store ?? browserStorage())?.getItem(PHONICS_STORAGE_KEY);
    if (typeof raw !== 'string' || raw.trim() === '') return emptyPhonicsProgress();
    return parseSave(raw);
  } catch {
    return emptyPhonicsProgress();
  }
}

export function writePhonicsProgress(save: PhonicsSave, store?: Storage | null): void {
  try {
    (store ?? browserStorage())?.setItem(PHONICS_STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* Persistence is optional. */
  }
}

/** Zone 1 is always open. Zone N opens when zone N-1 is cleared. */
export function isZoneUnlocked(save: PhonicsSave, zoneId: PhonicsZoneId): boolean {
  if (zoneId === 1) return true;
  const previous = (zoneId - 1) as PhonicsZoneId;
  return save.zones[previous]?.cleared === true;
}

/**
 * Pure. A locked zone is ignored.
 * `cleared` stays true, `bestStars` keeps the max, and misses join the wrong book.
 */
export function recordRound(save: PhonicsSave, zoneId: PhonicsZoneId, score: PhonicsRoundScore): PhonicsSave {
  if (!isPhonicsZoneId(zoneId) || !isZoneUnlocked(save, zoneId)) return save;
  const zone = phonicsZone(zoneId);
  const current = save.zones[zoneId] ?? emptyZone();
  const valid = new Set(zone.items.map((item) => item.id));
  const missed: string[] = [];
  for (const id of score.missedItemIds) {
    if (!valid.has(id) || missed.includes(id)) continue;
    missed.push(id);
  }
  const missCount = Math.min(zone.total, missed.length);
  const next = cloneSave(save);
  const book = [...current.wrongBook];
  for (const id of missed) {
    if (!book.includes(id)) book.push(id);
  }
  next.zones[zoneId] = {
    cleared: current.cleared || score.passed,
    bestStars: Math.max(current.bestStars, earnedStars(score)) as PhonicsStars,
    attempts: current.attempts + zone.total,
    correct: current.correct + (zone.total - missCount),
    rounds: current.rounds + 1,
    wrongBook: book,
  };
  return next;
}

/** Drop reviewed items that were answered correctly. Stars and unlocks stay as they are. */
export function recordWrongBookReview(
  save: PhonicsSave,
  zoneId: PhonicsZoneId,
  correctItemIds: readonly string[],
): PhonicsSave {
  if (!isPhonicsZoneId(zoneId)) return save;
  const current = save.zones[zoneId] ?? emptyZone();
  const drop = new Set(correctItemIds);
  if (!current.wrongBook.some((id) => drop.has(id))) return save;
  const next = cloneSave(save);
  next.zones[zoneId] = {
    ...current,
    wrongBook: current.wrongBook.filter((id) => !drop.has(id)),
  };
  return next;
}

export function parentSummary(save: PhonicsSave): PhonicsParentSummary {
  const zones = PHONICS_ZONES.map((zone) => {
    const row = save.zones[zone.id] ?? emptyZone();
    return {
      id: zone.id,
      order: zone.order,
      nameZh: zone.nameZh,
      nameEn: zone.nameEn,
      accuracy: row.attempts === 0 ? null : row.correct / row.attempts,
      rounds: row.rounds,
      bestStars: row.bestStars,
      cleared: row.cleared,
      attempts: row.attempts,
      correct: row.correct,
    };
  });
  const review: PhonicsReview[] = [];
  for (const zone of PHONICS_ZONES) {
    const row = save.zones[zone.id] ?? emptyZone();
    const low = row.attempts > 0 && row.correct * 10 < row.attempts * 8;
    if (!low && row.wrongBook.length === 0) continue;
    review.push({
      id: zone.id,
      nameZh: zone.nameZh,
      sounds: reviewSounds(zone.id, row.wrongBook),
    });
  }
  return { zones, review };
}

function reviewSounds(zoneId: PhonicsZoneId, wrongBook: readonly string[]): string[] {
  const zone = phonicsZone(zoneId);
  const sounds: string[] = [];
  for (const id of wrongBook) {
    const item = zone.items.find((entry) => entry.id === id);
    if (!item || sounds.includes(item.sound)) continue;
    sounds.push(item.sound);
    if (sounds.length === 3) break;
  }
  return sounds;
}

function earnedStars(score: PhonicsRoundScore): PhonicsStars {
  if (!score.passed) return 0;
  if (score.stars === 2 || score.stars === 3) return score.stars;
  return 1;
}

function emptyZone(): ZoneProgress {
  return { cleared: false, bestStars: 0, attempts: 0, correct: 0, rounds: 0, wrongBook: [] };
}

function cloneSave(save: PhonicsSave): PhonicsSave {
  const zones = {} as Record<PhonicsZoneId, ZoneProgress>;
  for (const id of PHONICS_ZONE_IDS) {
    const zone = save.zones[id] ?? emptyZone();
    zones[id] = { ...zone, wrongBook: [...zone.wrongBook] };
  }
  return { version: 1, zones };
}

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function parseSave(raw: string): PhonicsSave {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyPhonicsProgress();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyPhonicsProgress();
  const root = data as Record<string, unknown>;
  if (root.version !== 1) return emptyPhonicsProgress();
  const save = emptyPhonicsProgress();
  const zones = root.zones;
  if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return save;
  const table = zones as Record<string, unknown>;
  for (const id of PHONICS_ZONE_IDS) save.zones[id] = parseZone(id, table[String(id)]);
  return save;
}

function parseZone(id: PhonicsZoneId, raw: unknown): ZoneProgress {
  const blank = emptyZone();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank;
  const row = raw as Record<string, unknown>;
  const attempts = nonNegInt(row.attempts);
  const correct = nonNegInt(row.correct);
  const rounds = nonNegInt(row.rounds);
  if (attempts === null || correct === null || rounds === null) return blank;
  if (correct > attempts) return blank;
  if (typeof row.cleared !== 'boolean') return blank;
  if (!isStars(row.bestStars)) return blank;
  if (!Array.isArray(row.wrongBook)) return blank;

  const valid = new Set(phonicsZone(id).items.map((item) => item.id));
  const wrongBook: string[] = [];
  for (const entry of row.wrongBook) {
    if (typeof entry !== 'string' || !valid.has(entry) || wrongBook.includes(entry)) continue;
    wrongBook.push(entry);
  }
  const cleared = row.cleared;
  const bestStars = row.bestStars;
  if (!cleared && bestStars !== 0) return blank;
  if (cleared && bestStars === 0) return blank;
  if (rounds === 0 && (attempts !== 0 || correct !== 0 || cleared || wrongBook.length > 0)) return blank;
  if (rounds > 0 && attempts === 0) return blank;
  return { cleared, bestStars, attempts, correct, rounds, wrongBook };
}

function nonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function isStars(value: unknown): value is PhonicsStars {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
