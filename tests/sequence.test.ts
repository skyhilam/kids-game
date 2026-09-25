import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sprites } from '../src/art/sprites';
import { mazeLoadBand, parentCopy, sequenceLoadBand, STAGE_LABEL } from '../src/game/stages';
import { SEQUENCE_COPY } from '../src/sequence/copy';
import {
  BASIC_STORIES,
  dealSequence,
  EASY_STORIES,
  emptySlots,
  filledCount,
  isFull,
  isOrdered,
  judgeWhenFull,
  placeInLeftmost,
  PUZZLE_STORIES,
  removeFromSlot,
  rollRecentStories,
  SEQUENCE_LOAD_COUNT,
  SEQUENCE_POOL,
  SEQUENCE_RECENT,
  SEQUENCE_STORIES,
  sequenceStepCount,
  type SequenceStoryId,
} from '../src/sequence/stories';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const claims = /貼紙冊|100 枚|智商|智力|大腦|腦部|年齡標準/;

describe('sequence bands, N, and stories', () => {
  it('uses the same load-band thresholds as mazes', () => {
    expect(sequenceLoadBand(0)).toBe('easy');
    expect(sequenceLoadBand(1)).toBe(mazeLoadBand(1));
    expect(sequenceLoadBand(7)).toBe('basic');
    expect(sequenceLoadBand(8)).toBe(mazeLoadBand(8));
    expect(sequenceLoadBand(0)).toBe(mazeLoadBand(0));
    expect(sequenceLoadBand(20)).toBe(mazeLoadBand(20));
    expect(STAGE_LABEL[sequenceLoadBand(0)]).toBe('簡單');
    expect(STAGE_LABEL[sequenceLoadBand(3)]).toBe('基礎');
    expect(STAGE_LABEL[sequenceLoadBand(9)]).toBe('益智');
    for (const index of [0, 1, 3, 7, 8, 9, 20]) {
      expect(sequenceLoadBand(index)).toBe(mazeLoadBand(index));
    }
  });

  it('uses step counts easy 3 / basic 4 / puzzle 5', () => {
    expect(SEQUENCE_LOAD_COUNT.easy).toBe(3);
    expect(SEQUENCE_LOAD_COUNT.basic).toBe(4);
    expect(SEQUENCE_LOAD_COUNT.puzzle).toBe(5);
    expect(sequenceStepCount(0)).toBe(3);
    expect(sequenceStepCount(1)).toBe(4);
    expect(sequenceStepCount(7)).toBe(4);
    expect(sequenceStepCount(8)).toBe(5);
    expect(sequenceStepCount(9)).toBe(5);
  });

  it('keeps acceptance stories, labels, and existing sprites', () => {
    expect(EASY_STORIES.map((story) => story.id)).toEqual([
      'picnic-basic', 'drive-park', 'kid-brush', 'farm-pets', 'farm-pond',
    ]);
    expect(BASIC_STORIES.map((story) => story.id)).toEqual([
      'picnic-shop', 'picnic-spread', 'delivery-short', 'farm-visit', 'farm-barn',
    ]);
    expect(PUZZLE_STORIES.map((story) => story.id)).toEqual([
      'picnic-full', 'picnic-burger', 'delivery-day', 'farm-day', 'farm-yard',
    ]);
    expect(SEQUENCE_POOL.easy).toEqual(EASY_STORIES);
    expect(SEQUENCE_POOL.basic).toEqual(BASIC_STORIES);
    expect(SEQUENCE_POOL.puzzle).toEqual(PUZZLE_STORIES);
    expect(EASY_STORIES).toHaveLength(5);
    expect(BASIC_STORIES).toHaveLength(5);
    expect(PUZZLE_STORIES).toHaveLength(5);
    expect(SEQUENCE_STORIES).toHaveLength(15);

    const expected: Record<SequenceStoryId, string[]> = {
      'picnic-basic': ['home家', 'burger漢堡', 'park公園'],
      'drive-park': ['home家', 'car小車', 'park公園'],
      'kid-brush': ['kid小朋友', 'toothbrush牙刷', 'tooth牙齒'],
      'farm-pets': ['dog狗', 'cat貓', 'rabbit兔'],
      'farm-pond': ['duck鴨', 'frog青蛙', 'tortoise龜'],
      'picnic-shop': ['home家', 'shop商店', 'burger漢堡', 'park公園'],
      'picnic-spread': ['home家', 'car小車', 'park公園', 'picnic野餐'],
      'delivery-short': ['truck貨車', 'parcel包裹', 'home家', 'park公園'],
      'farm-visit': ['chicken雞', 'chick小雞', 'duck鴨', 'frog青蛙'],
      'farm-barn': ['dog狗', 'sheep羊', 'pig豬', 'cow牛'],
      'picnic-full': ['home家', 'car小車', 'shop商店', 'park公園', 'picnic野餐'],
      'picnic-burger': ['home家', 'burger漢堡', 'car小車', 'park公園', 'picnic野餐'],
      'delivery-day': ['truck貨車', 'parcel包裹', 'shop商店', 'home家', 'park公園'],
      'farm-day': ['kid小朋友', 'dog狗', 'sheep羊', 'cow牛', 'horse馬'],
      'farm-yard': ['cat貓', 'chicken雞', 'duck鴨', 'frog青蛙', 'bird鳥'],
    };

    for (const story of EASY_STORIES) expect(story.steps).toHaveLength(3);
    for (const story of BASIC_STORIES) expect(story.steps).toHaveLength(4);
    for (const story of PUZZLE_STORIES) expect(story.steps).toHaveLength(5);
    const farmStoryIds = new Set([
      'farm-pets', 'farm-pond', 'farm-visit', 'farm-barn', 'farm-day', 'farm-yard',
    ]);
    const kidFarmStories = new Set(['farm-day']);
    for (const story of SEQUENCE_STORIES) {
      expect(story.steps.map((step) => `${step.sprite}${step.label}`)).toEqual(expected[story.id]);
      expect(new Set(story.steps.map((step) => step.sprite)).size).toBe(story.steps.length);
      for (const step of story.steps) {
        expect(sprites).toHaveProperty(step.sprite);
        if (farmStoryIds.has(story.id)) {
          if (step.sprite === 'kid') expect(kidFarmStories.has(story.id)).toBe(true);
          else expect(sprites[step.sprite].atlas).toBe('farm');
        }
      }
    }
  });
});

