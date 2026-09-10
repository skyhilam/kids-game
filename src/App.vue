<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import GameBoard from './components/GameBoard.vue';
import GameDialogs from './components/GameDialogs.vue';
import SpriteDefs from './components/SpriteDefs.vue';
import { useGameSession } from './composables/useGameSession';
import {
  cancelSpeech,
  initAudio,
  loadVoices,
  playNotes,
  resumeAudio,
  speak,
  suspendAudio,
} from './game/audio';
import { ARRIVAL_GUIDE, SPEECH } from './game/copy';
import { LEVELS } from './game/rules';
import type { MoveOk, NodeId } from './game/types';

const soundOn = ref(true);
const toastText = ref('');
const toastOn = ref(false);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let toastTimer = 0;
let confettiTimer = 0;

function toast(text: string): void {
  window.clearTimeout(toastTimer);
  toastText.value = text;
  toastOn.value = true;
  toastTimer = window.setTimeout(() => { toastOn.value = false; }, 2600);
}

function clearConfetti(): void {
  window.clearTimeout(confettiTimer);
  confettiBits.value = [];
}

function burstConfetti(): void {
  if (session.reduceMotion) return;
  clearConfetti();
  const palette = ['#e89d7d', '#e9c465', '#9fb983', '#9fc3bf', '#d8b5a0'];
  confettiBits.value = Array.from({ length: 36 }, (_, i) => ({
    i,
    left: `${(i * 47 + 13) % 100}%`,
    bg: palette[i % palette.length],
    delay: `${i % 9 * 0.07}s`,
    duration: `${2.3 + (i % 7) * 0.15}s`,
    round: i % 3 === 0,
    drift: `${(i % 5 - 2) * 28}px`,
  }));
  confettiTimer = window.setTimeout(() => { confettiBits.value = []; }, 4400);
}

function onSettled(result: MoveOk): void {
  if (result.boughtNow) {
    playNotes(soundOn.value, [[523, 0, 0.18], [659, 0.13, 0.18], [784, 0.26, 0.27]]);
    speak(soundOn.value, ARRIVAL_GUIDE.bought.main);
  }
  if (result.won) {
    playNotes(soundOn.value, [[523, 0, 0.22], [659, 0.15, 0.22], [784, 0.3, 0.22], [1047, 0.48, 0.5]]);
    return;
  }
  if (result.stalled) {
    playNotes(soundOn.value, [[440, 0, 0.2, 0.035], [523, 0.18, 0.3, 0.04]]);
    speak(
      soundOn.value,
      result.stalled === 'burger' ? SPEECH.stuckBurger : SPEECH.stuckDeadend,
    );
  }
}

const session = useGameSession({ onSettled });
const {
  graph, game, overlay, narrow, inFlight, facing, hintNode, pickupVisible,
  completed, interactive, lastLevel, allDone, started,
  guideMain, guideSub, announce,
} = session;

function onWinRevealed(): void {
  burstConfetti();
  speak(soundOn.value, allDone.value ? SPEECH.winAllDone : SPEECH.win);
}

function speakAnnounce(): void {
  speak(soundOn.value, announce.value);
}

function move(to: NodeId): void {
  const result = session.requestMove(to);
  if (!result.ok) {
    if (result.reason === 'used-road') toast('此段橙色道路已經通行，請改選其他路線。');
    return;
  }
  playNotes(soundOn.value, [[430, 0, 0.10, 0.045], [510, 0.07, 0.12, 0.035]]);
}

function welcomeStart(): void {
  if (!session.welcomeStart()) return;
  initAudio(soundOn.value);
  playNotes(soundOn.value, [[523, 0, 0.16], [659, 0.12, 0.22]]);
  speak(soundOn.value, SPEECH.welcome);
}

function onHint(): void {
  const result = session.requestHint();
  if (result === 'blocked') return;
  playNotes(soundOn.value, [[660, 0, 0.15], [880, 0.11, 0.22]]);
  if (result === 'hint') speak(soundOn.value, guideMain.value);
  else speak(soundOn.value, SPEECH.rescue);
}

function toggleSound(): void {
  soundOn.value = !soundOn.value;
  if (soundOn.value) {
    initAudio(true);
    playNotes(true, [[659, 0, 0.17]]);
    speak(true, '聲音已開啟。');
  } else {
    cancelSpeech();
    suspendAudio();
  }
  toast(soundOn.value ? '聲音已開啟' : '聲音已關閉');
}

function onRestart(): void {
  if (!session.restart()) return;
  clearConfetti();
  cancelSpeech();
  playNotes(soundOn.value, [[523, 0, 0.18]]);
  speakAnnounce();
}

function onJump(index: number): void {
  if (!session.jump(index)) return;
  clearConfetti();
  speakAnnounce();
}

function onRetry(): void {
  if (!session.retry()) return;
  clearConfetti();
  speakAnnounce();
}

function onNext(): void {
  if (!session.next()) return;
  clearConfetti();
  speakAnnounce();
}

function onReplay(): void {
  if (!session.replay()) return;
  clearConfetti();
  speakAnnounce();
}

