import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gradeResponse, judgeRound, ZONE_PASS } from '../src/formula/rules';
import {
  FACTOR_IDENTITIES,
  ZONE_CATALOG,
  ZONE_IDS,
  type FactorIdentityId,
  type FormulaAnswer,
  type FormulaQuestion,
  type FormulaTag,
  type GradedAttempt,
} from '../src/formula/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const yes = (tag?: FormulaTag): GradedAttempt => (tag === undefined ? { correct: true } : { correct: true, tag });
const no = (tag?: FormulaTag): GradedAttempt => (tag === undefined ? { correct: false } : { correct: false, tag });

function marks(correct: number, wrong: number, tag?: FormulaTag): GradedAttempt[] {
  return [
    ...Array.from({ length: correct }, () => yes(tag)),
    ...Array.from({ length: wrong }, () => no(tag)),
  ];
}

function identityRound(
  first: Record<FactorIdentityId, boolean>,
  rematch: Partial<Record<FactorIdentityId, boolean>> = {},
): GradedAttempt[] {
  const attempts: GradedAttempt[] = FACTOR_IDENTITIES.map((item) => ({
    correct: first[item.id],
    tag: item.id,
  }));
  for (const item of FACTOR_IDENTITIES) {
    const again = rematch[item.id];
    if (again === undefined) continue;
    attempts.push({ correct: again, tag: item.id });
  }
  return attempts;
}

const allIdentities = (): Record<FactorIdentityId, boolean> => ({
  'sum-square': true,
  'diff-square': true,
  'diff-squares': true,
  'sum-cubes': true,
  'diff-cubes': true,
});

