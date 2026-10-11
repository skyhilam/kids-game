import { mulberry32, shuffle } from '../../game/rng';
import type { PickQuestion } from '../types';

/**
 * Zone 1: eight compass points, one question each.
 * A round asks for 5 correct and can still be open after misses
 * (a pass allows one miss; the third wrong closes it), so eight
 * questions are enough to finish either way.
 */
export const COMPASS = [
  { id: 'N', name: 'north' },
  { id: 'NE', name: 'north-east' },
  { id: 'E', name: 'east' },
  { id: 'SE', name: 'south-east' },
  { id: 'S', name: 'south' },
  { id: 'SW', name: 'south-west' },
  { id: 'W', name: 'west' },
  { id: 'NW', name: 'north-west' },
] as const;

export type CompassId = (typeof COMPASS)[number]['id'];

type CompassPoint = (typeof COMPASS)[number];
type DirectionStyle = 'name' | 'opposite' | 'quarter';

const STYLE_DECK: readonly DirectionStyle[] = [
  'name',
  'name',
  'name',
  'opposite',
  'opposite',
  'opposite',
  'quarter',
  'quarter',
];

export const tutorialSteps = [
  {
    title: 'Eight compass points',
    body: 'Clockwise from the top, the points are N, NE, E, SE, S, SW, W, and NW. NE sits between north and east. The other diagonal points work the same way.',
  },
  {
    title: 'Opposite pairs',
    body: 'North faces south, and east faces west. North-east faces south-west. North-west faces south-east. Turning all the way around lands on the opposite point.',
  },
  {
    title: 'A quarter turn',
    body: 'A quarter-turn clockwise is a right angle, the way a clock hand moves. From N you land on E, not on NE. NE is only halfway from N to E.',
  },
] as const;

export function deal(seed: number): PickQuestion[] {
  const rand = mulberry32(seed);
  const points = shuffle(rand, COMPASS);
  const styles = shuffle(rand, STYLE_DECK);
  return points.map((point, index) => makeQuestion(rand, point, styles[index]!));
}

function at(index: number): CompassPoint {
  const size = COMPASS.length;
  const wrapped = ((index % size) + size) % size;
  return COMPASS[wrapped]!;
}

function makeQuestion(rand: () => number, point: CompassPoint, style: DirectionStyle): PickQuestion {
  const index = COMPASS.findIndex((item) => item.id === point.id);
  const prompt = promptFor(point, style, index);
  const distractors = shuffle(
    rand,
    COMPASS.filter((item) => item.id !== point.id),
  )
    .slice(0, 3)
    .map((item) => item.id);
  return {
    id: `directions-${point.id}-${style}`,
    zone: 1,
    mode: 'pick',
    prompt,
    choices: shuffle(rand, [point.id, ...distractors]),
    answer: point.id,
  };
}

function promptFor(point: CompassPoint, style: DirectionStyle, index: number): string {
  if (style === 'name') {
    return `The picnic blanket is to the ${point.name}. Which compass point is that?`;
  }
  if (style === 'opposite') {
    const facing = at(index + 4);
    return `You are facing ${facing.name}. Turn to the opposite direction. Which compass point is that?`;
  }
  const facing = at(index - 2);
  return `You face ${facing.name}. Make one quarter-turn clockwise. Which compass point do you face now?`;
}
