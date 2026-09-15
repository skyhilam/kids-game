<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useMazePlay, type MazeSpeech } from '../composables/useMazePlay';
import type { OverlayCopy, SessionCopy } from '../game/copy';
import { mazeLoadBand, STAGE_LABEL, type LoadBand, type ParentGuide } from '../game/stages';
import type { LevelDef, LevelSource } from '../game/types';
import MazeOverlays from './MazeOverlays.vue';
import PlayChrome from './PlayChrome.vue';

const props = defineProps<{
  catalog: LevelSource;
  picks?: readonly LevelDef[];
  copy: SessionCopy;
  overlayCopy: OverlayCopy;
  parentCopy: Record<LoadBand, ParentGuide>;
  speech: MazeSpeech;
  board: Component;
  title: string;
  missionAria: string;
  footer: readonly string[];
  confettiPalette: readonly string[];
}>();

defineEmits<{
  home: [];
}>();

const play = useMazePlay({
  catalog: props.catalog,
  picks: props.picks,
  copy: props.copy,
  speech: props.speech,
  confettiPalette: props.confettiPalette,
});

const {
  graph, game, overlay, narrow, inFlight, facing, hintNode,
  completed, interactive, lastLevel, allDone, endless, helpLevels,
  guideMain, guideSub,
} = play.session;
const {
  soundOn, toastText, toastOn, confettiBits,
  move, welcomeStart, onHint, toggleSound, onRestart, onJump, onRetry, onNext, onReplay,
  showHelp, onWinRevealed,
} = play;

const stageBand = computed(() => mazeLoadBand(game.level));
const stageLabel = computed(() => STAGE_LABEL[stageBand.value]);
const parentGuide = computed(() => props.parentCopy[stageBand.value]);
</script>

<template>
  <main class="app" id="app-root">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><slot name="logo" /></div>
        <div>
          <div class="eyebrow">小 小 出 遊 家</div>
          <h1>{{ title }}</h1>
        </div>
      </div>
      <div class="top-actions">
        <button class="action-button" type="button" @click="$emit('home')">選擇遊戲</button>
        <slot name="top-extra" />
        <button
          class="icon-button"
          :aria-label="soundOn ? '關閉音效' : '開啟音效'"
          :aria-pressed="soundOn"
          title="開關音效"
          @click="toggleSound"
        >
          <svg aria-hidden="true"><use :href="soundOn ? '#i-sound' : '#i-muted'"/></svg>
        </button>
        <button
          class="icon-button"
          aria-label="遊戲說明"
          title="遊戲說明"
          :disabled="!interactive"
          @click="showHelp"
        >
          <svg aria-hidden="true"><use href="#i-help"/></svg>
        </button>
      </div>
    </header>
    <section class="mission" :aria-label="missionAria">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <slot name="mission" :game="game" :graph="graph" />
      </div>
      <div class="level-badge">
        <span>第 {{ game.level + 1 }} 關</span>
        <span class="stage-chip">{{ stageLabel }}</span>
        <span v-if="!endless" class="level-dots" aria-hidden="true">
          <i v-for="(_, i) in helpLevels" :key="i" :class="i === game.level ? 'current' : completed.has(i) ? 'complete' : ''"/>
        </span>
      </div>
    </section>
    <component
      :is="board"
      :graph="graph"
      :state="game"
      :interactive="interactive"
      :narrow="narrow"
      :facing="facing"
      :hint-node="hintNode"
      :in-flight="inFlight"
      @move="move"
    />
    <section class="bottom-bar" aria-label="遊戲提示及操作">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><slot name="guide-avatar" /></div>
        <div class="guide-copy">
          <div class="guide-main" role="status" aria-live="polite">{{ guideMain }}</div>
          <div class="guide-sub">{{ guideSub }}</div>
        </div>
      </div>
      <div class="bottom-actions">
        <button class="action-button hint" :disabled="!interactive" @click="onHint">
          <svg aria-hidden="true"><use href="#i-bulb"/></svg><span>提示</span>
        </button>
        <button class="action-button" :disabled="!interactive" @click="onRestart">
          <svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-restart"/></svg><span>重新開始</span>
        </button>
      </div>
    </section>
    <div class="footer-note" aria-hidden="true">
      <span>{{ footer[0] }}</span><i></i><span>{{ footer[1] }}</span><i></i><span>{{ footer[2] }}</span>
    </div>
  </main>

  <MazeOverlays
    :overlay="overlay"
    :level="game.level"
    :last-level="lastLevel"
    :all-done="allDone"
    :endless="endless"
    :reduce-motion="play.session.reduceMotion"
    :help-levels="helpLevels"
    :copy="overlayCopy"
    :stage-label="stageLabel"
    :parent-guide="parentGuide"
    @start="welcomeStart"
    @retry="onRetry"
    @next="onNext"
    @replay="onReplay"
    @close="play.session.dismissOverlay"
    @revealed="onWinRevealed"
    @jump="onJump"
    @home="$emit('home')"
  >
    <template #welcome-hero>
      <slot name="welcome-hero" />
    </template>
    <template #welcome-extra>
      <slot name="welcome-extra" />
    </template>
    <template #stuck-hero="{ reason }">
      <slot name="stuck-hero" :reason="reason" />
    </template>
    <template #win-hero>
      <slot name="win-hero" />
    </template>
    <template #rescue-hero>
      <slot name="rescue-hero" />
    </template>
  </MazeOverlays>

  <PlayChrome
    :toast-on="toastOn"
    :toast-text="toastText"
    :confetti-bits="confettiBits"
  />
</template>
