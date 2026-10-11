<script setup lang="ts">
import { computed } from 'vue';
import { FORMULA_COPY as copy, FORMULA_ZONE_COPY } from '../../formula/copy';
import { isZoneUnlocked, type FormulaSave } from '../../formula/progress';
import type { RoundStars, ZoneId } from '../../formula/types';
import { FORMULA_ZONES } from '../../formula/zones';
import FormulaScene from './FormulaScene.vue';

const props = defineProps<{ save: FormulaSave }>();
const emit = defineEmits<{ enter: [zone: ZoneId] }>();

type MapZone = {
  id: ZoneId;
  title: string;
  en: string;
  blurb: string;
  unlocked: boolean;
  stamped: boolean;
  stars: RoundStars;
};

const zones = computed<MapZone[]>(() => FORMULA_ZONES.map((zone) => {
  const row = props.save.zones[zone.id];
  return {
    id: zone.id,
    title: FORMULA_ZONE_COPY[zone.id].title,
    en: FORMULA_ZONE_COPY[zone.id].en,
    blurb: FORMULA_ZONE_COPY[zone.id].blurb,
    unlocked: isZoneUnlocked(props.save, zone.id),
    stamped: row?.stamped ?? false,
    stars: row?.bestStars ?? 0,
  };
}));

const allStamped = computed(() => zones.value.every((zone) => zone.stamped));

function statusOf(zone: MapZone): string {
  if (zone.stamped) return copy.map.stamped;
  if (zone.unlocked) return copy.map.open;
  return copy.map.locked;
}

function onEnter(zone: MapZone): void {
  if (!zone.unlocked) return;
  emit('enter', zone.id);
}
</script>

<template>
  <div class="formula-map" role="list" :aria-label="copy.map.title" :data-formula-all-stamped="allStamped">
    <button
      v-for="zone in zones"
      :key="zone.id"
      type="button"
      role="listitem"
      class="formula-zone-card"
      :class="{ locked: !zone.unlocked, stamped: zone.stamped }"
      :data-formula-zone="zone.id"
      :data-formula-unlocked="zone.unlocked"
      :data-formula-stamped="zone.stamped"
      :data-formula-stars="zone.stars"
      :disabled="!zone.unlocked"
      :aria-disabled="!zone.unlocked"
      :aria-label="`${zone.id}. ${zone.title} ${zone.en}：${statusOf(zone)}`"
      @click="onEnter(zone)"
    >
      <span class="formula-zone-index">{{ zone.id }}</span>
      <FormulaScene :zone="zone.id" compact/>
      <span class="formula-zone-copy">
        <strong>{{ zone.title }}</strong>
        <small>{{ zone.en }}</small>
        <span class="formula-zone-blurb">{{ zone.blurb }}</span>
      </span>
      <span class="formula-zone-state">
        <span class="formula-stars" :aria-label="`${copy.map.starsLabel} ${zone.stars}`">
          <i v-for="n in 3" :key="n" :class="{ lit: n <= zone.stars }">★</i>
        </span>
        <span v-if="zone.stamped" class="formula-stamp" aria-hidden="true">✓</span>
        <span v-else-if="!zone.unlocked" class="formula-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="10" width="14" height="10" rx="3" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </span>
        <small class="formula-zone-status">{{ statusOf(zone) }}</small>
      </span>
    </button>
  </div>
</template>
