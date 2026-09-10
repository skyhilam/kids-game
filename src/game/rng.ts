export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0]!;
  }
  return (Math.random() * 0x100000000) >>> 0;
}

export function mixSeed(seed: number, salt: number, attemptNo: number): number {
  return (Math.imul(seed >>> 0, 2246822519) + salt + attemptNo * 997) >>> 0;
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function shuffle<T>(rand: () => number, items: readonly T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const left = next[i]!;
    next[i] = next[j]!;
    next[j] = left;
  }
  return next;
}
