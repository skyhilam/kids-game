import { describe, expect, it } from 'vitest';
import { boardBacking, boardDpr, fitSize, labelRaster, worldScale } from '../src/phaser/display';

describe('Phaser board backing store', () => {
  it('caps devicePixelRatio so mobile fill-rate stays bounded', () => {
    expect(boardDpr(1)).toBe(1);
    expect(boardDpr(2)).toBe(2);
    expect(boardDpr(3)).toBe(2);
  });

  it('uses a uniform scale so the map is not stretched', () => {
    const backing = boardBacking({ clientWidth: 1084, clientHeight: 852 }, { width: 840, height: 660 }, 2);
    const scale = worldScale(backing, { width: 840, height: 660 });
    expect(scale.x).toBe(scale.y);
    expect(backing.width / backing.height).toBeCloseTo(840 / 660, 2);
    expect(backing.width).toBeGreaterThan(840);
  });

  it('falls back to the logical map when the host has not laid out yet', () => {
    expect(boardBacking(null, { width: 840, height: 660 }, 2)).toMatchObject({ width: 1680, height: 1320 });
  });

  it('fits artwork inside a box without stretching', () => {
    expect(fitSize(343, 316, 200, 104)).toEqual({ width: 343 * (104 / 316), height: 104 });
    expect(fitSize(318, 354, 76, 97).width / fitSize(318, 354, 76, 97).height).toBeCloseTo(318 / 354, 5);
    expect(fitSize(351, 237, 100, 66).width / fitSize(351, 237, 100, 66).height).toBeCloseTo(351 / 237, 5);
  });
});

describe('board label raster', () => {
  it('keeps glyph size while drawing at backing resolution', () => {
    expect(labelRaster(2)).toEqual({ fontMul: 2, zoom: 0.5 });
    expect(labelRaster(1)).toEqual({ fontMul: 1, zoom: 1 });
    expect(12 * labelRaster(2).fontMul * labelRaster(2).zoom).toBe(12);
  });
});
