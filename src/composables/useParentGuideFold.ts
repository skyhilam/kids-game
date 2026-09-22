import { ref } from 'vue';

/**
 * Fold state for the sticker and listen「給家長」columns.
 * One SPA visit shares this module (activity switches do not reset it).
 * A full reload evaluates `ref(true)` again, so the guide comes back shown.
 * Nothing here is persisted.
 */
const expanded = ref(true);

/** Visible control copy. Expanded offers hide; collapsed offers show. */
export const PARENT_GUIDE_HIDE_LABEL = '隱藏給家長';
export const PARENT_GUIDE_SHOW_LABEL = '顯示給家長';

export function useParentGuideFold() {
  function toggle(): void {
    expanded.value = !expanded.value;
  }

  return { expanded, toggle };
}

/** Test helper. A page reload gets the same shown default by re-running the module. */
export function resetParentGuideFold(): void {
  expanded.value = true;
}
