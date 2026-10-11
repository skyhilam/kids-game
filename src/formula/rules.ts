import {
  FACTOR_IDENTITIES,
  type FactorIdentityId,
  type FormulaAnswer,
  type FormulaQuestion,
  type FormulaTag,
  type GradedAttempt,
  type RoundResult,
  type RoundStars,
  type RoundStatus,
  type ZoneId,
} from './types';

/**
 * Pass lines for zones 1–8.
 * Stars on a pass come from misses: 0 → 3, 1 → 2, 2 or more → 1.
 * A failed or still-playing round never receives stars.
 *
 * Z1 stays open after a second miss and fails on the third wrong,
 * or when 5 correct land with more than one miss.
 * Z5 fails on the second miss because a pass allows at most one.
 * Quota zones (2, 3, 4, 8) stay `playing` until the full set is in.
 * Z6 is the five identities, then one rematch of whichever were missed.
 * Z7 plays the volume set to the end before any Euler question.
 */
export const ZONE_PASS = {
  1: { kind: 'streak', correct: 5, maxMiss: 1, failWrong: 3 },
  2: { kind: 'quota', total: 8, need: 6 },
  3: { kind: 'quota', total: 6, need: 5 },
  4: { kind: 'quota', total: 5, need: 4 },
  5: { kind: 'streak', correct: 4, maxMiss: 1, failWrong: 2 },
  6: { kind: 'rematch', identities: FACTOR_IDENTITIES.length, rematch: 1 },
  7: { kind: 'sections', volume: 4, volumeNeed: 3, eulerNeed: 2 },
  8: { kind: 'interest', total: 6, need: 5, simpleNeed: 2, compoundNeed: 2 },
} as const;

export function gradeResponse(question: FormulaQuestion, answer: FormulaAnswer): GradedAttempt {
  const tagged = (correct: boolean): GradedAttempt =>
    question.tag === undefined ? { correct } : { correct, tag: question.tag };
  if (answer.questionId !== question.id) return tagged(false);
  if (question.mode === 'pick') return tagged(answer.value === question.answer);
  return tagged(fillsMatch(question.answer, answer.value));
}

export function judgeRound(zone: ZoneId, attempts: readonly GradedAttempt[]): RoundResult {
  switch (zone) {
    case 1:
      return judgeStreak(1, attempts, ZONE_PASS[1].correct, ZONE_PASS[1].maxMiss, ZONE_PASS[1].failWrong);
    case 2:
      return judgeQuota(2, attempts, ZONE_PASS[2].total, ZONE_PASS[2].need);
    case 3:
      return judgeQuota(3, attempts, ZONE_PASS[3].total, ZONE_PASS[3].need);
    case 4:
      return judgeQuota(4, attempts, ZONE_PASS[4].total, ZONE_PASS[4].need);
    case 5:
      return judgeStreak(5, attempts, ZONE_PASS[5].correct, ZONE_PASS[5].maxMiss, ZONE_PASS[5].failWrong);
    case 6:
      return judgeFactor(attempts);
    case 7:
      return judgeVolume(attempts);
    case 8:
      return judgeInterest(attempts);
    default: {
      const never: never = zone;
      return never;
    }
  }
}

function starsFromMisses(misses: number): 1 | 2 | 3 {
  if (misses <= 0) return 3;
  if (misses === 1) return 2;
  return 1;
}

function finish(
  zone: ZoneId,
  status: RoundStatus,
  correct: number,
  wrong: number,
  misses: number,
): RoundResult {
  const stars: RoundStars = status === 'passed' ? starsFromMisses(misses) : 0;
  return { zone, status, stars, correct, wrong, total: correct + wrong };
}

function judgeStreak(
  zone: ZoneId,
  attempts: readonly GradedAttempt[],
  needCorrect: number,
  maxMiss: number,
  failWrong: number,
): RoundResult {
  let correct = 0;
  let wrong = 0;
  for (const attempt of attempts) {
    if (attempt.correct) correct += 1;
    else wrong += 1;
    if (wrong >= failWrong) return finish(zone, 'failed', correct, wrong, 0);
    if (correct >= needCorrect) {
      if (wrong <= maxMiss) return finish(zone, 'passed', correct, wrong, wrong);
      return finish(zone, 'failed', correct, wrong, 0);
    }
  }
  return finish(zone, 'playing', correct, wrong, 0);
}

/** The round is the first `total` answers. Earlier answers stay `playing`. */
function judgeQuota(zone: ZoneId, attempts: readonly GradedAttempt[], total: number, need: number): RoundResult {
  const slice = attempts.slice(0, total);
  let correct = 0;
  for (const attempt of slice) {
    if (attempt.correct) correct += 1;
  }
  const wrong = slice.length - correct;
  if (slice.length < total) return finish(zone, 'playing', correct, wrong, 0);
  if (correct >= need) return finish(zone, 'passed', correct, wrong, wrong);
  return finish(zone, 'failed', correct, wrong, 0);
}

