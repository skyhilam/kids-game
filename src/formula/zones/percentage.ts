import { mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';

const FRIENDLY_PERCENTS = [10, 20, 25, 50, 75] as const;

export const tutorialSteps = [
  {
    title: 'Out of one hundred',
    body: 'Percent means out of 100. 50% of 40 is 20, because half of 40 is 20. Multiply by the percent, then divide by 100.',
  },
  {
    title: 'Friendly percents',
    body: '10% is one tenth. 25% is one quarter. 20% is one fifth. 75% is three quarters. In this zone the result is a whole number.',
  },
  {
    title: 'Part of a group',
    body: 'If 15 of 60 seats are taken, the percent is 15 ÷ 60 × 100 = 25. You can also start from the percent and find how many that is.',
  },
] as const;

/** Five whole-number percent questions, one friendly percent each. */
export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  const percents = shuffle(rand, FRIENDLY_PERCENTS);
  return shuffle(rand, [
    whatIsPercent(rand, percents[0]!),
    partOfWhole(rand, percents[1]!),
    redApples(rand, percents[2]!),
    dollarsSaved(rand, percents[3]!),
    seatsTaken(rand, percents[4]!),
  ]);
}

function whatIsPercent(rand: () => number, percent: number): PickQuestion {
  const whole = wholeBase(rand, percent);
  const answer = percentOf(percent, whole);
  return question(rand, {
    id: `percent-of-${percent}-${whole}`,
    prompt: `What is ${percent}% of ${whole}?`,
    answer,
    distractors: [whole, percent, whole - answer, answer + percent],
  });
}

function partOfWhole(rand: () => number, percent: number): PickQuestion {
  const whole = wholeBase(rand, percent);
  const part = percentOf(percent, whole);
  return question(rand, {
    id: `percent-part-${part}-of-${whole}`,
    prompt: `${part} is what percent of ${whole}?`,
    answer: percent,
    distractors: [100 - percent, part, whole, percent + 10],
  });
}

function redApples(rand: () => number, percent: number): PickQuestion {
  const whole = wholeBase(rand, percent);
  const answer = percentOf(percent, whole);
  return question(rand, {
    id: `percent-apples-${percent}-${whole}`,
    prompt: `A basket holds ${whole} apples. ${percent}% of them are red. How many apples are red?`,
    answer,
    distractors: [whole, percent, whole - answer, answer + 10],
  });
}

function dollarsSaved(rand: () => number, percent: number): PickQuestion {
  const price = wholeBase(rand, percent);
  const saved = percentOf(percent, price);
  return question(rand, {
    id: `percent-save-${percent}-${price}`,
    prompt: `A hat costs ${price} dollars. The shop takes ${percent}% off. How many dollars do you save?`,
    answer: saved,
    distractors: [price, price - saved, percent, saved + price],
  });
}

function seatsTaken(rand: () => number, percent: number): PickQuestion {
  const seats = wholeBase(rand, percent);
  const taken = percentOf(percent, seats);
  return question(rand, {
    id: `percent-seats-${taken}-of-${seats}`,
    prompt: `There are ${seats} seats. ${taken} seats are taken. What percent of the seats are taken?`,
    answer: percent,
    distractors: [100 - percent, taken, seats, percent + 5],
  });
}

function question(
  rand: () => number,
  spec: { id: string; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  if (!Number.isInteger(spec.answer)) throw new Error(`Percent answer is not whole: ${spec.prompt}`);
  return {
    id: spec.id,
    zone: 4,
    mode: 'pick',
    prompt: spec.prompt,
    choices: numericChoices(rand, spec.answer, spec.distractors),
    answer: String(spec.answer),
  };
}

function wholeBase(rand: () => number, percent: number): number {
  const step = 100 / gcd(percent, 100);
  const maxK = Math.floor(120 / step);
  const k = intBetween(rand, 2, maxK);
  return k * step;
}

function percentOf(percent: number, whole: number): number {
  const product = percent * whole;
  if (product % 100 !== 0) throw new Error(`${percent}% of ${whole} is not a whole number`);
  return product / 100;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function numericChoices(rand: () => number, answer: number, candidates: readonly number[]): string[] {
  const chosen: number[] = [];
  const seen = new Set<number>([answer]);
  const tryAdd = (value: number) => {
    if (chosen.length >= 3) return;
    if (!Number.isInteger(value) || value < 0 || seen.has(value)) return;
    seen.add(value);
    chosen.push(value);
  };
  for (const candidate of candidates) tryAdd(candidate);
  for (let bump = 1; chosen.length < 3 && bump <= 30; bump += 1) {
    tryAdd(answer + bump);
    tryAdd(answer - bump);
  }
  if (chosen.length !== 3) throw new Error(`Could not build distractors for ${answer}`);
  return shuffle(rand, [answer, ...chosen].map((value) => String(value)));
}

function intBetween(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
