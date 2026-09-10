<script setup lang="ts">
import { confettiPalette, overlayCopy, sessionCopy, speech } from '../tooth/copy';
import { TOOTH_LEVELS } from '../tooth/levels';
import GameSprite from './GameSprite.vue';
import MazePlay from './MazePlay.vue';
import ToothBoard from './ToothBoard.vue';

defineEmits<{
  home: [];
}>();
</script>

<template>
  <div class="tooth-game">
    <MazePlay
      :catalog="TOOTH_LEVELS"
      :copy="sessionCopy"
      :overlay-copy="overlayCopy"
      :speech="speech"
      :board="ToothBoard"
      :confetti-palette="confettiPalette"
      title="打敗蛀牙蟲"
      mission-aria="任務：避開蛀牙蟲，走到終點"
      :footer="['從容遊玩', '不計時 · 不扣分', '天天刷牙']"
      @home="$emit('home')"
    >
      <template #logo><GameSprite name="toothbrush"/></template>
      <template #mission="{ game, graph }">
        <div class="mission-step" :class="game.node !== graph.start || game.used.size ? 'done' : 'active'">
          <div class="step-icon">
            <GameSprite aria-hidden="true" name="bug-coral"/>
          </div>
          <div class="step-copy">
            <small>注意</small>
            <strong>避開蛀牙蟲</strong>
          </div>
        </div>
        <svg class="step-connector" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-arrow"/></svg>
        <div class="mission-step" :class="game.won ? 'done' : 'active'">
          <div class="step-icon">
            <GameSprite aria-hidden="true" name="tooth"/>
            <span class="step-check">✓</span>
          </div>
          <div class="step-copy">
            <small>目標</small>
            <strong>{{ game.won ? '已到終點' : '走到終點' }}</strong>
          </div>
        </div>
      </template>
      <template #guide-avatar><GameSprite name="kid"/></template>
      <template #welcome-hero>
        <svg class="dialog-hero" viewBox="0 0 420 162" aria-hidden="true">
          <rect x="20" y="90" width="380" height="18" rx="9" fill="#dfeee8"/>
          <GameSprite name="kid" x="70" y="18" width="110" height="120"/>
          <GameSprite name="bug-coral" x="210" y="40" width="70" height="70"/>
          <GameSprite name="tooth" x="290" y="20" width="110" height="110"/>
        </svg>
      </template>
      <template #stuck-hero="{ reason }">
        <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
          <GameSprite name="kid" x="90" y="10" width="120" height="130"/>
          <GameSprite v-if="reason === 'hazard'" name="bug-coral" x="230" y="40" width="90" height="90"/>
          <GameSprite v-else name="toothbrush" x="240" y="30" width="50" height="90"/>
        </svg>
      </template>
      <template #win-hero>
        <svg class="dialog-hero" viewBox="0 0 400 165" aria-hidden="true">
          <ellipse cx="200" cy="145" rx="130" ry="13" fill="#e7f2e8"/>
          <GameSprite name="kid-cheer" x="73" y="0" width="118" height="152"/>
          <GameSprite name="tooth" x="211" y="20" width="126" height="126"/>
        </svg>
      </template>
      <template #rescue-hero>
        <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
          <GameSprite name="kid" x="100" y="12" width="110" height="120"/>
          <GameSprite name="bug-purple" x="230" y="40" width="80" height="80"/>
        </svg>
      </template>
    </MazePlay>
  </div>
</template>
