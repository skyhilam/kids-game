import { mixSeed, mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';

/**
 * Zone 7 is two ordered parts.
 * Volume (4 questions) is dealt and played first. Euler (2 questions) follows,
 * only after the volume set is finished. Each part has its own tutorial.
 */

const SOLIDS = [
  { id: 'tetrahedron', name: 'tetrahedron', vertices: 4, edges: 6, faces: 4 },
  { id: 'cube', name: 'cube', vertices: 8, edges: 12, faces: 6 },
  { id: 'triangular-prism', name: 'triangular prism', vertices: 6, edges: 9, faces: 5 },
  { id: 'square-pyramid', name: 'square pyramid', vertices: 5, edges: 8, faces: 5 },
  { id: 'pentagonal-prism', name: 'pentagonal prism', vertices: 10, edges: 15, faces: 7 },
  { id: 'pentagonal-pyramid', name: 'pentagonal pyramid', vertices: 6, edges: 10, faces: 6 },
  { id: 'hexagonal-pyramid', name: 'hexagonal pyramid', vertices: 7, edges: 12, faces: 7 },
  { id: 'octahedron', name: 'octahedron', vertices: 6, edges: 12, faces: 8 },
] as const;

type Solid = (typeof SOLIDS)[number];
type EulerPart = 'vertices' | 'edges' | 'faces';

const EULER_ASKS: readonly EulerPart[] = ['vertices', 'edges', 'faces'];

for (const solid of SOLIDS) {
  if (solid.vertices - solid.edges + solid.faces !== 2) {
    throw new Error(`Euler check failed for ${solid.name}`);
  }
}

export const volumeTutorialSteps = [
  {
    title: 'Cube and box',
    body: 'Volume counts the cubes inside a solid. A cube uses side × side × side. A box uses length × width × height.',
  },
  {
    title: 'Prism',
    body: 'A prism keeps the same base all the way along. Volume = area of the base × length. A triangular base uses base × height ÷ 2.',
  },
  {
    title: 'Pyramid',
    body: 'A pyramid comes to a point. Its volume is one third of the prism with the same base and height: one third × base area × height.',
  },
] as const;

export const eulerTutorialSteps = [
  {
    title: 'Vertices, edges, and faces',
    body: 'A vertex is a corner, an edge joins two corners, and a face is a flat side. Count each one before you use the formula.',
  },
  {
    title: "Euler's formula",
    body: 'For a cube, a tetrahedron, a prism, or a pyramid, V−E+F=2. Vertices minus edges plus faces is 2. Rearrange it to find the missing count.',
  },
] as const;

/** Volume steps first, then Euler steps. Show each part with its own questions. */
export const tutorialSteps = [...volumeTutorialSteps, ...eulerTutorialSteps] as const;

export function dealVolume(seed: number): PickQuestion[] {
  const rand = mulberry32(mixSeed(seed, 5, 0));
  return shuffle(rand, [cube(rand), box(rand), prism(rand), pyramid(rand)]);
}

export function dealEuler(seed: number): PickQuestion[] {
  const rand = mulberry32(mixSeed(seed, 7, 0));
  const solids = shuffle(rand, SOLIDS).slice(0, 2);
  return shuffle(
    rand,
    solids.map((solid) => eulerQuestion(rand, solid)),
  );
}

/** Volume questions, then Euler questions. The parts are not interleaved. */
export function deal(seed: number): PickQuestion[] {
  return [...dealVolume(seed), ...dealEuler(seed)];
}

function cube(rand: () => number): PickQuestion {
  const side = intBetween(rand, 2, 6);
  const volume = side * side * side;
  return question(rand, {
    id: `volume-cube-${side}`,
    tag: 'volume',
    prompt: `A cube has sides of ${side} cm. What is its volume in cubic centimetres?`,
    answer: volume,
    distractors: [side * side, 6 * side * side, side * 6, volume + side],
  });
}

function box(rand: () => number): PickQuestion {
  const length = intBetween(rand, 2, 6);
  const width = intBetween(rand, 2, 6);
  const height = intBetween(rand, 2, 6);
  const volume = length * width * height;
  return question(rand, {
    id: `volume-cuboid-${length}x${width}x${height}`,
    tag: 'volume',
    prompt: `A box is ${length} cm long, ${width} cm wide, and ${height} cm tall. What is its volume in cubic centimetres?`,
    answer: volume,
    distractors: [length * width, length + width + height, 2 * (length * width + length * height + width * height), volume + height],
  });
}

function prism(rand: () => number): PickQuestion {
  const base = intBetween(rand, 2, 6) * 2;
  const triHeight = intBetween(rand, 2, 8);
  const length = intBetween(rand, 2, 8);
  const area = (base / 2) * triHeight;
  const volume = area * length;
  if (!Number.isInteger(area) || !Number.isInteger(volume)) {
    throw new Error('Prism volume is not a whole number of cubes');
  }
  return question(rand, {
    id: `volume-prism-${base}x${triHeight}x${length}`,
    tag: 'volume',
    prompt: `A triangular prism has a triangle of base ${base} cm and height ${triHeight} cm, and the prism is ${length} cm long. What is its volume in cubic centimetres?`,
    answer: volume,
    distractors: [base * triHeight * length, area, base * length, volume + length],
  });
}

function pyramid(rand: () => number): PickQuestion {
  const side = intBetween(rand, 2, 8);
  const height = intBetween(rand, 1, 3) * 3;
  const baseArea = side * side;
  if ((baseArea * height) % 3 !== 0) throw new Error('Pyramid volume is not a whole number of cubes');
  const volume = (baseArea * height) / 3;
  if (!Number.isInteger(volume) || volume < 4) throw new Error('Pyramid volume is not a safe whole number');
  return question(rand, {
    id: `volume-pyramid-${side}x${height}`,
    tag: 'volume',
    prompt: `A square pyramid has a base side of ${side} cm and a height of ${height} cm. What is its volume in cubic centimetres?`,
    answer: volume,
    distractors: [baseArea * height, baseArea, side * height, volume + side],
  });
}

function eulerQuestion(rand: () => number, solid: Solid): PickQuestion {
  const ask = EULER_ASKS[intBetween(rand, 0, EULER_ASKS.length - 1)]!;
  const counts: Record<EulerPart, number> = {
    vertices: solid.vertices,
    edges: solid.edges,
    faces: solid.faces,
  };
  const answer = counts[ask];
  if (answer === 2) throw new Error(`Euler answer would appear in the hint for ${solid.name}`);
  const lead = /^[aeiou]/.test(solid.name) ? 'An' : 'A';
  return question(rand, {
    id: `euler-${solid.id}-${ask}`,
    tag: 'euler',
    prompt: eulerPrompt(lead, solid.name, ask, counts),
    answer,
    distractors: [solid.vertices, solid.edges, solid.faces, solid.vertices + solid.faces, 2, answer + 1],
  });
}

function eulerPrompt(
  lead: string,
  name: string,
  ask: EulerPart,
  counts: Record<EulerPart, number>,
): string {
  if (ask === 'faces') {
    return `${lead} ${name} has ${counts.vertices} vertices and ${counts.edges} edges. How many faces does it have?`;
  }
  if (ask === 'vertices') {
    return `${lead} ${name} has ${counts.edges} edges and ${counts.faces} faces. How many vertices does it have?`;
  }
  return `${lead} ${name} has ${counts.vertices} vertices and ${counts.faces} faces. How many edges does it have?`;
}

function question(
  rand: () => number,
  spec: { id: string; tag: 'volume' | 'euler'; prompt: string; answer: number; distractors: readonly number[] },
): PickQuestion {
  if (!Number.isInteger(spec.answer) || spec.answer <= 0) {
    throw new Error(`Zone 7 answer is not a positive integer: ${spec.prompt}`);
  }
  return {
    id: spec.id,
    zone: 7,
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
