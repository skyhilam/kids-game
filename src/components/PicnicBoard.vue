<script setup lang="ts">
import { computed, watch } from 'vue';
import { picnicCollect } from '../picnic/board';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import MazeBoard from './MazeBoard.vue';

const props = defineProps<{
  graph: Graph;
  state: GameState;
  interactive: boolean;
  narrow: boolean;
  facing: number;
  hintNode: NodeId | null;
  inFlight: InFlightMove | null;
}>();

defineEmits<{
  move: [to: NodeId];
}>();

watch(() => picnicCollect(props.graph), () => {}, { immediate: true });</script>

<template>
  <MazeBoard
    theme="picnic"
    :graph="graph"
    :state="state"
    :interactive="interactive"
    :narrow="narrow"
    :facing="facing"
    :hint-node="hintNode"
    :in-flight="inFlight"
    board-label="野餐路線遊戲"
    board-id="board"
    map-id="map"
    player-id="car"
    @move="$emit('move', $event)"
  />
</template>
