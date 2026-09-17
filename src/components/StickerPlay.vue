<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { cancelSpeech, initAudio, playCue, speakEnglish } from '../game/audio';
import { randomSeed } from '../game/rng';
import { parentCopy, STAGE_LABEL } from '../game/stages';
import { STICKER_COPY as copy } from '../sticker/copy';
import {
  dealBoard,
  lift,
  placedCount,
  slotOf,
  tryPlace,
  WORD_IDS,
  WORD_ZH,
  type PlacedMap,
  type StickerDeal,
  type WordId,
} from '../sticker/words';
import GameSprite from './GameSprite.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();

const overlay = ref<'welcome' | 'help' | 'win' | null>('welcome');
const board = ref<StickerDeal>(dealBoard(randomSeed()));
const placed = reactive<PlacedMap>({});
const shakeSlot = ref<WordId | null>(null);
const message = ref<string>(copy.guideMain);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let shakeTimer = 0;
let confettiTimer = 0;
const stageLabel = STAGE_LABEL.easy;
const guide = parentCopy.sticker.easy;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const drag = ref<{
  id: WordId;
  pointerId: number;
  x: number;
  y: number;
  over: WordId | null;
} | null>(null);

const matched = computed(() => placedCount(placed));
const playing = computed(() => overlay.value === null);

function resetPlaced(): void {
  for (const id of WORD_IDS) delete placed[id];
}

function applyPlaced(next: PlacedMap): void {
  for (const id of WORD_IDS) {
    if (next[id]) placed[id] = next[id];
    else delete placed[id];
  }
}

function reshuffle(): void {
  board.value = dealBoard(randomSeed());
  resetPlaced();
  message.value = copy.guideMain;
  overlay.value = null;
  clearConfetti();
  cancelSpeech();
}

function slotAtPoint(x: number, y: number): WordId | null {
  const node = document.elementFromPoint(x, y)?.closest('[data-word-slot]');
  const id = node?.getAttribute('data-word-slot');
  return id && (WORD_IDS as readonly string[]).includes(id) ? id as WordId : null;
}

function unbindDrag(): void {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
}

