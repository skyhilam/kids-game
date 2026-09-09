<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue';
import GameBoard from './components/GameBoard.vue';
import SpriteDefs from './components/SpriteDefs.vue';
import {
  cancelSpeech,
  initAudio,
  loadVoices,
  playNotes,
  resumeAudio,
  speak,
  suspendAudio,
} from './game/audio';
import {
  LEVELS,
  available,
  createGame,
  findSolution,
  makeGraph,
  tryMove,
} from './game/rules';
import type { GameState, Graph, NodeId } from './game/types';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = ref(window.innerWidth <= 600);
const graph = shallowRef<Graph>(makeGraph(0, narrow.value));
const game = reactive<GameState>(createGame(0, narrow.value).state);
const started = ref(false);
const moving = ref(false);
const soundOn = ref(true);
const epoch = ref(0);
const completed = ref(new Set<number>());
const carX = ref(graph.value.nodes.s[0]);
const carY = ref(graph.value.nodes.s[1]);
const carAngle = ref(90);
const hintNode = ref<NodeId | null>(null);
const pickupVisible = ref(false);
const trailProgress = ref<{ edgeId: string; reverse: boolean; t: number } | null>(null);
const guideMain = ref('點一下光圈，小車就會行！');
const guideSub = ref('先去漢堡店，再去公園開餐。');
const toastText = ref('');
const toastOn = ref(false);
const dialogKind = ref<'welcome' | 'stuck' | 'win' | 'help' | 'rescue' | ''>('');
const stuckReason = ref<'burger' | 'deadend'>('deadend');
const dialogEl = ref<HTMLDialogElement | null>(null);
const confettiBits = ref<{ i: number; left: string; bg: string; delay: string; duration: string; round: boolean; drift: string }[]>([]);
const keyboardMode = ref(false);
let toastTimer = 0;
let pickupTimer = 0;
let announcementTimer = 0;
let layoutTimer = 0;
let pointerStart: { id: number; x: number; y: number } | null = null;
let returnFocus: HTMLElement | null = null;

const helpShort = ['跟住走', '揀一揀', '探吓路'];
const lastLevel = computed(() => game.level === LEVELS.length - 1);
const allDone = computed(() => completed.value.size === LEVELS.length);

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function setGuide(main: string, sub?: string, read = false): void {
  guideMain.value = main;
  if (sub !== undefined) guideSub.value = sub;
  if (read) speak(soundOn.value, main);
}

function toast(text: string): void {
  window.clearTimeout(toastTimer);
  toastText.value = text;
  toastOn.value = true;
  toastTimer = window.setTimeout(() => { toastOn.value = false; }, 2600);
}

function openDialog(kind: typeof dialogKind.value): void {
  returnFocus = document.activeElement as HTMLElement | null;
  dialogKind.value = kind;
  nextTick(() => {
    const dialog = dialogEl.value;
    if (dialog && !dialog.open) dialog.showModal();
    const focus = dialog?.querySelector<HTMLElement>('[autofocus], button');
    focus?.focus({ preventScroll: true });
  });
}

function closeDialog(): void {
  dialogEl.value?.close();
  dialogKind.value = '';
  if (returnFocus && returnFocus.isConnected && !('disabled' in returnFocus && returnFocus.disabled)) {
    returnFocus.focus({ preventScroll: true });
  }
}

function showHelp(): void {
  if (moving.value) return;
  cancelSpeech();
  openDialog('help');
}

function onSwipeCancel(): void {
  pointerStart = null;
}

function onDialogCancel(event: Event): void {
  event.preventDefault();
  if (dialogKind.value === 'help' || dialogKind.value === 'rescue') closeDialog();
}

function placeCar(node: NodeId, angle: number): void {
  const [x, y] = graph.value.nodes[node];
  carX.value = x;
  carY.value = y;
  carAngle.value = angle;
}

function startLevel(index: number, opts: { announce?: boolean; hint?: boolean } = {}): void {
  epoch.value += 1;
  window.clearTimeout(pickupTimer);
  window.clearTimeout(announcementTimer);
  const fresh = createGame(index, narrow.value);
  graph.value = fresh.graph;
  Object.assign(game, fresh.state);
  moving.value = false;
  hintNode.value = null;
  pickupVisible.value = false;
  trailProgress.value = null;
  confettiBits.value = [];
  placeCar('s', 90);
  setGuide(
    game.level === 0 ? '點一下光圈，小車就會行！' : '先搵漢堡店，再去公園。',
    game.level === 0 ? '先去漢堡店，再去公園開餐。' : `第 ${game.level + 1} 關 · ${graph.value.name}。橙色路已經行過喇。`,
  );
  if (opts.hint) hintNode.value = findSolution(graph.value, game.node, game.burger, game.used)?.[0] ?? null;
  if (opts.announce) {
    speak(
      soundOn.value,
      game.level === 0 ? '點一下發光圓圈，去買漢堡啦。' : '先去漢堡店，再去公園。每段路只行一次。',
    );
  }
}

