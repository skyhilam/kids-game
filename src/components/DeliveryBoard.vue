<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import GameSprite from './GameSprite.vue';
import { useRouteTrace } from '../composables/useRouteTrace';
import { roadKey } from '../game/graph';
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
  stamp: [];
  tracing: [to: string | null];
  feedback: [reason: RouteFailure | 'off-road' | 'start-at-truck'];
}>();
const surface = ref<SVGSVGElement | null>(null);
const targetLayer = ref<HTMLElement | null>(null);
const stampButton = ref<HTMLButtonElement | null>(null);
const facing = ref(0);
const { trace, position, onPointerDown, onPointerMove, onPointerUp, stopPointer } = useRouteTrace({
  surface, mission: () => props.mission, state: () => props.state,
  enabled: () => props.enabled && props.mode === 'trace',
  move: (to) => emit('move', to), feedback: (reason) => emit('feedback', reason),
});
const roads = computed(() => props.mission.edges.map(([a, b]) => ({
  id: roadKey(a, b), a, b,
  path: `M${props.mission.nodes[a].join(',')}L${props.mission.nodes[b].join(',')}`,
})));
const neighbors = computed(() => routeNeighbors(props.mission, props.state.node)
  .filter((to) => !props.state.used.has(roadKey(props.state.node, to))));
const angle = computed(() => trace.value ? heading(props.mission.nodes[props.state.node], props.mission.nodes[trace.value.to]) : facing.value);
watch(() => props.state.node, (to, from) => { facing.value = heading(props.mission.nodes[from], props.mission.nodes[to]); });
watch(() => trace.value?.to ?? null, (to) => emit('tracing', to), { immediate: true });
const partial = computed(() => `M${props.mission.nodes[props.state.node].join(',')}L${position.value.join(',')}`);
const hintPath = computed(() => props.hint ? `M${props.mission.nodes[props.state.node].join(',')}L${props.mission.nodes[props.hint].join(',')}` : '');
const treeSpots = [[.29, .34], [.79, .69], [.86, .85], [.55, .12]];

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
  const next = props.state.pendingStamp ? stampButton.value : targetLayer.value?.querySelector('button');
  next?.focus({ preventScroll: true });
});
</script>

