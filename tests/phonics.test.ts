import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PHONICS_COPY, PHONICS_LESSONS } from '../src/phonics/copy';
import {
  emptyPhonicsProgress,
  isZoneUnlocked,
  parentSummary,
  PHONICS_STORAGE_KEY,
  readPhonicsProgress,
  recordRound,
  recordWrongBookReview,
  writePhonicsProgress,
} from '../src/phonics/progress';
import {
  dealPhonicsRound,
  dealWrongBook,
  optionLabel,
  scoreRound,
  starsFor,
  type PhonicsQuestion,
} from '../src/phonics/round';
import { phonicsAudioAvailable, speakPhonics } from '../src/phonics/speech';
import {
  PHONICS_ZONES,
  phonicsZone,
  type PhonicsZone,
  type PhonicsZoneId,
} from '../src/phonics/zones';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Spec list. These spellings must not share a question. Checked here, not imported. */
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

const CUES = new Set(['open', 'wide', 'round', 'teeth', 'lips', 'tongue']);
const BANNED = /JEI|Brain Safari|智商|智力|大腦/;

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

function clashHits(options: readonly string[]): number {
  let worst = 0;
  for (const group of SOUND_CLASHES) {
    const hits = group.filter((token) => options.includes(token)).length;
    if (hits > worst) worst = hits;
  }
  return worst;
}

function answered(questions: readonly PhonicsQuestion[], misses: number) {
  return questions.map((question, index) => ({
    itemId: question.itemId,
    value: index < misses ? 'nope' : question.answer,
  }));
}

