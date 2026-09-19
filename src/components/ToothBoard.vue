<script setup lang="ts">
import type { SpriteName } from '../art/sprites';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import GameSprite from './GameSprite.vue';
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

const roads = { border: '#c5d4ce', fill: '#f7fffc' };

function bugSprite(id: NodeId): SpriteName {
  return props.graph.hazards.indexOf(id) % 2 ? 'bug-purple' : 'bug-coral';
}

function ariaFor(to: NodeId): string {
  return `前往${props.graph.titles[to]}`;
}

function targetClass(to: NodeId): string {
  return props.graph.hazards.includes(to) ? 'step-target--hazard' : '';
}
</script>

<template>
  <MazeBoard
    theme="tooth"
    :graph="graph"
    :state="state"
    :interactive="interactive"
    :narrow="narrow"
    :facing="facing"
    :hint-node="hintNode"
    :in-flight="inFlight"
    board-label="刷牙路線遊戲"
    frame-class="tooth-board"
    :roads="roads"
    :aria-for="ariaFor"
    :target-class="targetClass"
    @move="$emit('move', $event)"
  >
    <template #target="{ link, rotate }">
      <GameSprite v-if="graph.hazards.includes(link.to)" class="target-bug" aria-hidden="true" :name="bugSprite(link.to)" width="80" height="80"/>
      <svg v-else viewBox="0 0 32 32" aria-hidden="true" :style="{ transform: rotate }">
        <use href="#i-arrow"/>
      </svg>
    </template>
    <template #note>
      <div class="board-note">
        <svg aria-hidden="true"><use href="#i-once"/></svg>
        <span>同一路段不可走兩次 · 避開蛀牙蟲</span>
      </div>
    </template>
  </MazeBoard>
</template>
