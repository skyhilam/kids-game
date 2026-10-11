import { mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';

/** One dollar is 100 cents. Amounts in this zone stay whole cents. */
export const CENTS_PER_DOLLAR = 100;

export const tutorialSteps = [
  {
    title: 'Dollars and cents',
    body: '$1 is 100 cents. Two dollars are 200 cents. Multiply the dollars by 100 when you need cents.',
  },
  {
    title: 'Dollars plus extra cents',
    body: 'A price of $3 and 25 cents is 3 × 100 + 25 = 325 cents. Count the dollars first, then add the leftover cents.',
  },
  {
    title: 'Change',
    body: 'Pay with 500 cents ($5) for a snack that costs 180 cents, and your change is 500 − 180 = 320 cents.',
  },
] as const;

export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  return shuffle(rand, [
    centsInDollars(rand, 1),
    centsInDollars(rand, intBetween(rand, 2, 9)),
    wholeDollars(rand),
    dollarsAndCents(rand),
    addCents(rand),
    change(rand),
    severalCards(rand),
    centsLeft(rand),
  ]);
}

function centsInDollars(rand: () => number, dollars: number): PickQuestion {
  const answer = dollars * CENTS_PER_DOLLAR;
  return question(rand, {
    id: `units-cents-in-${dollars}`,
    prompt: `How many cents are in $${dollars}?`,
    answer,
    distractors: [dollars, dollars * 10, dollars * 1000],
  });
}

function wholeDollars(rand: () => number): PickQuestion {
  const dollars = intBetween(rand, 2, 12);
  const cents = dollars * CENTS_PER_DOLLAR;
  return question(rand, {
    id: `units-dollars-in-${cents}`,
    prompt: `How many whole dollars are in ${cents} cents?`,
    answer: dollars,
    distractors: [cents, dollars * 10, dollars + 1],
  });
}

function dollarsAndCents(rand: () => number): PickQuestion {
  const dollars = intBetween(rand, 1, 6);
  const extra = intBetween(rand, 1, 99);
  const answer = dollars * CENTS_PER_DOLLAR + extra;
  return question(rand, {
    id: `units-mix-${dollars}-${extra}`,
    prompt: `A snack costs $${dollars} and ${extra} cents. How many cents is that altogether?`,
    answer,
    distractors: [dollars + extra, dollars * CENTS_PER_DOLLAR, extra],
  });
}

function addCents(rand: () => number): PickQuestion {
  const juice = intBetween(rand, 20, 90);
  const bun = intBetween(rand, 20, 90);
  return question(rand, {
    id: `units-add-${juice}-${bun}`,
    prompt: `Juice costs ${juice} cents and a bun costs ${bun} cents. How many cents is the total?`,
    answer: juice + bun,
    distractors: [Math.abs(juice - bun), juice + bun + CENTS_PER_DOLLAR, juice],
  });
}

function change(rand: () => number): PickQuestion {
  const dollars = intBetween(rand, 2, 6);
  const paid = dollars * CENTS_PER_DOLLAR;
  const price = intBetween(rand, 1, paid - 1);
  return question(rand, {
    id: `units-change-${dollars}-${price}`,
    prompt: `You pay with ${dollars} dollars for a toy that costs ${price} cents. How many cents do you get back?`,
    answer: paid - price,
    distractors: [paid + price, price, dollars],
  });
}

function severalCards(rand: () => number): PickQuestion {
  const price = intBetween(rand, 5, 40);
  const count = intBetween(rand, 2, 5);
  return question(rand, {
    id: `units-cards-${price}-${count}`,
    prompt: `Each card costs ${price} cents. You buy ${count} cards. How many cents do you spend?`,
    answer: price * count,
    distractors: [price + count, price, price * (count - 1)],
  });
}

function centsLeft(rand: () => number): PickQuestion {
  const have = intBetween(rand, 2, 8) * CENTS_PER_DOLLAR;
  const cost = intBetween(rand, 1, have - 1);
  return question(rand, {
    id: `units-left-${have}-${cost}`,
    prompt: `You have ${have} cents. The drink costs ${cost} cents. How many cents are left?`,
    answer: have - cost,
    distractors: [have + cost, cost, have],
  });
}

function question(
  rand: () => number,
  spec: { id: string; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  return {
    id: spec.id,
    zone: 2,
    mode: 'pick',
    prompt: spec.prompt,
    choices: numericChoices(rand, spec.answer, spec.distractors),
    answer: String(spec.answer),
  };
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
