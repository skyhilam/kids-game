import { describe, expect, it } from 'vitest';
import { bestByVector } from '../src/game/input';
import type { Point } from '../src/game/types';

describe('bestByVector', () => {
  it('returns undefined for a zero swipe', () => {
    expect(bestByVector([0, 0], [{ to: 'a', point: [10, 0] }], [0, 0])).toBeUndefined();
  });

  it('picks the rightward neighbor among left and right', () => {
    const best = bestByVector(
      [0, 0],
      [
        { to: 'left', point: [-10, 0] },
        { to: 'right', point: [10, 0] },
      ],
      [1, 0],
    );
    expect(best?.to).toBe('right');
    expect(best?.score).toBeGreaterThan(0.7);
  });

  it('scores a delivery-style candidate list with the same helper', () => {
    const origin: Point = [0, 0];
    const best = bestByVector(
      origin,
      [
        { to: 'a', point: [10, 0] },
        { to: 'b', point: [0, 10] },
      ],
      [0, 1],
    );
    expect(best?.to).toBe('b');
    expect(best?.score).toBeGreaterThan(0.7);
  });
});
