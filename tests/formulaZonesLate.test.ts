import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hintFor } from '../src/formula/hints';
import { gradeResponse, ZONE_PASS } from '../src/formula/rules';
import { FACTOR_IDENTITIES, type FactorIdentityId, type FormulaQuestion } from '../src/formula/types';
import { deal as dealFactor, tutorialSteps as factorSteps } from '../src/formula/zones/factorization';
import {
  CENTS_PER_DOLLAR,
  compoundBalanceCents,
  deal as dealInterest,
  simpleInterestCents,
  tutorialSteps as interestSteps,
} from '../src/formula/zones/interest';
import { CENTS_PER_DOLLAR as UNIT_CENTS } from '../src/formula/zones/units';
import { deal as dealPythagoras, tutorialSteps as pythagorasSteps } from '../src/formula/zones/pythagoras';
import {
  deal as dealVolumeEuler,
  dealEuler,
  dealVolume,
  eulerTutorialSteps,
  tutorialSteps as volumeEulerSteps,
  volumeTutorialSteps,
} from '../src/formula/zones/volumeEuler';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SEEDS = [
  ...Array.from({ length: 40 }, (_, index) => index),
  256,
  999,
  4096,
  123456,
  2 ** 31 - 1,
  2 ** 32 - 1,
];

const SOLIDS: Record<string, { vertices: number; edges: number; faces: number }> = {
  tetrahedron: { vertices: 4, edges: 6, faces: 4 },
  cube: { vertices: 8, edges: 12, faces: 6 },
  'triangular prism': { vertices: 6, edges: 9, faces: 5 },
  'square pyramid': { vertices: 5, edges: 8, faces: 5 },
  'pentagonal prism': { vertices: 10, edges: 15, faces: 7 },
  'pentagonal pyramid': { vertices: 6, edges: 10, faces: 6 },
  'hexagonal pyramid': { vertices: 7, edges: 12, faces: 7 },
  octahedron: { vertices: 6, edges: 12, faces: 8 },
};

type PythagoreanKind = 'hypotenuse' | 'leg';

