// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import MazeOverlays from '../src/components/MazeOverlays.vue';
import { useGameSession } from '../src/composables/useGameSession';
import { moveDuration } from '../src/game/motion';
import { findSolution } from '../src/game/rules';
import type { OverlayCopy } from '../src/game/copy';
import type { NodeId, Overlay } from '../src/game/types';
import { overlayCopy as picnicCopy, sessionCopy as picnicSessionCopy } from '../src/picnic/copy';
import { LEVELS } from '../src/picnic/levels';
import { overlayCopy as toothCopy, sessionCopy as toothSessionCopy } from '../src/tooth/copy';
import { TOOTH_LEVELS, toothLevel } from '../src/tooth/levels';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

type Session = ReturnType<typeof useGameSession>;

let rafQueue: FrameRequestCallback[] = [];
let rafTime = 0;
let showCalls = 0;
const originalShow = HTMLDialogElement.prototype.showModal;

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

function accessibleName(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function openDialogs(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('dialog')].filter((dialog) => (dialog as HTMLDialogElement).open) as HTMLElement[];
}

function getByRole(root: ParentNode, role: 'dialog'): HTMLElement;
function getByRole(root: ParentNode, role: 'button', options: { name: string | RegExp }): HTMLElement;
function getByRole(root: ParentNode, role: 'dialog' | 'button', options?: { name: string | RegExp }): HTMLElement {
  if (role === 'dialog') {
    const dialogs = openDialogs(root);
    expect(dialogs, 'open dialog').toHaveLength(1);
    return dialogs[0];
  }
  const buttons = [...root.querySelectorAll('button')].filter((button) => {
    const dialog = button.closest('dialog');
    if (dialog && !(dialog as HTMLDialogElement).open) return false;
    const name = accessibleName(button);
    if (!options?.name) return true;
    return typeof options.name === 'string' ? name === options.name : options.name.test(name);
  });
  expect(buttons, `button ${options?.name}`).toHaveLength(1);
  return buttons[0] as HTMLElement;
}

function expectEnabledHitBox(button: HTMLElement, minHeight: number): void {
  expect(button).toBeInstanceOf(HTMLButtonElement);
  expect((button as HTMLButtonElement).disabled).toBe(false);
  const style = getComputedStyle(button);
  expect(style.display).not.toBe('none');
  expect(style.visibility).not.toBe('hidden');
  expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(minHeight);
}

function mount(options: {
  copy: OverlayCopy;
  overlay: Overlay | null;
  level?: number;
  lastLevel?: boolean;
  allDone?: boolean;
  endless?: boolean;
  reduceMotion?: boolean;
}) {
  const state = reactive({
    overlay: options.overlay,
    level: options.level ?? 0,
    lastLevel: options.lastLevel ?? false,
    allDone: options.allDone ?? false,
    endless: options.endless ?? false,
    reduceMotion: options.reduceMotion ?? false,
  });
  const events: string[] = [];
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    setup() {
      return () => h(MazeOverlays, {
        overlay: state.overlay,
        level: state.level,
        lastLevel: state.lastLevel,
        allDone: state.allDone,
        endless: state.endless,
        reduceMotion: state.reduceMotion,
        helpLevels: [],
        copy: options.copy,
        onReplay: () => {
          events.push('replay');
          state.overlay = null;
        },
        onNext: () => {
          events.push('next');
          state.overlay = null;
        },
        onRetry: () => {
          events.push('retry');
          state.overlay = null;
        },
        onRevealed: () => {
          events.push('revealed');
        },
      });
    },
  });
  app.mount(host);
  let dead = false;
  return {
    host,
    state,
    events,
    unmount() {
      if (dead) return;
      dead = true;
      app.unmount();
      host.remove();
    },
    dialog() {
      const dialog = host.querySelector('dialog');
      if (!(dialog instanceof HTMLDialogElement)) throw new Error('missing dialog');
      return dialog;
    },
  };
}

async function openWin(view: ReturnType<typeof mount>, ms: number): Promise<void> {
  await nextTick();
  expect(view.dialog().open).toBe(false);
  expect(view.dialog().dataset.winReady).toBe('false');
  expect(view.dialog().getAttribute('aria-busy')).toBe('true');
  expect(showCalls).toBe(0);
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(view.dialog().open, `still closed at ${ms - 1}ms`).toBe(false);
  expect(view.dialog().dataset.winReady).toBe('false');
  await vi.advanceTimersByTimeAsync(1);
  expect(view.events).toContain('revealed');
  expect(view.dialog().open).toBe(true);
  expect(view.dialog().dataset.winReady).toBe('true');
  expect(view.dialog().getAttribute('aria-busy')).toBe('false');
  expect(showCalls).toBe(1);
  getByRole(view.host, 'dialog');
}

const mounted: ReturnType<typeof mount>[] = [];

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = readFileSync(join(root, 'src/assets/styles.css'), 'utf8');
  document.head.append(style);
});

beforeEach(() => {
  rafQueue = [];
  rafTime = 0;
  showCalls = 0;
  HTMLDialogElement.prototype.showModal = function showModalSpy(this: HTMLDialogElement) {
    showCalls += 1;
    return originalShow.call(this);
  };
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
});

