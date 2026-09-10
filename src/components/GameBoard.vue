<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBoardInput } from '../composables/useBoardInput';
import { available, mapSize, shopArtOrigin, SHOP_ART } from '../game/rules';
import { carPose, easeInOut } from '../game/motion';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import BoardScenery from './BoardScenery.vue';

const props = defineProps<{
  graph: Graph;
  state: GameState;
  interactive: boolean;
  narrow: boolean;
  facing: number;
  hintNode: NodeId | null;
  pickupVisible: boolean;
  inFlight: InFlightMove | null;
}>();

const emit = defineEmits<{
  move: [to: NodeId];
}>();

const boardEl = ref<HTMLElement | null>(null);
const targetLayer = ref<HTMLElement | null>(null);
const size = computed(() => mapSize(props.narrow));
const pose = computed(() => carPose(props.graph, props.state.node, props.facing, props.inFlight));
const startAt = computed(() => props.graph.nodes[props.graph.start]);
const shopAt = computed(() => props.graph.nodes[props.graph.shop]);
const parkAt = computed(() => props.graph.nodes[props.graph.park]);

function pathOf(a: NodeId, b: NodeId): string {
  const pa = props.graph.nodes[a];
  const pb = props.graph.nodes[b];
  return `M${pa[0]},${pa[1]} L${pb[0]},${pb[1]}`;
}

function edgeLength(a: NodeId, b: NodeId): number {
  const pa = props.graph.nodes[a];
  const pb = props.graph.nodes[b];
  return Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
}

const links = computed(() => {
  if (!props.interactive) return [];
  return available(props.graph, props.state.node, props.state.used);
});

function targetStyle(to: NodeId): { left: string; top: string } {
  const [x, y] = props.graph.nodes[to];
  return { left: `${x / size.value.width * 100}%`, top: `${y / size.value.height * 100}%` };
}

function arrowRotate(to: NodeId): string {
  const [x0, y0] = props.graph.nodes[props.state.node];
  const [x1, y1] = props.graph.nodes[to];
  return `rotate(${Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI}deg)`;
}

function ariaFor(to: NodeId): string {
  const [x0, y0] = props.graph.nodes[props.state.node];
  const [x1, y1] = props.graph.nodes[to];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '右' : '左') : (dy > 0 ? '下' : '上');
  const destination = props.graph.titles[to];
  return `向${direction}前往${destination}`;
}

function showHand(to: NodeId, index: number): boolean {
  return to === props.hintNode || (
    props.graph.tutorial && props.state.node === props.graph.start && index === 0
  );
}

const usedEdges = computed(() => props.graph.edges.filter((edge) => props.state.used.has(edge.id)));

const animTrail = computed(() => {
  const anim = props.inFlight;
  if (!anim || anim.t >= 1) return null;
  const edge = props.graph.edges.find((item) => item.id === anim.edgeId);
  if (!edge) return null;
  const d = anim.reverse ? pathOf(edge.b, edge.a) : pathOf(edge.a, edge.b);
  const length = edgeLength(edge.a, edge.b);
  const t = easeInOut(anim.t);
  return { d, length, offset: length * (1 - t) };
});

const shopArt = computed(() => shopArtOrigin(shopAt.value));
const picnicX = computed(() => Math.min(parkAt.value[0] - 95, size.value.width - 210));
const pickupStyle = computed(() => {
  const [x, y] = shopAt.value;
  return {
    left: `${x / size.value.width * 100}%`,
    top: `${(y - 43) / size.value.height * 100}%`,
  };
});

const { onPointerDown, onPointerUp, onPointerCancel } = useBoardInput({
  boardEl,
  targetLayer,
  graph: () => props.graph,
  state: () => props.state,
  interactive: () => props.interactive,
  narrow: () => props.narrow,
  inFlight: () => props.inFlight,
  onMove: (to) => emit('move', to),
});
</script>