const FARM_VISIT_NARRATION = '雞媽媽先帶路，小雞跟住媽媽，去到水邊先見鴨，再見到青蛙。';

describe('farm-visit 語意 v2', () => {
  it('orders chicken, chick, duck, then frog and keeps the duck-before-frog beat', () => {
    const visit = BASIC_STORIES.find((story) => story.id === 'farm-visit');
    expect(visit?.steps.map((step) => step.sprite)).toEqual(['chicken', 'chick', 'duck', 'frog']);
    expect(visit?.steps.map((step) => step.label)).toEqual(['雞', '小雞', '鴨', '青蛙']);
    expect(visit?.narration).toBe(FARM_VISIT_NARRATION);
    const narration = visit?.narration ?? '';
    for (const beat of ['雞媽媽先帶路', '小雞跟住媽媽', '去到水邊先見鴨', '再見到青蛙']) {
      expect(narration).toContain(beat);
    }
    expect(narration.indexOf('去到水邊先見鴨')).toBeLessThan(narration.indexOf('再見到青蛙'));
    expect(narration.indexOf('鴨')).toBeLessThan(narration.indexOf('青蛙'));

    const spritesInStory = visit?.steps.map((step) => step.sprite) ?? [];
    expect(spritesInStory).not.toContain('kid');
    expect(spritesInStory).not.toContain('toothbrush');
    expect(spritesInStory.every((name) => sprites[name].atlas === 'farm')).toBe(true);
    expect(SEQUENCE_STORIES.filter((story) => story.narration).map((story) => story.id)).toEqual(['farm-visit']);
  });

  it('deals a four-animal farm tray and still judges wrong order as a soft miss', () => {
    let seed = -1;
    for (let candidate = 0; candidate < 2000; candidate += 1) {
      if (dealSequence(candidate, 1).id === 'farm-visit') {
        seed = candidate;
        break;
      }
    }
    expect(seed).toBeGreaterThanOrEqual(0);
    const deal = dealSequence(seed, 1);
    expect(deal.narration).toBe(FARM_VISIT_NARRATION);
    expect(deal.tray.map((step) => step.sprite).sort()).toEqual(['chick', 'chicken', 'duck', 'frog']);
    expect(deal.tray.some((step) => step.sprite === 'kid' || step.sprite === 'toothbrush')).toBe(false);

    const story = deal.steps;
    const correct = story.map((step) => step.sprite);
    expect(correct.indexOf('duck')).toBeLessThan(correct.indexOf('frog'));
    expect(judgeWhenFull(correct, story)).toBe('correct');
    expect(isOrdered(correct, story)).toBe(true);

    const wrongOrder = [...correct].reverse();
    let slots = emptySlots(story.length);
    for (const sprite of wrongOrder) slots = placeInLeftmost(slots, sprite);
    expect(slots).toEqual(['frog', 'duck', 'chick', 'chicken']);
    expect(judgeWhenFull(slots, story)).toBe('wrong');
    expect(isFull(slots)).toBe(true);
    expect(judgeWhenFull([...correct.slice(0, 3), null], story)).toBe('incomplete');

    for (let index = 0; index < slots.length; index += 1) slots = removeFromSlot(slots, index);
    expect(slots.every((slot) => slot === null)).toBe(true);
    expect(judgeWhenFull(slots, story)).toBe('incomplete');
    for (const sprite of correct) slots = placeInLeftmost(slots, sprite);
    expect(judgeWhenFull(slots, story)).toBe('correct');
  });

  it('keeps farm-pond and farm-barn on their own orders', () => {
    const pond = EASY_STORIES.find((story) => story.id === 'farm-pond');
    const barn = BASIC_STORIES.find((story) => story.id === 'farm-barn');
    expect(pond?.steps.map((step) => `${step.sprite}${step.label}`)).toEqual(['duck鴨', 'frog青蛙', 'tortoise龜']);
    expect(pond?.narration).toBeUndefined();
    expect(barn?.steps.map((step) => `${step.sprite}${step.label}`)).toEqual(['dog狗', 'sheep羊', 'pig豬', 'cow牛']);
    expect(barn?.narration).toBeUndefined();
    expect(judgeWhenFull(pond!.steps.map((step) => step.sprite), pond!.steps)).toBe('correct');
    expect(judgeWhenFull(barn!.steps.map((step) => step.sprite), barn!.steps)).toBe('correct');
    expect(judgeWhenFull(['frog', 'duck', 'tortoise'], pond!.steps)).toBe('wrong');
  });

  it('shows the tray narration from the deal and leaves the SequencePlay judge path unchanged', () => {
    const play = readFileSync(join(root, 'src/components/SequencePlay.vue'), 'utf8');
    expect(play).toContain('data-sequence-narration');
    expect(play).toContain('{{ board.narration }}');
    expect(play).toContain('judgeWhenFull(next, board.value.steps)');
    expect(play).toContain('message.value = copy.wrong');
    expect(play).toContain("playCue(soundOn.value, 'hint')");
    expect(play).not.toContain('farm-visit');
    const mobile = play.slice(play.indexOf('@media(max-width:700px)'));
    expect(mobile).toContain('.sequence-narration{font-size:13px;padding:8px 10px}');
    expect(mobile).not.toContain('.sequence-narration{display:none');
  });
});