describe('phonics zones', () => {
  it('lists eight zones with the pass table', () => {
    expect(PHONICS_ZONES.map((zone) => [zone.id, zone.order, zone.nameZh, zone.nameEn, zone.total, zone.need, zone.kind])).toEqual([
      [1, 1, '字母沙灘', 'Consonants', 10, 8, 'consonant'],
      [2, 2, '軟硬岩岸', 'Hard and Soft', 8, 6, 'hard-soft'],
      [3, 3, '短元音谷', 'Short Vowels', 10, 8, 'short-vowel'],
      [4, 4, '長元音丘', 'Long Vowels', 8, 6, 'long-vowel'],
      [5, 5, '拼搭橋', 'Blends', 10, 7, 'blend'],
      [6, 6, '雙音洞', 'Digraphs', 10, 7, 'digraph'],
      [7, 7, '靜音林', 'Silent Letters', 8, 6, 'silent'],
      [8, 8, '雙元音灣', 'Vowel Digraphs', 10, 7, 'vowel-team'],
    ]);
    const ids = PHONICS_ZONES.flatMap((zone) => zone.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every item a speech line, on-screen text, gloss, and mouth cue', () => {
    for (const zone of PHONICS_ZONES) {
      expect(zone.tutorial.length).toBeGreaterThanOrEqual(3);
      for (const word of zone.tutorial) {
        expect(word.en.trim().length).toBeGreaterThan(0);
        expect(word.zh.trim().length).toBeGreaterThan(0);
      }
      expect(zone.items.length).toBeGreaterThanOrEqual(zone.total);
      for (const item of zone.items) {
        expect(item.say.trim().length).toBeGreaterThan(0);
        expect(item.show.trim().length).toBeGreaterThan(0);
        expect(item.zh.trim().length).toBeGreaterThan(0);
        expect(CUES.has(item.cue)).toBe(true);
        expect(item.answer.trim().length).toBeGreaterThan(0);
        expect(item.sound.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers every consonant on the letter beach, with hard c/g and final x', () => {
    const zone = phonicsZone(1);
    const consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'];
    expect(zone.items.map((item) => item.answer)).toEqual(consonants);
    const vowelAfter = (word: string, letter: string) => word[word.indexOf(letter) + 1];
    expect(vowelAfter(zone.items.find((item) => item.answer === 'c')!.say, 'c')).toMatch(/[aou]/);
    expect(vowelAfter(zone.items.find((item) => item.answer === 'g')!.say, 'g')).toMatch(/[aou]/);
    const ending = zone.items.find((item) => item.answer === 'x')!;
    expect(ending.say).toBe('box');
    expect(ending.position).toBe('end');
    expect(zone.items.filter((item) => item.position === 'end')).toHaveLength(1);
    expect(zone.tutorial.map((word) => word.en)).toEqual(expect.arrayContaining(['box', 'fox']));
  });

  it('uses only hard/soft rule words and covers C and G', () => {
    const zone = phonicsZone(2);
    const banned = new Set(['get', 'girl', 'give']);
    expect(zone.items.some((item) => banned.has(item.say))).toBe(false);
    for (const item of zone.items) {
      expect(item.letter === 'c' || item.letter === 'g').toBe(true);
      const vowel = item.say[item.say.indexOf(item.letter!) + 1];
      if (item.hardness === 'hard') expect(vowel).toMatch(/[aou]/);
      else expect(vowel).toMatch(/[eiy]/);
      expect([ '硬音 Hard', '軟音 Soft' ]).toContain(item.answer);
    }
    for (const letter of ['c', 'g'] as const) {
      for (const hardness of ['hard', 'soft'] as const) {
        expect(zone.items.some((item) => item.letter === letter && item.hardness === hardness)).toBe(true);
      }
    }
  });

  it('uses CVC short vowels and the long minimal pairs', () => {
    const shorts = phonicsZone(3);
    expect(new Set(shorts.items.map((item) => item.answer))).toEqual(new Set(['a', 'e', 'i', 'o', 'u']));
    for (const item of shorts.items) {
      expect(item.show.replace(' _ ', item.answer)).toBe(item.say);
    }
    expect(shorts.items.some((item) => item.show === 'c _ t' && item.say === 'cat')).toBe(true);

    const longs = phonicsZone(4);
    expect(new Set(longs.items.map((item) => item.sound))).toEqual(new Set(['long a', 'long i', 'long o', 'long u']));
    expect(longs.items.map((item) => item.show)).toEqual(expect.arrayContaining([
      'bit / bite',
      'cap / cape',
      'hop / hope',
      'cub / cube',
    ]));
    for (const item of longs.items) {
      expect(item.pair).toEqual([item.show.split(' / ')[0], item.answer]);
      expect(item.say).toBe(item.answer);
    }
  });

  it('covers blends, digraphs, and the long vowel teams', () => {
    expect(phonicsZone(5).items.map((item) => item.answer)).toEqual([
      'sn', 'st', 'sk', 'sp', 'sl', 'sw', 'sc', 'sm',
      'bl', 'cl', 'pl', 'fl', 'gl',
      'br', 'cr', 'dr', 'fr', 'gr', 'tr',
    ]);
    expect(new Set(phonicsZone(6).items.map((item) => item.answer))).toEqual(new Set(['ch', 'sh', 'th', 'wh', 'tch']));

    const bay = phonicsZone(8);
    expect(new Set(bay.items.map((item) => item.answer))).toEqual(new Set([
      'ai', 'ay', 'ea', 'ee', 'oa', 'ow', 'au', 'aw', 'ie', 'ew', 'oo',
    ]));
    const says = (pattern: string) => bay.items.filter((item) => item.pattern === pattern).map((item) => item.say);
    const notLongO = ['cow', 'now', 'how', 'down', 'owl', 'town', 'brown'];
    const notLongOo = ['book', 'look', 'foot', 'good', 'cook', 'wood'];
    expect(says('ow').some((word) => notLongO.includes(word))).toBe(false);
    expect(says('oo').some((word) => notLongOo.includes(word))).toBe(false);
    expect(says('ow').length).toBeGreaterThan(0);
    expect(says('oo').length).toBeGreaterThan(0);
  });

  it('points silent indexes at the silent letters', () => {
    const expected: Record<string, readonly string[]> = {
      kn: ['k'],
      wr: ['w'],
      ck: ['c'],
      mb: ['b'],
      gh: ['g', 'h'],
      st: ['t'],
    };
    const zone = phonicsZone(7);
    expect(new Set(zone.items.map((item) => item.pattern))).toEqual(new Set(Object.keys(expected)));
    for (const item of zone.items) {
      const letters = item.letters ?? '';
      const indexes = item.silent ?? [];
      expect(letters).toBe(item.say);
      expect(indexes.length).toBeGreaterThan(0);
      const silentLetters = indexes.map((index) => {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(letters.length);
        return letters[index];
      });
      expect(silentLetters).toEqual(expected[item.pattern ?? '']);
      if (item.pattern === 'ck') {
        expect(letters.includes('k')).toBe(true);
        expect(silentLetters).toEqual(['c']);
      }
    }
    const listen = zone.items.find((item) => item.letters === 'listen');
    expect(listen?.silent).toEqual([listen!.letters!.indexOf('t')]);

    const night = dealWrongBook(7, ['z7-night'], 1)[0]!;
    expect(optionLabel(night, night.answer)).toBe('g');
    expect(night.accept?.map((id) => optionLabel(night, id))).toEqual(['h']);
    const duck = dealWrongBook(7, ['z7-duck'], 1)[0]!;
    expect(optionLabel(duck, duck.answer)).toBe('c');
    expect(duck.options).not.toContain('c');
    expect(duck.options).not.toContain('k');
    expect(clashHits(duck.options)).toBeLessThan(2);
  });
});

describe('phonics rounds', () => {
  it('maps stars from misses, and only a clear earns stars', () => {
    for (const zone of PHONICS_ZONES) {
      const room = zone.total - zone.need;
      const twoStarLimit = Math.ceil(room / 2);
      for (let misses = 0; misses <= zone.total + 1; misses += 1) {
        const stars = starsFor(zone.total, zone.need, misses);
        if (misses > room) expect(stars).toBe(0);
        else if (misses === 0) expect(stars).toBe(3);
        else if (misses <= twoStarLimit) expect(stars).toBe(2);
        else expect(stars).toBe(1);
      }
    }
    expect(starsFor(10, 8, 0)).toBe(3);
    expect(starsFor(10, 8, 1)).toBe(2);
    expect(starsFor(10, 8, 2)).toBe(1);
    expect(starsFor(10, 8, 3)).toBe(0);
    expect(starsFor(10, 7, 2)).toBe(2);
    expect(starsFor(10, 7, 3)).toBe(1);
    expect(starsFor(8, 6, 2)).toBe(1);
  });

  it('deals a legal round for every zone and seed 0 through 50', () => {
    for (const zone of PHONICS_ZONES) {
      const before = zone.items.map((item) => item.id).join(',');
      for (let seed = 0; seed <= 50; seed += 1) {
        const questions = dealPhonicsRound(zone.id, seed);
        if (seed === 0) expect(dealPhonicsRound(zone.id, seed)).toEqual(questions);
        expectLegalRound(zone, questions);
      }
      expect(zone.items.map((item) => item.id).join(',')).toBe(before);
    }
    expect(dealPhonicsRound(1, 0).map((question) => question.itemId)).not.toEqual(
      dealPhonicsRound(1, 1).map((question) => question.itemId),
    );
  });

  it('counts only the first tap', () => {
    const questions = dealPhonicsRound(1, 0);
    const wrongFirst = scoreRound(1, questions, [
      ...answered(questions, questions.length),
      ...answered(questions, 0),
    ]);
    expect(wrongFirst).toMatchObject({ passed: false, stars: 0 });
    expect(wrongFirst.missedItemIds).toHaveLength(10);

    const rightFirst = scoreRound(1, questions, [
      ...answered(questions, 0),
      ...answered(questions, questions.length),
    ]);
    expect(rightFirst).toEqual({ passed: true, stars: 3, missedItemIds: [] });

    const oneMiss = scoreRound(1, questions, answered(questions, 1));
    expect(oneMiss.passed).toBe(true);
    expect(oneMiss.stars).toBe(2);
    expect(oneMiss.missedItemIds).toEqual([questions[0]!.itemId]);

    const twoMiss = scoreRound(1, questions, answered(questions, 2));
    expect(twoMiss).toMatchObject({ passed: true, stars: 1 });
    const threeMiss = scoreRound(1, questions, answered(questions, 3));
    expect(threeMiss).toMatchObject({ passed: false, stars: 0 });
  });

  it('accepts either silent letter in gh', () => {
    const gh = phonicsZone(7).items.find((item) => item.pattern === 'gh')!;
    let questions = dealPhonicsRound(7, 0);
    if (!questions.some((question) => question.itemId === gh.id)) {
      const replacement = dealWrongBook(7, [gh.id], 0)[0]!;
      const index = questions.findIndex((question) => question.itemId !== gh.id);
      questions = questions.map((question, itemIndex) => (itemIndex === index ? replacement : question));
    }
    const target = questions.find((question) => question.itemId === gh.id)!;
    expect(target.accept?.[0]).toBeTruthy();
    const answers = questions.map((question) => ({
      itemId: question.itemId,
      value: question.itemId === gh.id ? question.accept![0]! : question.answer,
    }));
    const score = scoreRound(7, questions, answers);
    expect(score.missedItemIds).not.toContain(gh.id);
    expect(score.passed).toBe(true);
    expect(score.stars).toBe(3);
  });

  it('deals the wrong book from those items only', () => {
    const zone = phonicsZone(5);
    const first = zone.items[0]!.id;
    const second = zone.items[1]!.id;
    const round = dealWrongBook(5, [first, 'missing', first, second], 3);
    expect(round.map((question) => question.itemId).sort()).toEqual([first, second].sort());
    expect(dealWrongBook(5, [first, 'missing', first, second], 3)).toEqual(round);
    expectLegalRound(zone, round, false);
    expect(dealWrongBook(5, [], 1)).toEqual([]);
  });
});

describe('phonics progress', () => {
  it('stores progress under kids-phonics-island-v1', () => {
    expect(PHONICS_STORAGE_KEY).toBe('kids-phonics-island-v1');
    const store = memory();
    const save = recordRound(emptyPhonicsProgress(), 1, scoreRound(1, dealPhonicsRound(1, 4), answered(dealPhonicsRound(1, 4), 0)));
    writePhonicsProgress(save, store);
    expect(store.getItem('kids-phonics-island-v1')).toContain('"version":1');
    expect(readPhonicsProgress(store)).toEqual(save);
    expect(() => readPhonicsProgress()).not.toThrow();
    expect(() => writePhonicsProgress(emptyPhonicsProgress())).not.toThrow();
    expect(readPhonicsProgress(exploding('getItem')).zones[1].rounds).toBe(0);
    expect(() => writePhonicsProgress(save, exploding('setItem'))).not.toThrow();
  });

  it('falls back when stored JSON or fields are bad', () => {
    const store = memory();
    for (const raw of ['{', 'null', '[]', '"kids"', '   ']) {
      store.setItem(PHONICS_STORAGE_KEY, raw);
      expect(readPhonicsProgress(store)).toEqual(emptyPhonicsProgress());
    }
    store.setItem(PHONICS_STORAGE_KEY, JSON.stringify({ version: 2, zones: {} }));
    expect(readPhonicsProgress(store).zones[1].rounds).toBe(0);

    store.setItem(PHONICS_STORAGE_KEY, JSON.stringify({
      version: 1,
      zones: {
        1: { cleared: true, bestStars: 0, attempts: 10, correct: 8, rounds: 1, wrongBook: [] },
        2: { cleared: true, bestStars: 2, attempts: 8, correct: 6, rounds: 1, wrongBook: ['z2-c-can', 'nope', 4] },
        3: { cleared: 'yes', bestStars: 3, attempts: 1, correct: 1, rounds: 1, wrongBook: [] },
        4: { cleared: false, bestStars: 2, attempts: 8, correct: 6, rounds: 1, wrongBook: [] },
      },
    }));
    const repaired = readPhonicsProgress(store);
    expect(repaired.zones[1]).toEqual({ cleared: false, bestStars: 0, attempts: 0, correct: 0, rounds: 0, wrongBook: [] });
    expect(repaired.zones[2]).toMatchObject({ cleared: true, bestStars: 2, attempts: 8, correct: 6, rounds: 1, wrongBook: ['z2-c-can'] });
    expect(repaired.zones[3].cleared).toBe(false);
    expect(repaired.zones[4].bestStars).toBe(0);
    expect(isZoneUnlocked(repaired, 2)).toBe(false);
    expect(isZoneUnlocked(repaired, 3)).toBe(true);
  });

  it('keeps the next zone locked after a failed round', () => {
    const questions = dealPhonicsRound(1, 9);
    const failed = scoreRound(1, questions, answered(questions, 3));
    expect(failed.passed).toBe(false);
    const original = emptyPhonicsProgress();
    const save = recordRound(original, 1, failed);
    expect(save).not.toBe(original);
    expect(original.zones[1].rounds).toBe(0);
    expect(save.zones[1]).toMatchObject({ cleared: false, bestStars: 0, rounds: 1, correct: 7, attempts: 10 });
    expect(save.zones[1].wrongBook).toEqual(failed.missedItemIds);
    expect(isZoneUnlocked(save, 1)).toBe(true);
    expect(isZoneUnlocked(save, 2)).toBe(false);

    const fresh = emptyPhonicsProgress();
    const skipped = recordRound(fresh, 4, scoreRound(4, dealPhonicsRound(4, 1), answered(dealPhonicsRound(4, 1), 0)));
    expect(skipped).toBe(fresh);
    expect(isZoneUnlocked(skipped, 4)).toBe(false);
  });

  it('unlocks the next zone only after the previous one clears', () => {
    let save = emptyPhonicsProgress();
    for (const zone of PHONICS_ZONES) {
      expect(isZoneUnlocked(save, zone.id), `zone ${zone.id}`).toBe(true);
      const questions = dealPhonicsRound(zone.id, 1);
      const score = scoreRound(zone.id, questions, answered(questions, 0));
      expect(score).toMatchObject({ passed: true, stars: 3, missedItemIds: [] });
      save = recordRound(save, zone.id, score);
      expect(save.zones[zone.id].cleared).toBe(true);
      if (zone.id < 8) expect(isZoneUnlocked(save, (zone.id + 1) as PhonicsZoneId)).toBe(true);
      if (zone.id < 7) expect(isZoneUnlocked(save, (zone.id + 2) as PhonicsZoneId)).toBe(false);
    }
    expect(save.zones[8].cleared).toBe(true);
  });

  it('keeps the best stars and reports accuracy', () => {
    const missTwo = scoreRound(1, dealPhonicsRound(1, 1), answered(dealPhonicsRound(1, 1), 2));
    const perfect = scoreRound(1, dealPhonicsRound(1, 2), answered(dealPhonicsRound(1, 2), 0));
    const failed = scoreRound(1, dealPhonicsRound(1, 3), answered(dealPhonicsRound(1, 3), 10));
    let save = recordRound(emptyPhonicsProgress(), 1, missTwo);
    expect(save.zones[1]).toMatchObject({ bestStars: 1, cleared: true, rounds: 1, correct: 8, attempts: 10 });
    expect(isZoneUnlocked(save, 2)).toBe(true);
    expect(isZoneUnlocked(save, 3)).toBe(false);
    save = recordRound(save, 1, perfect);
    save = recordRound(save, 1, failed);
    expect(save.zones[1]).toMatchObject({ bestStars: 3, cleared: true, rounds: 3, correct: 18, attempts: 30 });
    expect(isZoneUnlocked(save, 2)).toBe(true);

    const summary = parentSummary(save);
    expect(summary.zones[0]).toMatchObject({
      id: 1,
      nameZh: '字母沙灘',
      accuracy: 18 / 30,
      rounds: 3,
      bestStars: 3,
      cleared: true,
    });
    expect(summary.zones[1]).toMatchObject({ accuracy: null, rounds: 0, bestStars: 0, cleared: false });
    expect(summary.review.map((zone) => zone.id)).toContain(1);
    expect(summary.review[0]?.sounds.length).toBeLessThanOrEqual(3);

    const empty = parentSummary(emptyPhonicsProgress());
    expect(empty.zones.every((zone) => zone.accuracy === null && zone.rounds === 0 && zone.bestStars === 0 && zone.cleared === false)).toBe(true);
    expect(empty.review).toEqual([]);
  });

  it('suggests review below 0.8 or while the wrong book has items, at most three sounds', () => {
    const questions = dealPhonicsRound(1, 2);
    const score = scoreRound(1, questions, answered(questions, 5));
    expect(score.passed).toBe(false);
    let save = recordRound(emptyPhonicsProgress(), 1, score);
    const sounds = score.missedItemIds.slice(0, 3).map((id) => phonicsZone(1).items.find((item) => item.id === id)!.sound);
    expect(parentSummary(save).zones[0]?.accuracy).toBe(0.5);
    expect(parentSummary(save).review).toEqual([{ id: 1, nameZh: '字母沙灘', sounds }]);

    const reviewed = recordWrongBookReview(save, 1, score.missedItemIds);
    expect(reviewed.zones[1]).toMatchObject({
      wrongBook: [],
      bestStars: 0,
      cleared: false,
      rounds: 1,
      correct: 5,
      attempts: 10,
    });
    expect(isZoneUnlocked(reviewed, 2)).toBe(false);
    expect(parentSummary(reviewed).review).toEqual([{ id: 1, nameZh: '字母沙灘', sounds: [] }]);
    expect(recordWrongBookReview(reviewed, 1, ['z1-b'])).toBe(reviewed);

    const oneMiss = scoreRound(1, dealPhonicsRound(1, 6), answered(dealPhonicsRound(1, 6), 1));
    const cleared = recordRound(emptyPhonicsProgress(), 1, oneMiss);
    expect(parentSummary(cleared).zones[0]?.accuracy).toBe(0.9);
    expect(parentSummary(cleared).review).toHaveLength(1);
    const wiped = recordWrongBookReview(cleared, 1, oneMiss.missedItemIds);
    expect(wiped.zones[1].bestStars).toBe(cleared.zones[1].bestStars);
    expect(wiped.zones[1].cleared).toBe(true);
    expect(isZoneUnlocked(wiped, 2)).toBe(true);
    expect(parentSummary(wiped).review).toEqual([]);
  });
});

describe('phonics speech and copy', () => {
  it('speaks through the shared English voice and stays safe without it', () => {
    const source = readFileSync(join(root, 'src/phonics/speech.ts'), 'utf8');
    expect(source).toContain("from '../game/audio'");
    expect(source).toContain('speakEnglish');
    expect(phonicsAudioAvailable()).toBe(false);
    expect(() => speakPhonics(true, 'bat')).not.toThrow();
    expect(() => speakPhonics(false, 'bat')).not.toThrow();
  });

  it('keeps teaching copy with the zone examples and no banned branding', () => {
    expect(PHONICS_COPY.title).toBe('語音島');
    expect(PHONICS_COPY.home).toBe('選擇遊戲');
    expect(PHONICS_COPY.noAudio.length).toBeGreaterThan(0);
    for (const zone of PHONICS_ZONES) {
      const lesson = PHONICS_LESSONS[zone.id];
      expect(lesson.title).toBe(zone.nameZh);
      expect(lesson.body.length).toBeGreaterThan(0);
      for (const word of zone.tutorial) expect(lesson.body).toContain(word.en);
    }
    const folder = join(root, 'src/phonics');
    const files = readdirSync(folder).filter((name) => name.endsWith('.ts'));
    expect(files).toEqual(expect.arrayContaining(['zones.ts', 'round.ts', 'progress.ts', 'speech.ts', 'copy.ts']));
    for (const name of files) {
      const source = readFileSync(join(folder, name), 'utf8');
      expect(source, name).not.toMatch(BANNED);
      expect(source, name).not.toMatch(/from\s+['"]vue['"]/);
    }
  });
});

function expectLegalRound(zone: PhonicsZone, questions: readonly PhonicsQuestion[], full = true): void {
  if (full) expect(questions).toHaveLength(zone.total);
  const ids = questions.map((question) => question.itemId);
  expect(new Set(ids).size).toBe(ids.length);
  const items = questions.map((question) => zone.items.find((item) => item.id === question.itemId)!);
  if (zone.kind === 'hard-soft') {
    expect(items.filter((item) => item.letter === 'c')).toHaveLength(4);
    expect(items.filter((item) => item.letter === 'g')).toHaveLength(4);
    for (const letter of ['c', 'g'] as const) {
      for (const hardness of ['hard', 'soft'] as const) {
        expect(items.some((item) => item.letter === letter && item.hardness === hardness)).toBe(true);
      }
    }
  }
  for (const question of questions) {
    const item = zone.items.find((entry) => entry.id === question.itemId)!;
    expect(question.zoneId).toBe(zone.id);
    expect(question.say).toBe(item.say);
    expect(question.show).toBe(item.show);
    expect(question.zh).toBe(item.zh);
    expect(question.cue).toBe(item.cue);
    expect(new Set(question.options).size).toBe(question.options.length);
    expect(question.options).toContain(question.answer);
    expect(question.options.length).toBeGreaterThanOrEqual(2);
    expect(clashHits(question.options)).toBeLessThan(2);
    if (zone.kind === 'hard-soft') {
      expect(new Set(question.options)).toEqual(new Set(['硬音 Hard', '軟音 Soft']));
    } else if (zone.kind === 'short-vowel') {
      expect(new Set(question.options)).toEqual(new Set(['a', 'e', 'i', 'o', 'u']));
    } else if (zone.kind === 'long-vowel') {
      expect(new Set(question.options)).toEqual(new Set(item.pair));
    } else if (zone.kind === 'silent') {
      const letters = item.letters ?? '';
      expect(new Set(question.options)).toEqual(new Set([...letters].map((_, index) => `p${index}`)));
      expect(optionLabel(question, question.answer)).toBe(letters[item.silent![0]!]);
    } else {
      expect(question.options).toHaveLength(4);
    }
  }
}
