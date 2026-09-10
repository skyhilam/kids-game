<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { picnicCollect } from '../picnic/board';
import { SHOP_ART, shopArtOrigin } from '../picnic/art';
import { mapSize } from '../game/rules';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';
import BoardScenery from './BoardScenery.vue';
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

const size = computed(() => mapSize(props.narrow));
const startAt = computed(() => props.graph.nodes[props.graph.start]);
const shopId = computed(() => picnicCollect(props.graph));
const shopAt = computed(() => props.graph.nodes[shopId.value]);
const parkAt = computed(() => props.graph.nodes[props.graph.goal]);
const shopArt = computed(() => shopArtOrigin(shopAt.value));
const picnicX = computed(() => Math.min(parkAt.value[0] - 95, size.value.width - 210));
const pickupStyle = computed(() => {
  const [x, y] = shopAt.value;
  return {
    left: `${x / size.value.width * 100}%`,
    top: `${(y - 43) / size.value.height * 100}%`,
  };
});
const pickupVisible = ref(false);
let pickupTimer = 0;
watch(() => props.state.collected, (now, was) => {
  window.clearTimeout(pickupTimer);
  if (now && !was) {
    pickupVisible.value = true;
    pickupTimer = window.setTimeout(() => { pickupVisible.value = false; }, 2300);
  } else {
    pickupVisible.value = false;
  }
});
onUnmounted(() => window.clearTimeout(pickupTimer));
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
    board-label="野餐路線遊戲"
    board-id="board"
    map-id="map"
    player-id="car"
    @move="$emit('move', $event)"
  >
    <template #scenery="{ width, height }">
      <BoardScenery :width="width" :height="height" />
    </template>
    <template #landmarks>
      <GameSprite name="home" :x="startAt[0]-58" :y="startAt[1]-130" width="116" height="106"/>
      <g :transform="`translate(${startAt[0]+59} ${startAt[1]-29})`">
        <rect x="-23" y="-15" width="50" height="25" rx="12" fill="#fff5e7" stroke="#efc9b1"/>
        <text x="2" y="2" text-anchor="middle" font-size="12" fill="#c27c5a" font-weight="800">{{ graph.titles[graph.start] }}</text>
        <path d="m-29 19-16 11m3-14-3 14 14 1" stroke="#de785c" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <GameSprite name="shop" :x="shopArt[0]" :y="shopArt[1]" :width="SHOP_ART.width" :height="SHOP_ART.height"/>
      <rect :x="shopAt[0]-32" :y="shopAt[1]-41" width="64" height="23" rx="11" fill="#fff8e6" stroke="#dcd2aa"/>
      <text :x="shopAt[0]" :y="shopAt[1]-25" text-anchor="middle" font-size="12" fill="#9b7751" font-weight="800">{{ graph.titles[shopId] }}</text>
      <g id="shopMarker" :transform="`translate(${shopAt[0]} ${shopAt[1]})`">
        <template v-if="state.collected">
          <circle r="18" fill="#e6efda" stroke="#8eac70" stroke-width="2"/>
          <path d="m-8 0 5 5L9-7" fill="none" stroke="#6a9257" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else>
          <circle r="18" fill="#fbebc6" stroke="#d9b571" stroke-width="2"/>
          <GameSprite name="burger" x="-14" y="-13" width="28" height="26"/>
        </template>
      </g>
      <GameSprite
        :name="state.won ? 'picnic' : 'picnic-place'"
        :x="picnicX"
        :y="parkAt[1]+9"
        width="200"
        height="104"
        id="destinationArt"
      />
      <g :transform="`translate(${parkAt[0]} ${parkAt[1]})`">
        <circle r="19" fill="#dcebea" stroke="#79a6ac" stroke-width="2"/>
        <path d="M-9 0H9M2-7l7 7-7 7" fill="none" stroke="#609299" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g :transform="`translate(${Math.min(parkAt[0]+56, size.width-31)} ${parkAt[1]-18})`">
        <rect x="-26" y="-15" width="52" height="27" rx="13" fill="#eef6ed" stroke="#aec9bc"/>
        <text text-anchor="middle" y="3" font-size="12" fill="#658d7e" font-weight="800">{{ graph.titles[graph.goal] }}</text>
      </g>
      <g v-for="id in graph.deadends" :key="'dead-'+id" :transform="`translate(${graph.nodes[id][0]-18} ${graph.nodes[id][1]})`">
        <path d="M0-16v32" stroke="#b9ac85" stroke-width="5" stroke-linecap="round"/>
        <path d="M-6-10H6M-6 9H6" stroke="#d4c7a0" stroke-width="4" stroke-linecap="round"/>
      </g>
    </template>
    <template #player="{ pose }">
      <g id="carBody" :transform="`rotate(${pose.angle.toFixed(2)})`">
        <GameSprite name="car-top" x="-50" y="-33" width="100" height="66"/>
      </g>
      <g id="cargo" :visibility="state.collected ? 'visible' : 'hidden'" transform="translate(-44,-44)">
        <rect x="-3" y="3" width="35" height="29" rx="8" fill="#fff7df" stroke="#c69c60" stroke-width="2"/>
        <GameSprite name="burger" x="0" y="1" width="29" height="29"/>
      </g>
    </template>
    <template #overlay>
      <div id="pickup" class="pickup-pop" :hidden="!pickupVisible" :style="pickupStyle">已購得漢堡 <span>✓</span></div>
    </template>
  </MazeBoard>
</template>
