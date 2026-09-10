<script setup lang="ts">
import { computed, useId } from 'vue';
import { atlases, sprites, type SpriteName } from '../art/sprites';

const props = defineProps<{
  name: SpriteName;
  /** Omit for decorative art; supply a label when the picture carries meaning. */
  label?: string;
}>();

const sprite = computed(() => sprites[props.name]);
const atlas = computed(() => atlases[sprite.value.atlas]);
const clipId = `sprite-clip-${useId()}`;
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="sprite.frame.join(' ')"
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMid meet"
    :aria-hidden="label ? undefined : true"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    focusable="false"
    overflow="hidden"
    :data-sprite="name"
  >
    <defs>
      <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
        <rect :x="sprite.frame[0]" :y="sprite.frame[1]" :width="sprite.frame[2]" :height="sprite.frame[3]"/>
      </clipPath>
    </defs>
    <image :href="atlas.src" :width="atlas.width" :height="atlas.height" :clip-path="`url(#${clipId})`"/>
  </svg>
</template>