describe('formula zone catalog', () => {
  it('lists zones 1–8 in unlock order', () => {
    expect(ZONE_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ZONE_CATALOG.map((zone) => zone.title)).toEqual([
      'Directions',
      'Units',
      'Area+Perimeter',
      'Percentage',
      'Pythagoras',
      'Factorization',
      'Volume+Euler',
      'Interest',
    ]);
    expect(FACTOR_IDENTITIES.map((item) => item.id)).toEqual([
      'sum-square',
      'diff-square',
      'diff-squares',
      'sum-cubes',
      'diff-cubes',
    ]);
  });

  it('keeps the formula core free of Vue', () => {
    for (const file of ['types.ts', 'rules.ts', 'progress.ts']) {
      const source = readFileSync(join(root, 'src/formula', file), 'utf8');
      expect(source).not.toMatch(/from ['"]vue['"]/);
    }
  });
});

describe('pick and fill grading', () => {
  const picked: FormulaQuestion = {
    id: 'dir-1',
    zone: 1,
    mode: 'pick',
    prompt: 'Which way is north-east?',
    choices: ['ne', 'nw', 'se'],
    answer: 'ne',
  };
  const filled: FormulaQuestion = {
    id: 'unit-1',
    zone: 2,
    mode: 'fill',
    prompt: 'How many cents are in $1?',
    answer: '100',
    tag: 'simple',
  };

  it('matches a picked choice id and rejects a different question', () => {
    const answer: FormulaAnswer = { questionId: 'dir-1', value: 'ne' };
    expect(gradeResponse(picked, answer)).toEqual({ correct: true });
    expect(gradeResponse(picked, { questionId: 'dir-1', value: 'nw' }).correct).toBe(false);
    expect(gradeResponse(picked, { questionId: 'other', value: 'ne' }).correct).toBe(false);
  });

  it('accepts a filled value with trimmed or numeric equivalence', () => {
    expect(gradeResponse(filled, { questionId: 'unit-1', value: ' 100 ' })).toEqual({
      correct: true,
      tag: 'simple',
    });
    expect(gradeResponse(filled, { questionId: 'unit-1', value: '100.0' }).correct).toBe(true);
    expect(gradeResponse(
      { ...filled, answer: '1000' },
      { questionId: 'unit-1', value: '1,000' },
    ).correct).toBe(true);
    expect(gradeResponse(filled, { questionId: 'unit-1', value: '99' }).correct).toBe(false);
    expect(gradeResponse(filled, { questionId: 'unit-1', value: '   ' }).correct).toBe(false);

    const formula: FormulaQuestion = {
      id: 'fac-1',
      zone: 6,
      mode: 'fill',
      prompt: 'Expand (a+b)²',
      answer: '(a+b)^2',
      tag: 'sum-square',
    };
    expect(gradeResponse(formula, { questionId: 'fac-1', value: '(a + b)^2' }).correct).toBe(true);
  });
});

describe('zone pass boundaries', () => {
  it('pins the pass lines', () => {
    expect(ZONE_PASS[1]).toEqual({ kind: 'streak', correct: 5, maxMiss: 1, failWrong: 3 });
    expect(ZONE_PASS[2]).toEqual({ kind: 'quota', total: 8, need: 6 });
    expect(ZONE_PASS[3]).toEqual({ kind: 'quota', total: 6, need: 5 });
    expect(ZONE_PASS[4]).toEqual({ kind: 'quota', total: 5, need: 4 });
    expect(ZONE_PASS[5]).toEqual({ kind: 'streak', correct: 4, maxMiss: 1, failWrong: 2 });
    expect(ZONE_PASS[6]).toMatchObject({ identities: 5, rematch: 1 });
    expect(ZONE_PASS[7]).toEqual({ kind: 'sections', volume: 4, volumeNeed: 3, eulerNeed: 2 });
    expect(ZONE_PASS[8]).toEqual({ kind: 'interest', total: 6, need: 5, simpleNeed: 2, compoundNeed: 2 });
  });

  it('zone 1 passes 5 correct with at most one miss and fails on the third wrong', () => {
    const perfect = judgeRound(1, marks(5, 0));
    expect(perfect).toMatchObject({ status: 'passed', stars: 3, correct: 5, wrong: 0, total: 5 });

    const oneMiss = judgeRound(1, [no(), ...marks(5, 0)]);
    expect(oneMiss).toMatchObject({ status: 'passed', stars: 2, correct: 5, wrong: 1, total: 6 });

    const stillOpen = judgeRound(1, [...marks(4, 0), no()]);
    expect(stillOpen).toMatchObject({ status: 'playing', stars: 0, correct: 4, wrong: 1 });

    const twoMissesThenFive = judgeRound(1, [no(), no(), ...marks(5, 0)]);
    expect(twoMissesThenFive).toMatchObject({ status: 'failed', stars: 0, correct: 5, wrong: 2, total: 7 });

    const thirdWrong = judgeRound(1, [yes(), no(), yes(), no(), no()]);
    expect(thirdWrong).toMatchObject({ status: 'failed', stars: 0, correct: 2, wrong: 3, total: 5 });

    const closed = judgeRound(1, [...marks(5, 0), no(), no(), no()]);
    expect(closed).toMatchObject({ status: 'passed', stars: 3, correct: 5, wrong: 0, total: 5 });
  });

  it('zone 2 passes at 6/8, 7/8, and 8/8 with 1–3 stars', () => {
    expect(judgeRound(2, marks(5, 0))).toMatchObject({ status: 'playing', stars: 0, total: 5 });
    expect(judgeRound(2, marks(6, 2))).toMatchObject({ status: 'passed', stars: 1, correct: 6, wrong: 2, total: 8 });
    expect(judgeRound(2, marks(7, 1))).toMatchObject({ status: 'passed', stars: 2, correct: 7, wrong: 1 });
    expect(judgeRound(2, marks(8, 0))).toMatchObject({ status: 'passed', stars: 3, correct: 8, wrong: 0 });
    expect(judgeRound(2, marks(5, 3))).toMatchObject({ status: 'failed', stars: 0, correct: 5, wrong: 3, total: 8 });
  });

  it('zone 3 passes at 5/6 and fails at 4/6', () => {
    expect(judgeRound(3, marks(5, 0))).toMatchObject({ status: 'playing', stars: 0, total: 5 });
    expect(judgeRound(3, marks(5, 1))).toMatchObject({ status: 'passed', stars: 2, correct: 5, wrong: 1, total: 6 });
    expect(judgeRound(3, marks(6, 0))).toMatchObject({ status: 'passed', stars: 3, correct: 6, wrong: 0 });
    expect(judgeRound(3, marks(4, 2))).toMatchObject({ status: 'failed', stars: 0, correct: 4, wrong: 2, total: 6 });
  });

  it('zone 4 passes at 4/5 and fails at 3/5', () => {
    expect(judgeRound(4, marks(4, 0))).toMatchObject({ status: 'playing', stars: 0, total: 4 });
    expect(judgeRound(4, marks(4, 1))).toMatchObject({ status: 'passed', stars: 2, correct: 4, wrong: 1, total: 5 });
    expect(judgeRound(4, marks(5, 0))).toMatchObject({ status: 'passed', stars: 3 });
    expect(judgeRound(4, marks(3, 2))).toMatchObject({ status: 'failed', stars: 0, correct: 3, wrong: 2, total: 5 });
    expect(judgeRound(4, [...marks(4, 1), no(), no()])).toMatchObject({ status: 'passed', stars: 2, total: 5 });
  });

  it('zone 5 passes 4 correct with at most one miss and fails on the second miss', () => {
    expect(judgeRound(5, marks(4, 0))).toMatchObject({ status: 'passed', stars: 3, correct: 4, wrong: 0, total: 4 });
    expect(judgeRound(5, [no(), ...marks(4, 0)])).toMatchObject({
      status: 'passed',
      stars: 2,
      correct: 4,
      wrong: 1,
      total: 5,
    });
    expect(judgeRound(5, [yes(), yes(), no(), yes()])).toMatchObject({ status: 'playing', stars: 0, correct: 3, wrong: 1 });
    expect(judgeRound(5, [yes(), no(), no(), ...marks(4, 0)])).toMatchObject({
      status: 'failed',
      stars: 0,
      correct: 1,
      wrong: 2,
      total: 3,
    });
    expect(judgeRound(5, [...marks(4, 0), no(), no()])).toMatchObject({
      status: 'passed',
      stars: 3,
      total: 4,
    });
  });

  it('zone 6 needs all 5 identities and allows one rematch of the misses', () => {
    const perfect = judgeRound(6, identityRound(allIdentities()));
    expect(perfect).toMatchObject({ status: 'passed', stars: 3, correct: 5, wrong: 0, total: 5 });

    const oneMiss = allIdentities();
    oneMiss['diff-square'] = false;
    expect(judgeRound(6, identityRound(oneMiss))).toMatchObject({ status: 'playing', stars: 0, wrong: 1 });
    expect(judgeRound(6, identityRound(oneMiss, { 'diff-square': true }))).toMatchObject({
      status: 'passed',
      stars: 2,
      correct: 5,
      wrong: 1,
      total: 6,
    });
    expect(judgeRound(6, identityRound(oneMiss, { 'diff-square': false }))).toMatchObject({
      status: 'failed',
      stars: 0,
    });

    const twoMiss = allIdentities();
    twoMiss['sum-square'] = false;
    twoMiss['sum-cubes'] = false;
    expect(judgeRound(6, identityRound(twoMiss, { 'sum-square': true, 'sum-cubes': true }))).toMatchObject({
      status: 'passed',
      stars: 1,
      wrong: 2,
    });

    const everyMiss = {
      'sum-square': false,
      'diff-square': false,
      'diff-squares': false,
      'sum-cubes': false,
      'diff-cubes': false,
    } satisfies Record<FactorIdentityId, boolean>;
    expect(judgeRound(6, identityRound(everyMiss, {
      'sum-square': true,
      'diff-square': true,
      'diff-squares': true,
      'sum-cubes': true,
      'diff-cubes': true,
    }))).toMatchObject({ status: 'passed', stars: 1, correct: 5, wrong: 5 });

    const missing = identityRound(allIdentities()).slice(0, 4);
    expect(judgeRound(6, missing)).toMatchObject({ status: 'playing', stars: 0 });

    const rematchOfAHit = [...identityRound(allIdentities()), yes('sum-square')];
    expect(judgeRound(6, rematchOfAHit).status).toBe('failed');
    expect(judgeRound(6, rematchOfAHit).stars).toBe(0);

    const thirdTry = identityRound(oneMiss, { 'diff-square': true });
    thirdTry.push(yes('diff-square'));
    expect(judgeRound(6, thirdTry)).toMatchObject({ status: 'failed', stars: 0 });

    expect(judgeRound(6, [...identityRound(allIdentities()).slice(0, 4), yes('volume')])).toMatchObject({
      status: 'failed',
      stars: 0,
    });
  });

  it('zone 7 plays volume first, then requires volume ≥3/4 and Euler 2/2', () => {
    const volume = (correct: number): GradedAttempt[] => marks(correct, 4 - correct, 'volume');
    const euler = [yes('euler'), yes('euler')];

    expect(judgeRound(7, [...volume(4), ...euler])).toMatchObject({
      status: 'passed',
      stars: 3,
      correct: 6,
      wrong: 0,
      total: 6,
    });
    expect(judgeRound(7, [...volume(3), ...euler])).toMatchObject({
      status: 'passed',
      stars: 2,
      correct: 5,
      wrong: 1,
      total: 6,
    });
    expect(judgeRound(7, volume(4))).toMatchObject({ status: 'playing', stars: 0, total: 4 });
    expect(judgeRound(7, [...volume(4), yes('euler')])).toMatchObject({ status: 'playing', stars: 0, correct: 5, wrong: 0 });

    expect(judgeRound(7, volume(2))).toMatchObject({ status: 'failed', stars: 0, correct: 2, wrong: 2, total: 4 });
    expect(judgeRound(7, [...volume(3), yes('euler'), no('euler')])).toMatchObject({
      status: 'failed',
      stars: 0,
      correct: 4,
      wrong: 2,
    });
    expect(judgeRound(7, [yes('euler'), ...volume(4), yes('euler')])).toMatchObject({ status: 'failed', stars: 0 });
    expect(judgeRound(7, [...volume(3), yes('volume')])).toMatchObject({ status: 'failed', stars: 0 });
    expect(judgeRound(7, [yes()])).toMatchObject({ status: 'failed', stars: 0 });
  });

  it('zone 8 passes ≥5/6 only when at least two simple and two compound are correct', () => {
    const simple = (correct: boolean): GradedAttempt => ({ correct, tag: 'simple' });
    const compound = (correct: boolean): GradedAttempt => ({ correct, tag: 'compound' });

    const perfect = judgeRound(8, [
      simple(true), simple(true), simple(true),
      compound(true), compound(true), compound(true),
    ]);
    expect(perfect).toMatchObject({ status: 'passed', stars: 3, correct: 6, wrong: 0, total: 6 });

    const twoSimple = judgeRound(8, [
      simple(true), simple(true), simple(false),
      compound(true), compound(true), compound(true),
    ]);
    expect(twoSimple).toMatchObject({ status: 'passed', stars: 2, correct: 5, wrong: 1, total: 6 });

    const twoCompound = judgeRound(8, [
      simple(true), simple(true), simple(true),
      compound(true), compound(true), compound(false),
    ]);
    expect(twoCompound).toMatchObject({ status: 'passed', stars: 2, correct: 5, wrong: 1 });

    expect(judgeRound(8, [
      simple(true), simple(true), simple(true),
      compound(true), compound(true),
    ])).toMatchObject({ status: 'playing', stars: 0, total: 5 });

    expect(judgeRound(8, [
      simple(true), simple(true), simple(true), simple(true),
      compound(false), compound(false),
    ])).toMatchObject({ status: 'failed', stars: 0, correct: 4, wrong: 2, total: 6 });

    expect(judgeRound(8, [
      simple(true),
      compound(true), compound(true), compound(true), compound(true),
      simple(false),
    ])).toMatchObject({ status: 'failed', stars: 0, correct: 5, wrong: 1 });

    expect(judgeRound(8, [
      simple(true), simple(true), simple(true), simple(true), simple(true), simple(true),
    ])).toMatchObject({ status: 'failed', stars: 0, correct: 6, wrong: 0 });

    expect(judgeRound(8, [simple(true), { correct: true }])).toMatchObject({ status: 'failed', stars: 0 });
  });
});
