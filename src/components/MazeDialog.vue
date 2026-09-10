<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  revealMs?: number;
  cancelable?: boolean;
  labelledBy?: string;
  dialogClass?: string;
}>(), {
  revealMs: 0,
  cancelable: false,
  labelledBy: 'dialogTitle',
});

const emit = defineEmits<{
  close: [];
  revealed: [];
}>();

const dialogEl = ref<HTMLDialogElement | null>(null);
let returnFocus: HTMLElement | null = null;
let revealTimer = 0;

function openDialog(): void {
  nextTick(() => {
    const dialog = dialogEl.value;
    if (dialog && !dialog.open) {
      if (!returnFocus) returnFocus = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    const focus = dialog?.querySelector<HTMLElement>('[autofocus]')
      ?? dialog?.querySelector<HTMLElement>('button');
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
}

watch(() => props.open, (open) => {
  clearReveal();
  if (!open) {
    hideDialog();
    return;
  }
  if (props.revealMs > 0) {
    revealTimer = window.setTimeout(() => {
      openDialog();
      emit('revealed');
    }, props.revealMs);
    return;
  }
  openDialog();
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
  <dialog :class="dialogClass" ref="dialogEl" :aria-labelledby="labelledBy" @cancel="onCancel">
    <slot />
  </dialog>
</template>
