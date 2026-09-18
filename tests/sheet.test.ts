import { describe, expect, it } from 'vitest';
import { defaultSheet, frameTransform, motions, parseSheet, sheetLayout } from '../src/studio/animation';
import { crc32, zipFiles } from '../src/studio/download';
import { exportDesign, generateRecipe, initialRecipe, parseDesign, parseRecipe, recipeKey } from '../src/studio/recipe';
import { sheetMetadata } from '../src/studio/sheet';

describe('2D sprite sheet production', () => {
  it('migrates painted designs without changing their appearance and round-trips animation edits', () => {
    const painted = { ...initialRecipe('car'), primary: '#649FAE', variant: 2, version: 2, sheet: undefined };
    const migrated = parseRecipe(painted);
    expect(migrated).toEqual({ ...painted, version: 3, sheet: defaultSheet() });
    const edited = { ...migrated, sheet: { ...defaultSheet(), fps: 17, frames: 12 as const, columns: 8 as const, motion: 'sway' as const } };
    const context = { game: 'picnic' as const, level: 3 };
    expect(parseDesign(JSON.parse(exportDesign(context, edited)))).toEqual({ context, recipe: edited });
    expect(recipeKey(edited)).not.toBe(recipeKey(migrated));
    const generated = generateRecipe('car', 33, edited);
    expect(generated.sheet).toEqual(edited.sheet);
    expect(generated.sheet).not.toBe(edited.sheet);
  });
  it('rejects oversized, non-finite and unsupported sheet settings before rendering or import', () => {
    for (const patch of [{ motion: '__proto__' }, { motion: 'toString' }, { frames: 9999 }, { columns: 3 }, { fps: NaN }, { fps: Infinity }, { fps: 0 }, { fps: 25 }, { fps: 3.5 }]) {
      expect(() => parseSheet({ ...defaultSheet(), ...patch })).toThrow();
    }
    expect(() => parseRecipe({ ...initialRecipe('car'), sheet: undefined })).toThrow();
    expect(() => parseSheet(null)).toThrow();
  });
  it('exports row-major frame rectangles, duration and tags matching every supported layout', () => {
    for (const size of [64, 128, 256, 512] as const) for (const count of [4, 8, 12] as const) for (const columns of [1, 2, 4, 8] as const) {
      const recipe = { ...initialRecipe('bear'), size, sheet: { ...defaultSheet(), frames: count, columns, fps: 16 } };
      const layout = sheetLayout(size, recipe.sheet); const metadata = sheetMetadata(recipe, 'sprite.png');
      expect(layout.width * layout.height).toBeGreaterThanOrEqual(count * size * size);
      expect(metadata.meta.image).toBe('sprite.png');
      expect(metadata.meta.size).toEqual({ w: layout.width, h: layout.height });
      expect(metadata.meta.frameTags[0]).toEqual({ name: 'bob', from: 0, to: count - 1, direction: 'forward' });
      Object.values(metadata.frames).forEach((entry, i) => {
        expect(entry.frame).toEqual({ x: i % layout.columns * size, y: Math.floor(i / layout.columns) * size, w: size, h: size });
        expect(entry.frame.x + size).toBeLessThanOrEqual(layout.width);
        expect(entry.frame.y + size).toBeLessThanOrEqual(layout.height);
        expect([62, 63]).toContain(entry.duration); expect(entry.pivot).toEqual({ x: .5, y: .5 });
      });
      expect(Object.keys(metadata.frames)).toHaveLength(count);
      expect(Object.values(metadata.frames).reduce((total, frame) => total + frame.duration, 0)).toBe(count / 16 * 1000);
    }
  });
  it('loops continuously with bounded movement and leaves the static pose untouched', () => {
    for (const motion of Object.keys(motions) as (keyof typeof motions)[]) {
      const settings = { ...defaultSheet(), motion };
      expect(frameTransform(settings, settings.frames)).toEqual(frameTransform(settings, 0));
      for (let i = 0; i < settings.frames; i++) {
        const transform = frameTransform(settings, i);
        expect(Math.abs(transform.angle)).toBeLessThanOrEqual(.075);
        expect(Math.abs(transform.y)).toBeLessThanOrEqual(.04);
        expect(transform.xScale).toBeLessThanOrEqual(1);
        expect(transform.yScale).toBeLessThanOrEqual(1);
      }
    }
    expect(frameTransform({ ...defaultSheet(), motion: 'still' }, 3)).toEqual({ y: 0, angle: 0, xScale: 1, yScale: 1 });
  });
  it('writes valid ZIP offsets, UTF-8 names and exact binary payloads with standard CRC32', async () => {
    const encoder = new TextEncoder(); const decoder = new TextDecoder();
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    const files = [{ name: 'sprite.png', bytes: new Uint8Array([0, 255, 137, 80, 78, 71]) }, { name: '設計.json', bytes: encoder.encode('{"name":"小熊"}') }];
    const archive = zipFiles(files); const bytes = new Uint8Array(await archive.arrayBuffer()); const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(files.length);
    let central = view.getUint32(end + 16, true);
    expect(central + view.getUint32(end + 12, true)).toBe(end);
    for (const file of files) {
      expect(view.getUint32(central, true)).toBe(0x02014b50);
      const local = view.getUint32(central + 42, true); const nameLength = view.getUint16(central + 28, true);
      expect(decoder.decode(bytes.slice(central + 46, central + 46 + nameLength))).toBe(file.name);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      expect(view.getUint16(local + 6, true)).toBe(0x800);
      expect(view.getUint16(local + 8, true)).toBe(0);
      expect(view.getUint32(local + 14, true)).toBe(crc32(file.bytes));
      expect(view.getUint32(local + 18, true)).toBe(file.bytes.length);
      expect(bytes.slice(local + 30 + nameLength, local + 30 + nameLength + file.bytes.length)).toEqual(file.bytes);
      central += 46 + nameLength;
    }
  });
});
