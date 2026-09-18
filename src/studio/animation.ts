export const motions = { bob: '輕輕跳動', sway: '左右搖擺', breathe: '呼吸起伏', still: '靜態影格' } as const;
export type SheetSettings = { motion: keyof typeof motions; frames: 4 | 8 | 12; fps: number; columns: 1 | 2 | 4 | 8 };
export const defaultSheet = (): SheetSettings => ({ motion: 'bob', frames: 8, fps: 8, columns: 4 });
export function parseSheet(value: unknown): SheetSettings {
  const v = value as Partial<SheetSettings> | null;
  if (!v || typeof v !== 'object' || !Object.hasOwn(motions, v.motion ?? '')
    || ![4, 8, 12].includes(v.frames!) || ![1, 2, 4, 8].includes(v.columns!)
    || !Number.isInteger(v.fps) || v.fps! < 2 || v.fps! > 24) throw new Error('動畫設定不正確，請使用工房匯出的設計 JSON。');
  return { motion: v.motion!, frames: v.frames!, fps: v.fps!, columns: v.columns! };
}
/** Normalized transforms of the whole illustration; these are not skeletal poses. */
export function frameTransform(settings: SheetSettings, index: number) {
  const phase = (index % settings.frames) / settings.frames * Math.PI * 2;
  const wave = Math.sin(phase);
  if (settings.motion === 'still') return { y: 0, angle: 0, xScale: 1, yScale: 1 };
  const fit = .88; // Fixed canvas and pivot leave room for movement at every output size.
  return {
    y: settings.motion === 'bob' ? -.04 * (1 - Math.cos(phase)) / 2 : 0,
    angle: settings.motion === 'sway' ? .075 * wave : 0,
    xScale: fit * (settings.motion === 'breathe' ? 1 + .018 * wave : 1),
    yScale: fit * (settings.motion === 'breathe' ? 1 + .035 * wave : 1),
  };
}
export function sheetLayout(size: number, settings: SheetSettings) {
  const columns = Math.min(settings.columns, settings.frames);
  const rows = Math.ceil(settings.frames / columns);
  return { columns, rows, width: columns * size, height: rows * size };
}
