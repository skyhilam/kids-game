import type { ModelName } from './catalog';

type Material = { color: string; hue: number; radius: number; area?: readonly [number, number, number, number]; exclude?: readonly (readonly [number, number, number, number])[]; minSaturation?: number };
type Materials = { primary: Material; secondary: Material };
const red: Material = { color: '#E66F51', hue: 10, radius: 20 };
const green: Material = { color: '#7F9653', hue: 86, radius: 32 };
const blue: Material = { color: '#589BC5', hue: 205, radius: 27 };
const gold: Material = { color: '#EABB63', hue: 39, radius: 19 };
const foliage: Materials = { primary: green, secondary: { color: '#A87540', hue: 29, radius: 15 } };

/** Material-specific hue masks retain the painted highlights, grain, eyes and skin. */
export const materials: Record<ModelName, Materials> = {
  car: { primary: { ...red, area: [0, .35, 1, 1], exclude: [[.39, .38, .25, .23], [.64, .29, .12, .17]] }, secondary: green },
  'car-top': { primary: { ...red, exclude: [[.44, .5, .22, .34]] }, secondary: green },
  truck: { primary: blue, secondary: gold },
  'truck-top': { primary: blue, secondary: gold },
  bear: { primary: { ...green, area: [0, 0, 1, .30] }, secondary: { ...green, color: '#6C824C', area: [0, .65, 1, 1] } },
  courier: { primary: { ...blue, area: [0, .38, 1, 1] }, secondary: { ...green, area: [0, 0, 1, .26] } },
  kid: { primary: { color: '#65AD86', hue: 151, radius: 34, area: [0, .35, 1, 1] }, secondary: { ...red, area: [0, .76, 1, 1] } },
  'kid-cheer': { primary: { color: '#65AD86', hue: 151, radius: 34, area: [0, .38, 1, 1] }, secondary: { ...red, area: [0, .76, 1, 1] } },
  home: { primary: { color: '#598064', hue: 138, radius: 32, area: [0, 0, 1, .59] }, secondary: { ...red, area: [.2, .42, .8, 1] } },
  shop: { primary: { ...red, area: [0, 0, 1, .5] }, secondary: { ...green, area: [0, .4, 1, 1] } },
  tree: foliage, park: foliage, 'picnic-place': { primary: red, secondary: green }, picnic: { primary: red, secondary: green },
  burger: { primary: gold, secondary: green },
  flower: { primary: { color: '#EBDCC1', hue: 39, radius: 25, minSaturation: .04, area: [0, 0, 1, .77] }, secondary: green },
  sun: { primary: gold, secondary: { color: '#ED9781', hue: 10, radius: 19 } },
  tooth: { primary: { color: '#B2D7CA', hue: 158, radius: 38, minSaturation: .06 }, secondary: { ...gold, area: [0, 0, 1, .34] } },
  toothbrush: { primary: red, secondary: { color: '#62C5B1', hue: 168, radius: 30 } },
  'bug-coral': { primary: { ...red, hue: 17, radius: 14 }, secondary: { ...gold, hue: 35, radius: 13 } },
  'bug-purple': { primary: { color: '#9662B8', hue: 276, radius: 25 }, secondary: { color: '#D68DC8', hue: 318, radius: 24 } },
  parcel: { primary: gold, secondary: red },
};

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, max ? delta / max : 0, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(n => Math.round((n + m) * 255)) as [number, number, number];
}
const colorHsv = (hex: string) => rgbToHsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function recolorPixels(data: Uint8ClampedArray, width: number, height: number, name: ModelName, primary: string, secondary: string, materialOverride?: Materials): void {
  const masks = ([['primary', primary], ['secondary', secondary]] as const).flatMap(([key, color]) => {
    const source = (materialOverride ?? materials[name])[key];
    return color.toUpperCase() === source.color.toUpperCase() ? [] : [{ source, target: colorHsv(color), original: colorHsv(source.color) }];
  });
  if (!masks.length) return;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const hsv = rgbToHsv(data[i]!, data[i + 1]!, data[i + 2]!);
    if (hsv[2] < .24) continue;
    const x = (i / 4 % width) / width, y = Math.floor(i / 4 / width) / height;
    let best: typeof masks[number] | undefined; let weight = 0;
    for (const mask of masks) {
      const { source } = mask;
      if (hsv[1] < (source.minSaturation ?? .18)) continue;
      if (source.area && (x < source.area[0] || y < source.area[1] || x > source.area[2] || y > source.area[3])) continue;
      if (source.exclude?.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)) continue;
      const strength = clamp((source.radius - hueDistance(hsv[0], source.hue)) / (source.radius * .4), 0, 1);
      if (strength > weight) { best = mask; weight = strength; }
    }
    if (!best) continue;
    const [h, s, v] = best.target;
    const hue = (h + clamp(((hsv[0] - best.source.hue + 540) % 360) - 180, -15, 15) + 360) % 360;
    const color = hsvToRgb(hue, clamp(hsv[1] + (s - best.original[1]) * .75, .04, .95), clamp(hsv[2] + (v - best.original[2]) * .55, 0, 1));
    for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round(data[i + channel]! * (1 - weight) + color[channel]! * weight);
  }
}