function onDown(event: PointerEvent, id: WordId): void {
  if (!playing.value) return;
  event.preventDefault();
  drag.value = {
    id,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    over: slotAtPoint(event.clientX, event.clientY),
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}

function onMove(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  drag.value.x = event.clientX;
  drag.value.y = event.clientY;
  drag.value.over = slotAtPoint(event.clientX, event.clientY);
}

function finishDrag(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  const id = drag.value.id;
  const slot = slotAtPoint(event.clientX, event.clientY);
  drag.value = null;
  unbindDrag();
  if (!playing.value) return;
  if (!slot) {
    applyPlaced(lift(placed, id));
    return;
  }
  const result = tryPlace(placed, slot, id);
  if (result.kind === 'correct') {
    applyPlaced(result.placed);
    playCue(soundOn.value, 'collect');
    speakEnglish(soundOn.value, id);
    message.value = `對喇，${id}`;
    if (result.cleared) {
      overlay.value = 'win';
      playCue(soundOn.value, 'win');
      burstConfetti();
    }
    return;
  }
  playCue(soundOn.value, 'hint');
  window.clearTimeout(shakeTimer);
  shakeSlot.value = slot;
  shakeTimer = window.setTimeout(() => { shakeSlot.value = null; }, 420);
  if (result.kind === 'blocked') {
    toast(copy.blocked);
    message.value = copy.blocked;
    return;
  }
  toast(copy.wrong);
  message.value = copy.wrong;
}

function onUp(event: PointerEvent): void {
  finishDrag(event);
}

function onCancel(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  drag.value = null;
  unbindDrag();
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
  cancelSpeech();
  overlay.value = 'help';
}

function replay(): void {
  playCue(soundOn.value, 'restart');
  reshuffle();
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

function isAway(word: WordId): boolean {
  return Boolean(slotOf(placed, word)) && drag.value?.id !== word;
}

onUnmounted(() => {
  unbindDrag();
  window.clearTimeout(shakeTimer);
  clearConfetti();
});
</script>

<template>
  <main class="app words-game">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="flower"/></div>
        <div>
          <div class="eyebrow">小 小 出 遊 家</div>
          <h1>{{ copy.title }}</h1>
        </div>
        <span class="stage-chip" data-stage="簡單">{{ stageLabel }}</span>
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

    <section class="mission" aria-label="任務：拖貼紙配英文詞，全部放對就過關">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <div class="mission-step" :class="matched === WORD_IDS.length ? 'done' : 'active'">
          <div class="step-icon"><GameSprite aria-hidden="true" name="sun"/></div>
          <div class="step-copy">
            <small>圖詞配對</small>
            <strong>{{ copy.mission }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span>{{ matched }} / {{ WORD_IDS.length }}</span>
        <span class="stage-chip">{{ stageLabel }}</span>
      </div>
    </section>

    <div class="board-frame">
      <div class="board words-board" :class="{ dragging: Boolean(drag) }">
        <p class="board-note">把貼紙拖到英文詞上</p>
        <div class="word-slots" role="list" :aria-label="copy.slotsLabel">
          <div
            v-for="word in board.slots"
            :key="word"
            class="word-slot"
            :class="{
              filled: placed[word] && drag?.id !== placed[word],
              over: drag?.over === word,
              shake: shakeSlot === word,
            }"
            :data-word-slot="word"
            role="listitem"
            :aria-label="`英文詞 ${word}`"
          >
            <button
              v-if="placed[word] && drag?.id !== placed[word]"
              type="button"
              class="slot-sticker"
              :data-sticker="placed[word]"
              :data-placed="word"
              @pointerdown="onDown($event, placed[word]!)"
            >
              <GameSprite :name="placed[word]!" :label="WORD_ZH[placed[word]!]" />
            </button>
            <span class="word-label">
              {{ word }}
              <small v-if="placed[word] && drag?.id !== placed[word]" aria-hidden="true">✓</small>
            </span>
          </div>
        </div>
        <div class="sticker-tray" :aria-label="copy.trayLabel">
          <div
            v-for="word in board.tray"
            :key="word"
            class="tray-slot"
            :class="{ empty: isAway(word) }"
          >
            <button
              v-if="!isAway(word) && drag?.id !== word"
              type="button"
              class="sticker-chip"
              :data-sticker="word"
              @pointerdown="onDown($event, word)"
            >
              <GameSprite :name="word" :label="WORD_ZH[word]" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <section class="bottom-bar" aria-label="遊戲提示">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><GameSprite name="bear"/></div>
        <div class="guide-copy">
          <div class="guide-main" role="status" aria-live="polite">{{ message }}</div>
          <div class="guide-sub">{{ copy.guideSub }}</div>
        </div>
      </div>
    </section>
    <div class="footer-note">
      <span>{{ copy.footer[0] }}</span><i></i><span>{{ copy.footer[1] }}</span><i></i><span>{{ copy.footer[2] }}</span>
    </div>
  </main>

  <div
    v-if="drag"
    class="sticker-float"
    :style="{ left: `${drag.x}px`, top: `${drag.y}px` }"
    aria-hidden="true"
  >
    <GameSprite :name="drag.id" />
  </div>

  <MazeDialog
    :open="overlay !== null"
    :cancelable="overlay === 'help'"
    labelled-by="sticker-dialog-title"
    dialog-class="words-dialog"
    @close="closeHelp"
  >
    <div class="dialog-inner" :class="{ 'help-inner': overlay === 'help' }">
      <template v-if="overlay === 'welcome'">
        <div class="dialog-eyebrow">{{ copy.welcomeEyebrow }}</div>
        <svg class="dialog-hero" viewBox="0 0 420 150" aria-hidden="true">
          <rect width="420" height="150" rx="24" fill="#eef4e4"/>
          <GameSprite name="burger" x="18" y="28" width="88" height="88"/>
          <GameSprite name="car" x="118" y="32" width="92" height="80"/>
          <GameSprite name="tree" x="220" y="18" width="80" height="108"/>
          <GameSprite name="sun" x="312" y="22" width="90" height="90"/>
        </svg>
        <h2 id="sticker-dialog-title" class="dialog-title">{{ copy.title }}</h2>
        <p class="stage-chip">{{ stageLabel }}</p>
        <p class="dialog-copy">{{ copy.welcomeBody }}</p>
        <button class="primary-button" type="button" autofocus @click="beginPlay">
          {{ copy.start }}<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
        <div class="dialog-footnote">不計時 · 不扣分 · 放錯可以再拖</div>
      </template>

      <template v-else-if="overlay === 'help'">
        <div class="help-header">
          <h2 id="sticker-dialog-title">{{ copy.helpTitle }}</h2>
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
            <p>{{ copy.parent }}</p>
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
          <rect width="420" height="150" rx="24" fill="#eef4e4"/>
          <GameSprite name="flower" x="40" y="22" width="90" height="100"/>
          <GameSprite name="sun" x="160" y="18" width="100" height="100"/>
          <GameSprite name="home" x="280" y="24" width="96" height="100"/>
        </svg>
        <h2 id="sticker-dialog-title" class="dialog-title">{{ copy.winTitle }}</h2>
        <p class="dialog-copy">{{ copy.winBody }}</p>
        <button class="primary-button" type="button" autofocus @click="replay">
          再玩<svg viewBox="0 0 32 32"><use href="#i-restart"/></svg>
        </button>
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
.words-game .brand-logo{background:#f3ead4}
.words-game .brand{flex-wrap:wrap}
.words-game .stage-chip{align-self:center}
.board.words-board{background:#e8f0dc;display:flex;flex-direction:column;gap:16px;padding:42px 18px 16px;aspect-ratio:auto;height:auto;min-height:560px;overflow:visible}
.words-board .board-note{top:12px}
.words-dialog{width:min(640px,calc(100vw - 32px))}
.word-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;flex:1}
.word-slot{min-height:0;border:2px dashed #c5d2b3;border-radius:22px;background:#f7faf0cc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 8px;position:relative;transition:border-color .2s,background .2s,transform .2s}
.word-slot.filled{border-style:solid;border-color:#b7d0a4;background:#fffdf8;justify-content:flex-end}
.word-slot.over{border-color:#e6a557;background:#fff6df}
.word-slot.shake{animation:words-shake .4s ease}
.word-label{font-size:22px;letter-spacing:.6px;color:#4f6b4c;font-weight:850;display:flex;align-items:center;gap:6px}
.word-label small{width:18px;height:18px;border-radius:50%;background:var(--green);color:#fff;font-size:11px;display:grid;place-items:center}
.slot-sticker,.sticker-chip{width:100%;height:auto;background:transparent;padding:0;display:grid;place-items:center;touch-action:none}
.slot-sticker{flex:1;min-height:64px}
.slot-sticker svg,.sticker-chip svg{width:72px;height:64px}
.sticker-tray{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:10px;border-radius:20px;background:#fffdf8d9;border:1.5px solid #e3e7d6}
.tray-slot{min-height:78px;border-radius:16px;background:#f3f5ea;display:grid;place-items:center}
.tray-slot.empty{background:#eef1e4;border:1.5px dashed #d3d8c6}
.sticker-float{position:fixed;z-index:50;width:88px;height:80px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 8px 12px #304b4330)}
.words-help-cols{margin:8px 0 4px}
.words-dialog .stage-chip{margin:0 auto 10px}
@keyframes words-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media(max-width:700px){
  .board.words-board{min-height:0;padding:16px 12px 12px;gap:12px}
  .words-board .board-note{display:none}
  .word-slots{flex:none;gap:8px}
  .word-slot{min-height:112px}
  .word-label{font-size:16px}
  .slot-sticker{min-height:56px}
  .slot-sticker svg,.sticker-chip svg{width:56px;height:50px}
  .sticker-tray{grid-template-columns:repeat(3,minmax(0,1fr))}
  .tray-slot{min-height:70px}
}
@media(prefers-reduced-motion:reduce){.word-slot.shake{animation:none}}
</style>
