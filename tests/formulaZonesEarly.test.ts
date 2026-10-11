import { describe, expect, it } from 'vitest';
import { deal as dealDirections, tutorialSteps as directionSteps } from '../src/formula/zones/directions';
import { CENTS_PER_DOLLAR, deal as dealUnits, tutorialSteps as unitSteps } from '../src/formula/zones/units';
import { deal as dealArea, tutorialSteps as areaSteps } from '../src/formula/zones/areaPerimeter';
import { deal as dealPercent, tutorialSteps as percentSteps } from '../src/formula/zones/percentage';
import { gradeResponse } from '../src/formula/rules';
import type { FormulaQuestion } from '../src/formula/types';

const SEEDS = [
  ...Array.from({ length: 40 }, (_, index) => index),
  256,
  999,
  4096,
  123456,
  2 ** 31 - 1,
  2 ** 32 - 1,
];

const ROSE = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const NAME_TO_CODE: Record<string, string> = {
  north: 'N',
  'north-east': 'NE',
  east: 'E',
  'south-east': 'SE',
  south: 'S',
  'south-west': 'SW',
  west: 'W',
  'north-west': 'NW',
};

function turn(code: string, steps: number): string {
  const index = ROSE.indexOf(code as (typeof ROSE)[number]);
  if (index < 0) throw new Error(`Unknown compass point ${code}`);
  return ROSE[(index + steps + ROSE.length) % ROSE.length]!;
}

function directionAnswer(prompt: string): string {
  const named = prompt.match(/^The picnic blanket is to the ([a-z-]+)\. Which compass point is that\?$/);
  if (named) return mustCode(named[1]!);
  const opposite = prompt.match(
    /^You are facing ([a-z-]+)\. Turn to the opposite direction\. Which compass point is that\?$/,
  );
  if (opposite) return turn(mustCode(opposite[1]!), 4);
  const quarter = prompt.match(
    /^You face ([a-z-]+)\. Make one quarter-turn clockwise\. Which compass point do you face now\?$/,
  );
  if (quarter) return turn(mustCode(quarter[1]!), 2);
  throw new Error(`No direction oracle for: ${prompt}`);
}

function mustCode(name: string): string {
  const code = NAME_TO_CODE[name];
  if (!code) throw new Error(`Unknown direction name ${name}`);
  return code;
}

function unitsAnswer(prompt: string): number {
  const dollars = prompt.match(/^How many cents are in \$(\d+)\?$/);
  if (dollars) return Number(dollars[1]) * 100;
  const whole = prompt.match(/^How many whole dollars are in (\d+) cents\?$/);
  if (whole) {
    const cents = Number(whole[1]);
    if (cents % 100 !== 0) throw new Error(`Not a whole number of dollars: ${prompt}`);
    return cents / 100;
  }
  const mixed = prompt.match(/^A snack costs \$(\d+) and (\d+) cents\. How many cents is that altogether\?$/);
  if (mixed) return Number(mixed[1]) * 100 + Number(mixed[2]);
  const added = prompt.match(/^Juice costs (\d+) cents and a bun costs (\d+) cents\. How many cents is the total\?$/);
  if (added) return Number(added[1]) + Number(added[2]);
  const change = prompt.match(
    /^You pay with (\d+) dollars for a toy that costs (\d+) cents\. How many cents do you get back\?$/,
  );
  if (change) return Number(change[1]) * 100 - Number(change[2]);
  const cards = prompt.match(/^Each card costs (\d+) cents\. You buy (\d+) cards\. How many cents do you spend\?$/);
  if (cards) return Number(cards[1]) * Number(cards[2]);
  const left = prompt.match(/^You have (\d+) cents\. The drink costs (\d+) cents\. How many cents are left\?$/);
  if (left) return Number(left[1]) - Number(left[2]);
  throw new Error(`No units oracle for: ${prompt}`);
}

const FORMULA_EQUIVALENTS: Record<string, readonly string[]> = {
  area: ['length × width', 'width × length'],
  'square-perimeter': ['4 × side', 'side × 4'],
};

function areaOracle(question: FormulaQuestion): { answer: string; equivalents: readonly string[] } {
  const prompt = question.prompt;
  const rect = prompt.match(/^A rectangle is (\d+) cm long and (\d+) cm wide\. (.*)$/);
  if (rect) {
    const length = Number(rect[1]);
    const width = Number(rect[2]);
    if (length === width) throw new Error(`Rectangle has equal sides: ${prompt}`);
    const tail = rect[3];
    if (tail === 'Which formula gives its area?') return { answer: 'length × width', equivalents: FORMULA_EQUIVALENTS.area! };
    if (tail === 'What is its area in square centimetres?') {
      return { answer: String(length * width), equivalents: [String(length * width)] };
    }
    if (tail === 'What is its perimeter in centimetres?') {
      return { answer: String(2 * (length + width)), equivalents: [String(2 * (length + width))] };
    }
  }
  const square = prompt.match(/^A square has sides of (\d+) cm\. (.*)$/);
  if (square) {
    const side = Number(square[1]);
    const tail = square[2];
    if (tail === 'Which formula gives its perimeter?') {
      return { answer: '4 × side', equivalents: FORMULA_EQUIVALENTS['square-perimeter']! };
    }
    if (tail === 'What is its area in square centimetres?') {
      return { answer: String(side * side), equivalents: [String(side * side)] };
    }
    if (tail === 'What is its perimeter in centimetres?') {
      return { answer: String(4 * side), equivalents: [String(4 * side)] };
    }
  }
  throw new Error(`No area oracle for: ${prompt}`);
}

