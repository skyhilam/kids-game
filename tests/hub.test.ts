import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('hub landing metadata', () => {
  it('names the install surface 小小出遊家, not picnic alone', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>小小出遊家｜野餐、刷牙、送貨迷宮<\/title>/);
    expect(html).toMatch(/apple-mobile-web-app-title" content="小小出遊家"/);

    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8')) as {
      name: string;
    };
    expect(manifest.name).toBe('小小出遊家');

    const check = readFileSync(join(root, 'scripts/browser-check.mjs'), 'utf8');
    expect(check).toContain("title.includes('小小出遊家')");
    expect(check).not.toMatch(/title\.includes\('一起去野餐'\)/);
  });
});
