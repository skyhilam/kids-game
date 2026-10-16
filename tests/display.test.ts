import { describe, expect, it } from 'vitest';
import { boardBacking, boardDpr, fitSize, labelRaster, syncBoardCanvas, worldScale } from '../src/phaser/display';

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

  it('keeps canvas and touch surface aligned through repeated portrait and landscape sizes', () => {
    const parent = { clientWidth: 390, clientHeight: 600 };
    const canvas = { parentElement: parent, style: { width: '', height: '' } };
    const scale = { width: 0, height: 0, resize(width: number, height: number) { this.width = width; this.height = height; } };
    const scene = { scale, game: { canvas: canvas as unknown as HTMLCanvasElement } };
    for (const [width, height] of [[390, 600], [844, 390], [768, 604], [1024, 805], [580, 455]]) {
      parent.clientWidth = width;
      parent.clientHeight = height;
      const logical = width <= 600 ? { width: 660, height: 840 } : { width: 840, height: 660 };
      const result = syncBoardCanvas(scene, logical);
      expect(result.scale.x).toBe(result.scale.y);
      expect(parseFloat(canvas.style.width) / parseFloat(canvas.style.height)).toBeCloseTo(logical.width / logical.height);
      expect(scale.width).toBeGreaterThan(0);
    }
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
