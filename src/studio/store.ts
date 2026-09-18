import { shallowRef } from 'vue';
import { contextKey, kits, type ModelName, type StudioContext } from './catalog';
import { parseContext, parseRecipe, recipeKey, type Recipe } from './recipe';
import { spriteDataUrl } from './draw';

export const STORAGE_KEY = 'picnic-sprite-studio-v1';
export type SavedSprite = { context: StudioContext; recipe: Recipe; completedAt: string };
export type StudioLibrary = { version: 1; records: Record<string, SavedSprite>; active: Partial<Record<ModelName, Recipe>> };
const emptyLibrary = (): StudioLibrary => ({ version: 1, records: {}, active: {} });
export const library = shallowRef<StudioLibrary>(emptyLibrary());
export const activeImages = shallowRef<Partial<Record<ModelName, string>>>({});
export const storageWarning = shallowRef('');
export const styleNotice = shallowRef('');
const applyJobs = new Map<ModelName, number>();
let loaded = false;

export function parseLibrary(raw: string): StudioLibrary {
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !data.records || !data.active || Array.isArray(data.records) || Array.isArray(data.active)) throw new Error('素材紀錄格式錯誤');
  const result = emptyLibrary();
  for (const [key, value] of Object.entries(data.records)) {
    const entry = value as SavedSprite;
    const recipe = parseRecipe(entry?.recipe); const context = parseContext(entry?.context);
    if (contextKey(context, recipe.sprite) !== key || !(kits[context.game].sprites as readonly string[]).includes(recipe.sprite)
      || typeof entry.completedAt !== 'string' || !Number.isFinite(Date.parse(entry.completedAt))) throw new Error('素材紀錄內容錯誤');
    result.records[key] = { recipe, context, completedAt: entry.completedAt };
  }
  for (const [key, value] of Object.entries(data.active)) {
    const recipe = parseRecipe(value);
    if (recipe.sprite !== key) throw new Error('套用素材名稱錯誤');
    result.active[recipe.sprite] = recipe;
  }
  return result;
}
export function initializeLibrary(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      library.value = parseLibrary(raw);
      if (Object.values(JSON.parse(raw).records).some((entry: any) => entry.recipe?.version === 1)) {
        styleNotice.value = '舊版作品已改用遊戲原畫呈現，關卡與完成紀錄保留。';
      }
    }
    for (const recipe of Object.values(library.value.active)) {
      const job = applyJobs.get(recipe.sprite) ?? 0;
      void spriteDataUrl(recipe).then(url => {
        if ((applyJobs.get(recipe.sprite) ?? 0) === job && library.value.active[recipe.sprite]) {
          activeImages.value = { ...activeImages.value, [recipe.sprite]: url };
        }
      }).catch(() => { storageWarning.value = '未能載入已套用的原畫；暫時顯示遊戲素材，請重新載入後再試。'; });
    }
  } catch {
    storageWarning.value = '無法讀取本機紀錄；目前可繼續製作，請下載設計 JSON 保留作品。';
  }
}
function commit(next: StudioLibrary): boolean {
  library.value = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); storageWarning.value = ''; return true;
  } catch {
    storageWarning.value = '瀏覽器無法儲存紀錄，重開後可能遺失；請下載設計 JSON 備份。'; return false;
  }
}
export function completeSprite(context: StudioContext, recipe: Recipe): boolean {
  const key = contextKey(context, recipe.sprite);
  if (library.value.records[key] && recipeKey(library.value.records[key]!.recipe) === recipeKey(recipe)) return true;
  return commit({ ...library.value, records: { ...library.value.records,
    [key]: { context: { ...context }, recipe: parseRecipe(recipe), completedAt: new Date().toISOString() } } });
}
export async function applySprite(recipe: Recipe): Promise<boolean> {
  const clean = parseRecipe(recipe);
  const job = (applyJobs.get(clean.sprite) ?? 0) + 1; applyJobs.set(clean.sprite, job);
  const url = await spriteDataUrl(clean);
  if (applyJobs.get(clean.sprite) !== job) return false;
  activeImages.value = { ...activeImages.value, [clean.sprite]: url };
  return commit({ ...library.value, active: { ...library.value.active, [clean.sprite]: clean } });
}
export function restoreSprite(name: ModelName): boolean {
  applyJobs.set(name, (applyJobs.get(name) ?? 0) + 1);
  const active = { ...library.value.active }; delete active[name];
  const images = { ...activeImages.value }; delete images[name]; activeImages.value = images;
  return commit({ ...library.value, active });
}
