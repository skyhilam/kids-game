import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sprites } from '../src/art/sprites';
import { mazeLoadBand, parentCopy, stickerLoadBand, STAGE_LABEL } from '../src/game/stages';
import { STICKER_COPY } from '../src/sticker/copy';
import {
  BASIC_POOL,
  dealBoard,
  EASY_POOL,
  isCleared,
  lift,
  placedCount,
  PUZZLE_POOL,
  rollRecent,
  slotOf,
  STICKER_POOL,
  stickerWordCount,
  tryPlace,
  WORD_EN,
  WORD_IDS,
  WORD_ZH,
} from '../src/sticker/words';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const claims = /貼紙冊|100 枚|智商|智力|大腦/;

describe('sticker word list and deal', () => {
  it('uses existing sprites, including hyphenated ids mapped to English words', () => {
    expect(WORD_IDS).toHaveLength(24);
    expect([...WORD_IDS]).toEqual([
      'burger', 'car', 'home', 'tree', 'flower', 'sun',
      'truck', 'parcel', 'bear', 'shop', 'park', 'picnic',
      'kid', 'tooth', 'toothbrush', 'bug-coral',
      'dog', 'cat', 'chicken', 'duck', 'cow', 'pig', 'sheep', 'horse',
    ]);
    for (const extra of ['car-top', 'truck-top', 'kid-cheer', 'courier', 'bug-purple'] as const) {
      expect(WORD_IDS).not.toContain(extra);
    }
    for (const id of WORD_IDS) {
      expect(sprites).toHaveProperty(id);
      expect(WORD_ZH[id]).toBeTruthy();
      expect(WORD_EN[id]).toBeTruthy();
      expect(WORD_EN[id]).not.toMatch(/-/);
    }
    expect(WORD_EN['bug-coral']).toBe('bug');
    expect(WORD_ZH['bug-coral']).toBe('蟲');
    expect(WORD_ZH.dog).toBe('狗');
    expect(WORD_EN.dog).toBe('dog');
    expect(WORD_ZH.cat).toBe('貓');
    expect(WORD_EN.cat).toBe('cat');
    expect(WORD_ZH.chicken).toBe('雞');
    expect(WORD_EN.chicken).toBe('chicken');
    expect(WORD_ZH.duck).toBe('鴨');
    expect(WORD_EN.duck).toBe('duck');
    expect(WORD_ZH.cow).toBe('牛');
    expect(WORD_EN.cow).toBe('cow');
    expect(WORD_ZH.pig).toBe('豬');
    expect(WORD_EN.pig).toBe('pig');
    expect(WORD_ZH.sheep).toBe('羊');
    expect(WORD_EN.sheep).toBe('sheep');
    expect(WORD_ZH.horse).toBe('馬');
    expect(WORD_EN.horse).toBe('horse');
    expect(new Set(Object.values(WORD_EN)).size).toBe(WORD_IDS.length);
  });

  it('nests load-band pools as easy ⊂ basic ⊂ puzzle = WORD_IDS', () => {
    expect(EASY_POOL).toHaveLength(8);
    expect(BASIC_POOL).toHaveLength(16);
    expect(PUZZLE_POOL).toHaveLength(24);
    expect(STICKER_POOL.easy).toEqual(EASY_POOL);
    expect(STICKER_POOL.basic).toEqual(BASIC_POOL);
    expect(STICKER_POOL.puzzle).toEqual(PUZZLE_POOL);
    expect(EASY_POOL.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(BASIC_POOL.every((id) => PUZZLE_POOL.includes(id))).toBe(true);
    expect(new Set(PUZZLE_POOL)).toEqual(new Set(WORD_IDS));
    expect([...EASY_POOL]).toEqual(['sun', 'car', 'home', 'tree', 'flower', 'bear', 'kid', 'park']);
    expect(BASIC_POOL.filter((id) => !EASY_POOL.includes(id))).toEqual([
      'burger', 'shop', 'truck', 'picnic', 'dog', 'cat', 'chicken', 'duck',
    ]);
    expect(PUZZLE_POOL.filter((id) => !BASIC_POOL.includes(id))).toEqual([
      'parcel', 'tooth', 'toothbrush', 'bug-coral', 'cow', 'pig', 'sheep', 'horse',
    ]);
    for (const extra of ['car-top', 'truck-top', 'kid-cheer', 'courier', 'bug-purple'] as const) {
      expect(PUZZLE_POOL).not.toContain(extra);
    }
  });

  it('draws 4/5/6 words only from that load-band pool', () => {
    expect(stickerWordCount(0)).toBe(4);
    expect(stickerWordCount(1)).toBe(5);
    expect(stickerWordCount(7)).toBe(5);
    expect(stickerWordCount(8)).toBe(6);
    expect(stickerWordCount(9)).toBe(6);

    const easy = dealBoard(7, 0);
    const basic = dealBoard(7, 1);
    const puzzle = dealBoard(7, 8);
    expect(easy.slots).toHaveLength(4);
    expect(easy.tray).toHaveLength(4);
    expect(basic.slots).toHaveLength(5);
    expect(basic.tray).toHaveLength(5);
    expect(puzzle.slots).toHaveLength(6);
    expect(puzzle.tray).toHaveLength(6);
    expect([...easy.slots].sort()).toEqual([...easy.tray].sort());
    expect([...basic.slots].sort()).toEqual([...basic.tray].sort());
    expect([...puzzle.slots].sort()).toEqual([...puzzle.tray].sort());
    expect(new Set(easy.slots).size).toBe(4);
    expect(new Set(puzzle.slots).size).toBe(6);
    expect(easy.slots.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(basic.slots.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(puzzle.slots.every((id) => PUZZLE_POOL.includes(id))).toBe(true);
    expect(dealBoard(7, 0)).toEqual(easy);
    expect(dealBoard(7)).toEqual(easy);

    const seenTray = new Set(Array.from({ length: 24 }, (_, seed) => dealBoard(seed, 8).tray.join(',')));
    expect(seenTray.size).toBeGreaterThan(1);

    const laterTheme = [
      'burger', 'shop', 'truck', 'picnic', 'parcel', 'tooth', 'toothbrush', 'bug-coral',
      'dog', 'cat', 'chicken', 'duck', 'cow', 'pig', 'sheep', 'horse',
    ] as const;
    const easySeen = new Set(Array.from({ length: 48 }, (_, seed) => dealBoard(seed, 0).slots).flat());
    expect(laterTheme.every((id) => !easySeen.has(id))).toBe(true);

    const basicSeen = new Set(Array.from({ length: 80 }, (_, seed) => dealBoard(seed, 1).slots).flat());
    expect(basicSeen.has('burger') || basicSeen.has('shop')).toBe(true);
    expect(['dog', 'cat', 'chicken', 'duck'].some((id) => basicSeen.has(id))).toBe(true);
    expect((['parcel', 'tooth', 'toothbrush', 'bug-coral', 'cow', 'pig', 'sheep', 'horse'] as const).every((id) => !basicSeen.has(id))).toBe(true);

    const puzzleSeen = new Set(Array.from({ length: 80 }, (_, seed) => dealBoard(seed, 8).slots).flat());
    expect(puzzleSeen.has('toothbrush')).toBe(true);
    expect(puzzleSeen.has('bug-coral')).toBe(true);
    expect(['cow', 'pig', 'sheep', 'horse'].some((id) => puzzleSeen.has(id))).toBe(true);
    const laterPuzzle = new Set(Array.from({ length: 40 }, (_, seed) => dealBoard(seed, 9).slots).flat());
    expect(laterPuzzle.has('toothbrush') || laterPuzzle.has('bug-coral')).toBe(true);
  });

  it('prefers unused pool words, then recent-in-pool, and never leaves the band', () => {
    const avoid = ['car', 'home', 'tree'] as const;
    const next = dealBoard(3, 0, avoid);
    expect(next.slots).toHaveLength(4);
    expect(next.slots.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(next.slots.some((id) => (avoid as readonly string[]).includes(id))).toBe(false);

    const recentEasy = EASY_POOL.slice(0, 6);
    const refill = dealBoard(9, 0, recentEasy);
    expect(refill.slots).toHaveLength(4);
    expect(refill.slots.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(refill.slots.filter((id) => !recentEasy.includes(id))).toHaveLength(2);

    const forced = dealBoard(5, 0, [...EASY_POOL]);
    expect(forced.slots).toHaveLength(4);
    expect(forced.slots.every((id) => EASY_POOL.includes(id))).toBe(true);

    let recent: import('../src/sticker/words').WordId[][] = [];
    const first = dealBoard(100, 0, recent.flat());
    recent = rollRecent(recent, first.slots);
    const second = dealBoard(117, 1, recent.flat());
    expect(first.slots).toHaveLength(4);
    expect(second.slots).toHaveLength(5);
    expect(first.slots.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(second.slots.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(second.slots.some((id) => first.slots.includes(id))).toBe(false);
    expect(dealBoard(117, 1, first.slots)).toEqual(second);

    recent = rollRecent(recent, second.slots);
    const deals = [first, second];
    for (let i = 2; i < 5; i += 1) {
      const deal = dealBoard(100 + i * 17, i, recent.flat());
      expect(deal.slots).toHaveLength(stickerWordCount(i));
      expect(deal.slots.every((id) => STICKER_POOL[stickerLoadBand(i)].includes(id))).toBe(true);
      expect(dealBoard(100 + i * 17, i, recent.flat())).toEqual(deal);
      recent = rollRecent(recent, deal.slots);
      deals.push(deal);
    }
    expect(new Set(deals.flatMap((deal) => deal.slots)).size).toBeGreaterThan(6);
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
    expect(placedCount(board)).toBe(WORD_IDS.length);
  });

  it('clears a banded deal only when every drawn word is correct', () => {
    const deal = dealBoard(3, 0);
    expect(deal.slots).toHaveLength(4);
    let board: import('../src/sticker/words').PlacedMap = {};
    for (const id of deal.slots) {
      const next = tryPlace(board, id, id, deal.slots);
      expect(next.kind).toBe('correct');
      if (next.kind !== 'correct') return;
      board = next.placed;
    }
    expect(isCleared(board, deal.slots)).toBe(true);
    expect(placedCount(board, deal.slots)).toBe(4);
    expect(isCleared(board)).toBe(false);
  });
});

describe('sticker stages, copy, and hub wiring', () => {
  it('maps sticker level onto the same load band as maze stages', () => {
    expect(stickerLoadBand(0)).toBe('easy');
    expect(stickerLoadBand(1)).toBe(mazeLoadBand(1));
    expect(stickerLoadBand(7)).toBe('basic');
    expect(stickerLoadBand(8)).toBe(mazeLoadBand(8));
    expect(STAGE_LABEL[stickerLoadBand(0)]).toBe('簡單');
    expect(STAGE_LABEL[stickerLoadBand(3)]).toBe('基礎');
    expect(STAGE_LABEL[stickerLoadBand(9)]).toBe('益智');
    expect(parentCopy.sticker.easy).toEqual({
      goal: '用 4 張短詞圖練習圖詞配對，睇圖搵英文詞。',
      ask: '「呢張圖係咩？邊個英文詞？」',
      show: '家長拖一張放對並等英文讀出，之後交返孩子自己拖其餘。',
    });
    expect(parentCopy.sticker.basic).toEqual({
      goal: '用 5 張圖練習；可能出現漢堡、商店、貨車等主題詞，仍唔計時唔扣分。',
      ask: '「呢張圖同邊個英文詞啱？有冇兩個詞睇落好似？」',
      show: '第一個分岔式混淆（例如兩個都似交通工具）時，家長只指住兩個候選格，唔代拖；等孩子講完再自己放。',
    });
    expect(parentCopy.sticker.puzzle).toEqual({
      goal: '用 6 張圖；可能混入較長詞（例如 toothbrush）或刷牙主題，一次記多幾個配對。',
      ask: '「出發前你想先配邊張？有冇詞特別長、要慢慢認字母？」',
      show: '家長示範讀一次長詞（例如 toothbrush），唔代拖完全部；卡住先提示睇托盤剩低邊張。',
    });
    const bands = ['easy', 'basic', 'puzzle'] as const;
    for (let i = 0; i < bands.length; i += 1) {
      for (let j = i + 1; j < bands.length; j += 1) {
        const left = parentCopy.sticker[bands[i]!];
        const right = parentCopy.sticker[bands[j]!];
        expect(left).not.toEqual(right);
        expect(left.goal).not.toBe(right.goal);
        expect(left.ask).not.toBe(right.ask);
        expect(left.show).not.toBe(right.show);
        expect(STICKER_COPY.parent[bands[i]!]).not.toBe(STICKER_COPY.parent[bands[j]!]);
      }
    }
  });

  it('keeps sticker copy free of sticker-book, timer, and score claims', () => {
    expect(JSON.stringify({ STICKER_COPY, parent: parentCopy.sticker })).not.toMatch(claims);
    expect(STICKER_COPY.title).toBe('貼紙學單字');
    expect(STICKER_COPY.subtitle).toBe('拖貼紙配英文詞，全部放對就過關');
    expect(STICKER_COPY.next).toBe('下一關');
    expect(STICKER_COPY.replay).toBe('再玩本關');
    expect(STICKER_COPY.home).toBe('回 Hub');
    expect(STICKER_COPY.winBody).toContain('下一關');
    expect(STICKER_COPY.winBody).not.toContain('六張');
    expect(STICKER_COPY.task).toContain('圖詞配對練習');
    expect(STICKER_COPY.controls).toContain('可以再拖');
    expect(STICKER_COPY.parent.easy).toContain('呢張圖係咩？邊個英文詞？');
    expect(STICKER_COPY.parent.easy).toContain(parentCopy.sticker.easy.goal);
    expect(STICKER_COPY.parent.basic).toContain(parentCopy.sticker.basic.ask);
    expect(STICKER_COPY.parent.puzzle).toContain(parentCopy.sticker.puzzle.show);
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
    expect(play).toContain('stickerLoadBand');
    expect(play).toContain('parentCopy.sticker');
    expect(play).toContain('copy.parent[stageBand]');
    expect(play).toMatch(/第 \{\{ level \+ 1 \}\} 關/);
    expect(play).toContain(':data-stage="stageLabel"');
    expect(play).toContain('speakEnglish');
    expect(play).toContain('WORD_EN');
    expect(play).toContain("playCue(soundOn.value, 'collect')");
    expect(play).toContain("playCue(soundOn.value, 'hint')");
    expect(play).toContain('>任務<');
    expect(play).toContain('>操作<');
    expect(play).toContain('>家長<');
    expect(play).toContain('下一關');
    expect(play).toContain('回 Hub');
    expect(play).toContain('nextLevel');
    expect(play).toContain('dealLevel(level.value + 1)');
    expect(play).toContain('dealBoard(randomSeed(), nextLevel, recentDeals.value.flat())');
    expect(play).toContain('rollRecent');
    expect(play).toContain('usePlayAudio');
    expect(play).toContain('speakEnglish(soundOn.value, WORD_EN[id])');
    expect(play).not.toMatch(/speak\(soundOn\.value,\s*id\)/);
    expect(play).not.toMatch(/speakEnglish\(soundOn\.value,\s*id\)/);
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
