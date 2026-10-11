import { mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';
import { CENTS_PER_DOLLAR } from './units';

export { CENTS_PER_DOLLAR };

/**
 * Zone 8: 3 simple and 3 compound questions, in integer cents.
 * $1 = 100 cents.
 *
 * Rounding rule (half-up, integer only):
 *   (cents × ratePercent × years + 50) ÷ 100, dropping the remainder.
 *   50 is half of 100, so a remainder of half a cent or more rounds up.
 * Simple interest applies that once to principal × rate × time.
 * Compound interest applies it once per year to the current balance,
 * adds those rounded cents, then repeats for the next year.
 * Division uses BigInt, so the cents do not drift through binary floating point.
 */

const PRINCIPALS = [100, 150, 250, 400, 500, 750, 800, 1000, 1250, 2000] as const;
const RATES = [2, 3, 4, 5, 6, 8, 10] as const;

type InterestKind = 'simple' | 'compound';
type InterestAsk = 'interest' | 'balance';

type MoneyParams = {
  principal: number;
  rate: number;
  years: number;
};

export const tutorialSteps = [
  {
    title: 'Simple interest',
    body: 'Simple interest uses I = P × r × t. P is the money you put in, r is the percent each year, and t is the number of years. $1 is 100 cents, so a principal of $1 is 100 cents.',
  },
  {
    title: 'Compound interest',
    body: 'Compound interest uses A = P × (1 + r)^t. Each year the interest joins the principal, and the next year pays interest on that new amount. This zone compounds once a year.',
  },
  {
    title: 'Nearest cent',
    body: 'Answers are whole cents. Half a cent or more rounds up to the next cent. Less than half a cent rounds down. The same rule is used every year for compound interest.',
  },
] as const;

export function simpleInterestCents(principalCents: number, ratePercent: number, years: number): number {
  assertMoney(principalCents, ratePercent, years);
  return Number(divHalfUp(BigInt(principalCents) * BigInt(ratePercent) * BigInt(years), BigInt(CENTS_PER_DOLLAR)));
}

export function compoundBalanceCents(principalCents: number, ratePercent: number, years: number): number {
  assertMoney(principalCents, ratePercent, years);
  let balance = BigInt(principalCents);
  const rate = BigInt(ratePercent);
  const hundred = BigInt(CENTS_PER_DOLLAR);
  for (let year = 0; year < years; year += 1) {
    balance += divHalfUp(balance * rate, hundred);
  }
  return Number(balance);
}

export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const built = [
    spec('simple', 'interest', claim(seen, 'simple', 'interest', { principal: CENTS_PER_DOLLAR, rate: drawRate(rand), years: drawYears(rand) })),
    spec('simple', 'balance', claim(seen, 'simple', 'balance', pickRoundingSimple(rand))),
    spec('simple', 'interest', claim(seen, 'simple', 'interest', drawParams(rand))),
    spec('compound', 'balance', claim(seen, 'compound', 'balance', pickSplitCompound(rand))),
    spec('compound', 'interest', claim(seen, 'compound', 'interest', drawParams(rand))),
    spec('compound', 'balance', claim(seen, 'compound', 'balance', drawParams(rand))),
  ];
  return shuffle(
    rand,
    built.map((item, index) => makeQuestion(rand, index, item.kind, item.ask, item.params)),
  );
}

function spec(kind: InterestKind, ask: InterestAsk, params: MoneyParams): { kind: InterestKind; ask: InterestAsk; params: MoneyParams } {
  return { kind, ask, params };
}

function makeQuestion(
  rand: () => number,
  slot: number,
  kind: InterestKind,
  ask: InterestAsk,
  params: MoneyParams,
): PickQuestion {
  const { principal, rate, years } = params;
  const interest = kind === 'simple'
    ? simpleInterestCents(principal, rate, years)
    : compoundBalanceCents(principal, rate, years) - principal;
  const balance = principal + interest;
  const answer = ask === 'interest' ? interest : balance;
  if (!Number.isInteger(answer) || answer <= 1) {
    throw new Error(`Interest answer would collide with a formula digit: ${kind} ${principal}`);
  }
  const truncated = Number((BigInt(principal) * BigInt(rate) * BigInt(years)) / BigInt(CENTS_PER_DOLLAR));
  const otherKindBalance = kind === 'simple'
    ? compoundBalanceCents(principal, rate, years)
    : principal + simpleInterestCents(principal, rate, years);
  const otherKindInterest = otherKindBalance - principal;
  const lumpBalance = compoundLumpCents(principal, rate, years);
  return question(rand, {
    id: `interest-${kind}-${ask}-${slot}-${principal}-${rate}-${years}`,
    tag: kind,
    prompt: promptFor(kind, ask, principal, rate, years),
    answer,
    distractors: [
      ask === 'interest' ? balance : interest,
      truncated,
      principal,
      kind === 'simple' ? otherKindInterest : otherKindBalance,
      ask === 'interest' ? lumpBalance - principal : lumpBalance,
      answer + 1,
    ],
  });
}

