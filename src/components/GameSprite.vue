<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import { atlases, sprites, type SpriteName } from '../art/sprites';
import { activeSprites, type AppliedSprite } from '../studio/store';

const props = defineProps<{
  name: SpriteName;
  /** Omit for decorative art; supply a label when the picture carries meaning. */
  label?: string;
  /** Compare against the unmodified atlas even when a local studio override is active. */
  original?: boolean;
}>();

const sprite = computed(() => sprites[props.name]);
const atlas = computed(() => atlases[sprite.value.atlas]);
const generated = computed(() => props.original ? undefined : (activeSprites.value as Partial<Record<SpriteName, AppliedSprite>>)[props.name]);
const frame = ref(0);
const frameRect = computed(() => generated.value
  ? [frame.value % generated.value.columns * 128, Math.floor(frame.value / generated.value.columns) * 128, 128, 128]
  : sprite.value.frame);
const clipId = `sprite-clip-${useId()}`;
let request = 0; let mounted = false;
function restartPlayback() {
  cancelAnimationFrame(request); frame.value = 0;
  const animation = generated.value;
  if (!mounted || document.hidden || !animation || animation.frames < 2) return;
  const start = performance.now();
  function tick(now: number) {
    frame.value = Math.floor(Math.max(0, now - start) * animation!.fps / 1000) % animation!.frames;
    request = requestAnimationFrame(tick);
  }
  request = requestAnimationFrame(tick);
}
watch(generated, restartPlayback);
onMounted(() => { mounted = true; restartPlayback(); document.addEventListener('visibilitychange', restartPlayback); });
onUnmounted(() => { mounted = false; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', restartPlayback); });
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="frameRect.join(' ')"
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
    :data-animated="generated && generated.frames > 1 ? true : undefined"
    :data-frame="generated && generated.frames > 1 ? frame : undefined"
  >
    <defs>
      <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
        <rect :x="frameRect[0]" :y="frameRect[1]" :width="frameRect[2]" :height="frameRect[3]"/>
      </clipPath>
    </defs>
    <image v-if="generated" :href="generated.image" :width="generated.columns * 128" :height="generated.rows * 128" :clip-path="`url(#${clipId})`"/>
    <image v-if="!generated" :href="atlas.src" :width="atlas.width" :height="atlas.height" :clip-path="`url(#${clipId})`"/>
  </svg>
</template>
