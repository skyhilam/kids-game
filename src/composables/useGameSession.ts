import { computed, getCurrentInstance, onUnmounted, reactive, ref, shallowRef } from 'vue';
import {
  ARRIVAL_GUIDE,
  HINT_GUIDE,
  arrivalKind,
  startGuide,
} from '../game/copy';
import { clamp, heading, moveDuration } from '../game/motion';
import {
  LEVELS,
  applyMove,
  createGame,
  findSolution,
  makeGraph,
  tryMove,
} from '../game/rules';
import type {
  GameState,
  Graph,
  InFlightMove,
  MoveOk,
  MoveResult,
  NodeId,
  Overlay,
} from '../game/types';

const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useGameSession(hooks: {
  onSettled?: (result: MoveOk) => void;
} = {}) {
  const narrow = ref(typeof window !== 'undefined' && window.innerWidth <= 600);
  const fresh = createGame(0, narrow.value);
  const graph = shallowRef<Graph>(fresh.graph);
  const game = reactive<GameState>(fresh.state);
  const overlay = ref<Overlay | null>({ kind: 'welcome' });
  const inFlight = ref<InFlightMove | null>(null);
  const facing = ref(90);
  const hintNode = ref<NodeId | null>(null);
  const pickupVisible = ref(false);
  const completed = ref(new Set<number>());
  const epoch = ref(0);
  const started = ref(false);
  const opening = startGuide(fresh.graph, fresh.state.level);
  const guideMain = ref(opening.main);
  const guideSub = ref(opening.sub);
  const announce = ref(opening.announce);
  let pickupTimer = 0;
  let layoutTimer = 0;

  const interactive = computed(
    () => overlay.value === null && inFlight.value === null,
  );
  const lastLevel = computed(() => game.level === LEVELS.length - 1);
  const allDone = computed(() => completed.value.size === LEVELS.length);
  const wrapTour = computed(() => lastLevel.value || allDone.value);

  function applyStartGuide(): void {
    const copy = startGuide(graph.value, game.level);
    guideMain.value = copy.main;
    guideSub.value = copy.sub;
    announce.value = copy.announce;
  }

  function loadLevel(index: number, opts: { hint?: boolean } = {}): void {
    epoch.value += 1;
    window.clearTimeout(pickupTimer);
    const next = createGame(index, narrow.value);
    graph.value = next.graph;
    Object.assign(game, next.state);
    inFlight.value = null;
    pickupVisible.value = false;
    facing.value = 90;
    hintNode.value = opts.hint
      ? findSolution(next.graph, next.state.node, next.state.burger, next.state.used)?.[0] ?? null
      : null;
    applyStartGuide();
    applyLayout();
  }

  function openPlay(index: number, opts: { hint?: boolean } = {}): void {
    started.value = true;
    overlay.value = null;
    loadLevel(index, opts);
  }

  function jump(index: number): boolean {
    if (overlay.value?.kind !== 'help') return false;
    openPlay(index);
    return true;
  }

  function retry(): boolean {
    const kind = overlay.value?.kind;
    if (kind !== 'stuck' && kind !== 'rescue') return false;
    const index = game.level;
    openPlay(index, { hint: true });
    return true;
  }

  function next(): boolean {
    if (overlay.value?.kind !== 'win') return false;
    const index = wrapTour.value ? 0 : game.level + 1;
    openPlay(index);
    return true;
  }

  function replay(): boolean {
    if (overlay.value?.kind !== 'win') return false;
    const index = game.level;
    openPlay(index);
    return true;
  }

  function restart(): boolean {
    if (!interactive.value) return false;
    loadLevel(game.level);
    return true;
  }

  function flashPickup(): void {
    pickupVisible.value = true;
    pickupTimer = window.setTimeout(() => { pickupVisible.value = false; }, 2300);
  }

  function requestMove(to: NodeId): MoveResult {
    if (!interactive.value) return { ok: false, reason: 'blocked' };
    const result = tryMove(graph.value, game, to);
    if (!result.ok) return result;

    const currentEpoch = epoch.value;
    hintNode.value = null;
    pickupVisible.value = false;
    window.clearTimeout(pickupTimer);

    const fromPt = graph.value.nodes[result.from];
    const toPt = graph.value.nodes[result.to];
    const length = Math.hypot(toPt[0] - fromPt[0], toPt[1] - fromPt[1]);
    const duration = moveDuration(length, reduceMotion);
    const targetAngle = heading(fromPt, toPt);
    inFlight.value = { ...result, t: 0, startAngle: facing.value };

    let time0: number | null = null;
    const frame = (time: number) => {
      if (currentEpoch !== epoch.value) return;
      if (time0 === null) time0 = time;
      const t = clamp((time - time0) / duration, 0, 1);
      if (inFlight.value) inFlight.value.t = t;
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      applyMove(game, result);
      facing.value = targetAngle;
      if (result.boughtNow) flashPickup();
      if (result.won) {
        const nextCompleted = new Set(completed.value);
        nextCompleted.add(game.level);
        completed.value = nextCompleted;
        overlay.value = { kind: 'win' };
      } else if (result.stalled) {
        overlay.value = { kind: 'stuck', reason: result.stalled };
      }
      inFlight.value = null;
      const copy = ARRIVAL_GUIDE[arrivalKind(graph.value, result, game.used)];
      guideMain.value = copy.main;
      guideSub.value = copy.sub;
      hooks.onSettled?.(result);
    };
    requestAnimationFrame(frame);
    return result;
  }

  function requestHint(): 'hint' | 'rescue' | 'blocked' {
    if (!interactive.value) return 'blocked';
    const path = findSolution(graph.value, game.node, game.burger, game.used);
    if (path && path.length) {
      hintNode.value = path[0];
      const copy = game.burger ? HINT_GUIDE.park : HINT_GUIDE.shop;
      guideMain.value = copy.main;
      guideSub.value = copy.sub;
      return 'hint';
    }
    overlay.value = { kind: 'rescue' };
    return 'rescue';
  }

  function welcomeStart(): boolean {
    if (overlay.value?.kind !== 'welcome') return false;
    started.value = true;
    overlay.value = null;
    return true;
  }

  function showHelp(): void {
    if (!interactive.value) return;
    overlay.value = { kind: 'help' };
  }

  function dismissOverlay(): void {
    if (overlay.value?.kind !== 'help' && overlay.value?.kind !== 'rescue') return;
    overlay.value = null;
  }

  function applyLayout(force = false): void {
    if (typeof window === 'undefined') return;
    const next = window.innerWidth <= 600;
    if (!force && next === narrow.value) return;
    if (inFlight.value) {
      window.clearTimeout(layoutTimer);
      layoutTimer = window.setTimeout(() => applyLayout(force), 120);
      return;
    }
    narrow.value = next;
    graph.value = makeGraph(game.level, next);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      epoch.value += 1;
      window.clearTimeout(pickupTimer);
      window.clearTimeout(layoutTimer);
    });
  }

  return {
    narrow,
    graph,
    game,
    overlay,
    inFlight,
    facing,
    hintNode,
    pickupVisible,
    completed,
    interactive,
    lastLevel,
    allDone,
    wrapTour,
    started,
    reduceMotion,
    guideMain,
    guideSub,
    announce,
    jump,
    retry,
    next,
    replay,
    restart,
    requestMove,
    requestHint,
    welcomeStart,
    showHelp,
    dismissOverlay,
    applyLayout,
  };
}