describe('sequence deal and anti-repeat', () => {
  it('deals N unique tray cards from the band story', () => {
    const easy = dealSequence(7, 0);
    const basic = dealSequence(7, 1);
    const puzzle = dealSequence(7, 8);
    expect(easy.steps).toHaveLength(3);
    expect(easy.tray).toHaveLength(3);
    expect(basic.steps).toHaveLength(4);
    expect(basic.tray).toHaveLength(4);
    expect(puzzle.steps).toHaveLength(5);
    expect(puzzle.tray).toHaveLength(5);
    expect([...easy.steps].map((step) => step.sprite).sort()).toEqual(
      [...easy.tray].map((step) => step.sprite).sort(),
    );
    expect(EASY_STORIES.some((story) => story.id === easy.id)).toBe(true);
    expect(BASIC_STORIES.some((story) => story.id === basic.id)).toBe(true);
    expect(PUZZLE_STORIES.some((story) => story.id === puzzle.id)).toBe(true);
    expect(dealSequence(7, 0)).toEqual(easy);
    expect(dealSequence(7)).toEqual(easy);

    const easySeen = new Set(Array.from({ length: 24 }, (_, seed) => dealSequence(seed, 0).id));
    expect(easySeen.size).toBeGreaterThan(1);
    expect([...easySeen].every((id) => EASY_STORIES.some((story) => story.id === id))).toBe(true);
  });

  it('avoids the last SEQUENCE_RECENT stories when the pool still has remainder', () => {
    expect(SEQUENCE_RECENT).toBe(2);
    const first = dealSequence(100, 0);
    let recent = rollRecentStories([], first.id);
    const second = dealSequence(117, 0, recent);
    expect(second.id).not.toBe(first.id);
    expect(EASY_STORIES.some((story) => story.id === second.id)).toBe(true);
    expect(dealSequence(117, 0, recent)).toEqual(second);

    recent = rollRecentStories(recent, second.id);
    expect(recent).toHaveLength(2);
    const third = dealSequence(200, 0, recent);
    expect(third.id).not.toBe(first.id);
    expect(third.id).not.toBe(second.id);

    const forced = dealSequence(5, 0, EASY_STORIES.map((story) => story.id));
    expect(EASY_STORIES.some((story) => story.id === forced.id)).toBe(true);
    expect(forced.steps).toHaveLength(3);

    recent = rollRecentStories(recent, third.id);
    const basic = dealSequence(311, 1, recent);
    expect(basic.steps).toHaveLength(4);
    expect(BASIC_STORIES.some((story) => story.id === basic.id)).toBe(true);
  });

  it('deals farm stories across bands and keeps easy consecutive deals distinct', () => {
    const deals = Array.from({ length: 24 }, (_, seed) => {
      const level = seed % 3 === 0 ? 0 : seed % 3 === 1 ? 1 : 8;
      return dealSequence(seed + 10, level);
    });
    expect(deals.length).toBeGreaterThanOrEqual(8);
    expect(deals.some((deal) => deal.id.startsWith('farm-'))).toBe(true);

    let recent: SequenceStoryId[] = [];
    const easyIds: SequenceStoryId[] = [];
    for (let i = 0; i < 5; i += 1) {
      const deal = dealSequence(1000 + i * 31, 0, recent);
      easyIds.push(deal.id);
      recent = rollRecentStories(recent, deal.id);
    }
    expect(easyIds).toHaveLength(5);
    expect(new Set(easyIds).size).toBeGreaterThan(1);
    for (let i = 1; i < easyIds.length; i += 1) {
      expect(easyIds[i]).not.toBe(easyIds[i - 1]);
    }
  });
});

