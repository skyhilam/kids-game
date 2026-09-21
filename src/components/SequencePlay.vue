<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import type { SpriteName } from '../art/sprites';
import { usePlayAudio } from '../composables/usePlayAudio';
import { initAudio, playCue } from '../game/audio';
import { randomSeed } from '../game/rng';
import { parentCopy, sequenceLoadBand, STAGE_LABEL } from '../game/stages';
import { SEQUENCE_COPY as copy } from '../sequence/copy';
import {
  dealSequence,
  emptySlots,
  filledCount,
  isFull,
  judgeWhenFull,
  placeInLeftmost,
  removeFromSlot,
  rollRecentStories,
  type SequenceDeal,
  type SequenceSlots,
  type SequenceStoryId,
} from '../sequence/stories';
import GameSprite from './GameSprite.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();

const overlay = ref<'welcome' | 'help' | 'win' | null>('welcome');
const level = ref(0);
const board = ref<SequenceDeal>(dealSequence(randomSeed(), 0));
const recentStories = ref<SequenceStoryId[]>([board.value.id]);
const slots = ref<SequenceSlots>(emptySlots(board.value.steps.length));
const message = ref<string>(copy.guideMain);
const shaking = ref(false);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let shakeTimer = 0;
let confettiTimer = 0;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stageBand = computed(() => sequenceLoadBand(level.value));
const stageLabel = computed(() => STAGE_LABEL[stageBand.value]);
const guide = computed(() => parentCopy.sequence[stageBand.value]);
const filled = computed(() => filledCount(slots.value));
const playing = computed(() => overlay.value === null);
const slotColumns = computed(() => board.value.steps.length);

function labelOf(sprite: SpriteName): string {
  return board.value.steps.find((step) => step.sprite === sprite)?.label ?? sprite;
}

function isPlaced(sprite: SpriteName): boolean {
  return slots.value.includes(sprite);
}

function mintDeal(nextLevel: number): void {
  board.value = dealSequence(randomSeed(), nextLevel, recentStories.value);
  recentStories.value = rollRecentStories(recentStories.value, board.value.id);
  slots.value = emptySlots(board.value.steps.length);
}

function dealLevel(nextLevel: number): void {
  level.value = nextLevel;
  mintDeal(nextLevel);
  message.value = copy.guideMain;
  overlay.value = null;
  shaking.value = false;
  clearConfetti();
}

function beginPlay(): void {
  overlay.value = null;
  initAudio(soundOn.value);
  playCue(soundOn.value, 'welcome');
}

function closeHelp(): void {
  if (overlay.value === 'help') overlay.value = null;
}

function showHelp(): void {
  if (!playing.value) return;
  overlay.value = 'help';
}

function onTrayTap(sprite: SpriteName): void {
  if (!playing.value || isPlaced(sprite) || isFull(slots.value)) return;
  const next = placeInLeftmost(slots.value, sprite);
  slots.value = next;
  playCue(soundOn.value, 'collect');
  const verdict = judgeWhenFull(next, board.value.steps);
  if (verdict === 'incomplete') {
    message.value = copy.guideMain;
    return;
  }
  if (verdict === 'correct') {
    overlay.value = 'win';
    playCue(soundOn.value, 'win');
    burstConfetti();
    return;
  }
  playCue(soundOn.value, 'hint');
  window.clearTimeout(shakeTimer);
  shaking.value = true;
  shakeTimer = window.setTimeout(() => { shaking.value = false; }, 420);
  toast(copy.wrong);
  message.value = copy.wrong;
}

function onSlotTap(index: number): void {
  if (!playing.value || slots.value[index] == null) return;
  slots.value = removeFromSlot(slots.value, index);
  if (message.value === copy.wrong) message.value = copy.guideMain;
}

function nextLevel(): void {
  playCue(soundOn.value, 'restart');
  dealLevel(level.value + 1);
}

function replay(): void {
  playCue(soundOn.value, 'restart');
  dealLevel(level.value);
}

function clearConfetti(): void {
  window.clearTimeout(confettiTimer);
  confettiBits.value = [];
}

