import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sprites = readFileSync(join(root, 'src/assets/sprites.svg'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

const ui = vueFiles(join(root, 'src')).map((path) => readFileSync(path, 'utf8')).join('\n');

const ART_IDS = [
  'art-bear',
  'art-car',
  'art-burger',
  'art-shop',
  'art-home',
  'art-park',
  'art-picnic',
  'art-picnic-place',
  'art-tree',
  'art-flower',
] as const;

describe('original picnic art', () => {
  it('keeps every original SVG symbol id in the shipped sprite sheet', () => {
    for (const id of ART_IDS) {
      expect(sprites).toContain(`id="${id}"`);
      expect(ui.includes(`#${id}`) || ui.includes(id), `${id} should be referenced by the Vue UI`).toBe(true);
    }
  });

  it('ships Vue 3 rather than Vue 2 or another UI framework', () => {
    expect(pkg.dependencies?.vue).toMatch(/^[\^~]?3\./);
    expect(pkg.dependencies?.react).toBeUndefined();
    expect(pkg.dependencies?.svelte).toBeUndefined();
  });
});
