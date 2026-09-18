<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { models } from './catalog';
import { renderSprite } from './draw';
import type { Recipe } from './recipe';
const props = defineProps<{ recipe: Recipe; decorative?: boolean }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const error = ref('');
const loading = ref(true);
let revision = 0;
async function draw() {
  if (!canvas.value) return;
  const current = ++revision;
  loading.value = true;
  try { await renderSprite(canvas.value, props.recipe); if (current === revision) error.value = ''; }
  catch { if (current === revision) error.value = '未能載入遊戲原畫，請重新載入後再試。'; }
  finally { if (current === revision) loading.value = false; }
}
onMounted(draw);
onUnmounted(() => { revision++; });
watch(() => props.recipe, draw, { deep: true });
</script>
<template>
  <canvas ref="canvas" :aria-busy="loading" :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? true : undefined" :aria-label="decorative ? undefined : models[recipe.sprite].label"
    :data-model="recipe.sprite">{{ models[recipe.sprite].label }}</canvas>
  <span v-if="error && !decorative" role="alert">{{ error }}</span>
</template>
<style scoped>
canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
</style>