function showHelp(): void {
  cancelSpeech();
  session.showHelp();
}

function onVisibility(): void {
  if (document.hidden) {
    cancelSpeech();
    suspendAudio();
  } else if (started.value && soundOn.value) {
    resumeAudio(true);
  }
}

onMounted(() => {
  loadVoices();
  if (window.speechSynthesis?.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
  window.addEventListener('resize', () => session.applyLayout());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => { cancelSpeech(); suspendAudio(); });
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  window.clearTimeout(toastTimer);
  clearConfetti();
});
</script>

<template>
  <SpriteDefs />
  <main class="app" id="app-root">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><svg><use href="#art-car"/></svg></div>
        <div>
          <div class="eyebrow">小 小 出 遊 家</div>
          <h1>一起去野餐</h1>
        </div>
      </div>
      <div class="top-actions">
        <span class="age-pill">3+ 歲親子遊戲</span>
        <button
          class="icon-button"
          id="soundBtn"
          :aria-label="soundOn ? '關閉音效' : '開啟音效'"
          :aria-pressed="soundOn"
          title="開關音效"
          @click="toggleSound"
        >
          <svg aria-hidden="true"><use :href="soundOn ? '#i-sound' : '#i-muted'"/></svg>
        </button>
        <button
          class="icon-button"
          id="helpBtn"
          aria-label="遊戲說明與關卡選擇"
          title="遊戲說明"
          :disabled="!interactive"
          @click="showHelp"
        >
          <svg aria-hidden="true"><use href="#i-help"/></svg>
        </button>
      </div>
    </header>
    <section class="mission" aria-label="任務：先買漢堡，再去公園">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <div class="mission-step" :class="game.burger ? 'done' : 'active'" id="burgerStep">
          <div class="step-icon">
            <svg aria-hidden="true"><use href="#art-burger"/></svg>
            <span class="step-check">✓</span>
          </div>
          <div class="step-copy">
            <small id="burgerStepNumber">第一步</small>
            <strong id="burgerStepText">{{ game.burger ? '已購漢堡' : '購買漢堡' }}</strong>
          </div>
        </div>
        <svg class="step-connector" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-arrow"/></svg>
        <div class="mission-step" :class="game.won ? 'done' : game.burger ? 'active' : ''" id="parkStep">
          <div class="step-icon">
            <svg aria-hidden="true"><use href="#art-park"/></svg>
            <span class="step-check">✓</span>
          </div>
          <div class="step-copy">
            <small>第二步</small>
            <strong id="parkStepText">{{ game.won ? '已到公園' : '前往公園' }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span id="levelLabel">第 {{ game.level + 1 }} 關</span>
        <span class="level-dots" aria-hidden="true">
          <i v-for="(_, i) in LEVELS" :key="i" :class="i === game.level ? 'current' : completed.has(i) ? 'complete' : ''"/>
        </span>
      </div>
    </section>
    <GameBoard
      :graph="graph"
      :state="game"
      :interactive="interactive"
      :narrow="narrow"
      :facing="facing"
      :hint-node="hintNode"
      :pickup-visible="pickupVisible"
      :in-flight="inFlight"
      @move="move"
    />
    <section class="bottom-bar" aria-label="遊戲提示及操作">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><svg><use href="#art-bear"/></svg></div>
        <div class="guide-copy">
          <div class="guide-main" id="guideMain" role="status" aria-live="polite">{{ guideMain }}</div>
          <div class="guide-sub" id="guideSub">{{ guideSub }}</div>
        </div>
      </div>
      <div class="bottom-actions">
        <button class="action-button hint" id="hintBtn" :disabled="!interactive" @click="onHint">
          <svg aria-hidden="true"><use href="#i-bulb"/></svg><span>提示</span>
        </button>
        <button class="action-button" id="restartBtn" :disabled="!interactive" @click="onRestart">
          <svg aria-hidden="true"><use href="#i-restart"/></svg><span>重新開始</span>
        </button>
      </div>
    </section>
    <div class="footer-note" aria-hidden="true">
      <span>從容遊玩</span><i></i><span>不計時 · 不扣分</span><i></i><span>與小熊一同探索</span>
    </div>
  </main>

  <GameDialogs
    :overlay="overlay"
    :level="game.level"
    :last-level="lastLevel"
    :all-done="allDone"
    :reduce-motion="session.reduceMotion"
    @start="welcomeStart"
    @retry="onRetry"
    @next="onNext"
    @replay="onReplay"
    @close="session.dismissOverlay"
    @revealed="onWinRevealed"
    @jump="onJump"
  />

  <div class="toast" id="toast" role="status" :hidden="!toastOn">{{ toastText }}</div>
  <div class="confetti-layer" id="confetti" aria-hidden="true">
    <i
      v-for="bit in confettiBits"
      :key="bit.i"
      class="confetti"
      :style="{
        left: bit.left,
        background: bit.bg,
        '--delay': bit.delay,
        '--duration': bit.duration,
        '--drift': bit.drift,
        borderRadius: bit.round ? '50%' : undefined,
      }"
    />
  </div>
</template>
