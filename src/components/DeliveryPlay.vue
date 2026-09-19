<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { usePlayAudio } from '../composables/usePlayAudio';
import { deliveryMission } from '../delivery/generate';
import { cancelSpeech, initAudio, playCue, speak } from '../game/audio';
import { createRouteState, findRouteSolution, moveOnRoute, type RouteFailure, type RouteMission } from '../game/routeMission';
import { deliveryLoadBand, parentCopy, STAGE_LABEL } from '../game/stages';
import type { Point } from '../game/types';
import DeliveryBoard from './DeliveryBoard.vue';
import GameSprite from './GameSprite.vue';
import MazeDialog from './MazeDialog.vue';
import ParentGuide from './ParentGuide.vue';
import PlayChrome from './PlayChrome.vue';

const SPEECH = {
  welcome: '開始送貨。把包裹送到三間屋，再到藍色終點。',
  win: '三份包裹都送到了，也到達終點了。',
  delivered: '包裹送到了。',
} as const;

const emit = defineEmits<{ home: [] }>();
const { soundOn, toastText, toastOn, toggleSound } = usePlayAudio();
const source = deliveryMission();
const state = reactive(createRouteState(source));
const narrow = ref(window.innerWidth <= 600);
const mode = ref<'trace' | 'tap'>('tap');
const epoch = ref(0);
const hint = ref<string | null>(null);
const tracingTo = ref<string | null>(null);
const message = ref('把包裹送到三間屋，再到藍色終點。');
const overlay = ref<'welcome' | 'help' | 'win' | null>('welcome');
const mission = computed<RouteMission>(() => {
  if (!narrow.value) return source;
  return { ...source, width: 600, height: 820, nodes: Object.fromEntries(Object.entries(source.nodes)
    .map(([id, [x, y]]) => [id, [x / source.width * 600, y / source.height * 820] as Point])) };
});
const enabled = computed(() => !overlay.value && !state.won);
const remainingStops = computed(() => mission.value.stops.filter((stop) => !state.done.has(stop.node)));
const nextStop = computed(() => remainingStops.value.map((stop) => stop.label).join('、') || '藍色終點');
const stageName = computed(() => STAGE_LABEL[deliveryLoadBand(source)]);
const deliveryGuide = parentCopy.delivery;
const dialogTitle = computed(() => overlay.value === 'help' ? '這次怎樣送貨？'
  : overlay.value === 'win' ? '包裹都送到了！'
    : '小小送貨員，出發！');

function feedback(reason: RouteFailure | 'off-road' | 'start-at-truck'): void {
  if (reason === 'unfinished') message.value = `還有包裹未送，先去 ${nextStop.value} 吧。`;
  else if (reason === 'off-road') message.value = '慢慢來，回到小車旁，沿白色小路繼續畫。';
  else if (reason === 'start-at-truck') message.value = '先按住藍色小車，再沿白色小路畫線。';
}

function move(to: string): void {
  if (!enabled.value) return;
  const before = state.delivered;
  const result = moveOnRoute(mission.value, state, to);
  if (!result.ok) { feedback(result.reason); return; }
  hint.value = null;
  if (state.won) {
    message.value = '三份包裹都送好了，也到達終點了！';
    overlay.value = 'win';
    playCue(soundOn.value, 'win');
    speak(soundOn.value, SPEECH.win);
  } else if (state.delivered > before) {
    playCue(soundOn.value, 'collect');
    speak(soundOn.value, SPEECH.delivered);
    message.value = remainingStops.value.length
      ? `包裹送到了！還要去 ${nextStop.value}。`
      : '三份包裹都送好了！去藍色終點吧。';
  } else {
    playCue(soundOn.value, 'move');
    message.value = remainingStops.value.length
      ? `把包裹送到 ${nextStop.value}。`
      : '去藍色終點吧。';
  }
}

function beginPlay(): void {
  overlay.value = null;
  initAudio(soundOn.value);
  playCue(soundOn.value, 'welcome');
  speak(soundOn.value, SPEECH.welcome);
}

function closeHelpOrStart(): void {
  if (overlay.value === 'welcome') beginPlay();
  else overlay.value = null;
}

function restart(): void {
  Object.assign(state, createRouteState(mission.value));
  hint.value = null;
  epoch.value += 1;
  message.value = '把包裹送到三間屋，再到藍色終點。';
  overlay.value = null;
  cancelSpeech();
  playCue(soundOn.value, 'restart');
}

