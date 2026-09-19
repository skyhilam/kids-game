import { describe, expect, it } from 'vitest';
import { generateDeliveryMission } from '../src/delivery/generate';
import { DELIVERY_MISSION } from '../src/delivery/mission';
import {
  deliveryLoadBand,
  mazeLoadBand,
  parentCopy,
  STAGE_LABEL,
  STAGE_OVERVIEW,
  STAGE_PICK_INTRO,
  listenLoadBand,
  stickerLoadBand,
} from '../src/game/stages';

const claims = /貼紙冊|100 枚|智商|智力|大腦|腦部|年齡標準/;

describe('generator load bands and parent copy', () => {
  it('maps picnic/brush index onto the generator load band', () => {
    expect(mazeLoadBand(0)).toBe('easy');
    expect(mazeLoadBand(1)).toBe('basic');
    expect(mazeLoadBand(7)).toBe('basic');
    expect(mazeLoadBand(8)).toBe('puzzle');
    expect(mazeLoadBand(20)).toBe('puzzle');
    expect(STAGE_LABEL[mazeLoadBand(0)]).toBe('簡單');
    expect(STAGE_LABEL[mazeLoadBand(3)]).toBe('基礎');
    expect(STAGE_LABEL[mazeLoadBand(9)]).toBe('益智');
    expect(STAGE_OVERVIEW).toBe('簡單 · 基礎 · 益智');
  });

  it('labels delivery from the minted map, not a fixed name', () => {
    const compact = generateDeliveryMission(2);
    const wide = generateDeliveryMission(0);
    expect(Object.keys(compact.nodes)).toHaveLength(9);
    expect(Object.keys(wide.nodes)).toHaveLength(12);
    expect(deliveryLoadBand(compact)).toBe(compact.edges.length >= 10 ? 'basic' : 'easy');
    expect(deliveryLoadBand(wide)).toBe('puzzle');
    expect(deliveryLoadBand(compact)).not.toBe(deliveryLoadBand(wide));
    expect(deliveryLoadBand(DELIVERY_MISSION)).toBe('puzzle');
    expect(compact.name).toBe(wide.name);
    const seen = new Set(
      Array.from({ length: 24 }, (_, seed) => deliveryLoadBand(generateDeliveryMission(seed))),
    );
    expect(seen.has('easy') || seen.has('basic')).toBe(true);
    expect(seen.has('puzzle')).toBe(true);
  });

  it('keeps parentCopy[game][stage] for picnic/brush and a fixed delivery guide', () => {
    expect(parentCopy.picnic.easy.goal).toContain('出發點同公園');
    expect(parentCopy.picnic.basic.ask).toContain('漢堡店');
    expect(parentCopy.picnic.puzzle.show).toContain('先漢堡、再公園');
    expect(parentCopy.tooth.easy.goal).toContain('蛀牙蟲');
    expect(parentCopy.tooth.basic.ask).toContain('冇蛀牙蟲');
    expect(parentCopy.tooth.puzzle.show).toContain('橙色同蟲');
    expect(parentCopy.delivery.goal).toContain('三間屋');
    expect(parentCopy.delivery.ask).toContain('未送嘅係邊間屋');
    expect(parentCopy.delivery.show).toContain('點選路口');
    expect(parentCopy.delivery.load).toContain('點選較易入手');
    expect(STAGE_PICK_INTRO).toContain('三個階段');
    expect(STAGE_PICK_INTRO).toContain('不是年齡分級');
    expect(stickerLoadBand(0)).toBe('easy');
    expect(stickerLoadBand(3)).toBe(mazeLoadBand(3));
    expect(parentCopy.sticker.easy.goal).toBe('用 4 張短詞圖練習圖詞配對，睇圖搵英文詞。');
    expect(parentCopy.sticker.basic.goal).toBe('用 5 張圖練習；可能出現漢堡、商店、貨車等主題詞，仍唔計時唔扣分。');
    expect(parentCopy.sticker.puzzle.goal).toBe('用 6 張圖；可能混入較長詞（例如 toothbrush）或刷牙主題，一次記多幾個配對。');
    expect(parentCopy.sticker.easy.ask).toContain('呢張圖係咩？邊個英文詞？');
    expect(parentCopy.sticker.easy.show).toContain('家長拖一張放對並等英文讀出');
    expect(parentCopy.sticker.basic.ask).not.toBe(parentCopy.sticker.easy.ask);
    expect(parentCopy.sticker.puzzle.show).not.toBe(parentCopy.sticker.basic.show);
    expect(listenLoadBand(0)).toBe(mazeLoadBand(0));
    expect(listenLoadBand(8)).toBe(mazeLoadBand(8));
    expect(parentCopy.listen.easy.goal).toBe('聽完粵語詞，喺 3 張圖入面點啱嗰張。');
    expect(parentCopy.listen.basic.ask).toContain('邊兩張好似');
    expect(parentCopy.listen.puzzle.show).toContain('再聽一次');
    expect(parentCopy.listen.easy.goal).not.toBe(parentCopy.listen.basic.goal);
    expect(parentCopy.listen.basic.ask).not.toBe(parentCopy.listen.puzzle.ask);
    expect(JSON.stringify({ parentCopy, STAGE_PICK_INTRO })).not.toMatch(claims);
  });
});
