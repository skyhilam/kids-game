<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBoardInput } from '../composables/useBoardInput';
import { available, mapSize } from '../game/rules';
import { carPose, easeInOut } from '../game/motion';
import {
  ROAD_BORDER_RADIUS,
  ROAD_BORDER_WIDTH,
  ROAD_FILL_RADIUS,
  ROAD_FILL_WIDTH,
  ROAD_INNER_RADIUS,
  ROAD_INNER_WIDTH,
  ROAD_USED_RADIUS,
  centerDashOffset,
  centerPath,
  edgePath,
  jointIds,
} from '../game/roads';
import { traveledPath } from '../game/trail';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';

const props = withDefaults(defineProps<{
  graph: Graph;
  state: GameState;
  interactive: boolean;
  narrow: boolean;
  facing: number;
  hintNode: NodeId | null;
  inFlight: InFlightMove | null;
  boardLabel: string;
  boardId?: string;
  mapId?: string;
  playerId?: string;
  frameClass?: string;
  roads?: { border: string; fill: string; inner?: string };
  ariaFor?: (to: NodeId) => string;
  targetClass?: (to: NodeId) => string;
}>(), {
  frameClass: '',
  roads: () => ({ border: '#c8cdb3', fill: '#fcf6e5', inner: '#e9e4d0' }),
});

const emit = defineEmits<{
  move: [to: NodeId];
}>();

const boardEl = ref<HTMLElement | null>(null);
const targetLayer = ref<HTMLElement | null>(null);
const size = computed(() => mapSize(props.narrow));
const pose = computed(() => carPose(props.graph, props.state.node, props.facing, props.inFlight));

function pathOf(a: NodeId, b: NodeId): string {
  return edgePath(props.graph.nodes[a], props.graph.nodes[b]);
}

function centerOf(a: NodeId, b: NodeId): string {
  return centerPath(props.graph.nodes[a], props.graph.nodes[b]);
}

function dashOffsetOf(a: NodeId, b: NodeId): number {
  return centerDashOffset(props.graph.nodes[a], props.graph.nodes[b]);
}

function nodeAt(id: NodeId): { id: NodeId; x: number; y: number } {
  const [x, y] = props.graph.nodes[id];
  return { id, x, y };
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

function defaultAria(to: NodeId): string {
  const [x0, y0] = props.graph.nodes[props.state.node];
  const [x1, y1] = props.graph.nodes[to];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '右' : '左') : (dy > 0 ? '下' : '上');
  return `向${direction}前往${props.graph.titles[to]}`;
}

function announce(to: NodeId): string {
  return props.ariaFor?.(to) ?? defaultAria(to);
}

function showHand(to: NodeId, index: number): boolean {
  return to === props.hintNode || (
    props.graph.tutorial && props.state.node === props.graph.start && index === 0
  );
}

const roadJoints = computed(() => jointIds(props.graph.edges).map(nodeAt));

const usedEdges = computed(() => props.graph.edges
  .filter((edge) => props.state.used.has(edge.id))
  .map((edge) => ({
    id: edge.id,
    d: traveledPath(props.graph.nodes, edge, props.state.usedFrom[edge.id]),
  })));

const usedJoints = computed(() => jointIds(
  props.graph.edges.filter((edge) => props.state.used.has(edge.id)),
).map(nodeAt));