function burstConfetti(): void {
  if (reduceMotion) return;
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

onUnmounted(() => {
  window.clearTimeout(shakeTimer);
  clearConfetti();
});
</script>

<template>
  <main class="app sequence-game">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="home"/></div>
        <div>
          <div class="eyebrow">小 小 出 遊 家</div>
          <h1>{{ copy.title }}</h1>
        </div>
        <span class="stage-chip" :data-stage="stageLabel">{{ stageLabel }}</span>
      </div>
      <div class="top-actions">
        <button class="action-button" type="button" @click="emit('home')">選擇遊戲</button>
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
          :disabled="!playing"
          @click="showHelp"
        >
          <svg aria-hidden="true"><use href="#i-help"/></svg>
        </button>
      </div>
    </header>

    <section class="mission" aria-label="任務：依序點選步驟，排出正確出遊次序">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <div class="mission-step" :class="overlay === 'win' ? 'done' : 'active'">
          <div class="step-icon"><GameSprite aria-hidden="true" name="park"/></div>
          <div class="step-copy">
            <small>點選排序</small>
            <strong>{{ copy.mission }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span>第 {{ level + 1 }} 關</span>
        <span class="stage-chip" :data-stage="stageLabel">{{ stageLabel }}</span>
        <span>{{ filled }} / {{ board.steps.length }}</span>
      </div>
    </section>

    <div class="board-frame">
      <div
        class="board sequence-board"
        :data-sequence-story="board.id"
        :data-sequence-n="board.steps.length"
        :data-sequence-filled="filled"
      >
        <p class="board-note">點托盤放入槽；點槽可以改</p>
        <div
          class="sequence-slots"
          role="list"
          :aria-label="copy.slotsLabel"
          :style="{ gridTemplateColumns: `repeat(${slotColumns}, minmax(0, 1fr))` }"
        >
          <button
            v-for="(sprite, index) in slots"
            :key="index"
            type="button"
            class="sequence-slot"
            :class="{ filled: Boolean(sprite), shake: shaking }"
            :data-sequence-slot="index + 1"
            :data-sequence-placed="sprite ?? undefined"
            role="listitem"
            :aria-label="sprite ? `槽 ${index + 1} ${labelOf(sprite)}` : `槽 ${index + 1}`"
            :disabled="!playing || !sprite"
            @click="onSlotTap(index)"
          >
            <span class="slot-index">{{ index + 1 }}</span>
            <template v-if="sprite">
              <GameSprite :name="sprite" :label="labelOf(sprite)" />
              <span class="slot-label">{{ labelOf(sprite) }}</span>
            </template>
          </button>
        </div>
        <div
          class="sequence-tray"
          role="list"
          :aria-label="copy.trayLabel"
          :style="{ gridTemplateColumns: `repeat(${slotColumns}, minmax(0, 1fr))` }"
        >
          <div
            v-for="step in board.tray"
            :key="step.sprite"
            class="tray-slot"
            :class="{ empty: isPlaced(step.sprite) }"
            role="listitem"
          >
            <button
              v-if="!isPlaced(step.sprite)"
              type="button"
              class="sequence-card"
              :data-sequence-card="step.sprite"
              :aria-label="step.label"
              :disabled="!playing"
              @click="onTrayTap(step.sprite)"
            >
              <GameSprite :name="step.sprite" :label="step.label" />
              <span>{{ step.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <section class="bottom-bar" aria-label="遊戲提示">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><GameSprite name="car"/></div>
        <div class="guide-copy">
          <div class="guide-main" role="status" aria-live="polite">{{ message }}</div>
          <div class="guide-sub">第 {{ level + 1 }} 關 · {{ stageLabel }} · {{ filled }} / {{ board.steps.length }}。{{ copy.guideSub }}</div>
        </div>
      </div>
    </section>
    <div class="footer-note">
      <span>{{ copy.footer[0] }}</span><i></i><span>{{ copy.footer[1] }}</span><i></i><span>{{ copy.footer[2] }}</span>
    </div>
  </main>

  <MazeDialog
    :open="overlay !== null"
    :cancelable="overlay === 'help'"
    labelled-by="sequence-dialog-title"
    dialog-class="sequence-dialog"
    @close="closeHelp"
  >
    <div class="dialog-inner" :class="{ 'help-inner': overlay === 'help' }">
      <template v-if="overlay === 'welcome'">
        <div class="dialog-eyebrow">{{ copy.welcomeEyebrow }}</div>
        <svg class="dialog-hero" viewBox="0 0 420 150" aria-hidden="true">
          <rect width="420" height="150" rx="24" fill="#efe6d6"/>
          <GameSprite name="home" x="24" y="18" width="110" height="110"/>
          <GameSprite name="burger" x="156" y="28" width="96" height="90"/>
          <GameSprite name="park" x="280" y="16" width="116" height="116"/>
        </svg>
        <h2 id="sequence-dialog-title" class="dialog-title">{{ copy.title }}</h2>
        <p class="stage-chip" :data-stage="stageLabel">第 {{ level + 1 }} 關 · {{ stageLabel }}</p>
        <p class="dialog-copy">{{ copy.welcomeBody }}</p>
        <button class="primary-button" type="button" autofocus @click="beginPlay">
          {{ copy.start }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
        <div class="dialog-footnote">不計時 · 不扣分 · 點選排序</div>
      </template>

      <template v-else-if="overlay === 'help'">
        <div class="help-header">
          <h2 id="sequence-dialog-title">{{ copy.helpTitle }}</h2>
          <button class="close-button" type="button" aria-label="關閉說明" @click="closeHelp">
            <svg><use href="#i-close"/></svg>
          </button>
        </div>
        <div class="parent-cols words-help-cols">
          <article class="parent-col">
            <h4>任務</h4>
            <p>{{ copy.task }}</p>
          </article>
          <article class="parent-col">
            <h4>操作</h4>
            <p>{{ copy.controls }}</p>
          </article>
          <article class="parent-col">
            <h4>家長</h4>
            <p>{{ copy.parent[stageBand] }}</p>
          </article>
        </div>
        <ParentGuide :guide="guide" :stage-label="stageLabel"/>
        <button class="primary-button help-finish" type="button" autofocus @click="closeHelp">
          返回遊戲<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
      </template>

      <template v-else-if="overlay === 'win'">
        <div class="dialog-eyebrow">{{ copy.winEyebrow }}</div>
        <svg class="dialog-hero" viewBox="0 0 420 150" aria-hidden="true">
          <rect width="420" height="150" rx="24" fill="#efe6d6"/>
          <GameSprite name="car" x="28" y="28" width="120" height="96"/>
          <GameSprite name="park" x="160" y="14" width="112" height="118"/>
          <GameSprite name="picnic" x="286" y="18" width="110" height="112"/>
        </svg>
        <h2 id="sequence-dialog-title" class="dialog-title">{{ copy.winTitle }}</h2>
        <p class="dialog-copy">{{ copy.winBody }}</p>
        <button class="primary-button" type="button" autofocus @click="nextLevel">
          下一關<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="replay">{{ copy.replay }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">回 Hub</button>
      </template>
    </div>
  </MazeDialog>

  <PlayChrome
    :toast-on="toastOn"
    :toast-text="toastText"
    :confetti-bits="confettiBits"
  />
</template>

<style>
.sequence-game .brand-logo{background:#efe6d6}
.sequence-game .brand{flex-wrap:wrap}
.sequence-game .stage-chip{align-self:center}
.board.sequence-board{background:#f3ead8;display:flex;flex-direction:column;gap:16px;padding:42px 18px 16px;aspect-ratio:auto;height:auto;min-height:520px;overflow:visible;touch-action:manipulation}
.sequence-board .board-note{top:12px}
.sequence-dialog{width:min(640px,calc(100vw - 32px))}
.sequence-slots{display:grid;gap:12px;flex:1;align-content:center}
.sequence-slot{min-height:148px;border:2px dashed #d4c4a8;border-radius:24px;background:#fffdf8cc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 8px;gap:4px;position:relative;transition:border-color .2s,background .2s,transform .2s}
.sequence-slot.filled{border-style:solid;border-color:#c9b48a;background:#fffdf8}
.sequence-slot.shake{animation:sequence-shake .4s ease}
.sequence-slot:disabled{opacity:1}
.slot-index{position:absolute;top:8px;left:10px;width:22px;height:22px;border-radius:50%;background:#efe6d6;color:#7a6848;font-size:12px;font-weight:850;display:grid;place-items:center}
.sequence-slot svg{width:84px;height:76px}
.slot-label{font-size:15px;letter-spacing:.4px;color:#6a5a3e;font-weight:750}
.sequence-tray{display:grid;gap:8px;padding:10px;border-radius:20px;background:#fffdf8d9;border:1.5px solid #e8decc}
.tray-slot{min-height:112px;border-radius:16px;background:#f7f0e4;display:grid;place-items:center}
.tray-slot.empty{background:#f1eadc;border:1.5px dashed #ddd2be}
.sequence-card{width:100%;height:100%;min-height:112px;background:transparent;padding:8px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:16px}
.sequence-card svg{width:76px;height:68px}
.sequence-card span{font-size:14px;color:#6a5a3e;font-weight:750}
.sequence-dialog .stage-chip{margin:0 auto 10px}
.words-help-cols{margin:8px 0 4px}
@keyframes sequence-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:700px){
  .board.sequence-board{min-height:0;padding:16px 12px 12px;gap:12px}
  .sequence-board .board-note{display:none}
  .sequence-slots{flex:none;gap:8px}
  .sequence-slot{min-height:112px;border-radius:18px}
  .sequence-slot svg{width:56px;height:50px}
  .slot-label,.sequence-card span{font-size:12px}
  .tray-slot,.sequence-card{min-height:88px}
  .sequence-card svg{width:56px;height:50px}
  .sequence-game .mission .step-copy strong{font-size:13px;letter-spacing:0}
}
@media(max-width:420px){
  .sequence-slot{min-height:96px}
  .sequence-slot svg,.sequence-card svg{width:48px;height:44px}
}
@media(prefers-reduced-motion:reduce){.sequence-slot.shake{animation:none}}
</style>