<template>
  <section class="board-frame" aria-label="野餐路線遊戲">
    <div
      ref="boardEl"
      class="board"
      id="board"
      :class="{ moving: !!inFlight }"
      :style="{ aspectRatio: `${size.width} / ${size.height}` }"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <BoardScenery />
      <svg class="playfield" id="map" :viewBox="`0 0 ${size.width} ${size.height}`" aria-hidden="true">
        <g id="roads">
          <path
            v-for="edge in graph.edges"
            :key="'border-'+edge.id"
            :d="pathOf(edge.a, edge.b)"
            fill="none"
            stroke="#c8cdb3"
            stroke-width="72"
            stroke-linecap="round"
          />
          <path
            v-for="edge in graph.edges"
            :key="'fill-'+edge.id"
            :d="pathOf(edge.a, edge.b)"
            fill="none"
            stroke="#fcf6e5"
            stroke-width="65"
            stroke-linecap="round"
          />
          <path
            v-for="edge in graph.edges"
            :key="'inner-'+edge.id"
            :d="pathOf(edge.a, edge.b)"
            fill="none"
            stroke="#e9e4d0"
            stroke-width="48"
            stroke-linecap="round"
          />
          <path
            v-for="edge in graph.edges"
            :key="'center-'+edge.id"
            class="road-center"
            :d="pathOf(edge.a, edge.b)"
          />
        </g>
        <g id="trails">
          <template v-for="edge in usedEdges" :key="'used-'+edge.id">
            <path class="road-used" :d="pathOf(edge.a, edge.b)" :data-edge="edge.id"/>
            <path class="road-used-inner" :d="pathOf(edge.a, edge.b)"/>
          </template>
          <path
            v-if="animTrail"
            class="road-used"
            :d="animTrail.d"
            :stroke-dasharray="`${animTrail.length} ${animTrail.length}`"
            :stroke-dashoffset="animTrail.offset"
          />
        </g>
        <g id="landmarks">
          <use href="#art-home" :x="startAt[0]-58" :y="startAt[1]-130" width="116" height="106"/>
          <g :transform="`translate(${startAt[0]+59} ${startAt[1]-29})`">
            <rect x="-23" y="-15" width="50" height="25" rx="12" fill="#fff5e7" stroke="#efc9b1"/>
            <text x="2" y="2" text-anchor="middle" font-size="12" fill="#c27c5a" font-weight="800">{{ graph.titles[graph.start] }}</text>
            <path d="m-29 19-16 11m3-14-3 14 14 1" stroke="#de785c" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <use href="#art-shop" :x="shopArt[0]" :y="shopArt[1]" :width="SHOP_ART.width" :height="SHOP_ART.height"/>
          <rect :x="shopAt[0]-32" :y="shopAt[1]-41" width="64" height="23" rx="11" fill="#fff8e6" stroke="#dcd2aa"/>
          <text :x="shopAt[0]" :y="shopAt[1]-25" text-anchor="middle" font-size="12" fill="#9b7751" font-weight="800">{{ graph.titles[graph.shop] }}</text>
          <g id="shopMarker" :transform="`translate(${shopAt[0]} ${shopAt[1]})`">
            <template v-if="state.burger">
              <circle r="18" fill="#e6efda" stroke="#8eac70" stroke-width="2"/>
              <path d="m-8 0 5 5L9-7" fill="none" stroke="#6a9257" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle r="18" fill="#fbebc6" stroke="#d9b571" stroke-width="2"/>
              <use href="#art-burger" x="-14" y="-13" width="28" height="26"/>
            </template>
          </g>
          <use
            :href="state.won ? '#art-picnic' : '#art-picnic-place'"
            :x="picnicX"
            :y="parkAt[1]+15"
            width="200"
            height="104"
            id="destinationArt"
          />
          <g :transform="`translate(${parkAt[0]} ${parkAt[1]})`">
            <circle r="19" fill="#dcebea" stroke="#79a6ac" stroke-width="2"/>
            <path d="M-9 0H9M2-7l7 7-7 7" fill="none" stroke="#609299" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <g :transform="`translate(${parkAt[0]+56} ${parkAt[1]-18})`">
            <rect x="-26" y="-15" width="52" height="27" rx="13" fill="#eef6ed" stroke="#aec9bc"/>
            <text text-anchor="middle" y="3" font-size="12" fill="#658d7e" font-weight="800">{{ graph.titles[graph.park] }}</text>
          </g>
          <g v-for="id in graph.deadends" :key="'dead-'+id" :transform="`translate(${graph.nodes[id][0]-18} ${graph.nodes[id][1]})`">
            <path d="M0-16v32" stroke="#b9ac85" stroke-width="5" stroke-linecap="round"/>
            <path d="M-6-10H6M-6 9H6" stroke="#d4c7a0" stroke-width="4" stroke-linecap="round"/>
          </g>
        </g>
        <g id="car" class="car-group" :transform="`translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)})`">
          <g id="carBody" :transform="`rotate(${pose.angle.toFixed(2)})`">
            <rect x="-24" y="-29" width="18" height="12" rx="5" fill="#44534a"/>
            <rect x="-24" y="17" width="18" height="12" rx="5" fill="#44534a"/>
            <rect x="18" y="-29" width="14" height="12" rx="5" fill="#44534a"/>
            <rect x="18" y="17" width="14" height="12" rx="5" fill="#44534a"/>
            <rect x="-41" y="-23" width="83" height="46" rx="17" fill="#dc694f" stroke="#aa4f3c" stroke-width="2"/>
            <path d="M19-19h8q12 0 12 12V7q0 12-12 12h-8" fill="#ed8262"/>
            <rect x="32" y="-17" width="7" height="10" rx="3" fill="#ffefbe"/>
            <rect x="32" y="7" width="7" height="10" rx="3" fill="#ffefbe"/>
            <rect x="-32" y="-19" width="45" height="38" rx="12" fill="#b9cebc"/>
            <path d="M4-17q13 17 0 34" fill="#e0edd2"/>
            <use href="#art-bear" x="-28" y="-20" width="38" height="39"/>
            <path d="M-36-10v20" stroke="#efb09b" stroke-width="3" stroke-linecap="round"/>
          </g>
          <g id="cargo" :visibility="state.burger ? 'visible' : 'hidden'" transform="translate(-44,-44)">
            <rect x="-3" y="3" width="35" height="29" rx="8" fill="#fff7df" stroke="#c69c60" stroke-width="2"/>
            <use href="#art-burger" x="0" y="1" width="29" height="29"/>
          </g>
        </g>
      </svg>
      <div class="board-note">
        <svg aria-hidden="true"><use href="#i-once"/></svg>
        <span>每段道路僅可通行一次</span>
      </div>
      <div id="targets" ref="targetLayer" class="target-layer" role="group" aria-label="可選的小路">
        <button
          v-for="(link, index) in links"
          :key="link.edge.id + link.to"
          type="button"
          class="step-target"
          :class="{ hinted: link.to === hintNode }"
          :data-node="link.to"
          :data-edge="link.edge.id"
          :style="targetStyle(link.to)"
          :aria-label="ariaFor(link.to)"
          @click.stop="emit('move', link.to)"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" :style="{ transform: arrowRotate(link.to) }">
            <use href="#i-arrow"/>
          </svg>
          <svg v-if="showHand(link.to, index)" class="hint-hand" viewBox="0 0 48 56" aria-hidden="true">
            <use href="#i-hand"/>
          </svg>
        </button>
      </div>
      <div id="pickup" class="pickup-pop" :hidden="!pickupVisible" :style="pickupStyle">已購得漢堡 <span>✓</span></div>
    </div>
  </section>
</template>