describe('sequence place, remove, and judge', () => {
  it('places into the leftmost empty slot and returns a card to the tray', () => {
    const deal = dealSequence(3, 0);
    let slots = emptySlots(deal.steps.length);
    expect(filledCount(slots)).toBe(0);
    expect(isFull(slots)).toBe(false);
    expect(judgeWhenFull(slots, deal.steps)).toBe('incomplete');

    slots = placeInLeftmost(slots, deal.tray[0]!.sprite);
    expect(slots[0]).toBe(deal.tray[0]!.sprite);
    expect(filledCount(slots)).toBe(1);
    expect(judgeWhenFull(slots, deal.steps)).toBe('incomplete');

    slots = placeInLeftmost(slots, deal.tray[1]!.sprite);
    expect(slots[1]).toBe(deal.tray[1]!.sprite);
    expect(slots[0]).toBe(deal.tray[0]!.sprite);

    const same = placeInLeftmost(slots, deal.tray[0]!.sprite);
    expect(same).toEqual(slots);

    slots = removeFromSlot(slots, 0);
    expect(slots[0]).toBeNull();
    expect(slots[1]).toBe(deal.tray[1]!.sprite);
    expect(filledCount(slots)).toBe(1);
  });

  it('does not judge until full, then reports ordered or wrong without clearing', () => {
    const story = EASY_STORIES[0]!;
    const slots = emptySlots(3);
    const first = placeInLeftmost(slots, story.steps[2]!.sprite);
    const second = placeInLeftmost(first, story.steps[1]!.sprite);
    expect(judgeWhenFull(second, story.steps)).toBe('incomplete');
    expect(isOrdered(second, story.steps)).toBe(false);

    const wrong = placeInLeftmost(second, story.steps[0]!.sprite);
    expect(isFull(wrong)).toBe(true);
    expect(judgeWhenFull(wrong, story.steps)).toBe('wrong');
    expect(wrong).toEqual([
      story.steps[2]!.sprite,
      story.steps[1]!.sprite,
      story.steps[0]!.sprite,
    ]);

    const right = story.steps.map((step) => step.sprite);
    expect(isOrdered(right, story.steps)).toBe(true);
    expect(judgeWhenFull(right, story.steps)).toBe('correct');
  });
});

