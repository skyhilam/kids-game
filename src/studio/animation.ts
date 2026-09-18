export const motions = { wave: '揮手打招呼', walk: '原地走路', run: '原地跑步', jump: '屈膝跳躍', cheer: '舉手歡呼', drive: '開車 · 揮手眨眼', custom: '自訂角色動作' } as const;
export type SheetSettings = { motion: keyof typeof motions; prompt: string; frames: 4 | 8 | 12; fps: number; columns: 1 | 2 | 4 | 8; generationId?: string; sourceKey?: string };
export const hasActionFrames = (sprite: string) => sprite === 'car';
export const defaultSheet = (sprite?: string): SheetSettings => ({ motion: hasActionFrames(sprite ?? '') ? 'drive' : 'wave', prompt: '', frames: 8, fps: 8, columns: 4 });
export function parseSheet(value: unknown): SheetSettings {
  const v = value as Partial<SheetSettings> | null;
  if (!v || typeof v !== 'object' || !Object.hasOwn(motions, v.motion ?? '') || typeof v.prompt !== 'string' || v.prompt.length > 600
    || ![4, 8, 12].includes(v.frames!) || ![1, 2, 4, 8].includes(v.columns!)
    || !Number.isInteger(v.fps) || v.fps! < 2 || v.fps! > 24
    || (v.generationId !== undefined && !/^[a-f0-9]{64}$/.test(v.generationId))
    || (v.sourceKey !== undefined && (typeof v.sourceKey !== 'string' || v.sourceKey.length > 2000))
    || !!v.generationId !== !!v.sourceKey) throw new Error('角色動作設定不正確，請使用工房匯出的設計 JSON。');
  return { motion: v.motion!, prompt: v.prompt, frames: v.frames!, fps: v.fps!, columns: v.columns!,
    ...(v.generationId ? { generationId: v.generationId, sourceKey: v.sourceKey } : {}) };
}
/** Remove obsolete whole-image effects from old designs while keeping the artwork. */
export function migrateSheet(value: unknown, sprite: string): SheetSettings {
  const v = value as Record<string, unknown> | null;
  if (!v || ![4, 8, 12].includes(v.frames as number) || !['bob', 'sway', 'breathe', 'still', 'drive'].includes(String(v.motion))) throw new Error('舊版動畫設定不正確。');
  return parseSheet({ ...defaultSheet(sprite), fps: v.fps, columns: v.columns });
}
export function sheetLayout(size: number, settings: SheetSettings) {
  const columns = Math.min(settings.columns, settings.frames);
  const rows = Math.ceil(settings.frames / columns);
  return { columns, rows, width: columns * size, height: rows * size };
}

/** Square cells at an API-supported resolution; independent from the export layout. */
export function generatedAtlasLayout(frames: 4 | 8 | 12) {
  const columns = frames === 4 ? 2 : 4;
  const rows = frames / columns;
  const cellSize = frames === 4 ? 512 : 384;
  return { columns, rows, cellSize, width: columns * cellSize, height: rows * cellSize };
}
