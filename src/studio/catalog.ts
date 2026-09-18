import type { SpriteName } from '../art/sprites';
import { generateMaze } from '../game/generate';
import { generateDeliveryMission } from '../delivery/generate';
import { deliveryLoadBand, mazeLoadBand, stickerLoadBand, STAGE_LABEL } from '../game/stages';
import { stickerWordCount, WORD_IDS } from '../sticker/words';

export const models = {
  car: { label: '小車', group: 'vehicle' },
  'car-top': { label: '小車・俯視', group: 'vehicle' },
  truck: { label: '送貨車', group: 'vehicle' },
  'truck-top': { label: '送貨車・俯視', group: 'vehicle' },
  burger: { label: '漢堡', group: 'food' },
  home: { label: '房子', group: 'building' },
  shop: { label: '漢堡店', group: 'building' },
  tree: { label: '樹', group: 'nature' },
  flower: { label: '花', group: 'nature' },
  sun: { label: '太陽', group: 'nature' },
  park: { label: '公園', group: 'scene' },
  'picnic-place': { label: '野餐地點', group: 'scene' },
  picnic: { label: '野餐完成', group: 'scene' },
  bear: { label: '小熊嚮導', group: 'character' },
  kid: { label: '刷牙小朋友', group: 'character' },
  'kid-cheer': { label: '歡呼小朋友', group: 'character' },
  courier: { label: '送貨員', group: 'character' },
  tooth: { label: '牙齒', group: 'tooth' },
  toothbrush: { label: '牙刷', group: 'tooth' },
  'bug-coral': { label: '珊瑚蛀牙蟲', group: 'bug' },
  'bug-purple': { label: '紫色蛀牙蟲', group: 'bug' },
  parcel: { label: '包裹', group: 'object' },
} as const satisfies Partial<Record<SpriteName, { label: string; group: string }>>;
export type ModelName = keyof typeof models;
export const modelNames = Object.keys(models) as ModelName[];
export const kits = {
  picnic: { title: '一起去野餐', short: '野餐小路', icon: 'car', sprites: ['car', 'car-top', 'burger', 'home', 'shop', 'tree', 'flower', 'sun', 'park', 'picnic-place', 'picnic', 'bear'] },
  tooth: { title: '打敗蛀牙蟲', short: '刷牙冒險', icon: 'tooth', sprites: ['kid', 'kid-cheer', 'tooth', 'toothbrush', 'bug-coral', 'bug-purple'] },
  delivery: { title: '送貨員來了', short: '送貨任務', icon: 'truck', sprites: ['truck', 'truck-top', 'parcel', 'courier', 'home', 'tree', 'flower', 'sun'] },
  sticker: { title: '貼紙學單字', short: '單字貼紙', icon: 'flower', sprites: WORD_IDS },
} as const satisfies Record<string, { title: string; short: string; icon: ModelName; sprites: readonly ModelName[] }>;
export type GameKind = keyof typeof kits;
export type StudioContext = { game: GameKind; level: number };
export function contextKey(context: StudioContext, sprite: ModelName): string {
  return `${context.game}:${context.level}:${sprite}`;
}
export function levelInfo(context: StudioContext) {
  const index = context.level - 1;
  if (context.game === 'sticker') return { title: `${stickerWordCount(index)} 張圖詞配對`, stage: STAGE_LABEL[stickerLoadBand(index)], note: '依關卡難度從單字庫抽選圖片；清單列出所有可用素材。' };
  if (context.game === 'delivery') {
    const mission = generateDeliveryMission(index);
    return { title: `路線種子 ${index}`, stage: STAGE_LABEL[deliveryLoadBand(mission)], note: '用路線種子整理送貨素材；遊戲每次開始會另選路線。' };
  }
  const level = generateMaze(context.game, index, 0);
  return { title: level.name, stage: STAGE_LABEL[mazeLoadBand(index)], note: '同一遊戲各關共用素材；關卡編號用來整理設計版本。' };
}
