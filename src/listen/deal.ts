import { mulberry32, shuffle } from '../game/rng';
import { listenLoadBand, type LoadBand } from '../game/stages';
import { STICKER_POOL, type WordId } from '../sticker/words';

export { listenLoadBand };

export const LISTEN_RECENT = 2;

/** Option count N and clears-after-K correct taps per load band. */
export const LISTEN_LOAD: Record<LoadBand, { n: number; k: number }> = {
  easy: { n: 3, k: 3 },
  basic: { n: 4, k: 4 },
  puzzle: { n: 6, k: 5 },
};

/**
 * Visual/word neighbours used as forced distractors on basic/puzzle.
 * `burger`/`picnic` is the optional extra pair on top of park/picnic.
 */
export const SIMILARITY_GROUPS: readonly (readonly WordId[])[] = [
  ['car', 'truck'],
  ['home', 'shop'],
  ['tree', 'flower'],
  ['park', 'picnic'],
  ['tooth', 'toothbrush'],
  ['bear', 'kid'],
  ['burger', 'picnic'],
  ['dog', 'cat'],
  ['chicken', 'duck'],
  ['cow', 'horse'],
  ['pig', 'sheep'],
];

export type ListenDeal = {
  target: WordId;
  options: WordId[];
};

export type ListenTapResult =
  | { kind: 'correct'; correct: number; cleared: boolean }
  | { kind: 'wrong' };

export function listenOptionCount(level = 0): number {
  return LISTEN_LOAD[listenLoadBand(level)].n;
}

export function listenStreakNeed(level = 0): number {
  return LISTEN_LOAD[listenLoadBand(level)].k;
}

export function similarityPeers(target: WordId, pool: readonly WordId[]): WordId[] {
  const peers = new Set<WordId>();
  for (const group of SIMILARITY_GROUPS) {
    if (!group.includes(target)) continue;
    for (const id of group) {
      if (id !== target && pool.includes(id)) peers.add(id);
    }
  }
  return [...peers];
}

export function rollRecentTargets(history: readonly WordId[], target: WordId): WordId[] {
  return [...history, target].slice(-LISTEN_RECENT);
}

export function tryListenTap(
  target: WordId,
  picked: WordId,
  correct: number,
  need: number,
): ListenTapResult {
  if (picked !== target) return { kind: 'wrong' };
  const next = correct + 1;
  return { kind: 'correct', correct: next, cleared: next >= need };
}

export function dealListen(seed: number, level = 0, recent: readonly WordId[] = []): ListenDeal {
  const rand = mulberry32(seed);
  const band = listenLoadBand(level);
  const pool = STICKER_POOL[band];
  const n = LISTEN_LOAD[band].n;
  const recentSet = new Set(recent.filter((id) => pool.includes(id)));
  const fresh = pool.filter((id) => !recentSet.has(id));
  const target = shuffle(rand, fresh.length > 0 ? fresh : [...pool])[0]!;

  const others = pool.filter((id) => id !== target);
  const distractors: WordId[] = [];
  if (band !== 'easy') {
    const peers = similarityPeers(target, pool);
    if (peers.length > 0) distractors.push(shuffle(rand, peers)[0]!);
  }
  const leftover = shuffle(rand, others.filter((id) => !distractors.includes(id)));
  while (distractors.length < n - 1 && leftover.length > 0) {
    distractors.push(leftover.shift()!);
  }

  return {
    target,
    options: shuffle(rand, [target, ...distractors]),
  };
}