function showHint(): void {
  if (!enabled.value) return;
  if (tracingTo.value) {
    hint.value = tracingTo.value;
    message.value = '先沿綠色虛線，把這一小段畫到路口，再看看下一步。';
    playCue(soundOn.value, 'hint');
    return;
  }
  const path = findRouteSolution(mission.value, state);
  if (path?.length) {
    hint.value = path[0];
    message.value = `試試綠色虛線這條路，繼續前往${nextStop.value}。`;
    playCue(soundOn.value, 'hint');
  } else {
    message.value = '看一看地圖上還沒送到的房子。';
  }
}

function switchMode(value: 'trace' | 'tap'): void {
  if (mode.value === value) return;
  mode.value = value;
  epoch.value += 1;
  message.value = value === 'trace' ? '從小車開始，按住並沿白色小路畫線。' : '按箭嘴選擇下一個路口，也可以用方向鍵。';
}

function resize(): void { narrow.value = window.innerWidth <= 600; }
function closeHelp(): void { if (overlay.value === 'help') overlay.value = null; }
onMounted(() => window.addEventListener('resize', resize));
onUnmounted(() => window.removeEventListener('resize', resize));
</script>

<template>
  <main class="app delivery-game">
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true"><GameSprite name="truck"/></div>
        <div><div class="eyebrow">小 小 出 遊 家</div><h1>送貨員來了</h1></div>
        <span class="stage-chip">{{ stageName }}</span>
      </div>
      <div class="top-actions">
        <button class="action-button" @click="emit('home')">選擇遊戲</button>
        <button
          class="icon-button"
          :aria-label="soundOn ? '關閉音效' : '開啟音效'"
          :aria-pressed="soundOn"
          title="開關音效"
          @click="toggleSound"
        >
          <svg aria-hidden="true"><use :href="soundOn ? '#i-sound' : '#i-muted'"/></svg>
        </button>
        <button class="icon-button" aria-label="送貨遊戲說明" @click="overlay = 'help'"><svg aria-hidden="true"><use href="#i-help"/></svg></button>
      </div>
    </header>

    <section class="delivery-manifest" aria-label="送到三間屋，最後到終點">
      <div class="delivery-manifest-label"><span>今日送貨單</span><strong>{{ state.delivered }}<small> / 3</small></strong></div>
      <ol class="delivery-stops">
        <li v-for="(stop, index) in mission.stops" :key="stop.node" :class="{ delivered: state.done.has(stop.node), current: !state.done.has(stop.node) && !state.won }" :aria-current="!state.done.has(stop.node) && !state.won ? 'step' : undefined">
          <span class="delivery-number">{{ index + 1 }}</span>
          <span>{{ stop.label }}<small>{{ state.done.has(stop.node) ? '已送到 ✓' : '還沒送到' }}</small></span>
        </li>
        <li class="delivery-finish-step" :class="{ current: state.delivered === 3, delivered: state.won }"><span class="delivery-number">⚑</span><span>終點<small>{{ state.won ? '已完成 ✓' : '送完再去' }}</small></span></li>
      </ol>
    </section>

    <div class="delivery-tools">
      <div class="delivery-mode" role="group" aria-label="操作方式">
        <button :aria-pressed="mode === 'trace'" @click="switchMode('trace')">畫線走路</button>
        <button :aria-pressed="mode === 'tap'" @click="switchMode('tap')">點選路口</button>
      </div>
      <span>{{ mode === 'trace' ? '按住小車，沿路慢慢畫' : '按箭嘴，選下一段路' }}</span>
    </div>

    <DeliveryBoard :key="epoch" :mission="mission" :state="state" :enabled="enabled" :mode="mode" :hint="hint" @move="move" @feedback="feedback" @tracing="tracingTo = $event"/>

    <section class="bottom-bar" aria-label="送貨提示及操作">
      <div class="guide">
        <div class="guide-avatar" aria-hidden="true"><GameSprite name="courier"/></div>
        <div class="guide-copy"><div class="guide-main" role="status" aria-live="polite">{{ message }}</div><div class="guide-sub">{{ mode === 'trace' ? '未到路口可以拉返轉彎；到咗先鎖定。放手可再畫。' : '按箭嘴或方向鍵選路。' }}路可以來回走。</div></div>
      </div>
      <div class="bottom-actions">
        <button class="action-button hint" :disabled="!enabled" @click="showHint"><svg aria-hidden="true"><use href="#i-bulb"/></svg>提示</button>
        <button class="action-button" @click="restart"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-restart"/></svg>重新開始</button>
      </div>
    </section>
    <div class="footer-note"><span>先觀察，再出發</span><i></i><span>不計時 · 不扣分</span></div>
  </main>

  <MazeDialog
    :open="overlay !== null"
    :cancelable="overlay === 'help'"
    labelled-by="delivery-dialog-title"
    dialog-class="delivery-dialog"
    @close="closeHelp"
  >
    <div class="dialog-inner">
      <div class="dialog-eyebrow">{{ overlay === 'win' ? '任 務 完 成' : '觀 察 · 送 貨 · 回 家' }}</div>
      <h2 id="delivery-dialog-title" class="dialog-title">{{ dialogTitle }}</h2>
      <p v-if="overlay === 'welcome' || overlay === 'help'" class="stage-chip delivery-dialog-stage">這一張 · {{ stageName }}</p>
      <GameSprite class="delivery-hero" :name="overlay === 'win' ? 'courier' : 'truck'"/>
      <template v-if="overlay === 'welcome' || overlay === 'help'">
        <ol class="delivery-rules">
          <li><span>1</span><div>紅色起點出發<strong>按箭嘴選路，或改用畫線走路。</strong></div></li>
          <li><span>2</span><div>送到三間屋<strong>哪一間先到都可以，到達就自動送包裹。</strong></div></li>
          <li><span>3</span><div>送完，再到藍色終點<strong>同一條路可以再走，走錯可以轉彎回來。</strong></div></li>
        </ol>
        <ParentGuide :guide="deliveryGuide"/>
        <details class="delivery-parent">
          <summary>點選較易／描線多手眼</summary>
          <p>{{ deliveryGuide.load }}</p>
        </details>
        <button class="primary-button" @click="closeHelpOrStart">{{ overlay === 'welcome' ? '開始送貨' : '繼續送貨' }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
      </template>
      <template v-else-if="overlay === 'win'">
        <p class="dialog-copy">你把三間屋的包裹都送到了，<br>也到達終點了！</p>
        <div class="delivery-awards"><span v-for="n in 3" :key="n"><GameSprite name="parcel"/>{{ n }} 號屋 ✓</span></div>
        <button class="primary-button" @click="restart">再送一次</button>
        <button class="secondary-button" @click="emit('home')">選擇其他遊戲</button>
      </template>
    </div>
  </MazeDialog>

  <PlayChrome
    :toast-on="toastOn"
    :toast-text="toastText"
    :confetti-bits="[]"
  />
</template>

<style>
.app.delivery-game{--delivery-blue:#568aa2;max-width:1020px;min-width:0}
.delivery-game .brand-logo{background:#e1edf0}.delivery-game .brand-logo svg{height:43px}.delivery-game .brand{flex-wrap:wrap}.delivery-game .stage-chip{align-self:center}.delivery-dialog-stage{margin:0 auto 8px}
.delivery-manifest{display:flex;gap:24px;align-items:center;padding:16px 22px;background:var(--paper);border:1px solid #e3e7d9;border-radius:23px;box-shadow:var(--shadow)}
.delivery-manifest-label{flex:none;color:#87927c;font-size:11px;letter-spacing:1px}.delivery-manifest-label strong{display:block;color:#547563;font-size:25px;margin-top:4px}.delivery-manifest-label small{font-size:13px;color:#87927c}
.delivery-stops{list-style:none;margin:0;padding:0;display:flex;flex:1;justify-content:space-between;gap:8px}.delivery-stops li{display:flex;align-items:center;gap:9px;padding:9px;border-radius:15px;color:#8a9681;font-size:14px}.delivery-stops small{display:block;font-size:10px;margin-top:4px;white-space:nowrap}.delivery-stops li.current{background:#fbefce;color:#886730}.delivery-stops li.delivered{color:#4f7c61}.delivery-number{width:33px;height:33px;display:grid;place-items:center;background:#edf0e4;border-radius:50%;font-size:21px;font-weight:850}.current .delivery-number{background:#edcb7e;color:#785921}.delivered .delivery-number{background:#dfecdd;color:#527a56}.delivery-finish-step .delivery-number{background:#e0edf2;color:#568aa2}
.delivery-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:15px 0 12px}.delivery-tools>span{font-size:12px;color:#7f8c78}.delivery-mode{display:flex;padding:4px;border-radius:16px;background:#e8ecdf;gap:4px}.delivery-mode button{min-height:40px;padding:9px 18px;background:transparent;border-radius:12px;color:#7e8a76;font-size:13px}.delivery-mode button[aria-pressed=true]{background:#fffdf7;box-shadow:0 2px 5px #4b614110;color:#4c6d5d}
.delivery-board{position:relative;overflow:hidden;border-radius:22px;isolation:isolate;background:#eaf0df;user-select:none;-webkit-user-select:none}.delivery-board.tracing{touch-action:none}.delivery-map{width:100%;height:100%;display:block}.delivery-map-note{position:absolute;top:15px;left:50%;transform:translateX(-50%);background:#ffffffa6;color:#7d8c70;border-radius:20px;padding:7px 14px;font-size:11px;white-space:nowrap;pointer-events:none}
.delivery-targets{position:absolute;inset:0;pointer-events:none}.delivery-target{pointer-events:auto;position:absolute;width:45px;height:45px;transform:translate(-50%,-50%);display:grid;place-items:center;border:3px solid #fffaf0;border-radius:50%;background:#edca70;box-shadow:0 3px 0 #b3a05e}.delivery-target svg{width:24px;height:24px;color:#826b32}.delivery-target.hinted{background:#79aa8e}.delivery-target.hinted svg{color:white}.delivery-target:active{scale:1!important}.delivery-stamp-button{position:absolute;transform:translate(-50%,25px);background:#fffcf1;border:2px dashed #d5b56c;border-radius:17px;padding:7px 12px;min-height:48px;display:flex;align-items:center;gap:7px;box-shadow:0 3px 0 #c9d2b880;white-space:nowrap;font-size:13px}.delivery-stamp-button svg{width:32px;height:32px}.delivery-sticker{animation:pop-in .3s ease-out}
.delivery-game .guide-main{font-size:15px}.delivery-game .guide-sub{font-size:10px}.delivery-hero{height:125px;width:180px;margin:12px auto 18px}.delivery-rules{list-style:none;text-align:left;padding:0;margin:20px 0 24px;display:grid;gap:17px}.delivery-rules li{display:flex;align-items:flex-start;gap:13px;font-size:15px;line-height:1.5}.delivery-rules li>span{width:26px;height:26px;border-radius:9px;background:#e9efdf;color:#69805c;display:grid;place-items:center;flex:none;font-size:13px}.delivery-rules strong{display:block;font-size:12px;color:#88917f;font-weight:500;margin-top:3px}.delivery-parent{text-align:left;border-top:1px solid #e6e9dd;padding:15px 0;margin-bottom:8px;font-size:12px;color:#7a8870}.delivery-parent summary{cursor:pointer;min-height:30px}.delivery-parent p{line-height:1.8;margin:5px 0 12px}.delivery-awards{display:flex;justify-content:center;gap:16px;margin:15px 0 26px}.delivery-awards span{display:grid;justify-items:center;gap:8px;font-size:12px;color:#6a855a}.delivery-awards svg{width:65px;height:65px}
@media(min-width:1000px){.app.delivery-game{max-width:min(1020px,calc((100dvh - 340px)*1.167 + 70px));min-width:650px}}
@media(max-width:700px){.delivery-game .topbar{flex-wrap:wrap}.delivery-game .top-actions{margin-left:auto}.delivery-manifest{gap:10px;padding:12px}.delivery-manifest-label{display:none}.delivery-stops{gap:3px}.delivery-stops li{gap:5px;padding:7px 5px;font-size:12px}.delivery-number{width:27px;height:27px;font-size:18px}.delivery-stops small{font-size:9px}.delivery-tools{align-items:flex-start;flex-direction:column;gap:7px}.delivery-mode{width:100%}.delivery-mode button{flex:1;min-height:42px}.delivery-tools>span{align-self:center;font-size:11px}.delivery-map-note{font-size:10px;top:11px;padding:6px 11px}.delivery-stamp-button{font-size:12px;padding:5px 8px;gap:3px;transform:translate(-50%,14px)}.delivery-stamp-button svg{width:25px;height:25px}.delivery-game .bottom-bar{margin-top:15px}.delivery-game .guide-avatar{width:46px;height:46px}.delivery-game .guide-main{font-size:14px}.delivery-game .action-button{font-size:14px}.delivery-dialog .dialog-inner{padding:24px}.delivery-dialog .dialog-title{font-size:24px}}
@media(prefers-reduced-motion:reduce){.delivery-sticker{animation:none}}
</style>