function isBlocked(): boolean {
  return moving.value || !started.value || !!game.won || !!game.stalled || !!dialogEl.value?.open;
}

function move(to: NodeId): void {
  if (isBlocked()) return;
  const result = tryMove(graph.value, game, to);
  if (!result.ok) {
    toast('呢段橙色路行過喇，試吓另一條。');
    return;
  }
  const currentEpoch = epoch.value;
  moving.value = true;
  hintNode.value = null;
  pickupVisible.value = false;
  window.clearTimeout(pickupTimer);
  playNotes(soundOn.value, [[430, 0, 0.10, 0.045], [510, 0.07, 0.12, 0.035]]);

  const [x0, y0] = graph.value.nodes[result.from];
  const [x1, y1] = graph.value.nodes[result.to];
  const targetAngle = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
  const initialAngle = carAngle.value;
  const delta = ((targetAngle - initialAngle + 540) % 360) - 180;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const duration = reduceMotion ? 80 : clamp(length * 3, 650, 1080);
  trailProgress.value = { edgeId: result.edgeId, reverse: result.reverse, t: 0 };
  let time0: number | null = null;
  const frame = (time: number) => {
    if (currentEpoch !== epoch.value) return;
    if (time0 === null) time0 = time;
    const t = clamp((time - time0) / duration, 0, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    carX.value = x0 + (x1 - x0) * ease;
    carY.value = y0 + (y1 - y0) * ease;
    carAngle.value = initialAngle + delta * Math.min(t * 4, 1);
    trailProgress.value = { edgeId: result.edgeId, reverse: result.reverse, t: ease };
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    moving.value = false;
    placeCar(result.to, targetAngle);
    trailProgress.value = { edgeId: result.edgeId, reverse: result.reverse, t: 1 };
    if (result.boughtNow) pickupBurger();
    if (result.won) {
      win();
      return;
    }
    if (result.stalled) {
      stuck(result.stalled);
      return;
    }
    if (!result.boughtNow) {
      if (game.burger) setGuide('漢堡買好喇，去公園啦！', '揀一條未變橙色嘅路，向公園出發。');
      else if (available(graph.value, game.node, game.used).length > 1) setGuide('到路口喇，漢堡店喺邊呢？', '點一個光圈，揀你想行嘅路。');
      else setGuide('沿住小路，繼續行啦！', '先買漢堡，再去公園。每段路只行一次。');
    }
    if (keyboardMode.value) {
      nextTick(() => document.querySelector<HTMLButtonElement>('#targets button')?.focus({ preventScroll: true }));
    }
  };
  requestAnimationFrame(frame);
}

function pickupBurger(): void {
  setGuide('漢堡買好喇，去公園啦！', '小熊帶住漢堡，繼續揀未行過嘅路。', true);
  playNotes(soundOn.value, [[523, 0, 0.18], [659, 0.13, 0.18], [784, 0.26, 0.27]]);
  pickupVisible.value = true;
  pickupTimer = window.setTimeout(() => { pickupVisible.value = false; }, 2300);
}

function stuck(reason: 'burger' | 'deadend'): void {
  stuckReason.value = reason;
  const forgotten = reason === 'burger';
  setGuide(forgotten ? '記得先去漢堡店呀。' : '試吓另一條路，一齊再出發。', '冇扣分，慢慢試就得。');
  playNotes(soundOn.value, [[440, 0, 0.2, 0.035], [523, 0.18, 0.3, 0.04]]);
  openDialog('stuck');
  speak(
    soundOn.value,
    forgotten ? '仲未買漢堡呀。先去漢堡店，再去公園啦。' : '呢邊行到盡頭喇。冇問題，一齊再試一次。',
  );
}

function burstConfetti(): void {
  if (reduceMotion) return;
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
  window.setTimeout(() => { confettiBits.value = []; }, 4400);
}

function win(): void {
  const next = new Set(completed.value);
  next.add(game.level);
  completed.value = next;
  setGuide('到公園喇，一齊食漢堡！', '你帶小熊完成咗今次小旅行。');
  playNotes(soundOn.value, [[523, 0, 0.22], [659, 0.15, 0.22], [784, 0.3, 0.22], [1047, 0.48, 0.5]]);
  const currentEpoch = epoch.value;
  announcementTimer = window.setTimeout(() => {
    if (currentEpoch !== epoch.value) return;
    openDialog('win');
    burstConfetti();
    speak(
      soundOn.value,
      allDone.value
        ? '到公園喇！三段小旅程都完成啦！一齊食漢堡。'
        : '到公園喇！小熊好開心，一齊食漢堡啦！',
    );
  }, reduceMotion ? 100 : 650);
}

function welcomeStart(): void {
  started.value = true;
  initAudio(soundOn.value);
  closeDialog();
  playNotes(soundOn.value, [[523, 0, 0.16], [659, 0.12, 0.22]]);
  speak(soundOn.value, '出發啦！點一下發光圓圈，去買漢堡啦。');
}

function requestHint(): void {
  if (isBlocked()) return;
  const path = findSolution(graph.value, game.node, game.burger, game.used);
  playNotes(soundOn.value, [[660, 0, 0.15], [880, 0.11, 0.22]]);
  if (path && path.length) {
    hintNode.value = path[0];
    setGuide('試吓點綠色光圈。', game.burger ? '沿呢邊行，就可以去公園。' : '沿呢邊行，先去漢堡店。', true);
  } else {
    openDialog('rescue');
    speak(soundOn.value, '呢條路接唔到目的地喇。重新出發，再試另一條路。');
  }
}

function toggleSound(): void {
  soundOn.value = !soundOn.value;
  if (soundOn.value) {
    initAudio(true);
    playNotes(true, [[659, 0, 0.17]]);
    speak(true, '聲音開咗喇。');
  } else {
    cancelSpeech();
    suspendAudio();
  }
  toast(soundOn.value ? '聲音開咗喇' : '聲音已關閉');
}

function restart(): void {
  if (moving.value || dialogEl.value?.open) return;
  cancelSpeech();
  playNotes(soundOn.value, [[523, 0, 0.18]]);
  startLevel(game.level, { announce: true });
}

function jumpToLevel(index: number): void {
  closeDialog();
  started.value = true;
  startLevel(index, { announce: true });
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Tab') keyboardMode.value = true;
  if (dialogEl.value?.open || isBlocked()) return;
  const dirs: Record<string, [number, number]> = {
    ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
  };
  const dir = dirs[event.key];
  if (!dir) return;
  event.preventDefault();
  keyboardMode.value = true;
  const [vx, vy] = dir;
  const [x, y] = graph.value.nodes[game.node];
  const choice = available(graph.value, game.node, game.used)
    .map((link) => {
      const [nx, ny] = graph.value.nodes[link.to];
      const dx = nx - x;
      const dy = ny - y;
      return { to: link.to, score: (dx * vx + dy * vy) / Math.hypot(dx, dy) };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (choice && choice.score > 0.7) move(choice.to);
}

function onPointerDown(): void {
  keyboardMode.value = false;
}

function onSwipeStart(event: PointerEvent): void {
  if ((event.target as HTMLElement).closest('button') || isBlocked()) return;
  const board = document.getElementById('board');
  if (!board) return;
  const rect = board.getBoundingClientRect();
  const mapW = narrow.value ? 600 : 840;
  const mapH = narrow.value ? 790 : 660;
  const x = (event.clientX - rect.left) / rect.width * mapW;
  const y = (event.clientY - rect.top) / rect.height * mapH;
  const [cx, cy] = graph.value.nodes[game.node];
  if (Math.hypot(x - cx, y - cy) < Math.max(60, 38 / rect.width * mapW)) {
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    board.setPointerCapture(event.pointerId);
  } else {
    const nearest = available(graph.value, game.node, game.used)
      .map((link) => {
        const [nx, ny] = graph.value.nodes[link.to];
        return { to: link.to, d: Math.hypot((nx - x) * rect.width / mapW, (ny - y) * rect.height / mapH) };
      })
      .sort((a, b) => a.d - b.d)[0];
    if (nearest && nearest.d < 45) move(nearest.to);
  }
}

function onSwipeEnd(event: PointerEvent): void {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (isBlocked() || Math.hypot(dx, dy) < 20) return;
  const [x, y] = graph.value.nodes[game.node];
  const best = available(graph.value, game.node, game.used)
    .map((link) => {
      const [nx, ny] = graph.value.nodes[link.to];
      const vx = nx - x;
      const vy = ny - y;
      return { to: link.to, score: (dx * vx + dy * vy) / (Math.hypot(dx, dy) * Math.hypot(vx, vy)) };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score > 0.68) move(best.to);
}

function applyLayout(force = false): void {
  const next = window.innerWidth <= 600;
  if (!force && next === narrow.value) return;
  if (moving.value) {
    window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(() => applyLayout(force), 120);
    return;
  }
  narrow.value = next;
  graph.value = makeGraph(game.level, next);
  placeCar(game.node, carAngle.value);
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
  startLevel(0);
  openDialog('welcome');
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('resize', () => applyLayout());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => { cancelSpeech(); suspendAudio(); });
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('visibilitychange', onVisibility);
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
          aria-label="家長說明與關卡選擇"
          title="陪玩小貼士"
          :disabled="moving"
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
            <strong id="burgerStepText">{{ game.burger ? '漢堡到手' : '買漢堡' }}</strong>
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
            <strong id="parkStepText">{{ game.won ? '到公園喇' : '去公園' }}</strong>
          </div>
        </div>
      </div>
      <div class="level-badge">
        <span id="levelLabel">第 {{ game.level + 1 }} 關</span>
        <span class="level-dots" aria-hidden="true">
          <i v-for="n in 3" :key="n" :class="n - 1 === game.level ? 'current' : completed.has(n - 1) ? 'complete' : ''"/>
        </span>
      </div>
    </section>
    <GameBoard
      :graph="graph"
      :state="game"
      :started="started"
      :moving="moving"
      :narrow="narrow"
      :car-x="carX"
      :car-y="carY"
      :car-angle="carAngle"
      :hint-node="hintNode"
      :pickup-visible="pickupVisible"
      :trail-progress="trailProgress"
      @move="move"
      @swipe-start="onSwipeStart"
      @swipe-end="onSwipeEnd"
      @swipe-cancel="onSwipeCancel"
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
        <button class="action-button hint" id="hintBtn" :disabled="moving || game.won" @click="requestHint">
          <svg aria-hidden="true"><use href="#i-bulb"/></svg>提一提
        </button>
        <button class="action-button" id="restartBtn" :disabled="moving" @click="restart">
          <svg aria-hidden="true"><use href="#i-restart"/></svg>重新出發
        </button>
      </div>
    </section>
    <div class="footer-note" aria-hidden="true">
      <span>慢慢嚟，唔使急</span><i></i><span>冇計時 · 冇扣分</span><i></i><span>陪小熊一起探索</span>
    </div>
  </main>

  <dialog id="gameDialog" ref="dialogEl" aria-labelledby="dialogTitle" @cancel="onDialogCancel">
    <div v-if="dialogKind === 'welcome'" class="dialog-inner">
      <div class="dialog-eyebrow">一段小路 · 一次小冒險</div>
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
      <p class="dialog-copy">揸住小車買漢堡，<br>再去公園，同小熊開餐！</p>
      <div class="welcome-route" aria-label="小車出發，先買漢堡，再去公園">
        <div class="route-item"><div class="route-picture"><svg><use href="#art-car"/></svg></div><span>出發</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture" style="background:#fbedd0"><svg><use href="#art-burger"/></svg></div><span>買漢堡</span></div>
        <svg class="route-chevron" viewBox="0 0 32 32"><use href="#i-arrow"/></svg>
        <div class="route-item"><div class="route-picture"><svg><use href="#art-park"/></svg></div><span>去公園</span></div>
      </div>
      <div class="rule-note"><svg viewBox="0 0 28 28"><use href="#i-once"/></svg>同一段路，只行一次</div>
      <button class="primary-button" id="startBtn" autofocus @click="welcomeStart">出發啦！<svg><use href="#i-arrow"/></svg></button>
      <div class="dialog-footnote">3 個小關卡 · 點一點就可以玩 · 冇計時</div>
    </div>

    <div v-else-if="dialogKind === 'stuck'" class="dialog-inner">
      <div class="dialog-eyebrow">慢慢嚟 · 再試一次</div>
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <use href="#art-bear" x="132" y="8" width="136" height="135"/>
        <use v-if="stuckReason === 'burger'" href="#art-burger" x="256" y="60" width="60" height="55"/>
        <use v-else href="#art-flower" x="76" y="82" width="43" height="53"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle" style="font-size:27px">{{ stuckReason === 'burger' ? '仲未買漢堡呀！' : '呢邊行到盡頭喇' }}</h2>
      <p class="dialog-copy" v-html="stuckReason === 'burger' ? '小熊個肚仔咕咕叫。<br>先去漢堡店，再嚟公園啦。' : '冇問題，一齊試另一條路！<br>由起點再出發，慢慢揀。'"></p>
      <button class="primary-button" id="retryBtn" autofocus @click="closeDialog(); startLevel(game.level, { announce: true, hint: true })">
        <svg><use href="#i-restart"/></svg>再試一次
      </button>
      <div class="dialog-footnote">小熊會陪你，唔使急。</div>
    </div>

    <div v-else-if="dialogKind === 'win'" class="dialog-inner">
      <div class="dialog-eyebrow">第 {{ game.level + 1 }} 關 · 小旅行完成</div>
      <svg class="dialog-hero" viewBox="0 0 400 165" aria-hidden="true">
        <use href="#art-picnic" x="35" y="0" width="330" height="165"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle">到公園喇！</h2>
      <p class="dialog-copy">漢堡帶到，小熊好開心。<br>{{ allDone ? '三段小旅程都完成喇！' : '一齊坐低，開餐啦！' }}</p>
      <div class="stamp-row">
        <span class="stamp"><svg><use href="#i-check"/></svg>買咗漢堡</span>
        <span class="stamp"><svg><use href="#i-check"/></svg>到咗公園</span>
        <span class="stamp"><svg><use href="#i-check"/></svg>冇行重複路</span>
      </div>
      <button class="primary-button" id="nextBtn" autofocus @click="closeDialog(); startLevel(lastLevel ? 0 : game.level + 1, { announce: true })">
        {{ lastLevel ? '由頭再玩' : '下一站' }}
        <svg><use :href="lastLevel ? '#i-restart' : '#i-arrow'"/></svg>
      </button>
      <button class="secondary-button" id="replayBtn" @click="closeDialog(); startLevel(game.level, { announce: true })">再玩呢一關</button>
    </div>

    <div v-else-if="dialogKind === 'help'" class="dialog-inner help-inner">
      <div class="help-header">
        <h2 id="dialogTitle">陪玩小貼士</h2>
        <button class="close-button" id="closeHelp" aria-label="關閉說明" @click="closeDialog">
          <svg><use href="#i-close"/></svg>
        </button>
      </div>
      <div class="help-section">
        <h3>陪小朋友做三件事</h3>
        <p>由紅色小車出發 → 先去漢堡店 → 再到藍色箭嘴嘅公園。<strong>同一段路唔可以行兩次</strong>，走過嘅路會變橙色。唔計時、唔扣分，行到盡頭可以重新出發。</p>
      </div>
      <div class="help-section">
        <h3>點一下，就行一段</h3>
        <p>點發光圓圈，小車會自動沿路行；亦可由小車向相鄰光圈輕輕掃一下。圓圈只顯示未行過嘅路。按「提一提」會用綠色圈提示可完成任務嘅下一步；揀錯咗而冇路完成時，可以重新出發。</p>
      </div>
      <div class="help-section">
        <h3>揀一個小關卡</h3>
        <div class="help-levels">
          <button
            v-for="(level, i) in LEVELS"
            :key="level.name"
            class="help-level"
            :class="{ selected: i === game.level }"
            :data-level="i"
            @click="jumpToLevel(i)"
          >
            {{ i + 1 }} · {{ helpShort[i] }}
            <small>{{ level.name }}</small>
          </button>
        </div>
      </div>
      <div class="help-section" style="border:0">
        <h3>音效與使用</h3>
        <p>右上角喇叭可開關聲音。粵語旁白需要裝置提供廣東話語音；冇相應語音時，仍有提示音、圖示同文字。遊戲冇廣告、唔收集個人資料。呢三張放大地圖按相片規則重新設計，唔係原書迷宮嘅逐線複製。</p>
      </div>
      <button class="primary-button help-finish" id="backToGame" autofocus @click="closeDialog">返去玩<svg><use href="#i-arrow"/></svg></button>
    </div>

    <div v-else-if="dialogKind === 'rescue'" class="dialog-inner">
      <svg class="dialog-hero" viewBox="0 0 400 155" aria-hidden="true">
        <use href="#art-bear" x="142" y="15" width="116" height="123"/>
        <use href="#art-flower" x="260" y="80" width="35" height="45"/>
      </svg>
      <h2 class="dialog-title" id="dialogTitle" style="font-size:25px">呢條路接唔到目的地喇</h2>
      <p class="dialog-copy">唔行重複路，就要由起點再試。<br>我哋一齊揀另一條小路！</p>
      <button class="primary-button" id="rescueBtn" autofocus @click="closeDialog(); startLevel(game.level, { announce: true, hint: true })">
        重新出發<svg><use href="#i-restart"/></svg>
      </button>
      <button class="secondary-button" id="exploreBtn" @click="closeDialog">我想繼續試吓</button>
    </div>
  </dialog>

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