function isFactorId(tag: FormulaTag): tag is FactorIdentityId {
  return FACTOR_IDENTITIES.some((item) => item.id === tag);
}

function judgeFactor(attempts: readonly GradedAttempt[]): RoundResult {
  const bucket = new Map<FactorIdentityId, boolean[]>();
  let correct = 0;
  let wrong = 0;
  for (const attempt of attempts) {
    if (attempt.tag === undefined || !isFactorId(attempt.tag)) {
      return finish(6, 'failed', correct, wrong, 0);
    }
    const history = bucket.get(attempt.tag) ?? [];
    if (history.length >= 2 || (history.length === 1 && history[0] === true)) {
      return finish(6, 'failed', correct, wrong, 0);
    }
    history.push(attempt.correct);
    bucket.set(attempt.tag, history);
    if (attempt.correct) correct += 1;
    else wrong += 1;
    if (history.length === 2 && !attempt.correct) return finish(6, 'failed', correct, wrong, 0);
  }

  let rematches = 0;
  for (const identity of FACTOR_IDENTITIES) {
    const history = bucket.get(identity.id);
    if (!history) return finish(6, 'playing', correct, wrong, 0);
    if (history[0] === false) {
      if (history.length < 2) return finish(6, 'playing', correct, wrong, 0);
      rematches += 1;
    }
  }
  return finish(6, 'passed', correct, wrong, rematches);
}

function judgeVolume(attempts: readonly GradedAttempt[]): RoundResult {
  const { volume, volumeNeed, eulerNeed } = ZONE_PASS[7];
  let volumeCorrect = 0;
  let volumeWrong = 0;
  let eulerCorrect = 0;
  let eulerWrong = 0;
  let volumeClosed = false;

  for (const attempt of attempts) {
    if (attempt.tag === 'volume') {
      if (volumeClosed || eulerCorrect + eulerWrong > 0) {
        return finish(7, 'failed', volumeCorrect + eulerCorrect, volumeWrong + eulerWrong, 0);
      }
      if (attempt.correct) volumeCorrect += 1;
      else volumeWrong += 1;
      if (volumeCorrect + volumeWrong === volume && volumeCorrect < volumeNeed) {
        return finish(7, 'failed', volumeCorrect + eulerCorrect, volumeWrong + eulerWrong, 0);
      }
      if (volumeCorrect + volumeWrong === volume) volumeClosed = true;
      continue;
    }
    if (attempt.tag === 'euler') {
      if (attempt.correct) eulerCorrect += 1;
      else eulerWrong += 1;
      const answered = volumeCorrect + eulerCorrect;
      const missed = volumeWrong + eulerWrong;
      if (!volumeClosed || eulerWrong > 0 || eulerCorrect > eulerNeed) {
        return finish(7, 'failed', answered, missed, 0);
      }
      if (eulerCorrect === eulerNeed) return finish(7, 'passed', answered, missed, volumeWrong);
      continue;
    }
    return finish(7, 'failed', volumeCorrect + eulerCorrect, volumeWrong + eulerWrong, 0);
  }
  return finish(7, 'playing', volumeCorrect + eulerCorrect, volumeWrong + eulerWrong, 0);
}

function judgeInterest(attempts: readonly GradedAttempt[]): RoundResult {
  const { total, need, simpleNeed, compoundNeed } = ZONE_PASS[8];
  let correct = 0;
  let wrong = 0;
  let simpleCorrect = 0;
  let compoundCorrect = 0;

  for (const attempt of attempts) {
    if (correct + wrong >= total) break;
    if (attempt.tag !== 'simple' && attempt.tag !== 'compound') {
      return finish(8, 'failed', correct, wrong + 1, 0);
    }
    if (attempt.correct) {
      correct += 1;
      if (attempt.tag === 'simple') simpleCorrect += 1;
      else compoundCorrect += 1;
    } else {
      wrong += 1;
    }
  }

  if (correct + wrong < total) return finish(8, 'playing', correct, wrong, 0);
  const passed = correct >= need && simpleCorrect >= simpleNeed && compoundCorrect >= compoundNeed;
  if (!passed) return finish(8, 'failed', correct, wrong, 0);
  return finish(8, 'passed', correct, wrong, wrong);
}

function fillsMatch(expected: string, given: string): boolean {
  const left = normalizeFill(expected);
  const right = normalizeFill(given);
  return left !== null && right !== null && left === right;
}

function normalizeFill(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, '').replace(/,/g, '');
  if (compact === '') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(compact)) return String(Number(compact));
  return compact.toLowerCase();
}
