import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameSession } from '../src/composables/useGameSession';
import { ARRIVAL_GUIDE, HINT_GUIDE, hintGuide, sessionCopy as picnicCopy } from '../src/picnic/copy';
import {
  ARRIVAL_GUIDE as TOOTH_ARRIVAL,
  hintGuide as toothHintGuide,
  sessionCopy as toothCopy,
} from '../src/tooth/copy';
import { findSolution } from '../src/game/rules';
import { LEVELS, picnicLevel } from '../src/picnic/levels';
import { TOOTH_LEVELS, toothLevel } from '../src/tooth/levels';
import type { MoveOk, NodeId } from '../src/game/types';

type Session = ReturnType<typeof useGameSession>;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function picnicSession(hooks: { onSettled?: (result: MoveOk) => void } = {}) {
  return useGameSession(hooks, { catalog: LEVELS, copy: picnicCopy });
}

function toothSession(hooks: { onSettled?: (result: MoveOk) => void } = {}) {
  return useGameSession(hooks, { catalog: TOOTH_LEVELS, copy: toothCopy });
}

function endlessPicnic(hooks: { onSettled?: (result: MoveOk) => void } = {}) {
  return useGameSession(hooks, { catalog: picnicLevel, copy: picnicCopy });
}

function endlessTooth() {
  return useGameSession({}, { catalog: toothLevel, copy: toothCopy });
}

let rafQueue: FrameRequestCallback[] = [];
let rafTime = 0;

function flushFrames(): void {
  while (rafQueue.length) {
    const pending = rafQueue;
    rafQueue = [];
    for (const cb of pending) {
      rafTime += 10_000;
      cb(rafTime);
    }
  }
}

function play(session: Session, ...nodes: NodeId[]): void {
  for (const to of nodes) {
    const result = session.requestMove(to);
    expect(result.ok, `move to ${to}`).toBe(true);
    flushFrames();
  }
}

function followSolution(session: Session): void {
  for (let i = 0; i < 24; i += 1) {
    const path = findSolution(
      session.graph.value,
      session.game.node,
      session.game.collected,
      session.game.used,
    );
    expect(path, session.graph.value.name).not.toBeNull();
    if (!path || !path.length) return;
    play(session, path[0]);
    if (session.game.won) return;
  }
  throw new Error(`no win on ${session.graph.value.name}`);
}

