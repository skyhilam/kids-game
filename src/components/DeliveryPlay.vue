<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import GameSprite from './GameSprite.vue';
import DeliveryBoard from './DeliveryBoard.vue';
import MazeDialog from './MazeDialog.vue';
import { deliveryMission } from '../delivery/generate';
import { createRouteState, findRouteSolution, moveOnRoute, type RouteFailure, type RouteMission } from '../game/routeMission';
import type { Point } from '../game/types';

const emit = defineEmits<{ home: [] }>();
const source = deliveryMission();
const state = reactive(createRouteState(source));
const narrow = ref(window.innerWidth <= 600);
const mode = ref<'trace' | 'tap'>('trace');
const epoch = ref(0);
const hint = ref<string | null>(null);
const tracingTo = ref<string | null>(null);
const message = ref('先找一找 1 號屋，再從小車開始畫線。');
const overlay = ref<'welcome' | 'help' | 'win' | 'stuck' | null>('welcome');
const mission = computed<RouteMission>(() => {
  if (!narrow.value) return source;
  return { ...source, width: 600, height: 820, nodes: Object.fromEntries(Object.entries(source.nodes)
    .map(([id, [x, y]]) => [id, [x / source.width * 600, y / source.height * 820] as Point])) };
});
const enabled = computed(() => !overlay.value && !state.won && !state.stalled);
const nextStop = computed(() => mission.value.stops[state.delivered]?.label ?? '藍色終點');
const dialogTitle = computed(() => overlay.value === 'welcome' ? '小小送貨員，出發！'
  : overlay.value === 'help' ? '這次怎樣送貨？'
    : overlay.value === 'win' ? '包裹都送到了！' : '停一停，再想一條路');

function feedback(reason: RouteFailure | 'off-road' | 'start-at-truck'): void {
  if (reason === 'used-road') message.value = '橙色小路已經走過了，找另一條白色小路吧。';
  else if (reason === 'wrong-order') message.value = `要先送到 ${nextStop.value}，按 1 → 2 → 3 的次序走。`;
  else if (reason === 'unfinished') message.value = `包裹還未送完，先去 ${nextStop.value} 吧。`;
  else if (reason === 'off-road') message.value = '慢慢來，回到小車旁，沿白色小路繼續畫。';
  else if (reason === 'start-at-truck') message.value = '先按住藍色小車，再沿白色小路畫線。';
}

function move(to: string): void {
  if (!enabled.value) return;
  const before = state.delivered;
  const result = moveOnRoute(mission.value, state, to);
  if (!result.ok) { feedback(result.reason); return; }
  hint.value = null;
  if (state.won) { message.value = '三份包裹都送好了，也到達終點了！'; overlay.value = 'win'; }
  else if (state.stalled) overlay.value = 'stuck';
  else if (state.delivered > before) {
    message.value = state.delivered === mission.value.stops.length
      ? '三份包裹都送好了！沿未走過的小路，到藍色終點吧。'
      : `第 ${state.delivered} 份包裹送到了！下一站是 ${nextStop.value}。`;
  }
  else message.value = `下一站：${nextStop.value}。看看還有哪些白色小路。`;
}

function restart(): void {
  Object.assign(state, createRouteState(mission.value));
  hint.value = null;
  epoch.value += 1;
  message.value = '先找一找 1 號屋，再從小車出發。';
  overlay.value = null;
}

