import type { SpriteName } from './sprites';

export type DecorThemeId = 'garden' | 'farm' | 'prehistoric' | 'ocean' | 'space' | 'city' | 'construction';

export const DECOR_THEMES: Record<DecorThemeId, { big: SpriteName[]; small: SpriteName[]; sky: SpriteName[] }> = {
  garden: { big: ['sunflower', 'hydrangea', 'rose', 'lily'], small: ['butterfly', 'bee', 'ladybug', 'dandelion', 'snail'], sky: ['sun'] },
  farm: { big: ['cow', 'horse', 'sheep', 'donkey'], small: ['chick', 'duck', 'rabbit', 'frog'], sky: ['sun'] },
  prehistoric: { big: ['prehistoric-palm', 'volcano', 'brachiosaurus', 'stegosaurus'], small: ['triceratops', 'ankylosaurus'], sky: ['pterosaur'] },
  ocean: { big: ['coral', 'octopus', 'sea-anemone'], small: ['clownfish', 'starfish', 'seahorse', 'crab'], sky: ['jellyfish'] },
  space: { big: ['saturn', 'earth', 'rocket'], small: ['star', 'comet', 'ufo'], sky: ['satellite'] },
  city: { big: ['playground', 'bakery', 'library', 'post-office'], small: ['fire-hydrant', 'traffic-cone', 'mailbox'], sky: ['sun'] },
  construction: { big: ['excavator', 'bulldozer', 'crane', 'construction-building'], small: ['traffic-cone', 'bricks', 'hard-hat'], sky: ['sun'] },
};

export const GAME_DECOR_THEMES: Record<'picnic' | 'tooth' | 'delivery', DecorThemeId[]> = {
  picnic: ['garden', 'farm', 'prehistoric'],
  tooth: ['ocean', 'space'],
  delivery: ['city', 'construction', 'farm'],
};