describe('game session (two-axis overlay)', () => {
  beforeEach(() => {
    rafQueue = [];
    rafTime = 0;
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return 1;
    });
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    }));
    Object.defineProperty(globalThis, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts on welcome and only then becomes interactive', () => {
    const session = picnicSession();
    expect(session.overlay.value).toEqual({ kind: 'welcome' });
    expect(session.started.value).toBe(false);
    expect(session.interactive.value).toBe(false);
    expect(session.inFlight.value).toBeNull();
    expect(session.requestMove('a')).toEqual({ ok: false, reason: 'blocked' });
    session.showHelp();
    expect(session.overlay.value).toEqual({ kind: 'welcome' });

    expect(session.welcomeStart()).toBe(true);
    expect(session.overlay.value).toBeNull();
    expect(session.started.value).toBe(true);
    expect(session.interactive.value).toBe(true);
    expect(session.welcomeStart()).toBe(false);
  });

  it('sets overlay to win as soon as the tutorial path arrives', () => {
    const shown: MoveOk[] = [];
    const session = picnicSession({
      onSettled: (result) => { shown.push(result); },
    });
    session.welcomeStart();
    const { collect, goal } = session.graph.value;
    play(session, 'a', collect!, 'b', goal);

    expect(session.game.won).toBe(true);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    expect(session.inFlight.value).toBeNull();
    expect(session.interactive.value).toBe(false);
    expect(shown.at(-1)?.won).toBe(true);
    expect(session.guideMain.value).toBe(ARRIVAL_GUIDE.won.main);
    expect(session).not.toHaveProperty('motion');
    expect(session).not.toHaveProperty('boot');
  });

  it('ignores help while won and does not let dismissOverlay drop win or stuck', () => {
    const session = picnicSession();
    session.welcomeStart();
    play(session, 'a', session.graph.value.collect!, 'b', session.graph.value.goal);
    expect(session.overlay.value?.kind).toBe('win');
    session.showHelp();
    session.dismissOverlay();
    expect(session.overlay.value?.kind).toBe('win');

    session.replay();
    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd', session.graph.value.goal);
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'missing-collect' });
    expect(session.guideMain.value).toBe(ARRIVAL_GUIDE.stuckBurger.main);
    session.showHelp();
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'missing-collect' });
    session.dismissOverlay();
    expect(session.overlay.value?.kind).toBe('stuck');
  });

  it('clears help and rescue overlays and leaves welcome alone', () => {
    const session = picnicSession();
    expect(session.overlay.value).toEqual({ kind: 'welcome' });
    session.dismissOverlay();
    expect(session.overlay.value).toEqual({ kind: 'welcome' });

    expect(session.welcomeStart()).toBe(true);
    session.showHelp();
    expect(session.overlay.value?.kind).toBe('help');
    expect(session.interactive.value).toBe(false);
    session.dismissOverlay();
    expect(session.overlay.value).toBeNull();
    expect(session.interactive.value).toBe(true);

    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd');
    expect(session.requestHint()).toBe('rescue');
    expect(session.overlay.value?.kind).toBe('rescue');
    session.showHelp();
    expect(session.overlay.value?.kind).toBe('rescue');
    const node = session.game.node;
    const used = session.game.used.size;
    session.dismissOverlay();
    expect(session.overlay.value).toBeNull();
    expect(session.game.node).toBe(node);
    expect(session.game.used.size).toBe(used);
    expect(session.interactive.value).toBe(true);
    play(session, session.graph.value.goal);
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'missing-collect' });
  });

  it('blocks moves while a frame is in flight and when not interactive', () => {
    const session = picnicSession();
    expect(session.requestMove('a').ok).toBe(false);
    session.welcomeStart();
    expect(session.requestMove('a').ok).toBe(true);
    expect(session.inFlight.value).not.toBeNull();
    expect(session.interactive.value).toBe(false);
    expect(session.requestMove(session.graph.value.collect!)).toEqual({ ok: false, reason: 'blocked' });
    flushFrames();
    expect(session.game.node).toBe('a');
    expect(session.inFlight.value).toBeNull();
    expect(session.interactive.value).toBe(true);
    expect(session.overlay.value).toBeNull();
  });

  it('no-ops restart once the win overlay is on', () => {
    const session = picnicSession();
    session.welcomeStart();
    play(session, 'a', session.graph.value.collect!, 'b', session.graph.value.goal);
    expect(session.overlay.value?.kind).toBe('win');
    expect(session.restart()).toBe(false);
    expect(session.game.won).toBe(true);
  });

  it('selects beforeCollect then afterCollect hint copy', () => {
    const session = picnicSession();
    expect(session.requestHint()).toBe('blocked');
    session.welcomeStart();
    expect(session.requestHint()).toBe('hint');
    expect(session.guideMain.value).toBe(hintGuide(false).main);
    expect(session.guideSub.value).toBe(hintGuide(false).sub);
    play(session, 'a', session.graph.value.collect!);
    expect(session.game.collected).toBe(true);
    expect(session.requestHint()).toBe('hint');
    expect(session.guideMain.value).toBe(hintGuide(true).main);
    expect(session.guideSub.value).toBe(hintGuide(true).sub);
    expect(HINT_GUIDE.beforeCollect).not.toEqual(HINT_GUIDE.afterCollect);
  });

  it('blocks hints on welcome, help, and in-flight, and uses afterCollect for tooth', () => {
    const session = picnicSession();
    expect(session.requestHint()).toBe('blocked');
    session.welcomeStart();
    session.showHelp();
    expect(session.requestHint()).toBe('blocked');
    session.dismissOverlay();
    expect(session.requestMove('a').ok).toBe(true);
    expect(session.inFlight.value).not.toBeNull();
    expect(session.requestHint()).toBe('blocked');
    flushFrames();

    const tooth = toothSession();
    expect(toothHintGuide(false)).toEqual(toothHintGuide(true));
    tooth.welcomeStart();
    expect(tooth.game.collected).toBe(true);
    expect(tooth.requestHint()).toBe('hint');
    expect(tooth.guideMain.value).toBe(toothHintGuide(true).main);
    expect(tooth.guideSub.value).toBe(toothHintGuide(true).sub);
  });

  it('sets a hint on retry from stuck/rescue and not on replay from win', () => {
    const session = picnicSession();
    session.welcomeStart();
    expect(session.requestHint()).toBe('hint');
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.collected, session.game.used)?.[0],
    );

    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd', session.graph.value.goal);
    expect(session.overlay.value?.kind).toBe('stuck');
    expect(session.retry()).toBe(true);
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.collected, session.game.used)?.[0],
    );
    expect(session.overlay.value).toBeNull();

    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd');
    expect(session.requestHint()).toBe('rescue');
    expect(session.overlay.value?.kind).toBe('rescue');
    expect(session.retry()).toBe(true);
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.collected, session.game.used)?.[0],
    );

    session.showHelp();
    expect(session.jump(0)).toBe(true);
    followSolution(session);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    expect(session.retry()).toBe(false);
    expect(session.replay()).toBe(true);
    expect(session.hintNode.value).toBeNull();
  });

  it('gates jump/next/replay/welcomeStart on the matching overlay', () => {
    const session = picnicSession();
    expect(session.jump(2)).toBe(false);
    expect(session.next()).toBe(false);
    expect(session.replay()).toBe(false);
    session.welcomeStart();
    expect(session.jump(2)).toBe(false);
    session.showHelp();
    expect(session.jump(2)).toBe(true);
    expect(session.game.level).toBe(2);
    expect(session.overlay.value).toBeNull();

    followSolution(session);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    const afterWin = session.game.level;
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(afterWin === LEVELS.length - 1 ? 0 : afterWin + 1);
    expect(session.next()).toBe(false);
  });

  it('wraps next() to level 0 when every level is done, even off the last map', () => {
    const session = picnicSession();
    session.welcomeStart();
    session.showHelp();
    expect(session.jump(1)).toBe(true);
    for (let i = 1; i < LEVELS.length; i += 1) {
      followSolution(session);
      expect(session.overlay.value).toEqual({ kind: 'win' });
      expect(session.allDone.value).toBe(false);
      expect(session.next()).toBe(true);
    }
    expect(session.game.level).toBe(0);
    followSolution(session);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    expect(session.allDone.value).toBe(true);
    expect(session.lastLevel.value).toBe(false);
    expect(session.wrapTour.value).toBe(true);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(0);
  });

  it('wraps next() after a last-level win even when earlier maps are incomplete', () => {
    const session = picnicSession();
    session.welcomeStart();
    session.showHelp();
    expect(session.jump(LEVELS.length - 1)).toBe(true);
    followSolution(session);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    expect(session.lastLevel.value).toBe(true);
    expect(session.allDone.value).toBe(false);
    expect(session.wrapTour.value).toBe(true);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(0);
  });

  it('does not open help while a move is in flight', () => {
    const session = picnicSession();
    session.welcomeStart();
    expect(session.requestMove('a').ok).toBe(true);
    expect(session.inFlight.value).not.toBeNull();
    session.showHelp();
    expect(session.overlay.value).toBeNull();
    expect(session.inFlight.value).not.toBeNull();
    flushFrames();
  });

  it('uses a new shuffle of generated picnic maps per catalog seed', () => {
    const a = useGameSession({}, { catalog: (index) => picnicLevel(index, 1), copy: picnicCopy });
    const b = useGameSession({}, { catalog: (index) => picnicLevel(index, 99), copy: picnicCopy });
    a.welcomeStart();
    b.welcomeStart();
    expect({
      start: a.graph.value.start,
      collect: a.graph.value.collect,
      goal: a.graph.value.goal,
      edges: a.graph.value.edges.map((edge) => edge.id),
    }).not.toEqual({
      start: b.graph.value.start,
      collect: b.graph.value.collect,
      goal: b.graph.value.goal,
      edges: b.graph.value.edges.map((edge) => edge.id),
    });
  });

  it('keeps minting picnic maps instead of wrapping the tour', () => {
    const session = endlessPicnic();
    expect(session.endless).toBe(true);
    expect(session.helpLevels.value).toEqual([]);
    session.welcomeStart();
    followSolution(session);
    expect(session.overlay.value).toEqual({ kind: 'win' });
    expect(session.lastLevel.value).toBe(false);
    expect(session.wrapTour.value).toBe(false);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(1);
    expect(session.graph.value.collect).toBeTruthy();
    expect(session.graph.value.tutorial).toBe(false);
    followSolution(session);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(2);
  });

  it('keeps minting tooth maps from the first generated map', () => {
    const session = endlessTooth();
    expect(session.endless).toBe(true);
    session.welcomeStart();
    followSolution(session);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(1);
    expect(session.graph.value.hazards.length).toBeGreaterThan(0);
    followSolution(session);
    expect(session.game.won).toBe(true);
  });

  it('uses retry as the stuck and rescue recovery path', () => {
    const session = picnicSession();
    session.welcomeStart();
    session.showHelp();
    session.jump(1);
    play(session, 'a', 'c', 'd', session.graph.value.goal);
    const stuckLevel = session.game.level;
    expect(session.retry()).toBe(true);
    expect(session.game.level).toBe(stuckLevel);
    expect(session.game.node).toBe(session.graph.value.start);
    expect(session.game.stalled).toBe(false);
  });

  it('keeps a deadend overlay and does not let dismissOverlay drop it', () => {
    const session = picnicSession();
    session.welcomeStart();
    session.showHelp();
    expect(session.jump(2)).toBe(true);
    play(session, 'a', session.graph.value.collect!, 'b', 'u', 'v');
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'deadend' });
    expect(session.guideMain.value).toBe(ARRIVAL_GUIDE.stuckDeadend.main);
    session.dismissOverlay();
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'deadend' });
  });

  it('sets a hazard overlay on tooth when the player meets a bug', () => {
    const session = toothSession();
    session.welcomeStart();
    play(session, 'a', session.graph.value.hazards[0]);
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'hazard' });
    expect(session.guideMain.value).toBe(TOOTH_ARRIVAL.stuckHazard.main);
    session.showHelp();
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'hazard' });
    session.dismissOverlay();
    expect(session.overlay.value?.kind).toBe('stuck');
  });
});

