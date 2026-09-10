<script setup lang="ts">
import { computed } from 'vue';
import type { SpriteName } from '../art/sprites';
import { mapSize } from '../game/rules';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import GameSprite from './GameSprite.vue';
import MazeBoard from './MazeBoard.vue';
import ToothScenery from './ToothScenery.vue';

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

const size = computed(() => mapSize(props.narrow));
const startAt = computed(() => props.graph.nodes[props.graph.start]);
const goalAt = computed(() => props.graph.nodes[props.graph.goal]);
const roads = { border: '#c5d4ce', fill: '#f7fffc' };

function facingLeft(angle: number): boolean {
  return Math.cos(angle * Math.PI / 180) < -0.1;
}

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
    <template #scenery="{ width, height }">
      <ToothScenery :width="width" :height="height" />
    </template>
    <template #landmarks="{ links }">
      <ellipse :cx="startAt[0]" :cy="startAt[1]+8" rx="36" ry="12" fill="#bdddd2"/>
      <g :transform="`translate(${startAt[0]+56} ${startAt[1]+6})`">
        <rect x="-23" y="-15" width="50" height="25" rx="12" fill="#e8f4ff" stroke="#b7cde0"/>
        <text x="2" y="2" text-anchor="middle" font-size="12" fill="#4d7a9a" font-weight="800">{{ graph.titles[graph.start] }}</text>
      </g>
      <ellipse :cx="goalAt[0]" :cy="goalAt[1]+8" rx="38" ry="12" fill="#cde3ce"/>
      <GameSprite class="tooth-goal" name="tooth" :x="goalAt[0]-51" :y="goalAt[1]-125" width="102" height="96"/>
      <g :transform="`translate(${Math.min(goalAt[0]+52, size.width-31)} ${goalAt[1]+6})`">
        <rect x="-23" y="-15" width="50" height="25" rx="12" fill="#eef6ed" stroke="#aec9bc"/>
        <text x="2" y="2" text-anchor="middle" font-size="12" fill="#658d7e" font-weight="800">{{ graph.titles[graph.goal] }}</text>
      </g>
      <g v-for="id in graph.hazards" :key="'bug-'+id" :transform="`translate(${graph.nodes[id][0]} ${graph.nodes[id][1]})`">
        <ellipse cy="17" rx="31" ry="10" fill="#b7858d" opacity=".18"/>
        <GameSprite v-show="!links.some((link) => link.to === id)" class="tooth-bug" :name="bugSprite(id)" x="-42" y="-55" width="84" height="84"/>
      </g>
    </template>
    <template #player="{ pose }">
      <ellipse cy="15" rx="25" ry="8" fill="#446f5b" opacity=".15"/>
      <g id="carBody" :transform="`scale(${facingLeft(pose.angle) ? -1 : 1} 1)`">
        <g class="tooth-player" :class="{ 'is-walking': !!inFlight }">
          <GameSprite :name="state.won ? 'kid-cheer' : 'kid'" x="-43" y="-91" width="86" height="110"/>
        </g>
      </g>
    </template>
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
