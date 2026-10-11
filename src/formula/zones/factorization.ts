import { mulberry32, shuffle } from '../../game/rng';
import { FACTOR_IDENTITIES, type FactorIdentityId, type PickQuestion } from '../types';

/**
 * Zone 6: the five identities, one question each.
 * The child evaluates the identity at a pair of positive integers.
 * The hint card shows the formula; this deal asks for the number.
 */

export const tutorialSteps = [
  {
    title: 'Square identities',
    body: '(a+b)² = a² + 2ab + b². (a−b)² = a² − 2ab + b². The cross term 2ab is the part that is easy to forget.',
  },
  {
    title: 'Difference of squares',
    body: 'a²−b² = (a−b)(a+b). It is not the same as (a−b)².',
  },
  {
    title: 'Sum and difference of cubes',
    body: 'a³+b³ = (a+b)(a² − ab + b²). a³−b³ = (a−b)(a² + ab + b²). The middle sign flips.',
  },
] as const;

export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  const questions = FACTOR_IDENTITIES.map((identity) => makeQuestion(rand, identity.id));
  const tags = questions.map((question) => question.tag);
  if (new Set(tags).size !== FACTOR_IDENTITIES.length) {
    throw new Error('Factorization deal did not cover each identity once');
  }
  return shuffle(rand, questions);
}

function makeQuestion(rand: () => number, identity: FactorIdentityId): PickQuestion {
  const name = FACTOR_IDENTITIES.find((item) => item.id === identity)?.name;
  if (!name) throw new Error(`Unknown identity ${identity}`);
  const a = intBetween(rand, 3, 8);
  const b = intBetween(rand, 1, a - 2);
  const answer = evaluate(identity, a, b);
  if (answer < 4) throw new Error(`Factor answer collided with a formula digit: ${identity}`);
  return question(rand, {
    id: `factor-${identity}-${a}-${b}`,
    tag: identity,
    prompt: `a = ${a} and b = ${b}. What is ${name}?`,
    answer,
    distractors: mistakes(identity, a, b),
  });
}

function evaluate(identity: FactorIdentityId, a: number, b: number): number {
  const a2 = a * a;
  const b2 = b * b;
  const a3 = a2 * a;
  const b3 = b2 * b;
  switch (identity) {
    case 'sum-square':
      return (a + b) * (a + b);
    case 'diff-square':
      return (a - b) * (a - b);
    case 'diff-squares':
      return a2 - b2;
    case 'sum-cubes':
      return a3 + b3;
    case 'diff-cubes':
      return a3 - b3;
    default: {
      const never: never = identity;
      return never;
    }
  }
}

function mistakes(identity: FactorIdentityId, a: number, b: number): number[] {
  const a2 = a * a;
  const b2 = b * b;
  const a3 = a2 * a;
  const b3 = b2 * b;
  switch (identity) {
    case 'sum-square':
      return [a2 + b2, 2 * (a + b), a + b, a2 + 2 * a * b];
    case 'diff-square':
      return [a2 - b2, a2 + b2, a - b, a2 + b2 - a * b];
    case 'diff-squares':
      return [(a - b) * (a - b), a2 + b2, a - b, a * b];
    case 'sum-cubes':
      return [(a + b) * (a + b) * (a + b), a3 - b3, a + b, a3 + b];
    case 'diff-cubes':
      return [(a - b) * (a - b) * (a - b), a3 + b3, a - b, a3 - b];
    default: {
      const never: never = identity;
      return never;
    }
  }
}

function question(
  rand: () => number,
  spec: { id: string; tag: FactorIdentityId; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  if (!Number.isInteger(spec.answer) || spec.answer <= 0) {
    throw new Error(`Factor answer is not a positive integer: ${spec.prompt}`);
  }
  return {
    id: spec.id,
    zone: 6,
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