afterEach(() => {
  for (const view of mounted) view.unmount();
  mounted.length = 0;
  HTMLDialogElement.prototype.showModal = originalShow;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function useMount(view: ReturnType<typeof mount>): ReturnType<typeof mount> {
  mounted.push(view);
  return view;
}

describe('shared win and retry CTAs', () => {
  it('W1 L1 win-ready shows both CTAs for picnic and tooth', async () => {
    const welcome = useMount(mount({ copy: picnicCopy, overlay: { kind: 'welcome' } }));
    await nextTick();
    expect(welcome.dialog().open).toBe(true);
    expect(welcome.dialog().hasAttribute('data-win-ready')).toBe(false);
    expect(welcome.dialog().hasAttribute('aria-busy')).toBe(false);
    getByRole(welcome.host, 'dialog');
    welcome.unmount();

    for (const [copy, title] of [
      [picnicCopy, '已到達公園'],
      [toothCopy, '牙齒亮晶晶'],
    ] as const) {
      showCalls = 0;
      const view = useMount(mount({ copy, overlay: { kind: 'win' }, level: 0 }));
      await openWin(view, 650);
      const heading = view.dialog().querySelector('#dialogTitle');
      expect(heading).toBeInstanceOf(HTMLElement);
      expect(heading?.textContent?.trim()).toBe(title);
      expect(getComputedStyle(heading as HTMLElement).display).not.toBe('none');
      const next = getByRole(view.host, 'button', { name: '下一關' });
      const replay = getByRole(view.host, 'button', { name: '再玩本關' });
      expect(next.id).toBe('nextBtn');
      expect(replay.id).toBe('replayBtn');
      expectEnabledHitBox(next, 62);
      expectEnabledHitBox(replay, 49);
      expect(getComputedStyle(next).width).toBe('100%');
      view.unmount();
    }
  });

  it('W2 replay three times returns to the same level', async () => {
    const session = useGameSession({}, { catalog: LEVELS, copy: picnicSessionCopy });
    session.welcomeStart();
    for (let i = 0; i < 3; i += 1) {
      followSolution(session);
      expect(session.overlay.value).toEqual({ kind: 'win' });
      expect(session.game.level).toBe(0);
      expect(session.replay()).toBe(true);
      expect(session.overlay.value).toBeNull();
      expect(session.game.level).toBe(0);
      expect(session.interactive.value).toBe(true);
      expect(session.hintNode.value).toBeNull();
    }

    const view = useMount(mount({ copy: picnicCopy, overlay: { kind: 'win' }, level: 0 }));
    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        showCalls = 0;
        view.events.length = 0;
        view.state.overlay = { kind: 'win' };
      }
      await openWin(view, 650);
      getByRole(view.host, 'button', { name: '下一關' });
      getByRole(view.host, 'button', { name: '再玩本關' }).click();
      await nextTick();
      expect(view.events).toContain('replay');
      expect(view.state.overlay).toBeNull();
      expect(view.dialog().open).toBe(false);
      expect(view.dialog().dataset.winReady).not.toBe('true');
    }
  });

  it('W3 next level advances, and the last clear says 從頭再玩', async () => {
    const session = useGameSession({}, { catalog: LEVELS, copy: picnicSessionCopy });
    session.welcomeStart();
    followSolution(session);
    expect(session.game.level).toBe(0);
    expect(session.next()).toBe(true);
    expect(session.game.level).toBe(1);
    expect(session.overlay.value).toBeNull();
    expect(session.interactive.value).toBe(true);

    const mid = useMount(mount({ copy: toothCopy, overlay: { kind: 'win' }, level: 2 }));
    await openWin(mid, 650);
    expect(getByRole(mid.host, 'button', { name: '下一關' }).id).toBe('nextBtn');
    getByRole(mid.host, 'button', { name: '下一關' }).click();
    await nextTick();
    expect(mid.events).toContain('next');
    expect(mid.state.overlay).toBeNull();

    for (const props of [
      { lastLevel: true, allDone: false, endless: false },
      { lastLevel: false, allDone: true, endless: false },
    ]) {
      showCalls = 0;
      const view = useMount(mount({ copy: picnicCopy, overlay: { kind: 'win' }, level: 5, ...props }));
      await openWin(view, 650);
      const next = getByRole(view.host, 'button', { name: '從頭再玩' });
      expect(next.id).toBe('nextBtn');
      expectEnabledHitBox(next, 62);
      expect(accessibleName(getByRole(view.host, 'button', { name: '再玩本關' }))).toBe('再玩本關');
      view.unmount();
    }

    showCalls = 0;
    const endless = useMount(mount({
      copy: toothCopy,
      overlay: { kind: 'win' },
      level: 17,
      lastLevel: true,
      endless: true,
    }));
    await openWin(endless, 650);
    expect(getByRole(endless.host, 'button', { name: '下一關' }).id).toBe('nextBtn');
  });

  it('W4 high-level sample waits for win-ready within 3s', async () => {
    const longWalk = moveDuration(10_000, false);
    const reveal = 650;
    expect(longWalk + reveal).toBe(1730);
    expect(longWalk + reveal).toBeLessThanOrEqual(3000);
    expect(1500).toBeLessThan(longWalk + reveal);

    const session = useGameSession({}, {
      catalog: (index) => toothLevel(index, 4),
      copy: toothSessionCopy,
    });
    session.welcomeStart();
    for (let level = 0; level < 17; level += 1) {
      followSolution(session);
      expect(session.overlay.value).toEqual({ kind: 'win' });
      expect(session.next()).toBe(true);
    }
    followSolution(session);
    expect(session.game.level).toBe(17);
    expect(session.overlay.value).toEqual({ kind: 'win' });

    const view = useMount(mount({
      copy: toothCopy,
      overlay: { kind: 'win' },
      level: session.game.level,
    }));
    await nextTick();
    expect(view.dialog().dataset.winReady).toBe('false');
    expect(openDialogs(view.host)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(649);
    expect(view.dialog().open).toBe(false);
    expect(view.events).not.toContain('revealed');
    await vi.advanceTimersByTimeAsync(1);
    expect(view.events).toContain('revealed');
    expect(view.dialog().dataset.winReady).toBe('true');
    getByRole(view.host, 'dialog');
    expect(view.dialog().querySelector('#dialogTitle')?.textContent?.trim()).toBe('牙齒亮晶晶');
    expectEnabledHitBox(getByRole(view.host, 'button', { name: '下一關' }), 62);
    expect(accessibleName(getByRole(view.host, 'button', { name: '再玩本關' }))).toBe('再玩本關');
  });

  it('W5 stuck retry is named 再試一次 and recovers the level', async () => {
    const session = useGameSession({}, { catalog: LEVELS, copy: picnicSessionCopy });
    session.welcomeStart();
    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd', session.graph.value.goal);
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'missing-collect' });
    expect(session.retry()).toBe(true);
    expect(session.overlay.value).toBeNull();
    expect(session.interactive.value).toBe(true);
    expect(session.game.level).toBe(1);
    expect(session.game.node).toBe(session.graph.value.start);
    expect(session.game.stalled).toBe(false);

    const tooth = useGameSession({}, { catalog: TOOTH_LEVELS, copy: toothSessionCopy });
    tooth.welcomeStart();
    play(tooth, 'a', tooth.graph.value.hazards[0]);
    expect(tooth.overlay.value).toEqual({ kind: 'stuck', reason: 'hazard' });
    expect(tooth.retry()).toBe(true);
    expect(tooth.overlay.value).toBeNull();
    expect(tooth.game.node).toBe(tooth.graph.value.start);

    for (const [copy, reason] of [
      [picnicCopy, 'missing-collect'],
      [toothCopy, 'hazard'],
    ] as const) {
      showCalls = 0;
      const view = useMount(mount({ copy, overlay: { kind: 'stuck', reason } }));
      await nextTick();
      expect(view.dialog().open).toBe(true);
      expect(view.dialog().hasAttribute('data-win-ready')).toBe(false);
      expect(showCalls).toBe(1);
      getByRole(view.host, 'dialog');
      const retry = getByRole(view.host, 'button', { name: /再試一次/ });
      expect(retry.id).toBe('retryBtn');
      expect(accessibleName(retry)).toContain('再試一次');
      expectEnabledHitBox(retry, 62);
      retry.click();
      await nextTick();
      expect(view.events).toContain('retry');
      expect(view.state.overlay).toBeNull();
      expect(view.dialog().open).toBe(false);
      view.unmount();
    }
  });

  it('W6 reduced motion reveals at 100ms and does not cut the walk', async () => {
    const motion = readFileSync(join(root, 'src/game/motion.ts'), 'utf8');
    const overlays = readFileSync(join(root, 'src/components/MazeOverlays.vue'), 'utf8');
    expect(motion).toMatch(/return reduceMotion \? 80 : clamp\(length \* 3, 650, 1080\)/);
    expect(overlays).toMatch(/props\.reduceMotion \? 100 : 650/);
    expect(moveDuration(1, true)).toBe(80);
    expect(moveDuration(10_000, true)).toBe(80);
    expect(moveDuration(1, false)).toBe(650);
    expect(moveDuration(10_000, false)).toBe(1080);

    const view = useMount(mount({
      copy: picnicCopy,
      overlay: { kind: 'win' },
      reduceMotion: true,
    }));
    await openWin(view, 100);
    expect(view.dialog().querySelector('#dialogTitle')?.textContent?.trim()).toBe('已到達公園');
    expectEnabledHitBox(getByRole(view.host, 'button', { name: '下一關' }), 62);
    expect(accessibleName(getByRole(view.host, 'button', { name: '再玩本關' }))).toBe('再玩本關');

    showCalls = 0;
    const tooth = useMount(mount({
      copy: toothCopy,
      overlay: { kind: 'win' },
      reduceMotion: true,
      level: 8,
    }));
    await openWin(tooth, 100);
    expect(tooth.dialog().querySelector('#dialogTitle')?.textContent?.trim()).toBe('牙齒亮晶晶');
  });
});
