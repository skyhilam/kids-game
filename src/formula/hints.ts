import { FACTOR_IDENTITIES, type FactorIdentityId, type FormulaQuestion } from './types';

/**
 * Hint cards for zones 6–8. Each card shows the formula only:
 * not a worked example, not the numeric answer, and not the correct option.
 */

export type HintCard = {
  zone: 6 | 7 | 8;
  title: string;
  formula: string;
};

const FACTOR_FORMULAS: Record<FactorIdentityId, string> = {
  'sum-square': '(a+b)² = a² + 2ab + b²',
  'diff-square': '(a−b)² = a² − 2ab + b²',
  'diff-squares': 'a²−b² = (a−b)(a+b)',
  'sum-cubes': 'a³+b³ = (a+b)(a² − ab + b²)',
  'diff-cubes': 'a³−b³ = (a−b)(a² + ab + b²)',
};

const VOLUME_FORMULAS = {
  cube: 'V = side × side × side',
  cuboid: 'V = length × width × height',
  prism: 'V = area of the base × length',
  pyramid: 'V = one third × base area × height',
} as const;

const EULER_FORMULA = 'V−E+F=2';
const SIMPLE_FORMULA = 'I = P × r × t';
const COMPOUND_FORMULA = 'A = P × (1 + r)^t';

export function hintFor(question: FormulaQuestion): HintCard {
  const card = cardFor(question);
  const text = `${card.title}\n${card.formula}`;
  if (question.answer !== '' && text.includes(question.answer)) {
    throw new Error(`Hint for ${question.id} contains the answer ${question.answer}`);
  }
  return card;
}

function cardFor(question: FormulaQuestion): HintCard {
  if (question.zone === 6) {
    const identity = FACTOR_IDENTITIES.find((item) => item.id === question.tag);
    if (!identity) throw new Error(`No factorization hint for ${question.id}`);
    return { zone: 6, title: identity.name, formula: FACTOR_FORMULAS[identity.id] };
  }
  if (question.zone === 7 && question.tag === 'volume') {
    const shape = volumeShape(question.id);
    return { zone: 7, title: volumeTitle(shape), formula: VOLUME_FORMULAS[shape] };
  }
  if (question.zone === 7 && question.tag === 'euler') {
    return { zone: 7, title: "Euler's formula", formula: EULER_FORMULA };
  }
  if (question.zone === 8 && question.tag === 'simple') {
    return { zone: 8, title: 'Simple interest', formula: SIMPLE_FORMULA };
  }
  if (question.zone === 8 && question.tag === 'compound') {
    return { zone: 8, title: 'Compound interest', formula: COMPOUND_FORMULA };
  }
  throw new Error(`No hint card for zone ${question.zone}`);
}

function volumeShape(id: string): keyof typeof VOLUME_FORMULAS {
  if (id.startsWith('volume-cube-')) return 'cube';
  if (id.startsWith('volume-cuboid-')) return 'cuboid';
  if (id.startsWith('volume-prism-')) return 'prism';
  if (id.startsWith('volume-pyramid-')) return 'pyramid';
  throw new Error(`No volume hint for ${id}`);
}

function volumeTitle(shape: keyof typeof VOLUME_FORMULAS): string {
  if (shape === 'cube') return 'Cube volume';
  if (shape === 'cuboid') return 'Box volume';
  if (shape === 'prism') return 'Prism volume';
  return 'Pyramid volume';
}
