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

  it('shows the three-stage overview on every card and the delivery tap-first tip', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    expect([...hub.matchAll(/class="hub-stages"/g)]).toHaveLength(3);
    expect(hub).toMatch(/STAGE_OVERVIEW/);
    expect(hub).toMatch(/可先點選，再試畫線/);
    expect(hub).not.toMatch(/貼紙冊|100 枚|智商|智力|大腦/);
  });

  it('adds 貼紙學單字 as a fourth card with a new activity key', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    expect(hub).toMatch(/<strong>貼紙學單字<\/strong>/);
    expect(hub).toMatch(/拖貼紙配英文詞，全部放對就過關/);
    expect(hub).toMatch(/emit\('pick', 'sticker'\)/);
    expect(app).toMatch(/'hub' \| 'picnic' \| 'tooth' \| 'delivery' \| 'sticker' \| 'listen'/);
    expect(app).toMatch(/StickerPlay/);
    expect([...hub.matchAll(/class="hub-card"/g)]).toHaveLength(5);
  });

  it('adds 聽一聽揀圖 as a fifth card with listen activity', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    expect(hub).toMatch(/<strong>聽一聽揀圖<\/strong>/);
    expect(hub).toMatch(/聽到詞之後，點啱嘅圖。/);
    expect(hub).toMatch(/STAGE_OVERVIEW.*聽詞揀圖|聽詞揀圖/);
    expect(hub).toMatch(/emit\('pick', 'listen'\)/);
    expect(app).toMatch(/ListenPlay/);
    expect(app).toMatch(/activity === 'listen'/);
    expect([...hub.matchAll(/class="hub-card"/g)]).toHaveLength(5);
    expect(hub).toMatch(/emit\('pick', 'picnic'\)/);
    expect(hub).toMatch(/emit\('pick', 'sticker'\)/);
  });
});
