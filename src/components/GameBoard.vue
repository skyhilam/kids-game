<script setup lang="ts">
import { computed } from 'vue';
import { available, mapSize } from '../game/rules';
import type { GameState, Graph, NodeId } from '../game/types';

const props = defineProps<{
  graph: Graph;
  state: GameState;
  started: boolean;
  moving: boolean;
  narrow: boolean;
  carX: number;
  carY: number;
  carAngle: number;
  hintNode: NodeId | null;
  pickupVisible: boolean;
  trailProgress: { edgeId: string; reverse: boolean; t: number } | null;
}>();

const emit = defineEmits<{
  move: [to: NodeId];
  swipeStart: [event: PointerEvent];
  swipeEnd: [event: PointerEvent];
  swipeCancel: [];
}>();

const size = computed(() => mapSize(props.narrow));
const scaleX = computed(() => size.value.width / 840);
const scaleY = computed(() => size.value.height / 660);

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
  if (!props.started || props.moving || props.state.won || props.state.stalled) return [];
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
  const destination = to === 'h' ? '漢堡店' : to === 'p' ? '公園' : to === 'v' ? '小路盡頭' : '下一個路口';
  return `向${direction}行，去${destination}`;
}

function showHand(to: NodeId, index: number): boolean {
  return to === props.hintNode || (props.state.level === 0 && props.state.node === 's' && index === 0);
}

const usedEdges = computed(() => props.graph.edges.filter((edge) => props.state.used.has(edge.id)));

const animTrail = computed(() => {
  const anim = props.trailProgress;
  if (!anim) return null;
  const edge = props.graph.edges.find((item) => item.id === anim.edgeId);
  if (!edge) return null;
  const d = anim.reverse ? pathOf(edge.b, edge.a) : pathOf(edge.a, edge.b);
  const length = edgeLength(edge.a, edge.b);
  return { d, length, offset: length * (1 - anim.t), done: anim.t >= 1 };
});

const s = computed(() => props.graph.nodes.s);
const h = computed(() => props.graph.nodes.h);
const p = computed(() => props.graph.nodes.p);
const v = computed(() => props.graph.nodes.v);
const picnicX = computed(() => Math.min(p.value[0] - 95, size.value.width - 210));
const pickupStyle = computed(() => {
  const [x, y] = h.value;
  return {
    left: `${x / size.value.width * 100}%`,
    top: `${(y - 43) / size.value.height * 100}%`,
  };
});

