import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mazeLoadBand, parentCopy, STAGE_LABEL, stickerLoadBand } from '../src/game/stages';
import { LISTEN_COPY } from '../src/listen/copy';
import {
  dealListen,
  LISTEN_LOAD,
  LISTEN_RECENT,
  listenLoadBand,
  listenOptionCount,
  listenStreakNeed,
  rollRecentTargets,
  similarityPeers,
  tryListenTap,
} from '../src/listen/deal';
import { BASIC_POOL, EASY_POOL, PUZZLE_POOL, STICKER_POOL } from '../src/sticker/words';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const claims = /貼紙冊|100 枚|智商|智力|大腦|腦部|年齡標準/;

describe('listen bands, N/K, and deals', () => {
  it('uses the same load-band thresholds as mazes and sticker', () => {
    expect(listenLoadBand(0)).toBe('easy');
    expect(listenLoadBand(1)).toBe(mazeLoadBand(1));
    expect(listenLoadBand(7)).toBe('basic');
    expect(listenLoadBand(8)).toBe(mazeLoadBand(8));
    expect(listenLoadBand(3)).toBe(stickerLoadBand(3));
    expect(listenLoadBand(0)).toBe(mazeLoadBand(0));
    expect(listenLoadBand(20)).toBe(mazeLoadBand(20));
    expect(STAGE_LABEL[listenLoadBand(0)]).toBe('簡單');
    expect(STAGE_LABEL[listenLoadBand(3)]).toBe('基礎');
    expect(STAGE_LABEL[listenLoadBand(9)]).toBe('益智');
  });

  it('uses N/K 3/3, 4/4, 6/5', () => {
    expect(LISTEN_LOAD.easy).toEqual({ n: 3, k: 3 });
    expect(LISTEN_LOAD.basic).toEqual({ n: 4, k: 4 });
    expect(LISTEN_LOAD.puzzle).toEqual({ n: 6, k: 5 });
    expect(listenOptionCount(0)).toBe(3);
    expect(listenStreakNeed(0)).toBe(3);
    expect(listenOptionCount(1)).toBe(4);
    expect(listenStreakNeed(7)).toBe(4);
    expect(listenOptionCount(8)).toBe(6);
    expect(listenStreakNeed(9)).toBe(5);
  });

  it('deals exactly one target and N unique options from the band pool', () => {
    const easy = dealListen(7, 0);
    const basic = dealListen(7, 1);
    const puzzle = dealListen(7, 8);
    expect(easy.options).toHaveLength(3);
    expect(basic.options).toHaveLength(4);
    expect(puzzle.options).toHaveLength(6);
    expect(easy.options.filter((id) => id === easy.target)).toHaveLength(1);
    expect(basic.options.filter((id) => id === basic.target)).toHaveLength(1);
    expect(puzzle.options.filter((id) => id === puzzle.target)).toHaveLength(1);
    expect(new Set(easy.options).size).toBe(3);
    expect(new Set(puzzle.options).size).toBe(6);
    expect(easy.options.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(basic.options.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(puzzle.options.every((id) => PUZZLE_POOL.includes(id))).toBe(true);
    expect(easy.options.includes(easy.target)).toBe(true);
    expect(dealListen(7, 0)).toEqual(easy);
    expect(dealListen(7)).toEqual(easy);

    const laterTheme = ['burger', 'shop', 'truck', 'picnic', 'parcel', 'tooth', 'toothbrush', 'bug-coral'] as const;
    const easySeen = new Set(Array.from({ length: 48 }, (_, seed) => dealListen(seed, 0).options).flat());
    expect(laterTheme.every((id) => !easySeen.has(id))).toBe(true);

    const basicSeen = new Set(Array.from({ length: 80 }, (_, seed) => dealListen(seed, 1).options).flat());
    expect(basicSeen.has('burger') || basicSeen.has('shop') || basicSeen.has('truck')).toBe(true);
    expect((['parcel', 'tooth', 'toothbrush', 'bug-coral'] as const).every((id) => !basicSeen.has(id))).toBe(true);

    const puzzleSeen = new Set(Array.from({ length: 80 }, (_, seed) => dealListen(seed, 8).options).flat());
    expect(puzzleSeen.has('toothbrush')).toBe(true);
  });

  it('forces a similarity distractor on basic/puzzle when a peer is in the band pool', () => {
    expect(similarityPeers('car', BASIC_POOL)).toEqual(['truck']);
    expect(similarityPeers('truck', BASIC_POOL)).toEqual(['car']);
    expect(similarityPeers('picnic', BASIC_POOL).sort()).toEqual(['burger', 'park']);
    expect(similarityPeers('burger', BASIC_POOL)).toEqual(['picnic']);
    expect(similarityPeers('sun', BASIC_POOL)).toEqual([]);
    expect(similarityPeers('tooth', PUZZLE_POOL)).toEqual(['toothbrush']);
    expect(similarityPeers('car', EASY_POOL)).toEqual([]);
    expect(similarityPeers('tree', EASY_POOL)).toEqual(['flower']);

    for (const seed of Array.from({ length: 80 }, (_, i) => i)) {
      const deal = dealListen(seed, 1);
      const peers = similarityPeers(deal.target, BASIC_POOL);
      if (peers.length > 0) {
        expect(deal.options.some((id) => peers.includes(id)), `${deal.target} @${seed}`).toBe(true);
      }
      expect(deal.options.every((id) => BASIC_POOL.includes(id))).toBe(true);
    }

    for (const seed of Array.from({ length: 80 }, (_, i) => i)) {
      const deal = dealListen(seed, 8);
      const peers = similarityPeers(deal.target, PUZZLE_POOL);
      if (peers.length > 0) {
        expect(deal.options.some((id) => peers.includes(id)), `${deal.target} @${seed}`).toBe(true);
      }
    }

    const noPeerSeeds = Array.from({ length: 60 }, (_, seed) => dealListen(seed, 1))
      .filter((deal) => similarityPeers(deal.target, BASIC_POOL).length === 0);
    expect(noPeerSeeds.length).toBeGreaterThan(0);
    expect(noPeerSeeds.every((deal) => deal.options.length === 4)).toBe(true);
    expect(noPeerSeeds.every((deal) => deal.options.every((id) => BASIC_POOL.includes(id)))).toBe(true);
  });

  it('avoids the last LISTEN_RECENT targets when the pool still has unused words', () => {
    expect(LISTEN_RECENT).toBe(2);
    const first = dealListen(100, 0);
    let recent = rollRecentTargets([], first.target);
    const second = dealListen(117, 0, recent);
    expect(second.target).not.toBe(first.target);
    expect(second.options.every((id) => EASY_POOL.includes(id))).toBe(true);
    expect(dealListen(117, 0, recent)).toEqual(second);

    recent = rollRecentTargets(recent, second.target);
    expect(recent).toHaveLength(2);
    const third = dealListen(200, 0, recent);
    expect(third.target).not.toBe(first.target);
    expect(third.target).not.toBe(second.target);

    const forced = dealListen(5, 0, [...EASY_POOL]);
    expect(EASY_POOL.includes(forced.target)).toBe(true);
    expect(forced.options).toHaveLength(3);

    recent = rollRecentTargets(recent, third.target);
    const basic = dealListen(311, 1, recent);
    expect(basic.options).toHaveLength(4);
    expect(basic.options.every((id) => BASIC_POOL.includes(id))).toBe(true);
    expect(recent.includes(basic.target)).toBe(false);
  });

  it('counts K correct taps to clear and treats a wrong tap as retry', () => {
    expect(tryListenTap('car', 'tree', 0, 3)).toEqual({ kind: 'wrong' });
    expect(tryListenTap('car', 'car', 0, 3)).toEqual({ kind: 'correct', correct: 1, cleared: false });
    expect(tryListenTap('car', 'tree', 2, 3)).toEqual({ kind: 'wrong' });
    expect(tryListenTap('car', 'car', 2, 3)).toEqual({ kind: 'correct', correct: 3, cleared: true });
  });
});

describe('listen copy, parent guide, and hub card', () => {
  it('keeps the three listen parent-copy bands pairwise distinct', () => {
    expect(parentCopy.listen.easy).toEqual({
      goal: '聽完粵語詞，喺 3 張圖入面點啱嗰張。',
      ask: '「你聽到咩？邊張圖係佢？」',
      show: '家長播一次後，指住兩個候選圖（唔代點），再交返孩子自己揀。',
    });
    expect(parentCopy.listen.basic).toEqual({
      goal: '聽完詞，喺 4 張圖入面揀啱；可能有兩張好似（例如小車同貨車）。',
      ask: '「邊兩張好似？邊張先啱剛才聽到嗰個？」',
      show: '出現相似圖時，家長只指住相似嗰兩張，唔代點；等孩子講完再自己揀。',
    });
    expect(parentCopy.listen.puzzle).toEqual({
      goal: '聽完詞，喺 6 張圖入面揀啱；可能有較長詞（例如牙刷），要先聽清再揀。',
      ask: '「唔好急，你記住個詞未？要唔要再聽一次？」',
      show: '家長示範撳「再聽一次」，之後交返孩子；卡住先提示睇晒所有圖再揀。',
    });
    const bands = ['easy', 'basic', 'puzzle'] as const;
    for (let i = 0; i < bands.length; i += 1) {
      for (let j = i + 1; j < bands.length; j += 1) {
        const left = parentCopy.listen[bands[i]!];
        const right = parentCopy.listen[bands[j]!];
        expect(left).not.toEqual(right);
        expect(left.goal).not.toBe(right.goal);
        expect(left.ask).not.toBe(right.ask);
        expect(left.show).not.toBe(right.show);
        expect(LISTEN_COPY.parent[bands[i]!]).not.toBe(LISTEN_COPY.parent[bands[j]!]);
      }
    }
  });

  it('keeps listen copy free of sticker-book, timer, and score claims', () => {
    expect(JSON.stringify({ LISTEN_COPY, parent: parentCopy.listen })).not.toMatch(claims);
    expect(LISTEN_COPY.title).toBe('聽一聽揀圖');
    expect(LISTEN_COPY.subtitle).toBe('聽到詞之後，點啱嘅圖。');
    expect(LISTEN_COPY.listenAgain).toBe('再聽一次');
    expect(LISTEN_COPY.next).toBe('下一關');
    expect(LISTEN_COPY.replay).toBe('再玩本關');
    expect(LISTEN_COPY.home).toBe('回 Hub');
    expect(LISTEN_COPY.muted).toContain('靜音');
    expect(LISTEN_COPY.parent.easy).toContain(parentCopy.listen.easy.goal);
    expect(LISTEN_COPY.parent.basic).toContain(parentCopy.listen.basic.ask);
    expect(LISTEN_COPY.parent.puzzle).toContain(parentCopy.listen.puzzle.show);
  });

  it('adds a fifth hub card without rewriting the first four activities', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    const play = readFileSync(join(root, 'src/components/ListenPlay.vue'), 'utf8');
    expect(hub).toMatch(/<strong>聽一聽揀圖<\/strong>/);
    expect(hub).toContain('聽到詞之後，點啱嘅圖。');
    expect(hub).toContain('聽詞揀圖');
    expect(hub).toMatch(/emit\('pick', 'listen'\)/);
    expect(hub).toContain('name="kid"');
    expect([...hub.matchAll(/class="hub-card"/g)]).toHaveLength(5);
    expect([...hub.matchAll(/class="hub-stages"/g)]).toHaveLength(3);
    expect(hub).toContain('貼紙學單字');
    expect(hub).toContain('一起去野餐');
    expect(hub).toContain('打敗蛀牙蟲');
    expect(hub).toContain('送貨員來了');
    expect(app).toMatch(/activity === 'listen'/);
    expect(app).toContain('ListenPlay');
    expect(play).toContain('listenLoadBand');
    expect(play).toContain('parentCopy.listen');
    expect(play).toContain('copy.parent[stageBand]');
    expect(play).toMatch(/第 \{\{ level \+ 1 \}\} 關/);
    expect(play).toContain('{{ correct }} / {{ need }}');
    expect(play).toContain('再聽一次');
    expect(play).toContain('speak(soundOn.value, WORD_ZH[board.value.target])');
    expect(play).not.toContain('speakEnglish');
    expect(play).not.toMatch(/zh-CN|普通話/);
    expect(play).toContain('>任務<');
    expect(play).toContain('>操作<');
    expect(play).toContain('>家長<');
    expect(play).toContain('下一關');
    expect(play).toContain('回 Hub');
    expect(play).toContain('usePlayAudio');
    expect(play).not.toMatch(/貼紙冊|100 枚/);

    const picnic = readFileSync(join(root, 'src/components/PicnicPlay.vue'), 'utf8');
    const tooth = readFileSync(join(root, 'src/components/ToothPlay.vue'), 'utf8');
    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    const sticker = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    expect(picnic).toContain('一起去野餐');
    expect(tooth).toContain('打敗蛀牙蟲');
    expect(delivery).toContain('送貨員來了');
    expect(sticker).toContain('stickerLoadBand');
    expect(sticker).toContain('speakEnglish');
    expect(picnic + tooth + delivery + sticker).not.toMatch(/listen\/deal|聽一聽揀圖/);
    expect(STICKER_POOL.easy).toEqual(EASY_POOL);
  });
});
