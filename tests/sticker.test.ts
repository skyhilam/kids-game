import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sprites } from '../src/art/sprites';
import { mazeLoadBand, parentCopy, stickerLoadBand, STAGE_LABEL } from '../src/game/stages';
import { WORD_BANK } from '../src/sticker/wordBank';
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
  STICKER_LOAD_COUNT,
  stickerWordCount,
  tryPlace,
  WORD_EN,
  WORD_IDS,
  WORD_ZH,
} from '../src/sticker/words';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const claims = /貼紙冊|100 枚|智商|智力|大腦/;

describe('sticker word list and deal', () => {
  it('derives unique spoken labels and sprite ids from the word bank', () => {
    expect(WORD_IDS).toEqual(WORD_BANK.map(({ id }) => id));
    expect(new Set(WORD_IDS).size).toBe(WORD_IDS.length);
    for (const { id, en, zh } of WORD_BANK) {
      expect(sprites).toHaveProperty(id);
      expect(en.trim()).not.toBe('');
      expect(zh.trim()).not.toBe('');
      expect(en).not.toContain('-');
      expect(zh).not.toContain('-');
      expect(WORD_EN[id]).toBe(en);
      expect(WORD_ZH[id]).toBe(zh);
    }
    expect(new Set(Object.values(WORD_EN)).size).toBe(WORD_IDS.length);
    expect(new Set(Object.values(WORD_ZH)).size).toBe(WORD_IDS.length);
    expect(WORD_EN['tyrannosaurus']).toBe('dinosaur');
    const themes = new Set<string>(WORD_IDS.map((id) => sprites[id].atlas));
    for (const theme of ['farm', 'ocean', 'garden', 'restaurant', 'groceries', 'music', 'space', 'city', 'construction', 'station', 'prehistoric']) {
      expect(themes.has(theme)).toBe(true);
    }
  });

  it('keeps the original sixteen words, labels, and introduction bands', () => {
    const originals = [
      ['sun', 'sun', '太陽', 'easy'], ['car', 'car', '小車', 'easy'],
      ['home', 'home', '房子', 'easy'], ['tree', 'tree', '樹', 'easy'],
      ['flower', 'flower', '花', 'easy'], ['bear', 'bear', '小熊', 'easy'],
      ['kid', 'kid', '小朋友', 'easy'], ['park', 'park', '公園', 'easy'],
      ['burger', 'burger', '漢堡', 'basic'], ['shop', 'shop', '商店', 'basic'],
      ['truck', 'truck', '貨車', 'basic'], ['picnic', 'picnic', '野餐', 'basic'],
      ['parcel', 'parcel', '包裹', 'puzzle'], ['tooth', 'tooth', '牙齒', 'puzzle'],
      ['toothbrush', 'toothbrush', '牙刷', 'puzzle'], ['bug-coral', 'bug', '蟲', 'puzzle'],
    ] as const;
    for (const [id, en, zh, band] of originals) {
      expect(WORD_BANK).toContainEqual({ id, en, zh, band });
    }
  });

  it('expands ordered nested pools to at least 16/32/48 words with enough for every deal', () => {
    const bands = ['easy', 'basic', 'puzzle'] as const;
    const minimums = [16, 32, 48];
    for (const [index, band] of bands.entries()) {
      const pool = STICKER_POOL[band];
      expect(pool.length).toBeGreaterThanOrEqual(minimums[index]!);
      expect(pool.length).toBeGreaterThanOrEqual(STICKER_LOAD_COUNT[band]);
      expect(pool).toEqual(WORD_BANK.filter((entry) => bands.indexOf(entry.band) <= index).map(({ id }) => id));
    }
    expect(STICKER_POOL.easy).toEqual(EASY_POOL);
    expect(STICKER_POOL.basic).toEqual(BASIC_POOL);
    expect(STICKER_POOL.puzzle).toEqual(PUZZLE_POOL);
    expect(EASY_POOL.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(BASIC_POOL.every((id) => PUZZLE_POOL.includes(id))).toBe(true);
    expect(PUZZLE_POOL).toEqual(WORD_IDS);
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

    for (const [level, pool] of [[0, EASY_POOL], [1, BASIC_POOL], [8, PUZZLE_POOL]] as const) {
      const seen = new Set(Array.from({ length: 80 }, (_, seed) => dealBoard(seed, level).slots).flat());
      expect([...seen].every((id) => pool.includes(id))).toBe(true);
      expect(seen.size).toBeGreaterThan(stickerWordCount(level));
    }
  });

  it('prefers unused pool words, then recent-in-pool, and never leaves the band', () => {
    const avoid = ['car', 'home', 'tree'] as const;
    const next = dealBoard(3, 0, avoid);
    expect(next.slots).toHaveLength(4);
    expect(next.slots.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(next.slots.some((id) => (avoid as readonly string[]).includes(id))).toBe(false);

    const recentEasy = EASY_POOL.slice(0, -2);
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
    expect(play).toContain('formatStageChip');
    expect(play).toContain('`${matched.value} / ${words.value.length}`');
    expect(play).toContain(':data-stage-chip="stageChip"');
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

describe('sticker hear-then-drag', () => {
  const speech = {
    getVoices: () => [{ lang: 'en-US', name: 'Samantha' } as SpeechSynthesisVoice],
    cancel: vi.fn(),
    speak: vi.fn(),
    addEventListener: vi.fn(),
  };

  function mapStorage(map: Map<string, string>, fail = false): Storage {
    const blocked = () => {
      throw new Error('storage blocked');
    };
    return {
      get length() { return map.size; },
      clear() { if (fail) blocked(); map.clear(); },
      getItem(key: string) {
        if (fail) blocked();
        return map.get(key) ?? null;
      },
      key(index: number) {
        if (fail) blocked();
        return [...map.keys()][index] ?? null;
      },
      removeItem(key: string) {
        if (fail) blocked();
        map.delete(key);
      },
      setItem(key: string, value: string) {
        if (fail) blocked();
        map.set(key, value);
      },
    };
  }

  beforeEach(() => {
    speech.cancel.mockReset();
    speech.speak.mockReset();
    speech.getVoices = () => [{ lang: 'en-US', name: 'Samantha' } as SpeechSynthesisVoice];
    vi.resetModules();
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      voice: SpeechSynthesisVoice | null = null;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(public text: string) {}
    });
    vi.stubGlobal('window', { speechSynthesis: speech });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('speaks the English word on tap, repeats, and stays quiet when muted', async () => {
    const source = readFileSync(join(root, 'src/sticker/hear.ts'), 'utf8');
    expect(source).toContain('speakEnglish(soundOn, WORD_EN[id])');
    expect(source).not.toMatch(/speakEnglish\(\s*soundOn\s*,\s*id\s*\)/);
    expect(source).not.toMatch(/from ['"]vue['"]/);

    const { speakStickerWord } = await import('../src/sticker/hear');
    speakStickerWord(true, 'bug-coral');
    speakStickerWord(true, 'bug-coral');
    expect(speech.speak).toHaveBeenCalledTimes(2);
    const texts = speech.speak.mock.calls.map((call) => (call[0] as SpeechSynthesisUtterance).text);
    expect(texts).toEqual(['bug', 'bug']);

    speech.speak.mockClear();
    speakStickerWord(false, 'bug-coral');
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('hints the sticker’s own slot and names its English word after a wrong drop', async () => {
    const { wrongDropFeedback } = await import('../src/sticker/hear');
    const feedback = wrongDropFeedback('car');
    expect(feedback.hintSlot).toBe('car');
    expect(feedback.speakId).toBe('car');
    expect(feedback.message).toContain('car');
    expect(wrongDropFeedback('bug-coral').message).toContain('bug');
  });

  it('shows onboarding once and treats a throwing store as unseen', async () => {
    const { STICKER_ONBOARD_KEY, markStickerOnboardSeen, readStickerOnboardSeen } = await import('../src/sticker/hear');
    const map = new Map<string, string>();
    const store = mapStorage(map);
    expect(readStickerOnboardSeen(store)).toBe(false);
    markStickerOnboardSeen(store);
    expect(readStickerOnboardSeen(store)).toBe(true);
    expect(map.get(STICKER_ONBOARD_KEY)).toBe('1');

    const throwing = mapStorage(new Map(), true);
    expect(() => readStickerOnboardSeen(throwing)).not.toThrow();
    expect(readStickerOnboardSeen(throwing)).toBe(false);
    expect(() => markStickerOnboardSeen(throwing)).not.toThrow();
  });

  it('keeps the first-time onboard line and tap-to-hear copy', () => {
    expect(STICKER_COPY.onboard).toBe('先撳貼紙聽，再拉過去');
    expect(STICKER_COPY.onboardSkip).toBe('知道了');
    expect(STICKER_COPY.tapHint).toBe('撳貼紙可以聽英文');
    expect(STICKER_COPY.guideSub).toContain('撳貼紙可以聽');
    expect(STICKER_COPY.controls).toContain('撳貼紙可以聽英文');
    expect(STICKER_COPY.controls).toContain('可以再拖');
    expect(STICKER_COPY.controls).not.toContain('放對後仍可拖出來重放');
    expect(JSON.stringify(STICKER_COPY)).not.toMatch(claims);
  });

  it('wires tap-to-hear before drag, locks a correct sticker, and hints a wrong drop without failing', () => {
    const play = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    expect(play).toContain('speakStickerWord');
    expect(play).toContain('wrongDropFeedback');
    expect(play).toContain('readStickerOnboardSeen');
    expect(play).toContain('markStickerOnboardSeen');
    expect(play).toContain('copy.onboard');
    expect(play).toContain('data-sticker-onboard');

    const onDown = play.slice(play.indexOf('function onDown'), play.indexOf('function onMove'));
    const speakAt = onDown.indexOf('speakStickerWord');
    const dragListenAt = onDown.indexOf("window.addEventListener('pointermove'");
    expect(speakAt).toBeGreaterThan(-1);
    expect(dragListenAt).toBeGreaterThan(speakAt);
    expect(onDown.slice(speakAt, dragListenAt)).not.toContain('return');
    expect(onDown.indexOf('if (!playing.value) return;')).toBeLessThan(onDown.indexOf('initAudio(soundOn.value)'));
    expect(onDown.indexOf('initAudio(soundOn.value)')).toBeLessThan(speakAt);
    expect(onDown).not.toMatch(/heard|listenedBefore|mustListen|先聽過/);

    const slotSection = play.slice(play.indexOf('class="slot-sticker"'), play.indexOf('class="word-label"'));
    expect(slotSection).not.toContain('@pointerdown');
    expect(play).toContain('@keydown.enter');
    expect(play).toContain('@keydown.space');
    expect(play).toContain('撳聽');
    expect(play).toContain('feedback.message');
    expect(play).toContain('hint: hintSlot === word');
    expect(play).toContain('1600');
    expect(play).not.toMatch(/overlay\.value\s*=\s*['"]fail['"]/);

    const dealLevel = play.slice(play.indexOf('function dealLevel'), play.indexOf('function slotAtPoint'));
    const unmounted = play.slice(play.indexOf('onUnmounted'), play.indexOf('</script>'));
    expect(dealLevel).toContain('clearTimeout(hintTimer)');
    expect(unmounted).toContain('clearTimeout(hintTimer)');
  });
});