function promptFor(kind: InterestKind, ask: InterestAsk, principal: number, rate: number, years: number): string {
  const head = kind === 'simple' ? 'Simple interest' : 'Compound interest';
  const compound = kind === 'compound' ? ', compounded once a year' : '';
  const tail = ask === 'interest' ? 'How many cents of interest do you earn?' : 'How many cents do you have at the end?';
  const yearWord = years === 1 ? 'year' : 'years';
  return `${head}: you save ${principal} cents at ${rate}% per year for ${years} ${yearWord}${compound}. ${tail}`;
}

function pickRoundingSimple(rand: () => number): MoneyParams {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const params = drawParams(rand);
    if (simpleRoundsUp(params)) return params;
  }
  return { principal: 150, rate: 3, years: 1 };
}

function pickSplitCompound(rand: () => number): MoneyParams {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const params = { ...drawParams(rand), years: intBetween(rand, 2, 3) };
    if (compoundBalanceCents(params.principal, params.rate, params.years) !== compoundLumpCents(params.principal, params.rate, params.years)) {
      return params;
    }
  }
  return { principal: 150, rate: 3, years: 2 };
}

function simpleRoundsUp(params: MoneyParams): boolean {
  const numerator = BigInt(params.principal) * BigInt(params.rate) * BigInt(params.years);
  const hundred = BigInt(CENTS_PER_DOLLAR);
  return numerator % hundred >= hundred / 2n;
}

/** One half-up at the end. A distractor for the per-year compound rule. */
function compoundLumpCents(principalCents: number, ratePercent: number, years: number): number {
  let numerator = BigInt(principalCents);
  let denominator = 1n;
  const factor = BigInt(CENTS_PER_DOLLAR + ratePercent);
  const hundred = BigInt(CENTS_PER_DOLLAR);
  for (let year = 0; year < years; year += 1) {
    numerator *= factor;
    denominator *= hundred;
  }
  return Number(divHalfUp(numerator, denominator));
}

function claim(seen: Set<string>, kind: InterestKind, ask: InterestAsk, params: MoneyParams): MoneyParams {
  let principal = params.principal;
  for (let bump = 0; bump < PRINCIPALS.length; bump += 1) {
    const key = `${kind}|${ask}|${principal}|${params.rate}|${params.years}`;
    if (!seen.has(key)) {
      seen.add(key);
      return { principal, rate: params.rate, years: params.years };
    }
    const index = PRINCIPALS.indexOf(principal as (typeof PRINCIPALS)[number]);
    principal = PRINCIPALS[(index + 1 + PRINCIPALS.length) % PRINCIPALS.length]!;
  }
  throw new Error('Could not find a distinct interest question');
}

function drawParams(rand: () => number): MoneyParams {
  return {
    principal: PRINCIPALS[intBetween(rand, 0, PRINCIPALS.length - 1)]!,
    rate: drawRate(rand),
    years: drawYears(rand),
  };
}

function drawRate(rand: () => number): number {
  return RATES[intBetween(rand, 0, RATES.length - 1)]!;
}

function drawYears(rand: () => number): number {
  return intBetween(rand, 1, 3);
}

function divHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('Interest divisor must be positive');
  return (numerator + denominator / 2n) / denominator;
}

function assertMoney(principalCents: number, ratePercent: number, years: number): void {
  if (!Number.isInteger(principalCents) || !Number.isInteger(ratePercent) || !Number.isInteger(years)) {
    throw new Error('Interest inputs must be integers');
  }
  if (principalCents < 0 || ratePercent < 0 || years < 0) {
    throw new Error('Interest inputs must be non-negative');
  }
}

function question(
  rand: () => number,
  spec: { id: string; tag: InterestKind; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  return {
    id: spec.id,
    zone: 8,
    mode: 'pick',
    tag: spec.tag,
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
