<script setup lang="ts">
import { computed, useId } from 'vue';
import {
  PARENT_GUIDE_HIDE_LABEL,
  PARENT_GUIDE_SHOW_LABEL,
  useParentGuideFold,
} from '../composables/useParentGuideFold';
import type { ParentGuide } from '../game/stages';

const props = defineProps<{
  guide: ParentGuide;
  stageLabel?: string;
  /** Sticker and listen help dialogs share one fold. Other modes stay open. */
  collapsible?: boolean;
}>();

const { expanded, toggle } = useParentGuideFold();
const columnsId = useId();
const columnsOpen = computed(() => !props.collapsible || expanded.value);
</script>

<template>
  <section class="parent-guide" :class="{ 'is-collapsible': collapsible }" aria-label="給家長">
    <div v-if="collapsible" class="parent-guide-head">
      <h3>給家長<span v-if="stageLabel"> · {{ stageLabel }}</span></h3>
      <button
        class="parent-guide-toggle"
        type="button"
        :aria-expanded="expanded"
        :aria-controls="columnsId"
        @click="toggle"
      >{{ expanded ? PARENT_GUIDE_HIDE_LABEL : PARENT_GUIDE_SHOW_LABEL }}</button>
    </div>
    <h3 v-else>給家長<span v-if="stageLabel"> · {{ stageLabel }}</span></h3>
    <div
      v-show="columnsOpen"
      class="parent-cols"
      :id="collapsible ? columnsId : undefined"
    >
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