function showHint(): void {
  if (!enabled.value) return;
  if (tracingTo.value) {
    hint.value = tracingTo.value;
    message.value = '先沿綠色虛線，把這一小段畫到路口，再看看下一步。';
    return;
  }
  const path = findRouteSolution(mission.value, state);
  if (path?.length) {
    hint.value = path[0];
    message.value = `試試綠色虛線這條路，繼續前往${nextStop.value}。`;
  } else {
    message.value = '這條路線已經無法完成送貨，重新規劃一次吧。';
    overlay.value = 'stuck';
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
      </div>
      <div class="top-actions">
        <button class="action-button" @click="emit('home')">選擇遊戲</button>
        <button class="icon-button" aria-label="送貨遊戲說明" @click="overlay = 'help'"><svg aria-hidden="true"><use href="#i-help"/></svg></button>
      </div>
    </header>

    <section class="delivery-manifest" aria-label="依序送到 1、2、3 號屋，最後到終點">
      <div class="delivery-manifest-label"><span>今日送貨單</span><strong>{{ state.delivered }}<small> / 3</small></strong></div>
      <ol class="delivery-stops">
        <li v-for="(stop, index) in mission.stops" :key="stop.node" :class="{ delivered: index < state.delivered, current: index === state.delivered }" :aria-current="index === state.delivered ? 'step' : undefined">
          <span class="delivery-number">{{ index + 1 }}</span>
          <span>{{ stop.label }}<small>{{ index < state.delivered ? '已送到 ✓' : index === state.delivered ? '下一站' : '等待送貨' }}</small></span>
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
        <div class="guide-copy"><div class="guide-main" role="status" aria-live="polite">{{ message }}</div><div class="guide-sub">{{ mode === 'trace' ? '可以停下、放手，再從小車繼續。' : '按箭嘴或方向鍵選路。' }}橙色小路不能再走。</div></div>
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
      <div class="dialog-eyebrow">{{ overlay === 'win' ? '任 務 完 成' : '觀 察 · 順 序 · 畫 線' }}</div>
      <h2 id="delivery-dialog-title" class="dialog-title">{{ dialogTitle }}</h2>
      <GameSprite class="delivery-hero" :name="overlay === 'win' ? 'courier' : 'truck'"/>
      <template v-if="overlay === 'welcome' || overlay === 'help'">
        <ol class="delivery-rules">
          <li><span>1</span><div>紅色起點出發<strong>按住小車，沿白色小路畫線。</strong></div></li>
          <li><span>2</span><div>依序送到 1 → 2 → 3 號屋<strong>到達房子，包裹便會自動送到。</strong></div></li>
          <li><span>3</span><div>送完，再到藍色終點<strong>同一段路不能走兩次，反方向也不行。</strong></div></li>
        </ol>
        <details class="delivery-parent"><summary>給家長的小提示</summary><p>先一起找起點、三間屋和終點。問孩子：「先去邊間屋？返程有冇另一條路？」第一次可用點選路口；想畫線時，再用手指或觸控筆慢慢走。可以重經路口，但不能重走已變橙色的路段。</p></details>
        <button class="primary-button" @click="overlay = null">{{ overlay === 'welcome' ? '開始送貨' : '繼續送貨' }}</button>
        <button class="secondary-button" type="button" @click="emit('home')">選擇遊戲</button>
      </template>
      <template v-else-if="overlay === 'win'">
        <p class="dialog-copy">你按 1、2、3 的次序送好包裹，<br>沿不同的小路到達終點了！</p>
        <div class="delivery-awards"><span v-for="n in 3" :key="n"><GameSprite name="parcel"/>{{ n }} 號屋 ✓</span></div>
        <button class="primary-button" @click="restart">再送一次</button>
        <button class="secondary-button" @click="emit('home')">選擇其他遊戲</button>
      </template>
      <template v-else-if="overlay === 'stuck'">
        <p class="dialog-copy">剩下的小路未能完成送貨。<br>一起看看下一次怎樣走，慢慢試就好。</p>
        <button class="primary-button" @click="restart">重新畫一條路</button>
        <button class="secondary-button" @click="overlay = null">先看看地圖</button>
      </template>
    </div>
  </MazeDialog>
</template>

<style>
.app.delivery-game{--delivery-blue:#568aa2;max-width:1020px;min-width:0}
.delivery-game .brand-logo{background:#e1edf0}.delivery-game .brand-logo svg{height:43px}
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
