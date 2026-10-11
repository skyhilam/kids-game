<script setup lang="ts">
import { computed } from 'vue';
import { FORMULA_COPY as copy, FORMULA_ZONE_COPY } from '../../formula/copy';
import { parentSummary, type FormulaSave } from '../../formula/progress';

const props = defineProps<{ save: FormulaSave }>();
const emit = defineEmits<{ retry: []; back: [] }>();

const summary = computed(() => parentSummary(props.save));

function accuracyText(accuracy: number | null, unlocked: boolean): string {
  if (accuracy === null) return unlocked ? copy.summary.noData : copy.summary.locked;
  return `${Math.round(accuracy * 100)}%`;
}
</script>

<template>
  <section class="formula-summary" :aria-label="copy.summary.title">
    <div class="formula-summary-head">
      <div class="dialog-eyebrow">{{ copy.summary.eyebrow }}</div>
      <h2 class="dialog-title">{{ copy.summary.title }}</h2>
      <p class="dialog-copy">{{ copy.summary.body }}</p>
    </div>

    <table class="formula-summary-table" :data-formula-summary-rows="summary.zones.length">
      <thead>
        <tr>
          <th scope="col">{{ copy.summary.zone }}</th>
          <th scope="col">{{ copy.summary.accuracy }}</th>
          <th scope="col">{{ copy.summary.stars }}</th>
          <th scope="col">{{ copy.summary.attempts }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in summary.zones"
          :key="row.zone"
          :data-formula-summary-zone="row.zone"
          :data-formula-accuracy="row.accuracy === null ? '' : Math.round(row.accuracy * 100)"
          :class="{ locked: !row.unlocked, stamped: row.stamped }"
        >
          <th scope="row">
            <span class="formula-zone-index">{{ row.zone }}</span>
            <strong>{{ FORMULA_ZONE_COPY[row.zone].title }}</strong>
            <small>{{ row.title }}</small>
          </th>
          <td>{{ accuracyText(row.accuracy, row.unlocked) }}</td>
          <td>
            <span class="formula-stars">
              <i v-for="n in 3" :key="n" :class="{ lit: n <= row.bestStars }">★</i>
            </span>
          </td>
          <td>{{ row.attempts }}</td>
        </tr>
      </tbody>
    </table>

    <h3 class="formula-review-title">{{ copy.summary.review }} <span class="stage-chip">{{ summary.review.length }}</span></h3>
    <p v-if="summary.review.length === 0" class="formula-review-empty">{{ copy.summary.reviewEmpty }}</p>
    <ol v-else class="formula-review-list">
      <li v-for="item in summary.review" :key="item.id" :data-formula-review="item.id">
        <span class="formula-zone-index">{{ item.zone }}</span>
        <span class="formula-review-copy">
          <span>{{ item.prompt }}</span>
          <small>{{ copy.summary.answer }}：{{ item.answer }}</small>
        </span>
      </li>
    </ol>

    <div class="formula-summary-actions">
      <button
        class="primary-button"
        type="button"
        data-formula-retry-wrongs
        :disabled="summary.review.length === 0"
        @click="emit('retry')"
      >
        {{ copy.summary.retryWrongs }}<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-restart"/></svg>
      </button>
      <button class="secondary-button" type="button" @click="emit('back')">{{ copy.summary.back }}</button>
    </div>
  </section>
</template>
