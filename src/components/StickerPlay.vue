<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { cancelSpeech, hasEnglishSpeech, initAudio, playCue, speakEnglish } from '../game/audio';
import { randomSeed } from '../game/rng';
import { formatStageChip, parentCopy, STAGE_LABEL, stickerLoadBand } from '../game/stages';
import { STICKER_COPY as copy } from '../sticker/copy';
import {
  markStickerOnboardSeen,
  readStickerOnboardSeen,
  speakStickerWord,
  wrongDropFeedback,
} from '../sticker/hear';
import {
  dealBoard,
  isWordId,
  lift,
  nextCallout,
  parseStickerMode,
  placedCount,
  recapOrder,
  rollRecent,
  slotOf,
  tryPlace,
  tryPlaceCallout,
  WORD_EN,
  WORD_HINT,
  WORD_IDS,
  WORD_ZH,
  type PlacedMap,
  type StickerDeal,
  type StickerMode,
  type WordId,
} from '../sticker/words';
import GameSprite from './GameSprite.vue';
import SpriteStrip from './SpriteStrip.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toast, toggleSound } = usePlayAudio();

const RECAP_BEAT_MS = 900;
const SILENT_CUE_MS = 1500;

const mode = ref<StickerMode>(parseStickerMode(new URLSearchParams(location.search).get('mode')));
const overlay = ref<'welcome' | 'help' | 'win' | null>('welcome');
const level = ref(0);
const board = ref<StickerDeal>(dealBoard(randomSeed(), 0));
const recentDeals = ref<WordId[][]>([board.value.slots]);
const placed = reactive<PlacedMap>({});
const shakeSlot = ref<WordId | null>(null);
const flashSlot = ref<WordId | null>(null);
const hintSlot = ref<WordId | null>(null);
const cueSlot = ref<WordId | null>(null);
const recapSlot = ref<WordId | null>(null);
const recapping = ref(false);
const showOnboard = ref(false);
const message = ref<string>(mode.value === 'callout' ? copy.calloutIntro : copy.freeIntro);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
let shakeTimer = 0;
let hintTimer = 0;
let cueTimer = 0;
let calloutTimer = 0;
let recapTimer = 0;
let confettiTimer = 0;
const stageBand = computed(() => stickerLoadBand(level.value));
const stageLabel = computed(() => STAGE_LABEL[stageBand.value]);
const guide = computed(() => parentCopy.sticker[stageBand.value]);
const words = computed(() => board.value.slots);
const callOrder = computed(() => board.value.slots);
const active = computed(() => nextCallout(placed, callOrder.value));
const fallbackArt = ['apple', 'cat', 'rocket', 'dolphin'] as const;
const welcomeArt = computed(() => words.value.length ? words.value.slice(0, 4) : fallbackArt);
const winArt = computed(() => {
  const matchedWords = words.value.filter((word) => placed[word] === word);
  return matchedWords.length ? matchedWords.slice(0, 4) : fallbackArt;
});
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const drag = ref<{
  id: WordId;
  pointerId: number;
  x: number;
  y: number;
  over: WordId | null;
} | null>(null);

const matched = computed(() => placedCount(placed, words.value));
const stageChip = computed(() => formatStageChip({
  levelIndex: level.value,
  band: stageBand.value,
  progress: `${matched.value} / ${words.value.length}`,
}));
const playing = computed(() => overlay.value === null && !recapping.value);
const slotColumns = computed(() => words.value.length === 4 ? 2 : 3);
const trayColumns = computed(() => words.value.length);

function speechApiPresent(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  } catch {
    return false;
  }
}

function resetPlaced(): void {
  for (const id of WORD_IDS) delete placed[id];
}

function applyPlaced(next: PlacedMap): void {
  for (const id of WORD_IDS) {
    if (next[id]) placed[id] = next[id];
    else delete placed[id];
  }
}

function introMessage(): string {
  return mode.value === 'callout' ? copy.calloutIntro : copy.freeIntro;
}

