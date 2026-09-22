<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  revealMs?: number;
  cancelable?: boolean;
  labelledBy?: string;
  dialogClass?: string;
  /** Win beat only. `data-win-ready` stays false until showModal; revealMs is not shortened. */
  winBeat?: boolean;
}>(), {
  revealMs: 0,
  cancelable: false,
  labelledBy: 'dialogTitle',
  winBeat: false,
});

const emit = defineEmits<{
  close: [];
  revealed: [];
}>();

const dialogEl = ref<HTMLDialogElement | null>(null);
const winReady = ref(false);
let returnFocus: HTMLElement | null = null;
let revealTimer = 0;

function markWinOpen(dialog: HTMLDialogElement): void {
  winReady.value = true;
  dialog.dataset.winReady = 'true';
  dialog.setAttribute('aria-busy', 'false');
}

function openDialog(notify: boolean): void {
  nextTick(() => {
    if (!props.open) return;
    const dialog = dialogEl.value;
    if (!dialog) return;
    if (!dialog.open) {
      if (!returnFocus) returnFocus = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    if (props.winBeat) markWinOpen(dialog);
    if (notify) emit('revealed');
    const focus = dialog.querySelector<HTMLElement>('[autofocus]')
      ?? dialog.querySelector<HTMLElement>('button');
    focus?.focus({ preventScroll: true });
  });
}

function hideDialog(): void {
  dialogEl.value?.close();
  if (returnFocus && returnFocus.isConnected && !('disabled' in returnFocus && returnFocus.disabled)) {
    returnFocus.focus({ preventScroll: true });
  }
  returnFocus = null;
}

function clearReveal(): void {
  window.clearTimeout(revealTimer);
  revealTimer = 0;
}

watch(() => props.open, (open) => {
  clearReveal();
  winReady.value = false;
  if (!open) {
    hideDialog();
    const dialog = dialogEl.value;
    if (dialog) {
      delete dialog.dataset.winReady;
      dialog.removeAttribute('aria-busy');
    }
    return;
  }
  if (props.revealMs > 0) {
    // Closed dialog until this beat ends. Do not call showModal early (PR #14 verdict B).
    revealTimer = window.setTimeout(() => {
      openDialog(true);
    }, props.revealMs);
    return;
  }
  openDialog(false);
}, { immediate: true });

onBeforeUnmount(() => {
  clearReveal();
  dialogEl.value?.close();
});

function onCancel(event: Event): void {
  event.preventDefault();
  if (props.cancelable) emit('close');
}
</script>

<template>
  <dialog
    :class="dialogClass"
    ref="dialogEl"
    :aria-labelledby="labelledBy"
    :aria-busy="winBeat ? (winReady ? 'false' : 'true') : undefined"
    :data-win-ready="winBeat ? (winReady ? 'true' : 'false') : undefined"
    @cancel="onCancel"
  >
    <slot />
  </dialog>
</template>