const animTrail = computed(() => {
  const anim = props.inFlight;
  if (!anim || anim.t >= 1) return null;
  const edge = props.graph.edges.find((item) => item.id === anim.edgeId);
  if (!edge) return null;
  const d = traveledPath(props.graph.nodes, edge, anim.from);
  const length = edgeLength(edge.a, edge.b);
  const t = easeInOut(anim.t);
  return { d, length, offset: length * (1 - t) };
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
  <section class="board-frame" :class="frameClass" :aria-label="boardLabel">
    <div
      ref="boardEl"
      class="board"
      :id="boardId"
      :class="{ moving: !!inFlight }"
      :style="{ aspectRatio: `${size.width} / ${size.height}` }"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <slot name="scenery" :width="size.width" :height="size.height" />
      <svg class="playfield" :id="mapId" :viewBox="`0 0 ${size.width} ${size.height}`" aria-hidden="true">
        <g id="roads">
          <path
            v-for="edge in graph.edges"
            :key="'border-'+edge.id"
            class="road-edge"
            :d="pathOf(edge.a, edge.b)"
            fill="none"
            :stroke="roads.border"
            :stroke-width="ROAD_BORDER_WIDTH"
            stroke-linecap="butt"
          />
          <circle
            v-for="joint in roadJoints"
            :key="'border-join-'+joint.id"
            class="road-join-border"
            :data-node="joint.id"
            :cx="joint.x"
            :cy="joint.y"
            :r="ROAD_BORDER_RADIUS"
            :fill="roads.border"
          />
          <path
            v-for="edge in graph.edges"
            :key="'fill-'+edge.id"
            class="road-edge"
            :d="pathOf(edge.a, edge.b)"
            fill="none"
            :stroke="roads.fill"
            :stroke-width="ROAD_FILL_WIDTH"
            stroke-linecap="butt"
          />
          <circle
            v-for="joint in roadJoints"
            :key="'fill-join-'+joint.id"
            class="road-join-fill"
            :data-node="joint.id"
            :cx="joint.x"
            :cy="joint.y"
            :r="ROAD_FILL_RADIUS"
            :fill="roads.fill"
          />
          <template v-if="roads.inner">
            <path
              v-for="edge in graph.edges"
              :key="'inner-'+edge.id"
              class="road-edge"
              :d="pathOf(edge.a, edge.b)"
              fill="none"
              :stroke="roads.inner"
              :stroke-width="ROAD_INNER_WIDTH"
              stroke-linecap="butt"
            />
            <circle
              v-for="joint in roadJoints"
              :key="'inner-join-'+joint.id"
              class="road-join-inner"
              :data-node="joint.id"
              :cx="joint.x"
              :cy="joint.y"
              :r="ROAD_INNER_RADIUS"
              :fill="roads.inner"
            />
          </template>
          <path
            v-for="edge in graph.edges"
            :key="'center-'+edge.id"
            class="road-center"
            :d="centerOf(edge.a, edge.b)"
            :stroke-dashoffset="dashOffsetOf(edge.a, edge.b)"
          />
        </g>
        <g id="trails">
          <template v-for="edge in usedEdges" :key="'used-'+edge.id">
            <path class="road-used" :d="edge.d" :data-edge="edge.id"/>
            <path class="road-used-inner" :d="edge.d"/>
          </template>
          <circle
            v-for="joint in usedJoints"
            :key="'used-join-'+joint.id"
            class="road-used-join"
            :data-node="joint.id"
            :cx="joint.x"
            :cy="joint.y"
            :r="ROAD_USED_RADIUS"
          />
          <path
            v-if="animTrail"
            class="road-used is-growing"
            :d="animTrail.d"
            :stroke-dasharray="`${animTrail.length} ${animTrail.length}`"
            :stroke-dashoffset="animTrail.offset"
          />
        </g>
        <g id="landmarks">
          <slot name="landmarks" :size="size" :pose="pose" :links="links" />
        </g>
        <g :id="playerId" class="car-group" :transform="`translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)})`">
          <slot name="player" :pose="pose" />
        </g>
      </svg>
      <slot name="note">
        <div class="board-note">
          <svg aria-hidden="true"><use href="#i-once"/></svg>
          <span>每段道路僅可通行一次</span>
        </div>
      </slot>
      <div ref="targetLayer" class="target-layer" role="group" aria-label="可選的小路">
        <button
          v-for="(link, index) in links"
          :key="link.edge.id + link.to"
          type="button"
          class="step-target"
          :class="[{ hinted: link.to === hintNode }, targetClass?.(link.to)]"
          :data-node="link.to"
          :data-edge="link.edge.id"
          :style="targetStyle(link.to)"
          :aria-label="announce(link.to)"
          @click.stop="emit('move', link.to)"
        >
          <slot name="target" :link="link" :index="index" :rotate="arrowRotate(link.to)">
            <svg viewBox="0 0 32 32" aria-hidden="true" :style="{ transform: arrowRotate(link.to) }">
              <use href="#i-arrow"/>
            </svg>
          </slot>
          <svg v-if="showHand(link.to, index)" class="hint-hand" viewBox="0 0 48 56" aria-hidden="true">
            <use href="#i-hand"/>
          </svg>
        </button>
      </div>
      <slot name="overlay" :size="size" />
    </div>
  </section>
</template>
