import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import SpriteStrip from '../src/components/SpriteStrip.vue';
import { stripLayout } from '../src/art/strip';

const box = { width: 420, height: 150, padX: 18, padY: 16, gap: 12 };

describe('stripLayout', () => {
  it.each([1, 3, 4, 6])('centers %i equal cells inside the padded box without overlap', (count) => {
    const cells = stripLayout(count, box);
    expect(cells).toHaveLength(count);
    for (const [index, cell] of cells.entries()) {
      expect(cell.width).toBeGreaterThan(0);
      expect(cell.width).toBe(cells[0]!.width);
      expect(cell.height).toBe(cells[0]!.height);
      expect(cell.x).toBeGreaterThanOrEqual(box.padX);
      expect(cell.y).toBeGreaterThanOrEqual(box.padY);
      expect(cell.x + cell.width).toBeLessThanOrEqual(box.width - box.padX);
      expect(cell.y + cell.height).toBeLessThanOrEqual(box.height - box.padY);
      expect(cell.y + cell.height / 2).toBeCloseTo(box.height / 2);
      const previous = cells[index - 1];
      if (previous) expect(cell.x - previous.x - previous.width).toBeCloseTo(box.gap);
    }
    const first = cells[0]!;
    const last = cells[cells.length - 1]!;
    expect(first.x).toBeCloseTo(box.width - last.x - last.width);
  });

  it('returns no cells for empty or invalid counts', () => {
    for (const count of [0, -1, 1.5, Infinity, NaN]) expect(stripLayout(count, box)).toEqual([]);
  });

  it('shrinks excessive gaps to keep cells within a narrow box', () => {
    const narrow = { width: 60, height: 80, padX: 10, padY: 10, gap: 30 };
    const cells = stripLayout(6, narrow);
    for (const [index, cell] of cells.entries()) {
      expect(cell.x).toBeGreaterThanOrEqual(narrow.padX);
      expect(cell.x + cell.width).toBeLessThanOrEqual(narrow.width - narrow.padX);
      const previous = cells[index - 1];
      if (previous) expect(cell.x).toBeGreaterThanOrEqual(previous.x + previous.width);
    }
  });
});


describe('SpriteStrip', () => {
  it('renders each supplied sprite in a silent default viewBox', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h(SpriteStrip, { names: ['apple', 'cat', 'rocket'] }),
    }));
    expect(html.toLowerCase()).toContain('viewbox="0 0 420 150"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('rx="24"');
    for (const name of ['apple', 'cat', 'rocket']) expect(html).toContain(`data-sprite="${name}"`);
    expect(html.match(/data-sprite=/g)).toHaveLength(3);
  });

  it('uses custom dimensions and background even with no sprites', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h(SpriteStrip, { names: [], width: 220, height: 120, fill: '#abcdef' }),
    }));
    expect(html.toLowerCase()).toContain('viewbox="0 0 220 120"');
    expect(html).toContain('width="220" height="120"');
    expect(html).toContain('fill="#abcdef"');
    expect(html).not.toContain('data-sprite=');
  });
});