<template>
  <section class="board-frame delivery-frame" aria-label="送貨迷宮">
    <div class="delivery-board" :class="{ tracing: mode === 'trace' }" :style="{ aspectRatio: `${mission.width}/${mission.height}` }" @keydown="onKey">
      <svg ref="surface" class="delivery-map" :viewBox="`0 0 ${mission.width} ${mission.height}`"
        aria-label="從紅色起點出發，依序送到 1、2、3 號屋，再到藍色終點。橙色道路不可再走。"
        @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
        @pointercancel="stopPointer" @lostpointercapture="stopPointer">
        <rect :width="mission.width" :height="mission.height" fill="#eaf0df"/>
        <ellipse :cx="mission.width * .76" :cy="mission.height * .79" :rx="mission.width * .19" :ry="mission.height * .16" fill="#e0e9d1"/>
        <ellipse :cx="mission.width * .27" :cy="mission.height * .36" :rx="mission.width * .10" :ry="mission.height * .09" fill="#dfe9d0"/>
        <g aria-hidden="true" opacity=".87">
          <GameSprite v-for="([x, y], i) in treeSpots" :key="i" name="tree" :x="mission.width * x - 33" :y="mission.height * y - 48" width="66" height="85"/>
          <GameSprite name="flower" :x="mission.width * .56" :y="mission.height * .91" width="46" height="40"/>
          <GameSprite name="flower" :x="mission.width * .3" :y="mission.height * .59" width="38" height="35"/>
          <GameSprite name="sun" :x="mission.width - 76" y="20" width="47" height="47"/>
        </g>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-for="road in roads" :key="`border-${road.id}`" :d="road.path" stroke="#ced8bf" stroke-width="48"/>
          <path v-for="road in roads" :key="road.id" :d="road.path" stroke="#fffdf5" stroke-width="39"/>
          <path v-for="road in roads.filter((r) => state.used.has(r.id))" :key="`ink-${road.id}`" :d="road.path" stroke="#dd9161" stroke-width="12"/>
          <path v-if="trace" :d="partial" stroke="#dd9161" stroke-width="12"/>
          <path v-if="hintPath" :d="hintPath" stroke="#549785" stroke-width="9" stroke-dasharray="2 17"/>
        </g>
        <g aria-hidden="true">
          <circle v-for="(point, id) in mission.nodes" :key="id" :cx="point[0]" :cy="point[1]" r="5" fill="#d6dcc8"/>
          <g :transform="`translate(${mission.nodes.start.join(' ')})`">
            <rect x="-46" y="-88" width="92" height="33" rx="16" fill="#fff8ee"/>
            <text y="-66" text-anchor="middle" fill="#ba5944" font-size="18" font-weight="800">紅色起點</text>
            <path d="M-29 0H27M13-13 28 0 13 13" fill="none" stroke="#d96f53" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <g :transform="`translate(${mission.nodes.finish.join(' ')})`">
            <circle r="26" fill="#e0eff3" stroke="#68a6bc" stroke-width="2"/>
            <path d="M-13 0H13M2-10 13 0 2 10" fill="none" stroke="#4e91ae" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="-43" y="-65" width="86" height="30" rx="15" fill="#f5fcfc"/>
            <text y="-44" text-anchor="middle" font-size="17" fill="#477e96" font-weight="800">藍色終點</text>
          </g>
        </g>
        <g v-for="(stop, index) in mission.stops" :key="stop.node" :data-house="index + 1" :transform="`translate(${mission.nodes[stop.node].join(' ')})`" aria-hidden="true">
          <GameSprite name="home" x="-48" :y="index === 1 ? -115 : 20" width="96" height="87"/>
          <circle r="23" :fill="index < state.delivered ? '#608d72' : '#fffdf4'" :stroke="index === state.delivered ? '#d8944f' : '#8ca57e'" stroke-width="3"/>
          <text y="8" text-anchor="middle" font-size="26" font-weight="850" :fill="index < state.delivered ? '#fffdf4' : '#557348'">{{ index + 1 }}</text>
          <g v-if="index < state.delivered" class="delivery-sticker" :transform="`translate(23 ${index === 1 ? -48 : 71})`" :data-delivered="index + 1">
            <circle r="26" fill="#fffdf7" stroke="#e2bd74" stroke-width="2" stroke-dasharray="3 3"/>
            <GameSprite name="parcel" x="-21" y="-21" width="42" height="42"/>
            <circle cx="20" cy="15" r="10" fill="#608d72"/><text x="20" y="20" text-anchor="middle" font-size="14" fill="white">✓</text>
          </g>
        </g>
        <g :transform="`translate(${position.join(' ')})`" data-delivery-truck :data-node="state.node" aria-hidden="true">
          <circle v-if="mode === 'trace' && enabled" r="35" fill="#c1dce833" stroke="#568fa8" stroke-width="2" stroke-dasharray="4 5"/>
          <g :transform="`rotate(${angle})`"><GameSprite name="truck-top" x="-40" y="-29" width="80" height="58"/></g>
        </g>
      </svg>
      <div v-if="mode === 'tap' && enabled" ref="targetLayer" class="delivery-targets" role="group" aria-label="選擇下一個路口">
        <button v-for="node in neighbors" :key="node" type="button" class="delivery-target" :class="{ hinted: node === hint }"
          :style="percent(node)" :data-node="node" :aria-label="targetLabel(node)" @click="emit('move', node)">
          <svg viewBox="0 0 32 32" aria-hidden="true" :style="{ rotate: `${heading(mission.nodes[state.node], mission.nodes[node])}deg` }"><use href="#i-arrow"/></svg>
        </button>
      </div>
      <button v-if="state.pendingStamp" ref="stampButton" class="delivery-stamp-button" :style="percent(state.node)" @click="emit('stamp')">
        <GameSprite name="parcel"/><span>貼包裹 ✓</span>
      </button>
      <div class="delivery-map-note">同一路段只走一次</div>
    </div>
  </section>
</template>
