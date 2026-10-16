import type { WordId } from '../sticker/words';

/** Visual or word neighbours used as forced distractors on basic/puzzle. */
export const SIMILARITY_GROUPS: readonly (readonly WordId[])[] = [
  ['car', 'truck'], // Both are road vehicles with wheels.
  ['home', 'shop'], // Both are buildings with doors and windows.
  ['tree', 'flower'], // Both are plants found outdoors.
  ['park', 'picnic'], // Both depict outdoor leisure settings.
  ['tooth', 'toothbrush'], // Both belong to the tooth-brushing routine.
  ['bear', 'kid'], // Both depict upright characters with faces and limbs.
  ['burger', 'picnic'], // Both relate to eating a meal.
  ['dog', 'cat'], // Both are four-legged household pets.
  ['chicken', 'duck'], // Both are farm birds with beaks and wings.
  ['cow', 'horse'], // Both are large four-legged farm animals.
  ['pig', 'sheep'], // Both are round-bodied farm animals.
  ['bee', 'butterfly', 'ladybug'], // All are small winged garden insects.
  ['apple', 'banana'], // Both are familiar fruits.
  ['cake', 'pizza'], // Both are foods commonly served in slices.
  ['cow', 'sheep'], // Both are grazing farm animals.
  ['drum', 'guitar'], // Both are musical instruments.
  ['rocket', 'star'], // Both belong to a space scene.
  ['truck', 'train'], // Both carry goods in large wheeled vehicles.
  ['fish', 'dolphin', 'octopus'], // All are sea animals.
];
