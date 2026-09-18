<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { cancelSpeech, initAudio, playCue, speak } from '../game/audio';
import { randomSeed } from '../game/rng';
import { listenLoadBand, parentCopy, STAGE_LABEL } from '../game/stages';
import { LISTEN_COPY as copy } from '../listen/copy';
import {
  dealListen,
  listenStreakNeed,
  rollRecentTargets,
  tryListenTap,
  type ListenDeal,
} from '../listen/deal';
import { WORD_ZH, type WordId } from '../sticker/words';
import GameSprite from './GameSprite.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();

const overlay = ref<'welcome' | 'help' | 'win' | null>('welcome');
const level = ref(0);
const board = ref<ListenDeal>(dealListen(randomSeed(), 0));
const recentTargets = ref<WordId[]>([board.value.target]);
const correct = ref(0);
const prompt = ref<string>(copy.guideMain);
const shakeId = ref<WordId | null>(null);
const flashId = ref<WordId | null>(null);
const locked = ref(false);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let shakeTimer = 0;
let flashTimer = 0;
let confettiTimer = 0;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stageBand = computed(() => listenLoadBand(level.value));
const stageLabel = computed(() => STAGE_LABEL[stageBand.value]);
const guide = computed(() => parentCopy.listen[stageBand.value]);
const need = computed(() => listenStreakNeed(level.value));
const playing = computed(() => overlay.value === null);
const message = computed(() => (soundOn.value ? prompt.value : copy.muted));
const optionColumns = computed(() => {
  const count = board.value.options.length;
  if (count <= 3) return count;
  if (count === 4) return 2;
  return 3;
});

function speakTarget(): void {
  speak(soundOn.value, WORD_ZH[board.value.target]);
}

function mintDeal(nextLevel: number): void {
  board.value = dealListen(randomSeed(), nextLevel, recentTargets.value);
  recentTargets.value = rollRecentTargets(recentTargets.value, board.value.target);
}

function dealLevel(nextLevel: number): void {
  level.value = nextLevel;
  correct.value = 0;
  mintDeal(nextLevel);
  prompt.value = copy.guideMain;
  overlay.value = null;
  shakeId.value = null;
  flashId.value = null;
  locked.value = false;
  clearConfetti();
  cancelSpeech();
}

function beginPlay(): void {
  overlay.value = null;
  initAudio(soundOn.value);
  playCue(soundOn.value, 'welcome');
  speakTarget();
}

function closeHelp(): void {
  if (overlay.value !== 'help') return;
  overlay.value = null;
  speakTarget();
}

function showHelp(): void {
  if (!playing.value) return;
  cancelSpeech();
  overlay.value = 'help';
}

function listenAgain(): void {
  if (!playing.value) return;
  if (!soundOn.value) {
    toast(copy.muted);
    return;
  }
  speakTarget();
}

function nextRound(): void {
  mintDeal(level.value);
  prompt.value = copy.guideMain;
  flashId.value = null;
  locked.value = false;
  speakTarget();
}

function onTap(id: WordId): void {
  if (!playing.value || locked.value) return;
  const result = tryListenTap(board.value.target, id, correct.value, need.value);
  if (result.kind === 'wrong') {
    playCue(soundOn.value, 'hint');
    window.clearTimeout(shakeTimer);
    shakeId.value = id;
    shakeTimer = window.setTimeout(() => { shakeId.value = null; }, 420);
    toast(copy.wrong);
    prompt.value = copy.wrong;
    return;
  }
  correct.value = result.correct;
  playCue(soundOn.value, 'collect');
  prompt.value = copy.correct;
  flashId.value = id;
  if (result.cleared) {
    overlay.value = 'win';
    playCue(soundOn.value, 'win');
    burstConfetti();
    return;
  }
  locked.value = true;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { nextRound(); }, reduceMotion ? 0 : 480);
}

function nextLevel(): void {
  playCue(soundOn.value, 'restart');
  dealLevel(level.value + 1);
  speakTarget();
}

function replay(): void {
  playCue(soundOn.value, 'restart');
  dealLevel(level.value);
  speakTarget();
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
  window.clearTimeout(flashTimer);
  clearConfetti();
});
</script>

