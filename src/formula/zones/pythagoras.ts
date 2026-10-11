import { mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';

/**
 * Zone 5: integer Pythagorean triples, hypotenuse and a missing leg.
 * Six questions alternate the two kinds (three each). A pass needs 4 correct
 * with at most one miss, so the round always sees both kinds before it ends.
 */
const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [7, 24, 25],
  [8, 15, 17],
  [9, 12, 15],
  [9, 40, 41],
  [12, 16, 20],
  [12, 35, 37],
  [15, 20, 25],
  [15, 36, 39],
  [18, 24, 30],
  [20, 21, 29],
  [21, 28, 35],
] as const;

type Triple = (typeof TRIPLES)[number];
type Hide = 'short' | 'long';

for (const [a, b, c] of TRIPLES) {
  if (!(a < b && b < c && a * a + b * b === c * c)) {
    throw new Error(`Bad Pythagorean triple ${a}, ${b}, ${c}`);
  }
}

export const tutorialSteps = [
  {
    title: 'The hypotenuse',
    body: 'A right triangle has one square corner. The hypotenuse is the longest side, the one opposite that corner. The other two sides are the legs.',
  },
  {
    title: 'Pythagoras',
    body: 'The squares of the legs add up to the square of the hypotenuse. If the legs are 3 and 4, then 9 + 16 = 25, so the hypotenuse is 5.',
  },
  {
    title: 'A missing leg',
    body: 'When you know the hypotenuse and one leg, subtract the squares. A hypotenuse of 5 and a leg of 3 leave 25 − 9 = 16, so the other leg is 4.',
  },
] as const;

export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  const triples = shuffle(rand, TRIPLES);
  const startWithLeg = rand() < 0.5;
  const hides = shuffle(rand, ['short', 'long', rand() < 0.5 ? 'short' : 'long'] as const);
  const questions: PickQuestion[] = [];
  for (let index = 0; index < 3; index += 1) {
    const hypotenuse = hypotenuseQuestion(rand, triples[index]!);
    const leg = legQuestion(rand, triples[index + 3]!, hides[index]!);
    questions.push(startWithLeg ? leg : hypotenuse, startWithLeg ? hypotenuse : leg);
  }
  return questions;
}

function hypotenuseQuestion(rand: () => number, triple: Triple): PickQuestion {
  const [a, b, c] = triple;
  return question(rand, {
    id: `pythagoras-hyp-${a}-${b}-${c}`,
    prompt: `A right triangle has legs of ${a} cm and ${b} cm. How long is the hypotenuse in centimetres?`,
    answer: c,
    distractors: [a + b, c + 1, c - 1, b, a * b],
  });
}

function legQuestion(rand: () => number, triple: Triple, hide: Hide): PickQuestion {
  const [a, b, c] = triple;
  const shown = hide === 'short' ? b : a;
  const missing = hide === 'short' ? a : b;
  return question(rand, {
    id: `pythagoras-leg-${a}-${b}-${c}-miss-${missing}`,
    prompt: `A right triangle has a leg of ${shown} cm and a hypotenuse of ${c} cm. How long is the other leg in centimetres?`,
    answer: missing,
    distractors: [c - shown, c, shown, missing + 1, a + b],
  });
}

function question(
  rand: () => number,
  spec: { id: string; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  if (!Number.isInteger(spec.answer) || spec.answer <= 0) {
    throw new Error(`Pythagoras answer is not a positive integer: ${spec.prompt}`);
  }
  return {
    id: spec.id,
    zone: 5,
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