const treeScale = computed(() => props.narrow ? `${840 / size.value.width * 0.88} ${660 / size.value.height * 0.88}` : '1 1');
function treeTransform(x: number, y: number, w: number, hgt: number): string {
  if (!props.narrow) return '';
  const cx = x + w / 2;
  const cy = y + hgt;
  const [sx, sy] = treeScale.value.split(' ');
  return `translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
}
</script>

<template>
  <section class="board-frame" aria-label="野餐路線遊戲">
    <div
      class="board"
      id="board"
      :class="{ moving }"
      :style="{ aspectRatio: `${size.width} / ${size.height}` }"
      @pointerdown="emit('swipeStart', $event)"
      @pointerup="emit('swipeEnd', $event)"
      @pointercancel="emit('swipeCancel')"
    >
      <svg class="landscape" id="map" :viewBox="`0 0 ${size.width} ${size.height}`" aria-hidden="true">
        <defs>
          <pattern id="grassPattern" width="114" height="101" patternUnits="userSpaceOnUse">
            <path d="m13 32 2-6m4 6 2-5m62 49 3-5m5 5 2-6" stroke="#b7cb92" stroke-width="2" stroke-linecap="round" opacity=".45"/>
            <circle cx="51" cy="22" r="2" fill="#f7f4cd" opacity=".8"/>
            <circle cx="97" cy="21" r="2.3" fill="#c4d69e" opacity=".55"/>
          </pattern>
        </defs>
        <g id="baseScenery" :transform="`scale(${scaleX} ${scaleY})`">
          <rect width="840" height="660" fill="#e4edd4"/>
          <path d="M0 20q179-45 358 40t482-5v-55H0Z" fill="#d9e6c5"/>
          <path d="M0 517q135-94 271 29t313-11 256-38v163H0Z" fill="#dce8c9"/>
          <rect width="840" height="660" fill="url(#grassPattern)"/>
        </g>
        <g id="backDecor" :transform="`scale(${scaleX} ${scaleY})`">
          <path d="M840 501q-79-22-105 13t-37 80q-20 33 50 66h92Z" fill="#b7d7d1"/>
          <path d="M840 514q-73-25-91 17t-33 64" fill="none" stroke="#cfe5d7" stroke-width="5"/>
          <path d="M767 553h25m-40 30h22m22 28h19" stroke="#e6f1df" stroke-width="3" stroke-linecap="round"/>
          <g :transform="narrow ? `translate(766 73) scale(${840 / size.width} ${660 / size.height})` : 'translate(766 73)'">
            <g stroke="#e1c26a" stroke-width="2.6" stroke-linecap="round">
              <path d="M0-34v-7M0 34v7M-34 0h-7M34 0h7M-24-24l-5-5M24-24l5-5M24 24l5 5M-24 24l-5 5"/>
            </g>
            <circle r="25" fill="#f2d889"/>
            <circle cx="-7" cy="-1" r="2" fill="#a79964"/>
            <circle cx="7" cy="-1" r="2" fill="#a79964"/>
            <path d="M-5 7q5 5 10 0" fill="none" stroke="#b5a368" stroke-width="2" stroke-linecap="round"/>
          </g>
          <g fill="#f8faed" opacity=".85">
            <path d="M242 65c-5-24 28-31 39-11 25-17 39 3 32 17h-66q-9 0-5-6Z"/>
            <path d="M488 74c-2-13 16-23 25-9 21-12 31 4 25 11h-44q-9 0-6-2Z"/>
          </g>
          <use href="#art-tree" x="20" y="188" width="76" height="97" :transform="treeTransform(20,188,76,97)"/>
          <use href="#art-tree" x="748" y="309" width="80" height="108" :transform="treeTransform(748,309,80,108)"/>
          <use href="#art-tree" x="21" y="544" width="66" height="88" :transform="treeTransform(21,544,66,88)"/>
          <use href="#art-flower" class="flower" x="265" y="238" width="29" height="35" :transform="treeTransform(265,238,29,35)"/>
          <use href="#art-flower" class="flower" x="330" y="574" width="30" height="36" :transform="treeTransform(330,574,30,36)"/>
          <use href="#art-flower" class="flower" x="533" y="437" width="28" height="34" :transform="treeTransform(533,437,28,34)"/>
          <g fill="#b5c98c">
            <ellipse cx="65" cy="436" rx="18" ry="10"/>
            <ellipse cx="82" cy="432" rx="16" ry="13"/>
            <ellipse cx="98" cy="438" rx="14" ry="8"/>
          </g>
          <path d="M248 444q10-10 20 0m7 0q10-10 20 0" stroke="#9eb886" stroke-width="3" fill="none" stroke-linecap="round"/>
          <g transform="translate(595 81) rotate(-8)">
            <path d="M-11 0q5-8 11 0 5-8 11 0" fill="none" stroke="#9caf9b" stroke-width="2.3" stroke-linecap="round"/>
          </g>
        </g>
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
            <path
              v-if="!trailProgress || trailProgress.edgeId !== edge.id || trailProgress.t >= 1"
              class="road-used"
              :d="pathOf(edge.a, edge.b)"
              :data-edge="edge.id"
            />
            <path
              v-if="!trailProgress || trailProgress.edgeId !== edge.id || trailProgress.t >= 1"
              class="road-used-inner"
              :d="pathOf(edge.a, edge.b)"
            />
          </template>
          <path
            v-if="animTrail && trailProgress && trailProgress.t < 1"
            class="road-used"
            :d="animTrail.d"
            :stroke-dasharray="`${animTrail.length} ${animTrail.length}`"
            :stroke-dashoffset="animTrail.offset"
          />
        </g>
        <g id="landmarks">
          <use href="#art-home" :x="s[0]-58" :y="s[1]-130" width="116" height="106"/>
          <g :transform="`translate(${s[0]+59} ${s[1]-29})`">
            <rect x="-23" y="-15" width="50" height="25" rx="12" fill="#fff5e7" stroke="#efc9b1"/>
            <text x="2" y="2" text-anchor="middle" font-size="12" fill="#c27c5a" font-weight="800">出發</text>
            <path d="m-29 19-16 11m3-14-3 14 14 1" stroke="#de785c" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <use href="#art-shop" :x="h[0]-82" :y="h[1]-165" width="164" height="135"/>
          <rect :x="h[0]-32" :y="h[1]-41" width="64" height="23" rx="11" fill="#fff8e6" stroke="#dcd2aa"/>
          <text :x="h[0]" :y="h[1]-25" text-anchor="middle" font-size="12" fill="#9b7751" font-weight="800">漢堡店</text>
          <g id="shopMarker" :transform="`translate(${h[0]} ${h[1]})`">
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
            :y="p[1]+15"
            width="200"
            height="104"
            id="destinationArt"
          />
          <g :transform="`translate(${p[0]} ${p[1]})`">
            <circle r="19" fill="#dcebea" stroke="#79a6ac" stroke-width="2"/>
            <path d="M-9 0H9M2-7l7 7-7 7" fill="none" stroke="#609299" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <g :transform="`translate(${p[0]+56} ${p[1]-18})`">
            <rect x="-26" y="-15" width="52" height="27" rx="13" fill="#eef6ed" stroke="#aec9bc"/>
            <text text-anchor="middle" y="3" font-size="12" fill="#658d7e" font-weight="800">公園</text>
          </g>
          <g v-if="v" :transform="`translate(${v[0]-18} ${v[1]})`">
            <path d="M0-16v32" stroke="#b9ac85" stroke-width="5" stroke-linecap="round"/>
            <path d="M-6-10H6M-6 9H6" stroke="#d4c7a0" stroke-width="4" stroke-linecap="round"/>
          </g>
        </g>
        <g id="car" class="car-group" :transform="`translate(${carX.toFixed(2)} ${carY.toFixed(2)})`">
          <g id="carBody" :transform="`rotate(${carAngle.toFixed(2)})`">
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
        <span>每段路，只行一次</span>
      </div>
      <div id="targets" class="target-layer" role="group" aria-label="可選的小路">
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
      <div id="pickup" class="pickup-pop" :hidden="!pickupVisible" :style="pickupStyle">漢堡買好喇！ <span>✓</span></div>
    </div>
  </section>
</template>