<template>
  <main class="app listen-game">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="kid"/></div>
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

    <section class="mission" aria-label="任務：聽到詞之後，點啱嘅圖">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <div class="mission-step" :class="correct >= need ? 'done' : 'active'">
          <div class="step-icon"><GameSprite aria-hidden="true" name="sun"/></div>
          <div class="step-copy">
            <small>聽詞揀圖</small>
            <strong>{{ copy.mission }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span>第 {{ level + 1 }} 關</span>
        <span class="stage-chip" :data-stage="stageLabel">{{ stageLabel }}</span>
        <span>{{ correct }} / {{ need }}</span>
      </div>
    </section>

    <div class="board-frame">
      <div class="board listen-board">
        <p class="board-note">聽到邊個，就點嗰張圖</p>
        <div
          class="listen-options"
          role="list"
          :aria-label="copy.optionsLabel"
          :data-listen-target="board.target"
          :data-listen-need="need"
          :data-listen-correct="correct"
          :style="{ gridTemplateColumns: `repeat(${optionColumns}, minmax(0, 1fr))` }"
        >
          <button
            v-for="word in board.options"
            :key="word"
            type="button"
            class="listen-option"
            :class="{ shake: shakeId === word, flash: flashId === word }"
            :data-listen-option="word"
            :disabled="!playing || locked"
            role="listitem"
            :aria-label="WORD_ZH[word]"
            @click="onTap(word)"
          >
            <GameSprite :name="word" :label="WORD_ZH[word]" />
          </button>
        </div>
      </div>
    </div>

    <section class="bottom-bar" aria-label="遊戲提示及操作">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><GameSprite name="kid"/></div>
        <div class="guide-copy">
          <div class="guide-main" role="status" aria-live="polite">{{ message }}</div>
          <div class="guide-sub">第 {{ level + 1 }} 關 · {{ stageLabel }} · {{ correct }} / {{ need }}。{{ copy.guideSub }}</div>
        </div>
      </div>
      <div class="bottom-actions">
        <button
          id="listenAgainBtn"
          class="action-button hint"
          type="button"
          :disabled="!playing"
          @click="listenAgain"
        >
          <svg aria-hidden="true"><use href="#i-sound"/></svg>
          <span>{{ copy.listenAgain }}</span>
        </button>
      </div>
    </section>
    <div class="footer-note">
      <span>{{ copy.footer[0] }}</span><i></i><span>{{ copy.footer[1] }}</span><i></i><span>{{ copy.footer[2] }}</span>
    </div>
  </main>

  <MazeDialog
    :open="overlay !== null"
    :cancelable="overlay === 'help'"
    labelled-by="listen-dialog-title"
    dialog-class="listen-dialog"
    @close="closeHelp"
  >
    <div class="dialog-inner" :class="{ 'help-inner': overlay === 'help' }">
      <template v-if="overlay === 'welcome'">
        <div class="dialog-eyebrow">{{ copy.welcomeEyebrow }}</div>
        <svg class="dialog-hero" viewBox="0 0 420 150" aria-hidden="true">
          <rect width="420" height="150" rx="24" fill="#e8f0f4"/>
          <GameSprite name="kid" x="24" y="8" width="92" height="132"/>
          <GameSprite name="sun" x="140" y="22" width="90" height="90"/>
          <GameSprite name="car" x="248" y="34" width="140" height="96"/>
        </svg>
        <h2 id="listen-dialog-title" class="dialog-title">{{ copy.title }}</h2>
        <p class="stage-chip" :data-stage="stageLabel">第 {{ level + 1 }} 關 · {{ stageLabel }}</p>
        <p class="dialog-copy">{{ copy.welcomeBody }}</p>
        <button class="primary-button" type="button" autofocus @click="beginPlay">
          {{ copy.start }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
        <div class="dialog-footnote">不計時 · 不扣分 · 聽唔到可以再聽一次</div>
      </template>

      <template v-else-if="overlay === 'help'">
        <div class="help-header">
          <h2 id="listen-dialog-title">{{ copy.helpTitle }}</h2>
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
          <rect width="420" height="150" rx="24" fill="#e8f0f4"/>
          <GameSprite name="kid" x="36" y="8" width="92" height="132"/>
          <GameSprite name="sun" x="160" y="20" width="96" height="96"/>
          <GameSprite name="flower" x="286" y="22" width="96" height="108"/>
        </svg>
        <h2 id="listen-dialog-title" class="dialog-title">{{ copy.winTitle }}</h2>
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
.listen-game .brand-logo{background:#e4eef2}
.listen-game .brand{flex-wrap:wrap}
.listen-game .stage-chip{align-self:center}
.board.listen-board{background:#e4eef2;display:flex;flex-direction:column;gap:16px;padding:42px 18px 16px;aspect-ratio:auto;height:auto;min-height:520px;overflow:visible}
.listen-board .board-note{top:12px}
.listen-dialog{width:min(640px,calc(100vw - 32px))}
.listen-options{display:grid;gap:14px;flex:1;align-content:center}
.listen-option{min-height:148px;border:2px solid #c9d7de;border-radius:24px;background:#fffdf8;display:grid;place-items:center;padding:12px;box-shadow:0 4px 0 #d5e0e6;transition:border-color .2s,background .2s,transform .2s}
.listen-option svg{width:96px;height:88px}
.listen-option.shake{animation:listen-shake .4s ease}
.listen-option.flash{border-color:#b7d0a4;background:#f4faee}
.listen-option:disabled{opacity:1}
.listen-dialog .stage-chip{margin:0 auto 10px}
@keyframes listen-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:700px){
  .board.listen-board{min-height:0;padding:16px 12px 12px;gap:12px}
  .listen-board .board-note{display:none}
  .listen-options{flex:none;gap:10px}
  .listen-option{min-height:112px;padding:8px}
  .listen-option svg{width:72px;height:66px}
}
@media(max-width:420px){
  .listen-option{min-height:100px;border-radius:18px}
  .listen-option svg{width:64px;height:58px}
}
@media(prefers-reduced-motion:reduce){.listen-option.shake{animation:none}}
</style>
