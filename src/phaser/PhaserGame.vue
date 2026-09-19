<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { EventBus } from './EventBus';
import type { BoardModel } from './models';

const props = defineProps<{
  model: BoardModel;
}>();

const host = ref<HTMLDivElement | null>(null);
const scene = ref<unknown>(null);
let game: { destroy: (removeCanvas: boolean) => void } | null = null;

function onReady(instance: unknown): void {
  scene.value = instance;
}

onMounted(async () => {
  const { startBoardGame } = await import('./main');
  if (!host.value) return;
  EventBus.on('current-scene-ready', onReady);
  game = startBoardGame(host.value, () => props.model);
});

onUnmounted(() => {
  EventBus.off('current-scene-ready', onReady);
  game?.destroy(true);
  game = null;
});

defineExpose({ scene, game: () => game });
</script>

<template>
  <div ref="host" class="playfield phaser-board" aria-hidden="true"></div>
</template>
