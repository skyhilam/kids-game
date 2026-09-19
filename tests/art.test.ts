import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import GameSprite from '../src/components/GameSprite.vue';
import { atlases, sprites } from '../src/art/sprites';
import { activeSprites } from '../src/studio/store';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

const ui = vueFiles(join(root, 'src')).map((path) => readFileSync(path, 'utf8')).join('\n');

describe('shared game artwork', () => {
  it('matches the actual PNG dimensions and requires a transparent image format', () => {
    for (const atlas of Object.values(atlases)) {
      const png = readFileSync(join(root, atlas.src));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(atlas.width);
      expect(png.readUInt32BE(20)).toBe(atlas.height);
      expect(png[25], `${atlas.src} must have RGBA pixels`).toBe(6);
    }
  });

  it('keeps every frame within its atlas', () => {
    for (const [name, sprite] of Object.entries(sprites)) {
      const atlas = atlases[sprite.atlas];
      const [x, y, width, height] = sprite.frame;
      expect(x, name).toBeGreaterThanOrEqual(0);
      expect(y, name).toBeGreaterThanOrEqual(0);
      expect(width, name).toBeGreaterThan(0);
      expect(height, name).toBeGreaterThan(0);
      expect(x + width, name).toBeLessThanOrEqual(atlas.width);
      expect(y + height, name).toBeLessThanOrEqual(atlas.height);
    }
  });

  it('resolves artwork names used by all games and keeps UI icons separate', () => {
    for (const match of ui.matchAll(/<GameSprite\b[^>]*?\sname="([^"]+)"/g)) {
      expect(sprites, match[1]).toHaveProperty(match[1]);
    }
    expect(ui).not.toContain('#art-');
    const icons = readFileSync(join(root, 'src/assets/icons.svg'), 'utf8');
    for (const match of ui.matchAll(/#(i-[a-z-]+)/g)) {
      expect(icons).toContain(`id="${match[1]}"`);
    }
  });

  it('draws restart as a complete circular arrow that fits its viewBox', () => {
    const icons = readFileSync(join(root, 'src/assets/icons.svg'), 'utf8');
    const symbol = icons.match(/<symbol id="i-restart"[^>]*>.*?<\/symbol>/)?.[0] ?? '';
    expect(symbol).toContain('viewBox="0 0 32 32"');
    expect(symbol).toMatch(/a10\.5 10\.5 0 1 1/);
    expect(symbol).not.toMatch(/\bH1\b/);
    const uses = [...ui.matchAll(/<svg\b([^>]*)>[^<]*<use\b[^>]*i-restart/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const match of uses) {
      expect(match[1], match[0]).toContain('viewBox="0 0 32 32"');
    }
  });

  it('renders on its own with correct crop, placement and accessible name', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h(GameSprite, { name: 'car-top', label: '紅色小車', x: 25, y: 50, width: 100, height: 66 }),
    }));
    expect(html.toLowerCase()).toContain(`viewbox="${sprites['car-top'].frame.join(' ')}"`);
    expect(html).toContain('x="25"');
    expect(html).toContain('y="50"');
    expect(html).toContain('width="100"');
    expect(html).toContain('height="66"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="紅色小車"');
    expect(html).toContain('overflow="hidden"');
    expect(html).toContain(`<image href="${atlases.picnic.src}"`);
    expect(html).not.toContain('<use');
    expect(html).not.toContain('aria-hidden="true"');
  });

  it('makes unlabeled decorative sprites silent for assistive technology', async () => {
    const html = await renderToString(createSSRApp({ render: () => h(GameSprite, { name: 'tooth' }) }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it('renders applied animation cells with clipping in wide board viewports and preserves original comparisons', async () => {
    activeSprites.value = { 'car-top': { image: 'data:image/png;base64,test-animation', frames: 8, fps: 12, columns: 4, rows: 2 } };
    try {
      const html = await renderToString(createSSRApp({ render: () => h(GameSprite, { name: 'car-top', width: 100, height: 66 }) }));
      expect(html).toContain('data-animated="true"'); expect(html).toContain('data-frame="0"');
      expect(html).toContain('width="512" height="256"');
      expect(html).toContain('<rect x="0" y="0" width="128" height="128"');
      expect(html).toContain('clip-path="url(#sprite-clip-');
      const original = await renderToString(createSSRApp({ render: () => h(GameSprite, { name: 'car-top', original: true }) }));
      expect(original).not.toContain('data-animated'); expect(original).not.toContain('test-animation');
      expect(original.toLowerCase()).toContain(`viewbox="${sprites['car-top'].frame.join(' ')}"`);
    } finally { activeSprites.value = {}; }
  });

  it('clips neighboring artwork even in wide or tall containers, with unique local masks', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h('div', [
        h(GameSprite, { name: 'tree', width: 40, height: 140 }),
        h(GameSprite, { name: 'picnic', width: 240, height: 80 }),
      ]),
    }));
    const ids = [...html.matchAll(/<clippath id="([^"]+)"/gi)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
    for (const name of ['tree', 'picnic'] as const) {
      const [x, y, width, height] = sprites[name].frame;
      expect(html).toContain(`<rect x="${x}" y="${y}" width="${width}" height="${height}"`);
    }
  });

  it('registers Phaser atlas frames before drawing board scenery', () => {
    const maze = readFileSync(join(root, 'src/phaser/MazeScene.ts'), 'utf8');
    const delivery = readFileSync(join(root, 'src/phaser/DeliveryScene.ts'), 'utf8');
    expect(maze).toMatch(/registerAtlasFrames\(this,/);
    const create = delivery.slice(delivery.indexOf('create():'), delivery.indexOf('update():'));
    expect(create).toMatch(/registerAtlasFrames\(this, SPRITES\)/);
    expect(create.indexOf('registerAtlasFrames')).toBeLessThan(create.indexOf('syncScenery'));
    expect(delivery).toContain('drawDeliveryNetwork');
    expect(delivery).not.toMatch(/backgroundColor:\s*'transparent'/);
    expect(delivery).not.toMatch(/setBackgroundColor\('transparent'\)/);
    expect(maze).toContain('paintLabelChip');
    expect(maze).not.toMatch(/setStroke\(/);
    expect(maze).not.toMatch(/x - 42, y - 55/);
    expect(maze).not.toMatch(/shown\.has\(id\)/);
    expect(maze).toMatch(/bugName\(index\), x, y, 78, 78, \{ x: 0\.5, y: 0\.84 \}/);
    expect(delivery).toContain('paintLabelChip');
    expect(delivery).not.toMatch(/backgroundColor:/);
  });
});
