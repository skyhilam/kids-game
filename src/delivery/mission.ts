import type { RouteMission } from '../game/routeMission';

/** Original map: three houses and a finish. Visit any house, then the blue end. */
export const DELIVERY_MISSION: RouteMission = {
  name: '送貨員來了',
  width: 840,
  height: 720,
  start: 'start',
  finish: 'finish',
  stops: [
    { node: 'house1', label: '1 號屋' },
    { node: 'house2', label: '2 號屋' },
    { node: 'house3', label: '3 號屋' },
  ],
  nodes: {
    start: [175, 165], a: [360, 165], b: [560, 165], house2: [745, 165],
    finish: [75, 315], f: [175, 360], e: [360, 360], d: [560, 360], c: [745, 360],
    j: [75, 575], house3: [175, 575], g: [360, 575], house1: [560, 575],
    end: [360, 465],
  },
  edges: [
    ['start', 'a'], ['a', 'b'], ['a', 'e'], ['b', 'house2'], ['b', 'd'],
    ['house2', 'c'], ['c', 'd'], ['d', 'e'], ['d', 'house1'],
    ['e', 'f'], ['e', 'end'], ['f', 'house3'], ['house1', 'g'],
    ['g', 'house3'], ['g', 'end'], ['house3', 'j'], ['j', 'finish'],
  ],
};