function percentAnswer(prompt: string): number {
  const direct = prompt.match(/^What is (\d+)% of (\d+)\?$/);
  if (direct) return wholePercent(Number(direct[1]), Number(direct[2]));
  const share = prompt.match(/^(\d+) is what percent of (\d+)\?$/);
  if (share) return wholeShare(Number(share[1]), Number(share[2]));
  const apples = prompt.match(/^A basket holds (\d+) apples\. (\d+)% of them are red\. How many apples are red\?$/);
  if (apples) return wholePercent(Number(apples[2]), Number(apples[1]));
  const saved = prompt.match(/^A hat costs (\d+) dollars\. The shop takes (\d+)% off\. How many dollars do you save\?$/);
  if (saved) return wholePercent(Number(saved[2]), Number(saved[1]));
  const seats = prompt.match(/^There are (\d+) seats\. (\d+) seats are taken\. What percent of the seats are taken\?$/);
  if (seats) return wholeShare(Number(seats[2]), Number(seats[1]));
  throw new Error(`No percent oracle for: ${prompt}`);
}

function wholePercent(percent: number, whole: number): number {
  const product = percent * whole;
  if (product % 100 !== 0) throw new Error(`${percent}% of ${whole} is not whole`);
  return product / 100;
}

function wholeShare(part: number, whole: number): number {
  const product = part * 100;
  if (whole === 0 || product % whole !== 0) throw new Error(`${part} of ${whole} is not a whole percent`);
  return product / whole;
}

function assertSingleAnswer(question: FormulaQuestion, expected: string): void {
  expect(question.answer).toBe(expected);
  expect(question.prompt.trim().length).toBeGreaterThan(0);
  expect(gradeResponse(question, { questionId: question.id, value: question.answer }).correct).toBe(true);
  if (question.mode === 'fill') {
    expect('choices' in question).toBe(false);
    const nearby = String(Number(question.answer) + 1);
    expect(gradeResponse(question, { questionId: question.id, value: nearby }).correct).toBe(false);
    return;
  }
  expect(new Set(question.choices).size).toBe(question.choices.length);
  expect(question.choices).toHaveLength(4);
  expect(question.choices.filter((choice) => choice === question.answer)).toEqual([question.answer]);
  for (const choice of question.choices) {
    const graded = gradeResponse(question, { questionId: question.id, value: choice });
    expect(graded.correct).toBe(choice === question.answer);
    if (/^\d+$/.test(question.answer) && choice !== question.answer) {
      expect(Number(choice)).not.toBe(Number(question.answer));
    }
  }
}

function assertUniqueIds(questions: readonly FormulaQuestion[]): void {
  expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
}

describe('formula zones 1–4 deals', () => {
  it('repeats a seed exactly, including after another seed', () => {
    for (const seed of SEEDS) {
      expect(dealDirections(seed)).toEqual(dealDirections(seed));
      expect(dealUnits(seed)).toEqual(dealUnits(seed));
      expect(dealArea(seed)).toEqual(dealArea(seed));
      expect(dealPercent(seed)).toEqual(dealPercent(seed));
    }
    const again = {
      directions: dealDirections(5),
      units: dealUnits(5),
      area: dealArea(5),
      percent: dealPercent(5),
    };
    dealDirections(9);
    dealUnits(9);
    dealArea(9);
    dealPercent(9);
    expect(dealDirections(5)).toEqual(again.directions);
    expect(dealUnits(5)).toEqual(again.units);
    expect(dealArea(5)).toEqual(again.area);
    expect(dealPercent(5)).toEqual(again.percent);
  });

  it('uses the seed, so nearby seeds are not the same deal', () => {
    expect(dealDirections(1)).not.toEqual(dealDirections(2));
    expect(dealUnits(1)).not.toEqual(dealUnits(2));
    expect(dealArea(1)).not.toEqual(dealArea(2));
    expect(dealPercent(1)).not.toEqual(dealPercent(2));
  });
});

