/** Formula Island zones in unlock order. Zone 1 is always open. */
export const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export const ZONE_CATALOG: readonly { id: ZoneId; key: string; title: string }[] = [
  { id: 1, key: 'directions', title: 'Directions' },
  { id: 2, key: 'units', title: 'Units' },
  { id: 3, key: 'area-perimeter', title: 'Area+Perimeter' },
  { id: 4, key: 'percentage', title: 'Percentage' },
  { id: 5, key: 'pythagoras', title: 'Pythagoras' },
  { id: 6, key: 'factorization', title: 'Factorization' },
  { id: 7, key: 'volume-euler', title: 'Volume+Euler' },
  { id: 8, key: 'interest', title: 'Interest' },
];

/**
 * Five factorization identities, in teaching order.
 * A zone 6 round covers each id once, then one rematch of the misses.
 */
export const FACTOR_IDENTITIES = [
  { id: 'sum-square', name: '(a+b)²' },
  { id: 'diff-square', name: '(a−b)²' },
  { id: 'diff-squares', name: 'a²−b²' },
  { id: 'sum-cubes', name: 'a³+b³' },
  { id: 'diff-cubes', name: 'a³−b³' },
] as const;

export type FactorIdentityId = (typeof FACTOR_IDENTITIES)[number]['id'];

/** Tags the pass rules read. Zones 1–5 ignore them. */
export type FormulaTag = FactorIdentityId | 'volume' | 'euler' | 'simple' | 'compound';

export type AnswerMode = 'pick' | 'fill';

type QuestionBase = {
  id: string;
  zone: ZoneId;
  prompt: string;
  /** Canonical choice id (`pick`) or filled value (`fill`). */
  answer: string;
  tag?: FormulaTag;
};

/** One choice id per option. The child submits that id, not the label. */
export type PickQuestion = QuestionBase & {
  mode: 'pick';
  choices: readonly string[];
};

/** The child types the value. Comparison trims and accepts numeric equivalence. */
export type FillQuestion = QuestionBase & {
  mode: 'fill';
};

export type FormulaQuestion = PickQuestion | FillQuestion;

export type FormulaAnswer = {
  questionId: string;
  /** Choice id when the question is `pick`; typed text when it is `fill`. */
  value: string;
};

export type GradedAttempt = {
  correct: boolean;
  tag?: FormulaTag;
};

export type RoundStatus = 'playing' | 'passed' | 'failed';

export type RoundStars = 0 | 1 | 2 | 3;

export type RoundResult = {
  zone: ZoneId;
  status: RoundStatus;
  /** 1–3 after a pass. Playing and failed rounds are 0. */
  stars: RoundStars;
  correct: number;
  wrong: number;
  total: number;
};

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'number' && (ZONE_IDS as readonly number[]).includes(value);
}

const FORMULA_TAG_LIST: readonly FormulaTag[] = [
  ...FACTOR_IDENTITIES.map((item) => item.id),
  'volume',
  'euler',
  'simple',
  'compound',
];

export function isFormulaTag(value: unknown): value is FormulaTag {
  return typeof value === 'string' && (FORMULA_TAG_LIST as readonly string[]).includes(value);
}
