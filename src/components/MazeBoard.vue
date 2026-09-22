<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBoardInput } from '../composables/useBoardInput';
import { available, mapSize } from '../game/rules';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import PhaserGame from '../phaser/PhaserGame.vue';
import type { MazeBoardModel, MazeTheme } from '../phaser/models';

const props = withDefaults(defineProps<{
  graph: Graph;
  state: GameState;
  interactive: boolean;
  narrow: boolean;
  facing: number;
  hintNode: NodeId | null;
  inFlight: InFlightMove | null;
  theme: MazeTheme;
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
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const model = computed<MazeBoardModel>(() => ({
  kind: 'maze',
  theme: props.theme,
  width: size.value.width,
  height: size.value.height,
  graph: props.graph,
  state: props.state,
  facing: props.facing,
  inFlight: props.inFlight,
  reduceMotion,
  roads: props.roads,
}));

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
      :data-path-ready="interactive && links.length > 0 ? 'true' : 'false'"
      :style="{ aspectRatio: `${size.width} / ${size.height}` }"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <PhaserGame :key="`${theme}-${size.width}x${size.height}`" :model="model" />
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
