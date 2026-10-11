import { describe, expect, it } from 'vitest';
import {
  emptyFormulaProgress,
  FORMULA_STORAGE_KEY,
  isZoneUnlocked,
  parentSummary,
  readFormulaProgress,
  recordRound,
  retryWrong,
  toWrongBookItem,
  writeFormulaProgress,
  type FormulaSave,
  type WrongBookItem,
} from '../src/formula/progress';
import { ZONE_IDS, type FormulaQuestion, type RoundResult, type ZoneId } from '../src/formula/types';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

function exploding(method: 'getItem' | 'setItem'): Storage {
  const store = memory();
  return new Proxy(store, {
    get(target, prop, receiver) {
      if (prop === method) {
        return () => {
          throw new Error('storage blocked');
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function passed(zone: ZoneId, stars: 1 | 2 | 3 = 3, correct = 5, total = 5): RoundResult {
  return { zone, status: 'passed', stars, correct, wrong: total - correct, total };
}

function failed(zone: ZoneId, correct = 2, total = 5): RoundResult {
  return { zone, status: 'failed', stars: 0, correct, wrong: total - correct, total };
}

function miss(id: string, zone: ZoneId = 1, prompt = 'Try again'): WrongBookItem {
  const question: FormulaQuestion = {
    id,
    zone,
    mode: 'fill',
    prompt,
    answer: '100',
  };
  return toWrongBookItem(question);
}

describe('formula progress', () => {
  it('opens only zone 1 and reports eight empty accuracies', () => {
    const save = emptyFormulaProgress();
    expect(FORMULA_STORAGE_KEY).toBe('kids-formula-island-v1');
    for (const zone of ZONE_IDS) {
      expect(isZoneUnlocked(save, zone)).toBe(zone === 1);
      expect(save.zones[zone]).toMatchObject({ bestStars: 0, stamped: false, attempts: 0, correct: 0, total: 0 });
    }
    const summary = parentSummary(save);
    expect(summary.zones).toHaveLength(8);
    expect(summary.zones.map((zone) => zone.title)).toEqual([
      'Directions',
      'Units',
      'Area+Perimeter',
      'Percentage',
      'Pythagoras',
      'Factorization',
      'Volume+Euler',
      'Interest',
    ]);
    expect(summary.zones.every((zone) => zone.accuracy === null)).toBe(true);
    expect(summary.review).toEqual([]);
  });

  it('unlocks the next zone only after the previous one passes', () => {
    let save = emptyFormulaProgress();
    const missed = recordRound(save, failed(1));
    expect(missed).not.toBe(save);
    expect(isZoneUnlocked(missed, 2)).toBe(false);
    expect(missed.zones[1]).toMatchObject({ stamped: false, bestStars: 0, attempts: 1, correct: 2, total: 5 });

    const fresh = emptyFormulaProgress();
    const skipped = recordRound(fresh, passed(4));
    expect(skipped).toBe(fresh);
    expect(skipped.zones[4].stamped).toBe(false);
    expect(isZoneUnlocked(skipped, 4)).toBe(false);

    save = emptyFormulaProgress();
    for (const zone of ZONE_IDS) {
      expect(isZoneUnlocked(save, zone), `zone ${zone} before its pass`).toBe(true);
      const later = (zone + 1) as ZoneId;
      if (zone < 8) expect(isZoneUnlocked(save, later)).toBe(false);
      save = recordRound(save, passed(zone));
      expect(save.zones[zone].stamped).toBe(true);
      if (zone < 8) expect(isZoneUnlocked(save, later)).toBe(true);
    }
    expect(save.zones[8].stamped).toBe(true);
    expect(parentSummary(save).zones.every((zone) => zone.unlocked && zone.accuracy === 1)).toBe(true);
  });

  it('keeps the best stars and accumulates accuracy across rounds', () => {
    let save = recordRound(emptyFormulaProgress(), passed(1, 1, 5, 6));
    expect(save.zones[1]).toMatchObject({ bestStars: 1, stamped: true, attempts: 1, correct: 5, total: 6 });
    save = recordRound(save, passed(1, 3, 5, 5));
    save = recordRound(save, failed(1, 2, 5));
    expect(save.zones[1]).toMatchObject({ bestStars: 3, stamped: true, attempts: 3, correct: 12, total: 16 });
    expect(parentSummary(save).zones[0]?.accuracy).toBe(12 / 16);

    const playing = recordRound(save, { zone: 1, status: 'playing', stars: 0, correct: 1, wrong: 0, total: 1 });
    expect(playing).toBe(save);
  });

  it('round-trips a save and ignores a broken storage', () => {
    const store = memory();
    let save = recordRound(emptyFormulaProgress(), passed(1, 2, 4, 5));
    save = recordRound(save, passed(2, 3, 6, 8), [miss('cents', 2, '$1 = ? cents')]);
    writeFormulaProgress(save, store);
    const loaded = readFormulaProgress(store);
    expect(loaded).toEqual(save);
    expect(parentSummary(loaded).zones[1]).toMatchObject({
      zone: 2,
      unlocked: true,
      stamped: true,
      bestStars: 3,
      correct: 6,
      total: 8,
      accuracy: 6 / 8,
    });
    expect(parentSummary(loaded).review.map((item) => item.id)).toEqual(['cents']);
    expect(store.getItem(FORMULA_STORAGE_KEY)).toContain('"version":1');

    expect(readFormulaProgress(memory()).zones[1].stamped).toBe(false);
    expect(readFormulaProgress(exploding('getItem')).wrongBook).toEqual([]);
    expect(() => writeFormulaProgress(save, exploding('setItem'))).not.toThrow();
  });

  it('tolerates missing and corrupt stored data', () => {
    const store = memory();
    store.setItem(FORMULA_STORAGE_KEY, '{');
    expect(readFormulaProgress(store).wrongBook).toEqual([]);

    store.setItem(FORMULA_STORAGE_KEY, 'null');
    expect(readFormulaProgress(store).version).toBe(1);

    store.setItem(FORMULA_STORAGE_KEY, '[]');
    expect(isZoneUnlocked(readFormulaProgress(store), 2)).toBe(false);

    store.setItem(FORMULA_STORAGE_KEY, JSON.stringify({ version: 2, zones: {}, wrongBook: [] }));
    expect(readFormulaProgress(store).zones[1].attempts).toBe(0);

    store.setItem(FORMULA_STORAGE_KEY, JSON.stringify({
      version: 1,
      zones: {
        1: { bestStars: 0, stamped: true, attempts: 2, correct: 5, total: 6 },
        2: { bestStars: 9, stamped: true, attempts: 1, correct: 1, total: 1 },
        3: { bestStars: 2, stamped: false, attempts: 0, correct: 4, total: 5 },
      },
      wrongBook: [
        { id: 'keep', zone: 1, mode: 'pick', prompt: 'North?', answer: 'n', choices: ['n', 's'] },
        { id: 'no-choices', zone: 1, mode: 'fill', prompt: 'cents', answer: '100' },
        { id: '', zone: 1, mode: 'fill', prompt: 'nope', answer: '1' },
        { id: 'drop', zone: 1, mode: 'sort', prompt: 'nope', answer: '1' },
        { zone: 1, mode: 'fill', prompt: 'missing id', answer: '1' },
      ],
    }));
    const repaired = readFormulaProgress(store);
    expect(repaired.zones[1]).toMatchObject({ bestStars: 1, stamped: true, attempts: 2, correct: 5, total: 6 });
    expect(repaired.zones[2]).toMatchObject({ bestStars: 0, stamped: false, attempts: 0 });
    expect(repaired.zones[3]).toMatchObject({ bestStars: 2, stamped: true, attempts: 1, correct: 4, total: 5 });
    expect(repaired.zones[4].stamped).toBe(false);
    expect(repaired.wrongBook.map((item) => item.id)).toEqual(['keep', 'no-choices']);
    expect(repaired.wrongBook[1]?.choices).toEqual([]);
    expect(isZoneUnlocked(repaired, 2)).toBe(true);
    expect(isZoneUnlocked(repaired, 3)).toBe(false);
    expect(isZoneUnlocked(repaired, 4)).toBe(false);
    expect(parentSummary(repaired).review).toHaveLength(2);
    expect(parentSummary(repaired).zones).toHaveLength(8);
  });

  it('removes a wrong-book item only after a correct retry', () => {
    const first = miss('a', 1, 'first');
    const second = miss('b', 1, 'second');
    const otherZone = miss('c', 2, 'locked zone');
    let save: FormulaSave = recordRound(emptyFormulaProgress(), passed(1, 2, 5, 6), [first, first, second, otherZone]);
    expect(save.wrongBook.map((item) => item.id)).toEqual(['a', 'b']);

    const replaced = miss('a', 1, 'first, rewritten');
    save = recordRound(save, failed(1, 1, 4), [replaced]);
    expect(save.wrongBook.map((item) => [item.id, item.prompt])).toEqual([
      ['a', 'first, rewritten'],
      ['b', 'second'],
    ]);
    expect(save.zones[1].attempts).toBe(2);

    const stillWrong = retryWrong(save, 'a', false);
    expect(stillWrong).toBe(save);
    expect(parentSummary(stillWrong).review.map((item) => item.id)).toEqual(['a', 'b']);

    const unknown = retryWrong(save, 'missing', true);
    expect(unknown).toBe(save);

    save = retryWrong(save, 'a', true);
    expect(save.wrongBook.map((item) => item.id)).toEqual(['b']);
    save = retryWrong(save, 'b', true);
    expect(save.wrongBook).toEqual([]);
    expect(parentSummary(save).review).toEqual([]);
    expect(save.zones[1].stamped).toBe(true);
  });
});