function clearCalloutTimer(): void {
  window.clearTimeout(calloutTimer);
  calloutTimer = 0;
}

function clearSilentCue(): void {
  window.clearTimeout(cueTimer);
  cueTimer = 0;
  cueSlot.value = null;
}

function clearRecap(): void {
  window.clearTimeout(recapTimer);
  recapTimer = 0;
  recapSlot.value = null;
  recapping.value = false;
}

function chooseMode(next: StickerMode): void {
  mode.value = next;
  if (overlay.value === 'welcome') message.value = introMessage();
}

function dealLevel(nextLevel: number): void {
  clearCalloutTimer();
  clearRecap();
  clearSilentCue();
  level.value = nextLevel;
  board.value = dealBoard(randomSeed(), nextLevel, recentDeals.value.flat());
  recentDeals.value = rollRecent(recentDeals.value, board.value.slots);
  resetPlaced();
  message.value = introMessage();
  overlay.value = null;
  window.clearTimeout(hintTimer);
  hintSlot.value = null;
  shakeSlot.value = null;
  flashSlot.value = null;
  clearConfetti();
  cancelSpeech();
  if (mode.value === 'callout' && active.value) speakEnglish(soundOn.value, WORD_EN[active.value]);
}

function slotAtPoint(x: number, y: number): WordId | null {
  const node = document.elementFromPoint(x, y)?.closest('[data-word-slot]');
  const id = node?.getAttribute('data-word-slot');
  return id && isWordId(id) ? id : null;
}

function unbindDrag(): void {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
}

function showSilentCue(word: WordId): void {
  cueSlot.value = word;
  window.clearTimeout(cueTimer);
  cueTimer = window.setTimeout(() => { cueSlot.value = null; }, SILENT_CUE_MS);
}

function hearSticker(id: WordId): void {
  if (!playing.value) return;
  initAudio(soundOn.value);
  speakStickerWord(soundOn.value, id);
  if (mode.value === 'free' && !hasEnglishSpeech(soundOn.value)) showSilentCue(id);
}

