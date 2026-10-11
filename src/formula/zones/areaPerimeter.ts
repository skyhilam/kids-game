import { mulberry32, shuffle } from '../../game/rng';
import type { FillQuestion, FormulaQuestion, PickQuestion } from '../types';

/** Formulas a child can pick. Each wording is the only match for its question. */
const RECT_AREA = 'length × width';
const RECT_PERIMETER = '2 × (length + width)';
const SQUARE_AREA = 'side × side';
const SQUARE_PERIMETER = '4 × side';
const LENGTH_PLUS_WIDTH = 'length + width';
const DOUBLE_SIDE = '2 × side';

export const tutorialSteps = [
  {
    title: 'Area is the inside',
    body: 'Area counts the squares that cover a shape. The area of a rectangle is length × width. The area of a square is side × side.',
  },
  {
    title: 'Perimeter is the fence',
    body: 'Perimeter is the distance around the outside. The perimeter of a rectangle is 2 × (length + width). The perimeter of a square is 4 × side.',
  },
  {
    title: 'Formula or number',
    body: 'Some questions ask you to choose the formula. Others ask you to type the number of centimetres or square centimetres. Read which one it wants.',
  },
] as const;

/**
 * Six questions: rectangle and square, area and perimeter, and both
 * a formula pick and a typed number. Length and width of a rectangle differ.
 */
export function deal(seed: number): FormulaQuestion[] {
  const rand = mulberry32(seed);
  const questions: FormulaQuestion[] = [
    pickRectangleArea(rand),
    pickSquarePerimeter(rand),
    fillRectangleArea(rand),
    fillRectanglePerimeter(rand),
    fillSquareArea(rand),
    fillSquarePerimeter(rand),
  ];
  return shuffle(rand, questions);
}

function pickRectangleArea(rand: () => number): PickQuestion {
  const { length, width } = rectangleSides(rand);
  return {
    id: `area-rect-formula-${length}x${width}`,
    zone: 3,
    mode: 'pick',
    prompt: `A rectangle is ${length} cm long and ${width} cm wide. Which formula gives its area?`,
    choices: formulaChoices(rand, RECT_AREA, [LENGTH_PLUS_WIDTH, RECT_PERIMETER, SQUARE_PERIMETER]),
    answer: RECT_AREA,
  };
}

function pickSquarePerimeter(rand: () => number): PickQuestion {
  const side = squareSide(rand);
  return {
    id: `perim-square-formula-${side}`,
    zone: 3,
    mode: 'pick',
    prompt: `A square has sides of ${side} cm. Which formula gives its perimeter?`,
    choices: formulaChoices(rand, SQUARE_PERIMETER, [SQUARE_AREA, DOUBLE_SIDE, LENGTH_PLUS_WIDTH]),
    answer: SQUARE_PERIMETER,
  };
}

function fillRectangleArea(rand: () => number): FillQuestion {
  const { length, width } = rectangleSides(rand);
  return fill(
    `area-rect-${length}x${width}`,
    `A rectangle is ${length} cm long and ${width} cm wide. What is its area in square centimetres?`,
    length * width,
  );
}

function fillRectanglePerimeter(rand: () => number): FillQuestion {
  const { length, width } = rectangleSides(rand);
  return fill(
    `perim-rect-${length}x${width}`,
    `A rectangle is ${length} cm long and ${width} cm wide. What is its perimeter in centimetres?`,
    2 * (length + width),
  );
}

function fillSquareArea(rand: () => number): FillQuestion {
  const side = squareSide(rand);
  return fill(
    `area-square-${side}`,
    `A square has sides of ${side} cm. What is its area in square centimetres?`,
    side * side,
  );
}

function fillSquarePerimeter(rand: () => number): FillQuestion {
  const side = squareSide(rand);
  return fill(
    `perim-square-${side}`,
    `A square has sides of ${side} cm. What is its perimeter in centimetres?`,
    4 * side,
  );
}

function fill(id: string, prompt: string, answer: number): FillQuestion {
  return { id, zone: 3, mode: 'fill', prompt, answer: String(answer) };
}

function formulaChoices(rand: () => number, answer: string, distractors: readonly string[]): string[] {
  const unique = distractors.filter((item, index) => item !== answer && distractors.indexOf(item) === index);
  if (unique.length !== 3) throw new Error(`Formula distractors for ${answer} are not unique`);
  return shuffle(rand, [answer, ...unique]);
}

function rectangleSides(rand: () => number): { length: number; width: number } {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const length = intBetween(rand, 3, 12);
    const width = intBetween(rand, 2, length - 1);
    if (length * width !== 2 * (length + width)) return { length, width };
  }
  return { length: 5, width: 2 };
}

function squareSide(rand: () => number): number {
  const side = intBetween(rand, 2, 12);
  return side === 4 ? 5 : side;
}

function intBetween(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
