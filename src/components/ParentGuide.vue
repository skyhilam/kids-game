<script setup lang="ts">
import type { ParentGuide } from '../game/stages';

defineProps<{
  guide: ParentGuide;
  stageLabel?: string;
}>();
</script>

<template>
  <section class="parent-guide" aria-label="給家長">
    <h3>給家長<span v-if="stageLabel"> · {{ stageLabel }}</span></h3>
    <div class="parent-cols">
      <article class="parent-col">
        <h4>目標</h4>
        <p>{{ guide.goal }}</p>
      </article>
      <article class="parent-col">
        <h4>提問</h4>
        <p>{{ guide.ask }}</p>
      </article>
      <article class="parent-col">
        <h4>示範</h4>
        <p>{{ guide.show }}</p>
      </article>
    </div>
  </section>
</template>