describe('sequence copy, parent guide, and hub card', () => {
  it('keeps the three sequence parent-copy bands pairwise distinct', () => {
    expect(parentCopy.sequence.easy).toEqual({
      goal: '用 3 個步驟練習「邊樣先、邊樣後」，點選排出次序。',
      ask: '「我哋先去邊？之後呢？」',
      show: '家長示範點第一張放入槽 1，之後交返孩子排其餘。',
    });
    expect(parentCopy.sequence.basic).toEqual({
      goal: '用 4 個步驟排出完整出遊；中間可能多一站（商店／坐車）。',
      ask: '「邊兩步好似好近？邊個要先做？」',
      show: '家長指出兩個可能調轉嘅步驟，唔代排；等孩子講完再自己點。',
    });
    expect(parentCopy.sequence.puzzle).toEqual({
      goal: '用 5 個步驟排出較長出遊；出發前先想成條序。',
      ask: '「出發前你想點排？有冇一步放錯就去唔到公園？」',
      show: '家長用手指空劃一次正確序（唔代點），再交孩子；卡住先提示由左睇到右。',
    });
    const bands = ['easy', 'basic', 'puzzle'] as const;
    for (let i = 0; i < bands.length; i += 1) {
      for (let j = i + 1; j < bands.length; j += 1) {
        const left = parentCopy.sequence[bands[i]!];
        const right = parentCopy.sequence[bands[j]!];
        expect(left).not.toEqual(right);
        expect(left.goal).not.toBe(right.goal);
        expect(left.ask).not.toBe(right.ask);
        expect(left.show).not.toBe(right.show);
        expect(SEQUENCE_COPY.parent[bands[i]!]).not.toBe(SEQUENCE_COPY.parent[bands[j]!]);
      }
    }
  });

  it('keeps sequence copy free of sticker-book, timer, score, and dual-language TTS claims', () => {
    expect(JSON.stringify({ SEQUENCE_COPY, parent: parentCopy.sequence })).not.toMatch(claims);
    expect(SEQUENCE_COPY.title).toBe('出遊順序卡');
    expect(SEQUENCE_COPY.subtitle).toBe('依序點選步驟，排出正確出遊次序。');
    expect(SEQUENCE_COPY.mission).toBe('依序點選步驟，排出正確出遊次序。');
    expect(SEQUENCE_COPY.wrong).toBe('次序未啱，可以點卡改一改。');
    expect(SEQUENCE_COPY.next).toBe('下一關');
    expect(SEQUENCE_COPY.replay).toBe('再玩本關');
    expect(SEQUENCE_COPY.home).toBe('回 Hub');
    expect(SEQUENCE_COPY.footer).toEqual(['從容遊玩', '不計時 · 不扣分', '點選排序']);
    expect(SEQUENCE_COPY.welcomeBody).not.toMatch(/English|粵語|雙語|TTS/);
    expect(SEQUENCE_COPY.controls).not.toMatch(/English|粵語|拖曳|拖/);
    expect(SEQUENCE_COPY.parent.easy).toContain(parentCopy.sequence.easy.goal);
    expect(SEQUENCE_COPY.parent.basic).toContain(parentCopy.sequence.basic.ask);
    expect(SEQUENCE_COPY.parent.puzzle).toContain(parentCopy.sequence.puzzle.show);
  });

  it('adds a sixth hub card without drag or listen TTS changes', () => {
    const hub = readFileSync(join(root, 'src/components/Hub.vue'), 'utf8');
    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    const play = readFileSync(join(root, 'src/components/SequencePlay.vue'), 'utf8');
    const listen = readFileSync(join(root, 'src/components/ListenPlay.vue'), 'utf8');
    expect(hub).toMatch(/<strong>出遊順序卡<\/strong>/);
    expect(hub).toContain('依序點選步驟，排出正確出遊次序。');
    expect(hub).toContain('點選排序');
    expect(hub).toMatch(/emit\('pick', 'sequence'\)/);
    expect(hub).toContain('name="home"');
    expect(hub).toContain('name="burger"');
    expect(hub).toContain('name="park"');
    expect([...hub.matchAll(/class="hub-card"/g)]).toHaveLength(6);
    expect([...hub.matchAll(/class="hub-stages"/g)]).toHaveLength(3);
    expect(hub).toContain('聽一聽揀圖');
    expect(hub).toContain('貼紙學單字');
    expect(app).toMatch(/activity === 'sequence'/);
    expect(app).toContain('SequencePlay');
    expect(play).toContain('sequenceLoadBand');
    expect(play).toContain('parentCopy.sequence');
    expect(play).toContain('copy.parent[stageBand]');
    expect(play).toMatch(/第 \{\{ level \+ 1 \}\} 關/);
    expect(play).toContain('formatStageChip');
    expect(play).toContain('`${filled.value} / ${board.value.steps.length}`');
    expect(play).toContain(':data-stage-chip="stageChip"');
    expect(play).toContain('@click="onTrayTap(step.sprite)"');
    expect(play).toContain('@click="onSlotTap(index)"');
    expect(play).not.toMatch(/pointerdown|pointermove|sticker-float|draggable|@drag/);
    expect(play).not.toMatch(/speakEnglish|speakListenWord|speak\(/);
    expect(play).toContain("playCue(soundOn.value, 'collect')");
    expect(play).toContain("playCue(soundOn.value, 'hint')");
    expect(play).toContain("playCue(soundOn.value, 'win')");
    expect(play).toContain('usePlayAudio');
    expect(play).toContain('>任務<');
    expect(play).toContain('>操作<');
    expect(play).toContain('>家長<');
    expect(play).toContain('下一關');
    expect(play).toContain('回 Hub');
    expect(play).toContain('copy.wrong');
    expect(play).toContain('judgeWhenFull');
    expect(play).toContain('rollRecentStories');
    expect(listen).toContain('speakListenWord(soundOn.value, listenLang.value, board.value.target)');
    expect(listen).toContain("setListenLang('en')");
    expect(listen).toContain("setListenLang('yue')");

    const picnic = readFileSync(join(root, 'src/components/PicnicPlay.vue'), 'utf8');
    const tooth = readFileSync(join(root, 'src/components/ToothPlay.vue'), 'utf8');
    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    const sticker = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    expect(picnic).toContain('一起去野餐');
    expect(tooth).toContain('打敗蛀牙蟲');
    expect(delivery).toContain('送貨員來了');
    expect(sticker).toContain('stickerLoadBand');
    expect(picnic + tooth + delivery + sticker + listen).not.toMatch(/sequence\/stories|出遊順序卡/);
  });
});
