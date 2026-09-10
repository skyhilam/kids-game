import picnicAtlas from '../assets/picnic/sprites.png';
import toothAtlas from '../assets/tooth/sprites.png';
import deliveryAtlas from '../assets/delivery/sprites.png';

export const atlases = {
  picnic: { src: picnicAtlas, width: 1448, height: 1086 },
  tooth: { src: toothAtlas, width: 1536, height: 1024 },
  delivery: { src: deliveryAtlas, width: 1254, height: 1254 },
} as const;

type SpriteDefinition = {
  atlas: keyof typeof atlases;
  /** Pixel coordinates within the original atlas: x, y, width, height. */
  frame: readonly [number, number, number, number];
};

/** Names are shared across games; rendering and motion stay in the consuming UI. */
export const sprites = {
  'truck': { atlas: 'delivery', frame: [26, 125, 638, 408] },
  'truck-top': { atlas: 'delivery', frame: [677, 125, 552, 368] },
  'parcel': { atlas: 'delivery', frame: [53, 686, 580, 463] },
  'courier': { atlas: 'delivery', frame: [784, 551, 420, 662] },
  'bear': { atlas: 'picnic', frame: [19, 15, 334, 357] },
  'car': { atlas: 'picnic', frame: [366, 47, 374, 312] },
  'burger': { atlas: 'picnic', frame: [748, 71, 320, 291] },
  'home': { atlas: 'picnic', frame: [1088, 46, 346, 316] },
  'shop': { atlas: 'picnic', frame: [30, 372, 326, 350] },
  'tree': { atlas: 'picnic', frame: [378, 370, 318, 354] },
  'flower': { atlas: 'picnic', frame: [736, 397, 329, 323] },
  'park': { atlas: 'picnic', frame: [1093, 401, 342, 310] },
  'picnic-place': { atlas: 'picnic', frame: [17, 748, 344, 315] },
  'picnic': { atlas: 'picnic', frame: [379, 747, 343, 316] },
  'car-top': { atlas: 'picnic', frame: [735, 777, 351, 237] },
  'sun': { atlas: 'picnic', frame: [1109, 732, 310, 317] },
  'kid': { atlas: 'tooth', frame: [70, 0, 400, 512] },
  'tooth': { atlas: 'tooth', frame: [40, 542, 475, 450] },
  'toothbrush': { atlas: 'tooth', frame: [655, 516, 240, 500] },
  'bug-coral': { atlas: 'tooth', frame: [580, 35, 440, 450] },
  'bug-purple': { atlas: 'tooth', frame: [1110, 15, 395, 475] },
  'kid-cheer': { atlas: 'tooth', frame: [1080, 512, 404, 512] },
} as const satisfies Record<string, SpriteDefinition>;

export type SpriteName = keyof typeof sprites;
