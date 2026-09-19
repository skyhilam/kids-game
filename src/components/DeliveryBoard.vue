<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import PhaserGame from '../phaser/PhaserGame.vue';
import type { DeliveryBoardModel } from '../phaser/models';
import { useRouteTrace } from '../composables/useRouteTrace';
import { routeNeighbors, type RouteFailure, type RouteMission, type RouteState } from '../game/routeMission';
import { heading } from '../game/motion';
import { bestByVector } from '../game/input';

const props = defineProps<{
  mission: RouteMission;
  state: RouteState;
  enabled: boolean;
  mode: 'trace' | 'tap';
  hint: string | null;
}>();
const emit = defineEmits<{
  move: [to: string];
  tracing: [to: string | null];
  feedback: [reason: RouteFailure | 'off-road' | 'start-at-truck'];
}>();
const surface = ref<HTMLElement | null>(null);
const targetLayer = ref<HTMLElement | null>(null);
const facing = ref(0);
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const { trace, position, onPointerDown, onPointerMove, onPointerUp, stopPointer } = useRouteTrace({
  surface, mission: () => props.mission, state: () => props.state,
  enabled: () => props.enabled && props.mode === 'trace',
  move: (to) => emit('move', to), feedback: (reason) => emit('feedback', reason),
});
const neighbors = computed(() => routeNeighbors(props.mission, props.state.node));
const angle = computed(() => trace.value ? heading(props.mission.nodes[props.state.node], props.mission.nodes[trace.value.to]) : facing.value);
watch(() => props.state.node, (to, from) => { facing.value = heading(props.mission.nodes[from], props.mission.nodes[to]); });
watch(() => trace.value?.to ?? null, (to) => emit('tracing', to), { immediate: true });

function houseAbove(node: string): boolean {
  return props.mission.nodes[node][1] < props.mission.height * 0.42;
}

const model = computed<DeliveryBoardModel>(() => ({
  kind: 'delivery',
  width: props.mission.width,
  height: props.mission.height,
  mission: props.mission,
  state: props.state,
  position: position.value,
  angle: angle.value,
  hint: props.hint,
  mode: props.mode,
  enabled: props.enabled,
  reduceMotion,
  houses: props.mission.stops.map((stop) => ({
    node: stop.node,
    artY: houseAbove(stop.node) ? -115 : 20,
    stickerY: houseAbove(stop.node) ? -48 : 71,
  })),
}));

function title(node: string): string {
  return props.mission.stops.find((stop) => stop.node === node)?.label ?? (node === props.mission.finish ? '藍色終點' : '路口');
}
function targetLabel(node: string): string {
  const angle = heading(props.mission.nodes[props.state.node], props.mission.nodes[node]);
  const direction = Math.abs(angle) < 45 ? '右方' : Math.abs(angle) > 135 ? '左方' : angle > 0 ? '下方' : '上方';
  return `前往${direction}的${title(node)}`;
}
function percent(node: string): { left: string; top: string } {
  const [x, y] = props.mission.nodes[node];
  return { left: `${x / props.mission.width * 100}%`, top: `${y / props.mission.height * 100}%` };
}
function onKey(event: KeyboardEvent): void {
  if (!props.enabled || props.mode !== 'tap') return;
  const directions: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  const direction = directions[event.key];
  if (!direction) return;
  event.preventDefault();
  const from = props.mission.nodes[props.state.node];
  const candidate = bestByVector(
    from,
    neighbors.value.map((to) => ({ to, point: props.mission.nodes[to] })),
    direction,
  );
  if (candidate && candidate.score > .7) emit('move', candidate.to);
}
watch([() => props.state.node, () => props.enabled], async () => {
  if (props.mode !== 'tap') return;
  await nextTick();
  const next = targetLayer.value?.querySelector('button');
  next?.focus({ preventScroll: true });
});
</script>

<template>
  <section class="board-frame delivery-frame" aria-label="送貨迷宮">
    <div
      ref="surface"
      class="delivery-board"
      :class="{ tracing: mode === 'trace' }"
      :style="{ aspectRatio: `${mission.width}/${mission.height}` }"
      tabindex="0"
      @keydown="onKey"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="stopPointer"
      @lostpointercapture="stopPointer"
    >
      <PhaserGame :key="`${mission.width}x${mission.height}`" :model="model" />
      <div v-if="mode === 'tap' && enabled" ref="targetLayer" class="delivery-targets" role="group" aria-label="選擇下一個路口">
        <button v-for="node in neighbors" :key="node" type="button" class="delivery-target" :class="{ hinted: node === hint }"
          :style="percent(node)" :data-node="node" :aria-label="targetLabel(node)" @click="emit('move', node)">
          <svg viewBox="0 0 32 32" aria-hidden="true" :style="{ rotate: `${heading(mission.nodes[state.node], mission.nodes[node])}deg` }"><use href="#i-arrow"/></svg>
        </button>
      </div>
      <div class="delivery-map-note">送到三間屋，再到終點</div>
    </div>
  </section>
</template>