describe('zone 1 directions', () => {
  it('deals all eight compass points, enough for five correct plus misses', () => {
    for (const seed of SEEDS) {
      const questions = dealDirections(seed);
      expect(questions).toHaveLength(8);
      expect(questions.length).toBeGreaterThanOrEqual(5 + 2);
      expect(questions.map((question) => question.zone)).toEqual(Array(8).fill(1));
      expect(questions.every((question) => question.mode === 'pick')).toBe(true);
      expect(questions.map((question) => question.answer).sort()).toEqual([...ROSE].sort());
      assertUniqueIds(questions);
      for (const question of questions) {
        assertSingleAnswer(question, directionAnswer(question.prompt));
        expect(question.choices.every((choice) => (ROSE as readonly string[]).includes(choice))).toBe(true);
      }
    }
  });

  it('teaches the eight points, opposites, and a quarter turn', () => {
    expect(directionSteps.length).toBeGreaterThanOrEqual(2);
    const text = directionSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    for (const code of ROSE) expect(text).toMatch(new RegExp(`\\b${code}\\b`));
    expect(text.toLowerCase()).toContain('opposite');
    expect(text.toLowerCase()).toContain('quarter');
  });
});

describe('zone 2 units', () => {
  it('deals 8 integer-cent questions and keeps $1 = 100 cents', () => {
    expect(CENTS_PER_DOLLAR).toBe(100);
    for (const seed of SEEDS) {
      const questions = dealUnits(seed);
      expect(questions).toHaveLength(8);
      expect(questions.every((question) => question.zone === 2 && question.mode === 'pick')).toBe(true);
      assertUniqueIds(questions);
      const dollarPrompts = questions.filter((question) => question.prompt.startsWith('How many cents are in $'));
      expect(dollarPrompts.some((question) => question.prompt === 'How many cents are in $1?')).toBe(true);
      for (const question of questions) {
        const expected = unitsAnswer(question.prompt);
        expect(Number.isInteger(expected)).toBe(true);
        expect(expected).toBeGreaterThan(0);
        assertSingleAnswer(question, String(expected));
        expect(question.choices.every((choice) => /^\d+$/.test(choice))).toBe(true);
      }
      const oneDollar = questions.find((question) => question.prompt === 'How many cents are in $1?');
      expect(oneDollar?.answer).toBe('100');
    }
  });

  it('teaches that one dollar is 100 cents', () => {
    const text = unitSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(unitSteps.length).toBeGreaterThanOrEqual(2);
    expect(text).toContain('$1');
    expect(text).toContain('100 cents');
  });
});

describe('zone 3 area and perimeter', () => {
  it('deals 6 questions mixing shapes, measures, formula picks, and typed answers', () => {
    for (const seed of SEEDS) {
      const questions = dealArea(seed);
      expect(questions).toHaveLength(6);
      expect(questions.every((question) => question.zone === 3)).toBe(true);
      expect(questions.filter((question) => question.mode === 'pick')).toHaveLength(2);
      expect(questions.filter((question) => question.mode === 'fill')).toHaveLength(4);
      expect(questions.some((question) => question.prompt.startsWith('A rectangle'))).toBe(true);
      expect(questions.some((question) => question.prompt.startsWith('A square'))).toBe(true);
      expect(questions.some((question) => question.prompt.includes('area'))).toBe(true);
      expect(questions.some((question) => question.prompt.includes('perimeter'))).toBe(true);
      assertUniqueIds(questions);
      for (const question of questions) {
        const oracle = areaOracle(question);
        assertSingleAnswer(question, oracle.answer);
        if (question.mode === 'pick') {
          const hits = question.choices.filter((choice) => oracle.equivalents.includes(choice));
          expect(hits).toEqual([question.answer]);
        }
      }
    }
  });

  it('teaches area, perimeter, rectangles, and squares', () => {
    const text = areaSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(areaSteps.length).toBeGreaterThanOrEqual(2);
    expect(text.toLowerCase()).toContain('area');
    expect(text.toLowerCase()).toContain('perimeter');
    expect(text.toLowerCase()).toContain('rectangle');
    expect(text.toLowerCase()).toContain('square');
  });
});

describe('zone 4 percentage', () => {
  it('deals 5 questions whose answers are whole numbers', () => {
    for (const seed of SEEDS) {
      const questions = dealPercent(seed);
      expect(questions).toHaveLength(5);
      expect(questions.every((question) => question.zone === 4 && question.mode === 'pick')).toBe(true);
      assertUniqueIds(questions);
      for (const question of questions) {
        const expected = percentAnswer(question.prompt);
        expect(Number.isInteger(expected)).toBe(true);
        expect(expected).toBeGreaterThan(0);
        assertSingleAnswer(question, String(expected));
        expect(question.answer).toMatch(/^\d+$/);
        expect(question.choices.every((choice) => /^\d+$/.test(choice))).toBe(true);
      }
    }
  });

  it('teaches percent as out of 100', () => {
    const text = percentSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(percentSteps.length).toBeGreaterThanOrEqual(2);
    expect(text.toLowerCase()).toContain('percent');
    expect(text).toContain('100');
  });
});
