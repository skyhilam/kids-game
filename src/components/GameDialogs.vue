<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { LEVELS } from '../game/rules';
import type { Overlay } from '../game/types';

const props = defineProps<{
  overlay: Overlay | null;
  level: number;
  lastLevel: boolean;
  allDone: boolean;
  reduceMotion: boolean;
}>();

const emit = defineEmits<{
  start: [];
  retry: [];
  next: [];
  replay: [];
  close: [];
  jump: [index: number];
  revealed: [];
}>();

const dialogEl = ref<HTMLDialogElement | null>(null);
const stuckReason = computed(() => props.overlay?.kind === 'stuck' ? props.overlay.reason : 'deadend');
let returnFocus: HTMLElement | null = null;
let revealTimer = 0;

function openDialog(): void {
  nextTick(() => {
    const dialog = dialogEl.value;
    if (dialog && !dialog.open) {
      if (!returnFocus) returnFocus = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    const focus = dialog?.querySelector<HTMLElement>('[autofocus], button');
    focus?.focus({ preventScroll: true });
  });
}

function hideDialog(): void {
  dialogEl.value?.close();
  if (returnFocus && returnFocus.isConnected && !('disabled' in returnFocus && returnFocus.disabled)) {
    returnFocus.focus({ preventScroll: true });
  }
  returnFocus = null;
}

function clearReveal(): void {
  window.clearTimeout(revealTimer);
}

watch(() => props.overlay?.kind, (kind) => {
  clearReveal();
  if (kind === 'win') {
    revealTimer = window.setTimeout(() => {
      openDialog();
      emit('revealed');
    }, props.reduceMotion ? 100 : 650);
    return;
  }
  if (kind) openDialog();
  else hideDialog();
}, { immediate: true });

onUnmounted(clearReveal);

function onCancel(event: Event): void {
  event.preventDefault();
  if (props.overlay?.kind === 'help' || props.overlay?.kind === 'rescue') emit('close');
}
</script>

<template>
  <dialog id="gameDialog" ref="dialogEl" aria-labelledby="dialogTitle" @cancel="onCancel">
    <div v-if="overlay?.kind === 'welcome'" class="dialog-inner">
      <div class="dialog-eyebrow">一段小路 · 一次旅程</div>
      <svg class="dialog-hero" viewBox="0 0 420 162" aria-hidden="true">
        <path d="M38 126q89-33 170-3t172-9" stroke="#dfe9cf" stroke-width="26" fill="none" stroke-linecap="round"/>
        <path d="M40 126q88-32 168-3t172-9" stroke="#fff8e5" stroke-width="12" fill="none" stroke-linecap="round"/>
        <use href="#art-tree" x="301" y="18" width="76" height="105"/>
        <use href="#art-car" x="100" y="44" width="201" height="122"/>
        <use href="#art-flower" x="56" y="93" width="32" height="40"/>
        <g fill="#ead092">
          <circle cx="64" cy="45" r="4"/>
          <circle cx="294" cy="33" r="3"/>
          <path d="m311 67 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>
        </g>
      </svg>
      <h2 class="dialog-title" id="dialogTitle">一起去野餐</h2>
      <p class="dialog-copy">駕駛小車購買漢堡，<br>再前往公園，與小熊野餐。</p>
      <div class="welcome-route" aria-label="小車出發，先購買漢堡，再前往公園">
        <div class="route-item"><div class="route-picture"><svg><use href="#art-car"/></svg></div><span>出發</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture" style="background:#fbedd0"><svg><use href="#art-burger"/></svg></div><span>購買漢堡</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture"><svg><use href="#art-park"/></svg></div><span>前往公園</span></div>
      </div>
      <div class="rule-note"><svg viewBox="0 0 28 28"><use href="#i-once"/></svg>同一路段僅可通行一次</div>
      <button class="primary-button" id="startBtn" autofocus @click="emit('start')">開始遊戲<svg><use href="#i-arrow"/></svg></button>
      <div class="dialog-footnote">{{ LEVELS.length }} 個關卡 · 輕觸即可遊玩 · 不計時</div>
    </div>

    <div v-else-if="overlay?.kind === 'stuck'" class="dialog-inner">
      <div class="dialog-eyebrow">從容再試</div>
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <use href="#art-bear" x="132" y="8" width="136" height="135"/>
        <use v-if="stuckReason === 'burger'" href="#art-burger" x="256" y="60" width="60" height="55"/>
        <use v-else href="#art-flower" x="76" y="82" width="43" height="53"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle" style="font-size:27px">{{ stuckReason === 'burger' ? '尚未購買漢堡' : '此路已經走到盡頭' }}</h2>
      <p class="dialog-copy" v-html="stuckReason === 'burger' ? '請先前往漢堡店，<br>再前往公園野餐。' : '沒有關係，請改選其他路線。<br>可由起點重新出發。'"></p>
      <button class="primary-button" id="retryBtn" autofocus @click="emit('retry')">
        <svg><use href="#i-restart"/></svg>再試一次
      </button>
      <div class="dialog-footnote">小熊會陪伴你，不必著急。</div>
    </div>

    <div v-else-if="overlay?.kind === 'win'" class="dialog-inner">
      <div class="dialog-eyebrow">第 {{ level + 1 }} 關 · 小旅行完成</div>
      <svg class="dialog-hero" viewBox="0 0 400 165" aria-hidden="true">
        <use href="#art-picnic" x="35" y="0" width="330" height="165"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle">已到達公園</h2>
      <p class="dialog-copy">漢堡已經帶到，小熊很高興。<br>{{ allDone ? '所有關卡均已完成。' : '一起坐下野餐。' }}</p>
      <div class="stamp-row">
        <span class="stamp"><svg><use href="#i-check"/></svg>已購漢堡</span>
        <span class="stamp"><svg><use href="#i-check"/></svg>已到公園</span>
        <span class="stamp"><svg><use href="#i-check"/></svg>沒有重複通行</span>
      </div>
      <button class="primary-button" id="nextBtn" autofocus @click="emit('next')">
        {{ lastLevel || allDone ? '從頭再玩' : '下一關' }}
        <svg><use :href="lastLevel || allDone ? '#i-restart' : '#i-arrow'"/></svg>
      </button>
      <button class="secondary-button" id="replayBtn" @click="emit('replay')">再玩本關</button>
    </div>

    <div v-else-if="overlay?.kind === 'help'" class="dialog-inner help-inner">
      <div class="help-header">
        <h2 id="dialogTitle">遊戲說明</h2>
        <button class="close-button" id="closeHelp" aria-label="關閉說明" @click="emit('close')">
          <svg><use href="#i-close"/></svg>
        </button>
      </div>
      <div class="help-section">
        <h3>任務</h3>
        <p>由紅色小車出發，先前往漢堡店，再到藍色箭頭的公園。<strong>同一路段不可重複通行</strong>，走過的道路會變成橙色。不計時、不扣分；若走到盡頭，可重新開始。</p>
      </div>
      <div class="help-section">
        <h3>操作</h3>
        <p>輕觸發光圓圈，小車會沿路駛至下一路口；亦可由小車向相鄰光圈輕掃。圓圈只顯示尚未通行的道路。按「提示」會以綠色圓圈標示可完成任務的下一步；若已無法完成，可重新開始。</p>
      </div>
      <div class="help-section" style="border:0">
        <h3>選擇關卡</h3>
        <div class="help-levels">
          <button
            v-for="(item, i) in LEVELS"
            :key="item.name"
            class="help-level"
            :class="{ selected: i === level }"
            :data-level="i"
            @click="emit('jump', i)"
          >
            {{ i + 1 }} · {{ item.short }}
            <small>{{ item.name }}</small>
          </button>
        </div>
      </div>
      <button class="primary-button help-finish" id="backToGame" autofocus @click="emit('close')">返回遊戲<svg><use href="#i-arrow"/></svg></button>
    </div>

    <div v-else-if="overlay?.kind === 'rescue'" class="dialog-inner">
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <use href="#art-bear" x="142" y="15" width="116" height="123"/>
        <use href="#art-flower" x="260" y="80" width="35" height="45"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle" style="font-size:25px">此路線無法到達目的地</h2>
      <p class="dialog-copy">在不重複通行的規則下，請由起點再試。<br>一起選擇另一條小路。</p>
      <button class="primary-button" id="rescueBtn" autofocus @click="emit('retry')">
        重新開始<svg><use href="#i-restart"/></svg>
      </button>
      <button class="secondary-button" id="exploreBtn" @click="emit('close')">繼續嘗試</button>
    </div>
  </dialog>
</template>
