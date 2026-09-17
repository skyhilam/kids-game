import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sprites } from '../src/art/sprites';
import { mazeLoadBand, parentCopy, stickerLoadBand, STAGE_LABEL } from '../src/game/stages';
import { STICKER_COPY } from '../src/sticker/copy';
import {
  dealBoard,
  isCleared,
  lift,
  placedCount,
  slotOf,
  tryPlace,
  WORD_IDS,
} from '../src/sticker/words';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const claims = /貼紙冊|100 枚|智商|智力|大腦/;

describe('sticker word list and deal', () => {
  it('uses the six shared sprite names as English slots', () => {
    expect([...WORD_IDS]).toEqual(['burger', 'car', 'home', 'tree', 'flower', 'sun']);
    for (const id of WORD_IDS) expect(sprites).toHaveProperty(id);
  });

  it('shuffles tray and slots as permutations of the same six words', () => {
    const first = dealBoard(7);
    const same = dealBoard(7);
    expect(first.slots).toEqual(same.slots);
    expect(first.tray).toEqual(same.tray);
    expect([...first.slots].sort()).toEqual([...WORD_IDS].sort());
    expect([...first.tray].sort()).toEqual([...WORD_IDS].sort());

    const seenTray = new Set(Array.from({ length: 24 }, (_, seed) => dealBoard(seed).tray.join(',')));
    expect(seenTray.size).toBeGreaterThan(1);
  });
});

describe('sticker place rules', () => {
  it('snaps a correct sticker, keeps wrong unlocked, and allows lifting', () => {
    expect(tryPlace({}, 'car', 'tree')).toEqual({ kind: 'wrong' });
    expect(tryPlace({ car: 'car' }, 'car', 'tree')).toEqual({ kind: 'blocked' });

    const placed = tryPlace({}, 'burger', 'burger');
    expect(placed).toEqual({ kind: 'correct', placed: { burger: 'burger' }, cleared: false });
    if (placed.kind !== 'correct') return;
    expect(slotOf(placed.placed, 'burger')).toBe('burger');
    expect(placedCount(placed.placed)).toBe(1);

    const lifted = lift(placed.placed, 'burger');
    expect(lifted.burger).toBeUndefined();
    expect(isCleared(lifted)).toBe(false);

    let board: import('../src/sticker/words').PlacedMap = {};
    for (const id of WORD_IDS) {
      const next = tryPlace(board, id, id);
      expect(next.kind).toBe('correct');
      if (next.kind !== 'correct') return;
      board = next.placed;
    }
    expect(isCleared(board)).toBe(true);
    expect(placedCount(board)).toBe(6);
  });
});

describe('sticker stages, copy, and hub wiring', () => {
  it('reserves LoadBand like maze stages and keeps in-run label 簡單', () => {
    expect(stickerLoadBand(0)).toBe('easy');
    expect(stickerLoadBand(1)).toBe(mazeLoadBand(1));
    expect(stickerLoadBand(8)).toBe(mazeLoadBand(8));
    expect(STAGE_LABEL.easy).toBe('簡單');
    expect(parentCopy.sticker.easy).toEqual({
      goal: '圖詞配對練習',
      ask: '呢張圖係咩？邊個英文詞？',
      show: '家長拖一張放對後交返孩子',
    });
    expect(parentCopy.sticker.basic.goal).toBe('圖詞配對練習');
    expect(parentCopy.sticker.puzzle.show).toContain('家長拖一張放對後交返孩子');
  });

  it('keeps sticker copy free of sticker-book, timer, and score claims', () => {
    expect(JSON.stringify({ STICKER_COPY, parent: parentCopy.sticker })).not.toMatch(claims);
    expect(STICKER_COPY.title).toBe('貼紙學單字');
    expect(STICKER_COPY.subtitle).toBe('拖貼紙配英文詞，全部放對就過關');
    expect(STICKER_COPY.replay).toBe('再玩');
    expect(STICKER_COPY.home).toBe('回 Hub');
    expect(STICKER_COPY.task).toContain('圖詞配對練習');
    expect(STICKER_COPY.controls).toContain('可以再拖');
    expect(STICKER_COPY.parent).toContain('呢張圖係咩？邊個英文詞？');
  });

  it('adds a fourth hub activity without rewriting maze routes', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    const play = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    expect(hub).toMatch(/emit\('pick', 'sticker'\)/);
    expect(hub).toContain('貼紙學單字');
    expect(hub).toContain('拖貼紙配英文詞，全部放對就過關');
    expect([...hub.matchAll(/class="hub-stages"/g)]).toHaveLength(3);
    expect(app).toMatch(/activity === 'sticker'/);
    expect(app).toContain('StickerPlay');
    expect(play).toContain('data-stage="簡單"');
    expect(play).toContain('speakEnglish');
    expect(play).toContain("playCue(soundOn.value, 'collect')");
    expect(play).toContain("playCue(soundOn.value, 'hint')");
    expect(play).toContain('>任務<');
    expect(play).toContain('>操作<');
    expect(play).toContain('>家長<');
    expect(play).toContain('再玩');
    expect(play).toContain('回 Hub');
    expect(play).toContain('usePlayAudio');
    expect(play).not.toMatch(/speak\(soundOn\.value,\s*id\)/);
    expect(play).not.toMatch(/貼紙冊|100 枚/);

    const picnic = readFileSync(join(root, 'src/components/PicnicPlay.vue'), 'utf8');
    const tooth = readFileSync(join(root, 'src/components/ToothPlay.vue'), 'utf8');
    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    expect(picnic).toContain('一起去野餐');
    expect(tooth).toContain('打敗蛀牙蟲');
    expect(delivery).toContain('送貨員來了');
    expect(picnic + tooth + delivery).not.toMatch(/sticker\/words|貼紙學單字/);
  });
});