function onDown(event: PointerEvent, id: WordId): void {
  if (!event.isPrimary || event.button !== 0) { cancelDrag(); return; }
  if (!playing.value) return;
  initAudio(soundOn.value);
  speakStickerWord(soundOn.value, id);
  if (mode.value === 'free' && !hasEnglishSpeech(soundOn.value)) showSilentCue(id);
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

function pulseSlot(slot: WordId): void {
  window.clearTimeout(shakeTimer);
  shakeSlot.value = slot;
  flashSlot.value = slot;
  shakeTimer = window.setTimeout(() => {
    shakeSlot.value = null;
    flashSlot.value = null;
  }, reduceMotion ? 0 : 420);
}

function queueRecapBeat(run: () => void): void {
  if (!speechApiPresent()) {
    run();
    return;
  }
  recapTimer = window.setTimeout(run, RECAP_BEAT_MS);
}

function openWin(): void {
  window.clearTimeout(recapTimer);
  recapTimer = 0;
  recapSlot.value = null;
  recapping.value = false;
  overlay.value = 'win';
  playCue(soundOn.value, 'win');
  burstConfetti();
}

function recapAt(order: readonly WordId[], index: number): void {
  if (!recapping.value) return;
  if (index >= order.length) {
    openWin();
    return;
  }
  const word = order[index]!;
  recapSlot.value = word;
  if (hasEnglishSpeech(soundOn.value)) speakEnglish(soundOn.value, WORD_EN[word]);
  queueRecapBeat(() => recapAt(order, index + 1));
}

function beginRecap(): void {
  clearCalloutTimer();
  window.clearTimeout(recapTimer);
  recapping.value = true;
  recapSlot.value = null;
  message.value = copy.recap;
  const order = recapOrder(words.value);
  queueRecapBeat(() => recapAt(order, 0));
}

function armNextCallout(next: WordId | null): void {
  clearCalloutTimer();
  if (!next) return;
  const speakNext = () => {
    if (!playing.value || mode.value !== 'callout' || active.value !== next) return;
    speakEnglish(soundOn.value, WORD_EN[next]);
  };
  if (speechApiPresent()) calloutTimer = window.setTimeout(speakNext, RECAP_BEAT_MS);
  else speakNext();
}

function placeCallout(slot: WordId, id: WordId): void {
  const current = active.value;
  if (!current) return;
  const result = tryPlaceCallout(placed, current, slot, id, words.value);
  if (result.kind === 'correct') {
    applyPlaced(result.placed);
    playCue(soundOn.value, 'collect');
    speakEnglish(soundOn.value, WORD_EN[id]);
    message.value = `對喇，${WORD_EN[id]}`;
    hideOnboard();
    if (result.cleared) beginRecap();
    else armNextCallout(nextCallout(result.placed, callOrder.value));
    return;
  }
  applyPlaced(lift(placed, id));
  playCue(soundOn.value, 'hint');
  pulseSlot(current);
  message.value = copy.calloutWrong;
  speakEnglish(soundOn.value, WORD_EN[current]);
}

function placeFree(slot: WordId, id: WordId): void {
  const result = tryPlace(placed, slot, id, words.value);
  if (result.kind === 'correct') {
    applyPlaced(result.placed);
    playCue(soundOn.value, 'collect');
    speakEnglish(soundOn.value, WORD_EN[id]);
    message.value = `對喇，${WORD_EN[id]}`;
    hideOnboard();
    if (result.cleared) beginRecap();
    return;
  }
  applyPlaced(lift(placed, id));
  playCue(soundOn.value, 'hint');
  pulseSlot(slot);
  const feedback = wrongDropFeedback(id);
  window.clearTimeout(hintTimer);
  hintSlot.value = feedback.hintSlot;
  hintTimer = window.setTimeout(() => { hintSlot.value = null; }, 1600);
  message.value = feedback.message;
  toast(feedback.message);
  speakEnglish(soundOn.value, WORD_EN[slot]);
}

function finishDrag(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  const id = drag.value.id;
  const slot = slotAtPoint(event.clientX, event.clientY);
  drag.value = null;
  unbindDrag();
  if (!playing.value) return;
  clearCalloutTimer();
  if (!slot) {
    applyPlaced(lift(placed, id));
    return;
  }
  if (mode.value === 'callout') placeCallout(slot, id);
  else placeFree(slot, id);
}

function onUp(event: PointerEvent): void {
  finishDrag(event);
}

function cancelDrag(): void {
  drag.value = null;
  unbindDrag();
}

function onWindowPointer(event: PointerEvent): void {
  if (!event.isPrimary) cancelDrag();
}

function onCancel(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return;
  drag.value = null;
  unbindDrag();
}

watch(playing, (enabled) => { if (!enabled) cancelDrag(); }, { flush: 'sync' });

function hideOnboard(): void {
  markStickerOnboardSeen();
  showOnboard.value = false;
}

function beginPlay(): void {
  overlay.value = null;
  initAudio(soundOn.value);
  playCue(soundOn.value, 'welcome');
  showOnboard.value = !readStickerOnboardSeen();
  message.value = introMessage();
  if (mode.value === 'callout' && active.value) speakEnglish(soundOn.value, WORD_EN[active.value]);
}

function closeHelp(): void {
  if (overlay.value === 'help') overlay.value = null;
}

function showHelp(): void {
  if (!playing.value) return;
  cancelSpeech();
  overlay.value = 'help';
}

function nextLevel(): void {
  playCue(soundOn.value, 'restart');
  dealLevel(level.value + 1);
}

function replay(): void {
  playCue(soundOn.value, 'restart');
  clearRecap();
  dealLevel(level.value);
}

function replayActive(): void {
  if (!playing.value || mode.value !== 'callout' || !active.value) return;
  initAudio(soundOn.value);
  if (!hasEnglishSpeech(soundOn.value)) {
    pulseSlot(active.value);
    return;
  }
  speakEnglish(soundOn.value, WORD_EN[active.value]);
}

function onSlotPress(word: WordId): void {
  if (!playing.value || mode.value !== 'free') return;
  if (!hasEnglishSpeech(soundOn.value)) {
    showSilentCue(word);
    return;
  }
  initAudio(soundOn.value);
  speakEnglish(soundOn.value, WORD_EN[word]);
}

function slotIsActive(word: WordId): boolean {
  return playing.value && mode.value === 'callout' && active.value === word;
}

function slotIsDim(word: WordId): boolean {
  return playing.value && mode.value === 'callout' && active.value !== word;
}

function slotAccepts(word: WordId): boolean {
  if (!playing.value) return false;
  return mode.value === 'free' || active.value === word;
}

function showsNoAudio(word: WordId): boolean {
  if (hasEnglishSpeech(soundOn.value)) return false;
  if (mode.value === 'callout') return slotIsActive(word);
  return cueSlot.value === word;
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

onMounted(() => {
  window.addEventListener('resize', cancelDrag);
  window.addEventListener('pointerdown', onWindowPointer, true);
});

onUnmounted(() => {
  cancelDrag();
  window.removeEventListener('resize', cancelDrag);
  window.removeEventListener('pointerdown', onWindowPointer, true);
  window.clearTimeout(shakeTimer);
  window.clearTimeout(hintTimer);
  hintSlot.value = null;
  clearSilentCue();
  clearCalloutTimer();
  clearRecap();
  clearConfetti();
});
</script>

<template>
  <main class="app words-game" :data-sticker-mode="mode">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="flower"/></div>
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

    <section class="mission" aria-label="任務：拖貼紙配英文詞，全部放對就過關">
      <div class="mission-label">今日小任務</div>
      <div class="mission-steps">
        <div class="mission-step" :class="matched === words.length ? 'done' : 'active'">
          <div class="step-icon"><GameSprite aria-hidden="true" name="sun"/></div>
          <div class="step-copy">
            <small>圖詞配對</small>
            <strong>{{ copy.mission }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span class="stage-chip" :data-stage="stageLabel" :data-stage-chip="stageChip">{{ stageChip }}</span>
      </div>
    </section>

    <div class="board-frame">
      <div class="board words-board" :class="{ dragging: Boolean(drag) }">
        <p class="board-note">把貼紙拖到英文詞上</p>
        <div v-if="showOnboard" class="sticker-onboard" data-sticker-onboard>
          <span>{{ copy.onboard }}</span>
          <button type="button" @click="hideOnboard">{{ copy.onboardSkip }}</button>
        </div>
        <div
          class="word-slots"
          role="list"
          :aria-label="copy.slotsLabel"
          :style="{ gridTemplateColumns: `repeat(${slotColumns}, minmax(0, 1fr))` }"
        >
          <div
            v-for="word in board.slots"
            :key="word"
            class="word-slot"
            :class="{
              filled: placed[word] && drag?.id !== placed[word],
              over: drag?.over === word && slotAccepts(word),
              shake: shakeSlot === word,
              flash: flashSlot === word,
              hint: hintSlot === word,
              active: slotIsActive(word),
              dim: slotIsDim(word),
              'no-audio': showsNoAudio(word),
              recap: recapSlot === word,
            }"
            :data-word-slot="word"
            :data-active="slotIsActive(word) ? 'true' : undefined"
            role="listitem"
            :aria-disabled="slotIsDim(word) ? true : undefined"
            :aria-label="`英文詞 ${WORD_EN[word]}`"
            @click="onSlotPress(word)"
          >
            <div
              v-if="placed[word] && drag?.id !== placed[word]"
              class="slot-sticker"
              :data-sticker="placed[word]"
              :data-placed="word"
            >
              <GameSprite :name="placed[word]!" :label="WORD_ZH[placed[word]!]" />
            </div>
            <span class="word-label">
              {{ WORD_EN[word] }}
              <small v-if="placed[word] && drag?.id !== placed[word]" aria-hidden="true">✓</small>
            </span>
            <span v-if="showsNoAudio(word)" class="word-hint">👄 {{ WORD_HINT[word] }}</span>
            <button
              v-if="slotIsActive(word)"
              class="slot-replay"
              type="button"
              :aria-label="copy.replayLabel"
              @click.stop="replayActive"
            >
              <svg aria-hidden="true"><use href="#i-sound"/></svg>
            </button>
          </div>
        </div>
        <div
          class="sticker-tray"
          :aria-label="copy.trayLabel"
          :style="{ gridTemplateColumns: `repeat(${trayColumns}, minmax(0, 1fr))` }"
        >
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
              :aria-label="`撳聽 ${WORD_ZH[word]}`"
              @pointerdown="onDown($event, word)"
              @keydown.enter.prevent="hearSticker(word)"
              @keydown.space.prevent="hearSticker(word)"
            >
              <GameSprite :name="word" :label="WORD_ZH[word]" />
              <svg class="chip-speaker" aria-hidden="true"><use href="#i-sound"/></svg>
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
          <div class="guide-sub">{{ stageChip }}。{{ copy.guideSub }}</div>
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
        <SpriteStrip class="dialog-hero" :names="welcomeArt" fill="#eef4e4"/>
        <h2 id="sticker-dialog-title" class="dialog-title">{{ copy.title }}</h2>
        <p class="stage-chip" :data-stage="stageLabel">第 {{ level + 1 }} 關 · {{ stageLabel }}</p>
        <p class="dialog-copy">{{ copy.welcomeBody }}</p>
        <div class="mode-pick" role="group" :aria-label="copy.modeLabel">
          <button
            class="secondary-button"
            type="button"
            :aria-pressed="mode === 'callout'"
            @click="chooseMode('callout')"
          >{{ copy.modeCallout }}</button>
          <button
            class="secondary-button"
            type="button"
            :aria-pressed="mode === 'free'"
            @click="chooseMode('free')"
          >{{ copy.modeFree }}</button>
        </div>
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
            <p>{{ copy.parent[stageBand] }}</p>
          </article>
        </div>
        <ParentGuide collapsible :guide="guide" :stage-label="stageLabel"/>
        <button class="primary-button help-finish" type="button" autofocus @click="closeHelp">
          返回遊戲<svg><use href="#i-arrow"/></svg>
        </button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
      </template>

      <template v-else-if="overlay === 'win'">
        <div class="dialog-eyebrow">{{ copy.winEyebrow }}</div>
        <SpriteStrip class="dialog-hero" :names="winArt" fill="#eef4e4"/>
        <h2 id="sticker-dialog-title" class="dialog-title">{{ copy.winTitle }}</h2>
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
.words-game .brand-logo{background:#f3ead4}
.words-game .brand{flex-wrap:wrap}
.words-game .stage-chip{align-self:center}
.board.words-board{background:#e8f0dc;display:flex;flex-direction:column;gap:16px;padding:42px 18px 16px;aspect-ratio:auto;height:auto;min-height:clamp(320px,50dvh,560px);overflow:visible}
.words-board .board-note{top:12px}
.words-dialog{width:min(640px,calc(100vw - 32px))}
.mode-pick{display:flex;gap:8px;justify-content:center;margin:0 auto 12px;max-width:360px}
.mode-pick .secondary-button{flex:1;min-width:0}
.mode-pick button[aria-pressed="true"]{background:#e8f0dc;box-shadow:inset 0 0 0 2px #7eaa6a}
.word-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;flex:1}
.word-slot{min-height:148px;min-width:0;border:2px dashed #c5d2b3;border-radius:22px;background:#f7faf0cc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 8px;position:relative;transition:border-color .2s,background .2s,transform .2s,opacity .2s}
.word-slot.filled{border-style:solid;border-color:#b7d0a4;background:#fffdf8;justify-content:flex-end}
.word-slot.over{border-color:#e6a557;background:#fff6df}
.word-slot.shake{animation:words-shake .4s ease}
.word-slot.flash{box-shadow:0 0 0 4px #e6a55766;animation:words-flash .45s ease}
.word-slot.hint{border-color:#e6a557;box-shadow:0 0 0 4px #e6a55740}
.word-slot.active{border-style:solid;border-color:#e0943a;background:#fff6df;box-shadow:0 0 0 5px #e6a55755,0 8px 20px #e6a55733}
.word-slot.dim{opacity:.5}
.word-slot.recap{opacity:1;border-style:solid;border-color:#7eaa6a;background:#fffdf8;box-shadow:0 0 0 4px #9fb98366}
.word-slot.no-audio .word-label{font-size:calc(22px * 1.6)}
.word-label{font-size:22px;letter-spacing:.6px;color:#4f6b4c;font-weight:850;display:flex;align-items:center;gap:6px}
.word-label small{width:18px;height:18px;border-radius:50%;background:var(--green);color:#fff;font-size:11px;display:grid;place-items:center}
.word-hint{display:block;max-width:100%;margin-top:4px;font-size:13px;font-weight:750;line-height:1.3;color:#6a5344;text-align:center;overflow-wrap:anywhere}
.slot-replay{position:absolute;top:8px;right:8px;width:34px;height:34px;border-radius:50%;background:#fff;border:1.5px solid #d7e2c4;display:grid;place-items:center;padding:0}
.slot-replay svg{width:18px;height:18px}
.slot-sticker,.sticker-chip{min-height:64px;width:100%;height:auto;background:transparent;padding:0;display:grid;place-items:center;touch-action:none}
.slot-sticker{flex:1;min-height:64px;pointer-events:none}
.slot-sticker svg,.sticker-chip svg{width:72px;height:64px}
.sticker-chip{position:relative}
.sticker-chip svg.chip-speaker{position:absolute;right:2px;bottom:2px;width:18px;height:18px;pointer-events:none;opacity:.75}
.sticker-tray{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:10px;border-radius:20px;background:#fffdf8d9;border:1.5px solid #e3e7d6}
.tray-slot{min-height:78px;border-radius:16px;background:#f3f5ea;display:grid;place-items:center}
.tray-slot.empty{background:#eef1e4;border:1.5px dashed #d3d8c6}
.sticker-float{position:fixed;z-index:50;width:88px;height:80px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 8px 12px #304b4330)}
.sticker-onboard{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin:0;padding:6px 8px 6px 12px;border-radius:16px;background:#fffdf8f2;border:1.5px solid #d7e2c4;color:#3f5c3e;font-size:14px;font-weight:800;line-height:1.3;pointer-events:none}
.sticker-onboard button{pointer-events:auto;border-radius:999px;background:#e8f0dc;padding:4px 10px;font-size:13px;font-weight:800}
.words-help-cols{margin:8px 0 4px}
.words-dialog .stage-chip{margin:0 auto 10px}
@keyframes words-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes words-flash{0%,100%{filter:none}40%{filter:brightness(1.12)}}
@media(max-width:700px){
  .board.words-board{min-height:0;padding:16px 12px 12px;gap:12px}
  .words-board .board-note{display:none}
  .word-slots{flex:none;gap:8px}
  .word-slot{min-height:112px}
  .word-label{font-size:16px}
  .word-slot.no-audio .word-label{font-size:calc(16px * 1.6)}
  .slot-sticker{min-height:56px}
  .slot-sticker svg,.sticker-chip svg{width:56px;height:50px}
  .sticker-tray{grid-template-columns:repeat(3,minmax(0,1fr))}
  .tray-slot{min-height:70px}
}
@media(max-height:500px) and (min-width:701px){
  .board.words-board{min-height:0}
  .word-slots{flex:none}
  .word-slot{min-height:148px}
}
@media(prefers-reduced-motion:reduce){.word-slot.shake,.word-slot.hint,.word-slot.flash{animation:none}}
</style>
