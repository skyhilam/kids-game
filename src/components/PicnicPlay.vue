<script setup lang="ts">
import { confettiPalette, overlayCopy, sessionCopy, speech } from '../picnic/copy';
import { picnicCatalog } from '../picnic/levels';
import GameSprite from './GameSprite.vue';
import MazePlay from './MazePlay.vue';
import PicnicBoard from './PicnicBoard.vue';

defineEmits<{
  home: [];
}>();

const catalog = picnicCatalog();
</script>

<template>
  <MazePlay
    :catalog="catalog"
    :copy="sessionCopy"
    :overlay-copy="overlayCopy"
    :speech="speech"
    :board="PicnicBoard"
    :confetti-palette="confettiPalette"
    title="一起去野餐"
    mission-aria="任務：先買漢堡，再去公園"
    :footer="['從容遊玩', '不計時 · 不扣分', '與小熊一同探索']"
    @home="$emit('home')"
  >
    <template #logo><GameSprite name="car"/></template>
    <template #top-extra>
      <span class="age-pill">3+ 歲親子遊戲</span>
    </template>
    <template #mission="{ game }">
      <div class="mission-step" :class="game.collected ? 'done' : 'active'" id="burgerStep">
        <div class="step-icon">
          <GameSprite aria-hidden="true" name="burger"/>
          <span class="step-check">✓</span>
        </div>
        <div class="step-copy">
          <small id="burgerStepNumber">第一步</small>
          <strong id="burgerStepText">{{ game.collected ? '已購漢堡' : '購買漢堡' }}</strong>
        </div>
      </div>
      <svg class="step-connector" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-arrow"/></svg>
      <div class="mission-step" :class="game.won ? 'done' : game.collected ? 'active' : ''" id="parkStep">
        <div class="step-icon">
          <GameSprite aria-hidden="true" name="park"/>
          <span class="step-check">✓</span>
        </div>
        <div class="step-copy">
          <small>第二步</small>
          <strong id="parkStepText">{{ game.won ? '已到公園' : '前往公園' }}</strong>
        </div>
      </div>
    </template>
    <template #guide-avatar><GameSprite name="bear"/></template>
    <template #welcome-hero>
      <svg class="dialog-hero" viewBox="0 0 420 162" aria-hidden="true">
        <path d="M38 126q89-33 170-3t172-9" stroke="#dfe9cf" stroke-width="26" fill="none" stroke-linecap="round"/>
        <path d="M40 126q88-32 168-3t172-9" stroke="#fff8e5" stroke-width="12" fill="none" stroke-linecap="round"/>
        <GameSprite name="tree" x="301" y="18" width="76" height="105"/>
        <GameSprite name="car" x="100" y="44" width="201" height="122"/>
        <GameSprite name="flower" x="56" y="93" width="32" height="40"/>
        <g fill="#ead092">
          <circle cx="64" cy="45" r="4"/>
          <circle cx="294" cy="33" r="3"/>
          <path d="m311 67 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>
        </g>
      </svg>
    </template>
    <template #welcome-extra>
      <div class="welcome-route" aria-label="小車出發，先購買漢堡，再前往公園">
        <div class="route-item"><div class="route-picture"><GameSprite name="car"/></div><span>出發</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture" style="background:#fbedd0"><GameSprite name="burger"/></div><span>購買漢堡</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture"><GameSprite name="park"/></div><span>前往公園</span></div>
      </div>
    </template>
    <template #stuck-hero="{ reason }">
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <GameSprite name="bear" x="132" y="8" width="136" height="135"/>
        <GameSprite v-if="reason === 'missing-collect'" name="burger" x="256" y="60" width="60" height="55"/>
        <GameSprite v-else name="flower" x="76" y="82" width="43" height="53"/>
      </svg>
    </template>
    <template #win-hero>
      <GameSprite class="dialog-hero" aria-hidden="true" name="picnic" x="35" y="0" width="330" height="165"/>
    </template>
    <template #rescue-hero>
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <GameSprite name="bear" x="142" y="15" width="116" height="123"/>
        <GameSprite name="flower" x="260" y="80" width="35" height="45"/>
      </svg>
    </template>
  </MazePlay>
</template>