describe('dialog wiring', () => {
  it('keeps one maze play shell and one overlay renderer', () => {
    const overlays = readFileSync(join(root, 'src/components/MazeOverlays.vue'), 'utf8');
    expect(overlays).toMatch(/overlay\?\.kind === 'welcome'/);
    expect(overlays).toMatch(/overlay\?\.kind === 'stuck'/);
    expect(overlays).toMatch(/overlay\?\.kind === 'win'/);
    expect(overlays).toMatch(/overlay\?\.kind === 'help'/);
    expect(overlays).toMatch(/overlay\?\.kind === 'rescue'/);
    expect(overlays).toMatch(/三階段點揀/);
    expect(overlays).toMatch(/ParentGuideBlock/);
    expect(overlays).toMatch(/v-if="helpLevels.length"/);
    expect(overlays).toMatch(/選擇關卡/);
    expect(overlays).toMatch(/id="rescueBtn"[^>]*@click="emit\('retry'\)"/);
    expect(overlays).not.toMatch(/emit\('rescue'\)/);
    expect(overlays).not.toMatch(/kind: 'play'/);
    expect(overlays).toMatch(/props\.reduceMotion \? 100 : 650/);
    expect(overlays).toMatch(/overlay\?\.kind === 'help' \|\| props\.overlay\?\.kind === 'rescue'/);
    expect(overlays).toMatch(/wrapTour \? '從頭再玩' : '下一關'/);
    expect(overlays).toMatch(/if \(props\.overlay\?\.kind !== 'win'\) return 0/);
    expect(overlays).toMatch(/name="stuck-hero" :reason="stuckReason"/);
    expect(overlays).toMatch(/@close="emit\('close'\)"/);
    expect([...overlays.matchAll(/@click="emit\('home'\)"/g)]).toHaveLength(2);
    function overlayKindBlock(kind: string, next?: string): string {
      const startNeedle = kind === 'welcome'
        ? `v-if="overlay?.kind === '${kind}'"`
        : `v-else-if="overlay?.kind === '${kind}'"`;
      const start = overlays.indexOf(startNeedle);
      expect(start, kind).toBeGreaterThan(-1);
      const end = next ? overlays.indexOf(`v-else-if="overlay?.kind === '${next}'"`, start + 1) : overlays.length;
      expect(end, next ?? 'end').toBeGreaterThan(start);
      return overlays.slice(start, end);
    }
    expect(overlayKindBlock('welcome', 'stuck')).toMatch(/@click="emit\('home'\)">選擇遊戲/);
    expect(overlayKindBlock('help', 'rescue')).toMatch(/@click="emit\('home'\)">選擇遊戲/);
    expect(overlayKindBlock('help', 'rescue')).toMatch(/id="closeHelp"[^>]*@click="emit\('close'\)"/);
    expect(overlayKindBlock('help', 'rescue')).toMatch(/id="backToGame"[^>]*@click="emit\('close'\)"/);
    expect(overlayKindBlock('stuck', 'win')).toMatch(/copy\.stuck\.title\(stuckReason\)/);
    expect(overlayKindBlock('stuck', 'win')).toMatch(/copy\.stuck\.body\(stuckReason\)/);
    expect(overlayKindBlock('stuck', 'win')).not.toMatch(/emit\('home'\)/);
    expect(overlayKindBlock('win', 'help')).not.toMatch(/emit\('home'\)/);
    expect(overlayKindBlock('rescue')).not.toMatch(/emit\('home'\)/);
    expect(overlayKindBlock('rescue')).toMatch(/id="exploreBtn"[^>]*@click="emit\('close'\)"/);

    const picnicBoard = readFileSync(join(root, 'src/components/PicnicBoard.vue'), 'utf8');
    const picnicCollectSrc = readFileSync(join(root, 'src/picnic/board.ts'), 'utf8');
    expect(picnicBoard).toMatch(/picnicCollect/);
    expect(picnicCollectSrc).toMatch(/if \(!graph\.collect\) throw/);
    expect(picnicCollectSrc).not.toMatch(/collect \|\|/);
    expect(picnicCollectSrc).not.toMatch(/collect \?\?/);
    expect(picnicBoard).not.toMatch(/collect \|\|/);
    expect(picnicBoard).not.toMatch(/collect \?\?/);

    const host = readFileSync(join(root, 'src/components/MazeDialog.vue'), 'utf8');
    expect(host).toMatch(/if \(props\.cancelable\) emit\('close'\)/);
    expect(host).toMatch(/querySelector<HTMLElement>\('\[autofocus\]'\)/);
    expect(host).toMatch(/if \(props\.revealMs > 0\)/);
    expect(host).toMatch(/openDialog\(\);\s*emit\('revealed'\)/);
    expect(host).toMatch(/if \(!open\) \{\s*hideDialog\(\);/);
    expect(host).toMatch(/returnFocus\.isConnected/);
    expect(host).toMatch(/'disabled' in returnFocus && returnFocus\.disabled/);
    expect(host).toMatch(/returnFocus\.focus/);
    expect(host).toMatch(/onBeforeUnmount\(\(\) => \{[\s\S]*dialogEl\.value\?\.close\(\)/);
    expect(host).not.toMatch(/overlay\?\.kind/);

    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    expect(delivery).toMatch(/const source = deliveryMission\(\);/);
    expect(delivery).not.toMatch(/DELIVERY_MISSION/);
    expect(delivery).not.toMatch(/generateDeliveryMission/);
    expect(delivery).not.toMatch(/randomSeed/);
    const deliveryBoard = readFileSync(join(root, 'src/components/DeliveryBoard.vue'), 'utf8');
    expect(deliveryBoard).toMatch(/function houseAbove\(node: string\): boolean/);
    expect(deliveryBoard).toMatch(/nodes\[node\]\[1\] < props\.mission\.height \* 0\.42/);
    expect(deliveryBoard).toMatch(/houseAbove\(stop\.node\) \? -115 : 20/);
    expect(deliveryBoard).toMatch(/houseAbove\(stop\.node\) \? -48 : 71/);
    expect(deliveryBoard).not.toMatch(/index === 1 \? -115/);
    expect(delivery).toMatch(/這一張 · \{\{ stageName \}\}/);
    expect(delivery).toMatch(/deliveryLoadBand\(source\)/);
    expect(delivery).toMatch(/<ParentGuide/);
    expect(delivery).toMatch(/點選較易／描線多手眼/);
    expect(delivery).not.toMatch(/給家長的小提示/);
    expect(delivery).toMatch(/<MazeDialog/);
    expect(delivery).toMatch(/:cancelable="overlay === 'help'"/);
    expect(delivery).toMatch(
      /overlay === 'welcome' \|\| overlay === 'help'[\s\S]*?@click="emit\('home'\)">選擇遊戲/,
    );
    expect(delivery).not.toMatch(/showModal/);

    const sessionSrc = readFileSync(join(root, 'src/composables/useGameSession.ts'), 'utf8');
    expect(sessionSrc).not.toMatch(/kind:\s*'play'/);
    expect(sessionSrc).not.toMatch(/motion\.value/);
    expect(sessionSrc).not.toMatch(/function boot\(/);
    expect(sessionSrc).not.toMatch(/650/);
    expect(sessionSrc).not.toMatch(/pickupVisible/);
    expect(sessionSrc).not.toMatch(/ARRIVAL_GUIDE/);
    expect(sessionSrc).not.toMatch(/HINT_GUIDE/);
    expect(sessionSrc).not.toMatch(/arrivalKind/);
    expect(sessionSrc).toMatch(/copy\.arrivalGuide\(/);
    expect(sessionSrc).toMatch(/copy\.hintGuide\(/);
    expect(sessionSrc).toMatch(/onUnmounted\(\(\) => \{\s*epoch\.value \+= 1/);

    const typesSrc = readFileSync(join(root, 'src/game/types.ts'), 'utf8');
    expect(typesSrc).not.toMatch(/export type Motion/);
    expect(typesSrc).not.toMatch(/\bburger\b/);
    expect(typesSrc).not.toMatch(/\bshop\b/);
    expect(typesSrc).not.toMatch(/\bpark\b/);

    const app = readFileSync(join(root, 'src/App.vue'), 'utf8');
    expect(app).not.toMatch(/useGameSession/);
    expect(app).not.toMatch(/picnic\/copy/);
    expect(app).not.toMatch(/picnic\/levels/);
    expect(app).toMatch(/PicnicPlay/);
    expect(app).toMatch(/ToothPlay/);

    const mazePlay = readFileSync(join(root, 'src/components/MazePlay.vue'), 'utf8');
    expect(mazePlay).toMatch(/useMazePlay/);
    expect(mazePlay).toMatch(/<MazeOverlays/);
    expect(mazePlay).toMatch(/name="top-extra"/);
    expect(mazePlay).toMatch(/#welcome-hero/);
    expect(mazePlay).toMatch(/#welcome-extra/);
    expect(mazePlay).toMatch(/#stuck-hero="\{ reason \}"/);
    expect(mazePlay).toMatch(/name="stuck-hero" :reason="reason"/);
    expect(mazePlay).toMatch(/#win-hero/);
    expect(mazePlay).toMatch(/#rescue-hero/);
    expect(mazePlay).toMatch(/:copy="overlayCopy"/);
    expect(mazePlay).toMatch(/:parent-guide="parentGuide"/);
    expect(mazePlay).toMatch(/stage-chip/);
    expect(mazePlay).toMatch(/第 \{\{ game.level \+ 1 \}\} 關/);
    expect(mazePlay).toMatch(/aria-label="遊戲說明"/);
    expect(mazePlay).not.toMatch(/關卡選擇/);
    expect(mazePlay).toMatch(/@start="welcomeStart"/);
    expect(mazePlay).toMatch(/@retry="onRetry"/);
    expect(mazePlay).toMatch(/@next="onNext"/);
    expect(mazePlay).toMatch(/@replay="onReplay"/);
    expect(mazePlay).toMatch(/@close="play\.session\.dismissOverlay"/);
    expect(mazePlay).toMatch(/@jump="onJump"/);
    expect(mazePlay).toMatch(/@home="\$emit\('home'\)"/);
    expect(mazePlay).toMatch(/<PlayChrome/);

    const playSrc = readFileSync(join(root, 'src/composables/useMazePlay.ts'), 'utf8');
    expect(playSrc).toMatch(/confettiPalette: readonly string\[\]/);

    const picnicPlay = readFileSync(join(root, 'src/components/PicnicPlay.vue'), 'utf8');
    const toothPlay = readFileSync(join(root, 'src/components/ToothPlay.vue'), 'utf8');
    expect(picnicPlay).toMatch(/<MazePlay/);
    expect(toothPlay).toMatch(/<MazePlay/);
    expect(picnicPlay).not.toMatch(/useMazePlay/);
    expect(toothPlay).not.toMatch(/useMazePlay/);
    expect(picnicPlay).not.toMatch(/overlay\?\.kind/);
    expect(toothPlay).not.toMatch(/overlay\?\.kind/);
    expect(picnicPlay).toMatch(/@home="\$emit\('home'\)"/);
    expect(toothPlay).toMatch(/@home="\$emit\('home'\)"/);
    expect(picnicPlay).toMatch(/PicnicBoard/);
    expect(toothPlay).toMatch(/ToothBoard/);
    expect(picnicPlay).toMatch(/:overlay-copy="overlayCopy"/);
    expect(toothPlay).toMatch(/:overlay-copy="overlayCopy"/);
    expect(picnicPlay).toMatch(/:parent-copy="parentCopy.picnic"/);
    expect(toothPlay).toMatch(/:parent-copy="parentCopy.tooth"/);
    expect(picnicPlay).toMatch(/:confetti-palette="confettiPalette"/);
    expect(toothPlay).toMatch(/:confetti-palette="confettiPalette"/);
    expect(picnicPlay).toMatch(/#welcome-hero/);
    expect(toothPlay).toMatch(/#welcome-hero/);
    expect(picnicPlay).toMatch(/#welcome-extra/);
    expect(picnicPlay).toMatch(/#stuck-hero="\{ reason \}"/);
    expect(toothPlay).toMatch(/#stuck-hero="\{ reason \}"/);
    expect(picnicPlay).toMatch(/v-if="reason === 'missing-collect'" name="burger"[\s\S]*?v-else name="flower"/);
    expect(toothPlay).toMatch(/v-if="reason === 'hazard'" name="bug-coral"[\s\S]*?v-else name="toothbrush"/);
    expect(picnicPlay).toMatch(/#win-hero/);
    expect(toothPlay).toMatch(/#win-hero/);
    expect(picnicPlay).toMatch(/#rescue-hero/);
    expect(toothPlay).toMatch(/#rescue-hero/);
    expect(picnicPlay).not.toContain('蛀牙蟲');
    expect(toothPlay).not.toContain('漢堡');
    expect(picnicPlay).toMatch(/picnicCatalog\(\)/);
    expect(toothPlay).toMatch(/toothCatalog\(\)/);
    expect(picnicPlay).toMatch(/class="age-pill"/);
    expect(toothPlay).toMatch(/class="tooth-game"/);
  });
});
