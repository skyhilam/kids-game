<script setup lang="ts">
defineProps<{
  toastOn: boolean;
  toastText: string;
  confettiBits: { i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[];
}>();
</script>

<template>
  <div class="toast" role="status" :hidden="!toastOn">{{ toastText }}</div>
  <div class="confetti-layer" aria-hidden="true">
    <i
      v-for="bit in confettiBits"
      :key="bit.i"
      class="confetti"
      :style="{
        left: bit.left,
        background: bit.bg,
        '--delay': bit.delay,
        '--duration': bit.duration,
        '--drift': bit.drift,
        borderRadius: bit.round ? '50%' : undefined,
      }"
    />
  </div>
</template>
