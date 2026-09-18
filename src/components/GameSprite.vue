<script setup lang="ts">
import { computed, useId } from 'vue';
import { atlases, sprites, type SpriteName } from '../art/sprites';
import { activeImages } from '../studio/store';

const props = defineProps<{
  name: SpriteName;
  /** Omit for decorative art; supply a label when the picture carries meaning. */
  label?: string;
  /** Compare against the unmodified atlas even when a local studio override is active. */
  original?: boolean;
}>();

const sprite = computed(() => sprites[props.name]);
const atlas = computed(() => atlases[sprite.value.atlas]);
const generated = computed(() => props.original ? undefined : (activeImages.value as Partial<Record<SpriteName, string>>)[props.name]);
const clipId = `sprite-clip-${useId()}`;
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="generated ? '0 0 128 128' : sprite.frame.join(' ')"
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMid meet"
    :aria-hidden="label ? undefined : true"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    focusable="false"
    overflow="hidden"
    :data-sprite="name"
    :data-generated="generated ? true : undefined"
  >
    <image v-if="generated" :href="generated" width="128" height="128"/>
    <defs v-if="!generated">
      <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
        <rect :x="sprite.frame[0]" :y="sprite.frame[1]" :width="sprite.frame[2]" :height="sprite.frame[3]"/>
      </clipPath>
    </defs>
    <image v-if="!generated" :href="atlas.src" :width="atlas.width" :height="atlas.height" :clip-path="`url(#${clipId})`"/>
  </svg>
</template>
