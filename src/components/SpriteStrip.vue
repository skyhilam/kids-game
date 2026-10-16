<script setup lang="ts">
import { computed } from 'vue';
import type { SpriteName } from '../art/sprites';
import { stripLayout } from '../art/strip';
import GameSprite from './GameSprite.vue';

const props = withDefaults(defineProps<{
  names: readonly SpriteName[];
  width?: number;
  height?: number;
  fill?: string;
}>(), { width: 420, height: 150, fill: '#eef4e4' });

const cells = computed(() => stripLayout(props.names.length, {
  width: props.width, height: props.height, padX: 18, padY: 16, gap: 12,
}));
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" aria-hidden="true" focusable="false">
    <rect :width="width" :height="height" rx="24" :fill="fill"/>
    <GameSprite v-for="(name, index) in names" :key="index" :name="name" v-bind="cells[index]"/>
  </svg>
</template>
