import { describe, expect, it } from 'vitest';
import { normalizationPlan, spriteBounds } from '../src/studio/spritePipeline';

describe('sprite-pipeline geometry', () => {
  it('uses one scale for differently sized poses without flattening pose proportions', () => {
    const a = { x: 20, y: 30, width: 80, height: 100 }, b = { x: 40, y: 10, width: 120, height: 140 };
    const plan = normalizationPlan([a, b], a, 'wave');
    expect(plan.alignment).toBe('bottom-center');
    expect(plan.scale).toBeCloseTo((256 - 42) / 140);
    for (const [i, bounds] of [a, b].entries()) {
      const position = plan.positions[i]!;
      expect(position.y + (bounds.y + bounds.height) * plan.scale).toBeCloseTo(235);
      expect(position.x + (bounds.x + bounds.width / 2) * plan.scale).toBeCloseTo(128);
    }
    expect(a.height * plan.scale / (b.height * plan.scale)).toBeCloseTo(100 / 140);
  });
  it.each(['jump', 'run', 'custom'] as const)('preserves airborne and lateral offsets for %s', motion => {
    const ground = { x: 50, y: 80, width: 80, height: 120 }, air = { x: 65, y: 20, width: 80, height: 120 };
    const plan = normalizationPlan([ground, air], ground, motion);
    expect(plan.alignment).toBe('shared-origin'); expect(plan.positions[0]).toEqual(plan.positions[1]);
    expect((ground.y - air.y) * plan.scale).toBeGreaterThan(60);
    expect(air.x * plan.scale + plan.positions[1]!.x).toBeGreaterThan(ground.x * plan.scale + plan.positions[0]!.x);
  });
  it('detects alpha bounds and rejects blank, opaque or border-crossing frames', () => {
    const width = 32, height = 32; const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 5; y < 20; y++) for (let x = 4; x < 18; x++) data[(y * width + x) * 4 + 3] = 255;
    expect(spriteBounds({ width, height, data })).toEqual({ x: 4, y: 5, width: 14, height: 15 });
    for (let x = 0; x < width; x++) data[x * 4 + 3] = 255;
    expect(() => spriteBounds({ width, height, data })).toThrow('影格邊界');
    data.fill(0); expect(() => spriteBounds({ width, height, data })).toThrow('透明背景');
    data.fill(255); expect(() => spriteBounds({ width, height, data })).toThrow('透明背景');
  });
});