function intSqrt(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Not a whole square candidate: ${value}`);
  let root = 0;
  while (root * root < value) root += 1;
  if (root * root !== value) throw new Error(`${value} is not a perfect square`);
  return root;
}

function pythagorasOracle(prompt: string): { answer: number; kind: PythagoreanKind; shown: number; other: number } {
  const hypotenuse = prompt.match(
    /^A right triangle has legs of (\d+) cm and (\d+) cm\. How long is the hypotenuse in centimetres\?$/,
  );
  if (hypotenuse) {
    const left = Number(hypotenuse[1]);
    const right = Number(hypotenuse[2]);
    const answer = intSqrt(left * left + right * right);
    return { answer, kind: 'hypotenuse', shown: left, other: right };
  }
  const leg = prompt.match(
    /^A right triangle has a leg of (\d+) cm and a hypotenuse of (\d+) cm\. How long is the other leg in centimetres\?$/,
  );
  if (leg) {
    const shown = Number(leg[1]);
    const hypotenuseLength = Number(leg[2]);
    const answer = intSqrt(hypotenuseLength * hypotenuseLength - shown * shown);
    return { answer, kind: 'leg', shown, other: hypotenuseLength };
  }
  throw new Error(`No Pythagoras oracle for: ${prompt}`);
}

function factorValue(identity: FactorIdentityId, a: number, b: number): number {
  switch (identity) {
    case 'sum-square':
      return (a + b) * (a + b);
    case 'diff-square':
      return (a - b) * (a - b);
    case 'diff-squares':
      return a * a - b * b;
    case 'sum-cubes':
      return a * a * a + b * b * b;
    case 'diff-cubes':
      return a * a * a - b * b * b;
    default: {
      const never: never = identity;
      return never;
    }
  }
}

function factorOracle(question: FormulaQuestion): { identity: FactorIdentityId; answer: number; a: number; b: number } {
  const match = question.prompt.match(/^a = (\d+) and b = (\d+)\. What is (.+)\?$/);
  if (!match) throw new Error(`No factorization oracle for: ${question.prompt}`);
  const a = Number(match[1]);
  const b = Number(match[2]);
  const identity = FACTOR_IDENTITIES.find((item) => item.name === match[3]);
  if (!identity) throw new Error(`Unknown identity expression: ${match[3]}`);
  return { identity: identity.id, answer: factorValue(identity.id, a, b), a, b };
}

function volumeOracle(prompt: string): number {
  const cube = prompt.match(/^A cube has sides of (\d+) cm\. What is its volume in cubic centimetres\?$/);
  if (cube) {
    const side = Number(cube[1]);
    return side * side * side;
  }
  const box = prompt.match(
    /^A box is (\d+) cm long, (\d+) cm wide, and (\d+) cm tall\. What is its volume in cubic centimetres\?$/,
  );
  if (box) return Number(box[1]) * Number(box[2]) * Number(box[3]);
  const prism = prompt.match(
    /^A triangular prism has a triangle of base (\d+) cm and height (\d+) cm, and the prism is (\d+) cm long\. What is its volume in cubic centimetres\?$/,
  );
  if (prism) {
    const base = Number(prism[1]);
    const height = Number(prism[2]);
    const length = Number(prism[3]);
    if (base % 2 !== 0) throw new Error(`Prism base is not even: ${prompt}`);
    return (base / 2) * height * length;
  }
  const pyramid = prompt.match(
    /^A square pyramid has a base side of (\d+) cm and a height of (\d+) cm\. What is its volume in cubic centimetres\?$/,
  );
  if (pyramid) {
    const side = Number(pyramid[1]);
    const height = Number(pyramid[2]);
    const product = side * side * height;
    if (product % 3 !== 0) throw new Error(`Pyramid volume is not whole: ${prompt}`);
    return product / 3;
  }
  throw new Error(`No volume oracle for: ${prompt}`);
}

function eulerOracle(prompt: string): { name: string; answer: number } {
  const faces = prompt.match(/^(A|An) (.+) has (\d+) vertices and (\d+) edges\. How many faces does it have\?$/);
  if (faces) return eulerAnswer(faces[2]!, Number(faces[3]), Number(faces[4]), 'faces');
  const vertices = prompt.match(/^(A|An) (.+) has (\d+) edges and (\d+) faces\. How many vertices does it have\?$/);
  if (vertices) return eulerAnswer(vertices[2]!, Number(vertices[3]), Number(vertices[4]), 'vertices');
  const edges = prompt.match(/^(A|An) (.+) has (\d+) vertices and (\d+) faces\. How many edges does it have\?$/);
  if (edges) return eulerAnswer(edges[2]!, Number(edges[3]), Number(edges[4]), 'edges');
  throw new Error(`No Euler oracle for: ${prompt}`);
}

function eulerAnswer(
  name: string,
  first: number,
  second: number,
  ask: 'vertices' | 'edges' | 'faces',
): { name: string; answer: number } {
  const solid = SOLIDS[name];
  if (!solid) throw new Error(`Unknown polyhedron: ${name}`);
  if (solid.vertices - solid.edges + solid.faces !== 2) throw new Error(`Catalog broke Euler for ${name}`);
  if (ask === 'faces') {
    if (first !== solid.vertices || second !== solid.edges) throw new Error(`Cube counts drifted for ${name}`);
  } else if (ask === 'vertices') {
    if (first !== solid.edges || second !== solid.faces) throw new Error(`Edge and face counts drifted for ${name}`);
  } else if (first !== solid.vertices || second !== solid.faces) {
    throw new Error(`Vertex and face counts drifted for ${name}`);
  }
  const answer = solid[ask];
  const vertices = ask === 'vertices' ? answer : solid.vertices;
  const edges = ask === 'edges' ? answer : solid.edges;
  const faces = ask === 'faces' ? answer : solid.faces;
  if (vertices - edges + faces !== 2) throw new Error(`Answer broke Euler for ${name}`);
  return { name, answer };
}

/** Half-up cents: (numerator + 50) / 100, BigInt division, no binary float. */
function simpleBig(principal: bigint, rate: bigint, years: bigint): bigint {
  return (principal * rate * years + 50n) / 100n;
}

function compoundBig(principal: bigint, rate: bigint, years: number): bigint {
  let balance = principal;
  for (let year = 0; year < years; year += 1) balance += (balance * rate + 50n) / 100n;
  return balance;
}

function lumpBig(principal: bigint, rate: bigint, years: number): bigint {
  let numerator = principal;
  let denominator = 1n;
  for (let year = 0; year < years; year += 1) {
    numerator *= 100n + rate;
    denominator *= 100n;
  }
  return (numerator + denominator / 2n) / denominator;
}

type InterestParsed = {
  kind: 'simple' | 'compound';
  ask: 'interest' | 'balance';
  principal: number;
  rate: number;
  years: number;
  answer: bigint;
};

function interestOracle(prompt: string): InterestParsed {
  const match = prompt.match(
    /^(Simple|Compound) interest: you save (\d+) cents at (\d+)% per year for (\d+) (year|years)(, compounded once a year)?\. How many cents (of interest do you earn|do you have at the end)\?$/,
  );
  if (!match) throw new Error(`No interest oracle for: ${prompt}`);
  const kind = match[1] === 'Simple' ? 'simple' : 'compound';
  const principal = Number(match[2]);
  const rate = Number(match[3]);
  const years = Number(match[4]);
  const unit = match[5];
  const compoundClause = match[6];
  const ask = match[7] === 'of interest do you earn' ? 'interest' : 'balance';
  if ((years === 1 && unit !== 'year') || (years !== 1 && unit !== 'years')) {
    throw new Error(`Year wording drifted: ${prompt}`);
  }
  if (kind === 'compound' && compoundClause !== ', compounded once a year') {
    throw new Error(`Compound wording drifted: ${prompt}`);
  }
  if (kind === 'simple' && compoundClause !== undefined) throw new Error(`Simple prompt mentions compounding: ${prompt}`);
  const principalBig = BigInt(principal);
  const rateBig = BigInt(rate);
  const interest = kind === 'simple' ? simpleBig(principalBig, rateBig, BigInt(years)) : compoundBig(principalBig, rateBig, years) - principalBig;
  const balance = kind === 'simple' ? principalBig + interest : compoundBig(principalBig, rateBig, years);
  return { kind, ask, principal, rate, years, answer: ask === 'interest' ? interest : balance };
}

function assertSingleAnswer(question: FormulaQuestion, expected: string): void {
  expect(question.answer).toBe(expected);
  expect(question.prompt.trim().length).toBeGreaterThan(0);
  const graded = gradeResponse(question, { questionId: question.id, value: question.answer });
  expect(graded.correct).toBe(true);
  if (question.tag === undefined) expect(graded.tag).toBeUndefined();
  else expect(graded.tag).toBe(question.tag);
  if (question.mode === 'fill') {
    expect('choices' in question).toBe(false);
    return;
  }
  expect(new Set(question.choices).size).toBe(question.choices.length);
  expect(question.choices).toHaveLength(4);
  expect(question.choices.filter((choice) => choice === question.answer)).toEqual([question.answer]);
  for (const choice of question.choices) {
    const choiceGrade = gradeResponse(question, { questionId: question.id, value: choice });
    expect(choiceGrade.correct).toBe(choice === question.answer);
    if (question.tag !== undefined) expect(choiceGrade.tag).toBe(question.tag);
    if (choice !== question.answer) expect(Number(choice)).not.toBe(Number(question.answer));
  }
}

function assertUniqueIds(questions: readonly FormulaQuestion[]): void {
  expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
}

function assertHintHidesAnswer(question: FormulaQuestion): void {
  const hint = hintFor(question);
  const text = `${hint.title}\n${hint.formula}`;
  expect(hint.zone).toBe(question.zone);
  expect(hint.formula).toContain('=');
  expect(text.includes(question.answer)).toBe(false);
  expect(hint.formula).not.toBe(question.answer);
  expect(text.toLowerCase()).not.toContain('how many');
  expect(text.toLowerCase()).not.toContain('what is');
  if (question.mode === 'pick') {
    expect(question.choices).toContain(question.answer);
    expect(text.includes(question.answer)).toBe(false);
  }
}

describe('formula zones 5–8 deals', () => {
  it('repeats a seed exactly, including hints and after another seed', () => {
    const fingerprint = (seed: number) => ({
      pythagoras: dealPythagoras(seed),
      factor: dealFactor(seed),
      volume: dealVolume(seed),
      euler: dealEuler(seed),
      together: dealVolumeEuler(seed),
      interest: dealInterest(seed),
      hints: [...dealFactor(seed), ...dealVolumeEuler(seed), ...dealInterest(seed)].map((question) => hintFor(question)),
    });
    for (const seed of SEEDS) expect(fingerprint(seed)).toEqual(fingerprint(seed));
    const again = fingerprint(5);
    fingerprint(9);
    expect(fingerprint(5)).toEqual(again);
  });

  it('uses the seed, so nearby seeds are not the same deal', () => {
    expect(dealPythagoras(1)).not.toEqual(dealPythagoras(2));
    expect(dealFactor(1)).not.toEqual(dealFactor(2));
    expect(dealVolume(1)).not.toEqual(dealVolume(2));
    expect(dealEuler(1)).not.toEqual(dealEuler(2));
    expect(dealVolumeEuler(1)).not.toEqual(dealVolumeEuler(2));
    expect(dealInterest(1)).not.toEqual(dealInterest(2));
  });
});

describe('zone 5 Pythagoras', () => {
  it('deals integer triples for the hypotenuse and a missing leg', () => {
    for (const seed of SEEDS) {
      const questions = dealPythagoras(seed);
      expect(questions.length).toBeGreaterThanOrEqual(ZONE_PASS[5].correct + ZONE_PASS[5].maxMiss);
      expect(questions).toHaveLength(6);
      expect(questions.every((question) => question.zone === 5 && question.mode === 'pick' && question.tag === undefined)).toBe(true);
      assertUniqueIds(questions);
      const kinds = questions.map((question) => pythagorasOracle(question.prompt).kind);
      expect(kinds.filter((kind) => kind === 'hypotenuse')).toHaveLength(3);
      expect(kinds.filter((kind) => kind === 'leg')).toHaveLength(3);
      for (let index = 1; index < kinds.length; index += 1) expect(kinds[index]).not.toBe(kinds[index - 1]);
      const legGaps: number[] = [];
      for (const question of questions) {
        const oracle = pythagorasOracle(question.prompt);
        expect(Number.isInteger(oracle.answer)).toBe(true);
        expect(oracle.answer).toBeGreaterThan(0);
        assertSingleAnswer(question, String(oracle.answer));
        if (oracle.kind === 'leg') legGaps.push(oracle.answer - oracle.shown);
      }
      expect(legGaps.some((gap) => gap < 0)).toBe(true);
      expect(legGaps.some((gap) => gap > 0)).toBe(true);
    }
  });

  it('teaches the hypotenuse and a missing leg', () => {
    const text = pythagorasSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(pythagorasSteps.length).toBeGreaterThanOrEqual(2);
    expect(text.toLowerCase()).toContain('hypotenuse');
    expect(text.toLowerCase()).toContain('leg');
    expect(text.toLowerCase()).toContain('pythagoras');
  });
});

describe('zone 6 factorization', () => {
  it('deals each of the five identities once', () => {
    for (const seed of SEEDS) {
      const questions = dealFactor(seed);
      expect(questions).toHaveLength(FACTOR_IDENTITIES.length);
      expect(questions.every((question) => question.zone === 6 && question.mode === 'pick')).toBe(true);
      assertUniqueIds(questions);
      const tags = questions.map((question) => question.tag);
      expect([...tags].sort()).toEqual(FACTOR_IDENTITIES.map((item) => item.id).sort());
      for (const question of questions) {
        const oracle = factorOracle(question);
        expect(question.tag).toBe(oracle.identity);
        expect(oracle.a).toBeGreaterThan(oracle.b);
        expect(oracle.answer).toBeGreaterThan(1);
        assertSingleAnswer(question, String(oracle.answer));
        assertHintHidesAnswer(question);
        const hint = hintFor(question);
        const identity = FACTOR_IDENTITIES.find((item) => item.id === oracle.identity)!;
        expect(hint.formula).toContain(identity.name);
        expect(hint.formula.length).toBeGreaterThan(identity.name.length);
      }
    }
  });

  it('teaches all five identities', () => {
    const text = factorSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(factorSteps.length).toBeGreaterThanOrEqual(2);
    for (const identity of FACTOR_IDENTITIES) expect(text).toContain(identity.name);
  });
});

describe('zone 7 volume then Euler', () => {
  it('deals 4 volume questions and then 2 Euler questions on real polyhedra', () => {
    expect(SOLIDS.cube).toBeDefined();
    expect(SOLIDS.tetrahedron).toBeDefined();
    expect(Object.keys(SOLIDS).some((name) => name.includes('prism'))).toBe(true);
    expect(Object.keys(SOLIDS).some((name) => name.includes('pyramid'))).toBe(true);
    for (const seed of SEEDS) {
      const volume = dealVolume(seed);
      const euler = dealEuler(seed);
      const questions = dealVolumeEuler(seed);
      expect(volume).toHaveLength(ZONE_PASS[7].volume);
      expect(euler).toHaveLength(ZONE_PASS[7].eulerNeed);
      expect(questions).toEqual([...volume, ...euler]);
      expect(questions.map((question) => question.tag)).toEqual(['volume', 'volume', 'volume', 'volume', 'euler', 'euler']);
      expect(questions.every((question) => question.zone === 7 && question.mode === 'pick')).toBe(true);
      assertUniqueIds(questions);
      const shapes = volume.map((question) => question.id.split('-')[1]);
      expect(shapes.sort()).toEqual(['cube', 'cuboid', 'prism', 'pyramid']);
      for (const question of volume) {
        const expected = volumeOracle(question.prompt);
        expect(Number.isInteger(expected)).toBe(true);
        expect(expected).toBeGreaterThan(0);
        assertSingleAnswer(question, String(expected));
        assertHintHidesAnswer(question);
      }
      const names = euler.map((question) => eulerOracle(question.prompt).name);
      expect(new Set(names).size).toBe(2);
      for (const question of euler) {
        const oracle = eulerOracle(question.prompt);
        expect(oracle.answer).not.toBe(2);
        assertSingleAnswer(question, String(oracle.answer));
        assertHintHidesAnswer(question);
        expect(hintFor(question).formula).toBe('V−E+F=2');
      }
    }
  });

  it('teaches volume and Euler as separate parts, volume first', () => {
    expect(volumeTutorialSteps.length).toBeGreaterThanOrEqual(2);
    expect(eulerTutorialSteps.length).toBeGreaterThanOrEqual(2);
    expect(volumeEulerSteps).toEqual([...volumeTutorialSteps, ...eulerTutorialSteps]);
    const volumeText = volumeTutorialSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    const eulerText = eulerTutorialSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(volumeText.toLowerCase()).toContain('volume');
    expect(volumeText.toLowerCase()).toContain('cube');
    expect(volumeText.toLowerCase()).toContain('prism');
    expect(volumeText.toLowerCase()).toContain('pyramid');
    expect(eulerText).toContain('V−E+F=2');
    expect(eulerText.toLowerCase()).toContain('cube');
    expect(eulerText.toLowerCase()).toContain('tetrahedron');
    expect(eulerText.toLowerCase()).toContain('prism');
    expect(eulerText.toLowerCase()).toContain('pyramid');
  });
});

describe('zone 8 interest', () => {
  it('keeps the documented half-up cent vectors', () => {
    expect(CENTS_PER_DOLLAR).toBe(100);
    expect(UNIT_CENTS).toBe(100);
    expect(simpleBig(100n, 5n, 1n)).toBe(5n);
    expect(simpleBig(150n, 3n, 1n)).toBe(5n);
    expect(simpleBig(149n, 1n, 1n)).toBe(1n);
    expect(simpleBig(150n, 1n, 1n)).toBe(2n);
    expect(compoundBig(100n, 5n, 2)).toBe(110n);
    expect(compoundBig(150n, 3n, 2)).toBe(160n);
    expect(lumpBig(150n, 3n, 2)).toBe(159n);
    expect(simpleInterestCents(100, 5, 1)).toBe(5);
    expect(simpleInterestCents(150, 3, 1)).toBe(5);
    expect(simpleInterestCents(149, 1, 1)).toBe(1);
    expect(simpleInterestCents(150, 1, 1)).toBe(2);
    expect(compoundBalanceCents(100, 5, 2)).toBe(110);
    expect(compoundBalanceCents(150, 3, 2)).toBe(160);
  });

  it('deals 3 simple and 3 compound questions in integer cents', () => {
    const source = readFileSync(join(root, 'src/formula/zones/interest.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).toMatch(/half-up/);
    expect(code).toMatch(/BigInt/);
    expect(code).not.toMatch(/\d+\.\d+/);
    expect(code).not.toMatch(/Math\.(pow|round|random)\b|parseFloat|toFixed|(?<![/*])\*\*/);
    for (const seed of SEEDS) {
      const questions = dealInterest(seed);
      expect(questions).toHaveLength(ZONE_PASS[8].total);
      expect(questions.filter((question) => question.tag === 'simple')).toHaveLength(3);
      expect(questions.filter((question) => question.tag === 'compound')).toHaveLength(3);
      expect(questions.every((question) => question.zone === 8 && question.mode === 'pick')).toBe(true);
      assertUniqueIds(questions);
      expect(questions.some((question) => question.prompt.includes(`you save ${CENTS_PER_DOLLAR} cents`))).toBe(true);
      let simpleRoundsUp = false;
      let compoundSplits = false;
      for (const question of questions) {
        const oracle = interestOracle(question.prompt);
        expect(question.tag).toBe(oracle.kind);
        expect(oracle.answer > 1n).toBe(true);
        assertSingleAnswer(question, oracle.answer.toString());
        assertHintHidesAnswer(question);
        const hint = hintFor(question);
        expect(hint.formula).toBe(oracle.kind === 'simple' ? 'I = P × r × t' : 'A = P × (1 + r)^t');
        const principal = BigInt(oracle.principal);
        const rate = BigInt(oracle.rate);
        if (oracle.kind === 'simple') {
          expect(simpleInterestCents(oracle.principal, oracle.rate, oracle.years)).toBe(Number(simpleBig(principal, rate, BigInt(oracle.years))));
          if (simpleBig(principal, rate, BigInt(oracle.years)) !== (principal * rate * BigInt(oracle.years)) / 100n) {
            simpleRoundsUp = true;
          }
        } else {
          expect(compoundBalanceCents(oracle.principal, oracle.rate, oracle.years)).toBe(Number(compoundBig(principal, rate, oracle.years)));
          if (compoundBig(principal, rate, oracle.years) !== lumpBig(principal, rate, oracle.years)) compoundSplits = true;
        }
      }
      expect(simpleRoundsUp).toBe(true);
      expect(compoundSplits).toBe(true);
    }
  });

  it('teaches simple interest, compound interest, and $1 = 100 cents', () => {
    const text = interestSteps.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(interestSteps.length).toBeGreaterThanOrEqual(2);
    expect(text.toLowerCase()).toContain('simple');
    expect(text.toLowerCase()).toContain('compound');
    expect(text).toContain('$1');
    expect(text).toContain('100 cents');
    expect(text).toContain('I = P × r × t');
    expect(text).toContain('A = P × (1 + r)^t');
  });
});

describe('hint cards for zones 6–8', () => {
  it('shows the formula only and never the numeric answer or the correct option', () => {
    for (const seed of SEEDS) {
      const questions = [...dealFactor(seed), ...dealVolumeEuler(seed), ...dealInterest(seed)];
      expect(questions.some((question) => question.zone === 6)).toBe(true);
      expect(questions.some((question) => question.zone === 7 && question.tag === 'volume')).toBe(true);
      expect(questions.some((question) => question.zone === 7 && question.tag === 'euler')).toBe(true);
      expect(questions.some((question) => question.zone === 8 && question.tag === 'simple')).toBe(true);
      expect(questions.some((question) => question.zone === 8 && question.tag === 'compound')).toBe(true);
      for (const question of questions) assertHintHidesAnswer(question);
    }
    expect(() => hintFor(dealPythagoras(1)[0]!)).toThrow(/No hint card/);
  });
});
