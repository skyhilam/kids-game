import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameSession } from '../src/composables/useGameSession';
import { ARRIVAL_GUIDE } from '../src/game/copy';
import { findSolution, LEVELS } from '../src/game/rules';
import type { MoveOk, NodeId } from '../src/game/types';

type Session = ReturnType<typeof useGameSession>;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
      session.game.burger,
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
    const session = useGameSession();
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
    const session = useGameSession({
      onSettled: (result) => { shown.push(result); },
    });
    session.welcomeStart();
    const { shop, park } = session.graph.value;
    play(session, 'a', shop, 'b', park);

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
    const session = useGameSession();
    session.welcomeStart();
    play(session, 'a', session.graph.value.shop, 'b', session.graph.value.park);
    expect(session.overlay.value?.kind).toBe('win');
    session.showHelp();
    session.dismissOverlay();
    expect(session.overlay.value?.kind).toBe('win');

    session.replay();
    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd', session.graph.value.park);
    expect(session.overlay.value).toEqual({ kind: 'stuck', reason: 'burger' });
    expect(session.guideMain.value).toBe(ARRIVAL_GUIDE.stuckBurger.main);
    session.dismissOverlay();
    expect(session.overlay.value?.kind).toBe('stuck');
  });

  it('clears help and rescue overlays and leaves welcome alone', () => {
    const session = useGameSession();
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
    const node = session.game.node;
    const used = session.game.used.size;
    session.dismissOverlay();
    expect(session.overlay.value).toBeNull();
    expect(session.game.node).toBe(node);
    expect(session.game.used.size).toBe(used);
    expect(session.interactive.value).toBe(true);
  });

  it('blocks moves while a frame is in flight and when not interactive', () => {
    const session = useGameSession();
    expect(session.requestMove('a').ok).toBe(false);
    session.welcomeStart();
    expect(session.requestMove('a').ok).toBe(true);
    expect(session.inFlight.value).not.toBeNull();
    expect(session.interactive.value).toBe(false);
    expect(session.requestMove(session.graph.value.shop)).toEqual({ ok: false, reason: 'blocked' });
    flushFrames();
    expect(session.game.node).toBe('a');
    expect(session.inFlight.value).toBeNull();
    expect(session.interactive.value).toBe(true);
    expect(session.overlay.value).toBeNull();
  });

  it('no-ops restart once the win overlay is on', () => {
    const session = useGameSession();
    session.welcomeStart();
    play(session, 'a', session.graph.value.shop, 'b', session.graph.value.park);
    expect(session.overlay.value?.kind).toBe('win');
    expect(session.restart()).toBe(false);
    expect(session.game.won).toBe(true);
  });

  it('sets a hint on retry from stuck/rescue and not on replay from win', () => {
    const session = useGameSession();
    session.welcomeStart();
    expect(session.requestHint()).toBe('hint');
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.burger, session.game.used)?.[0],
    );

    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd', session.graph.value.park);
    expect(session.overlay.value?.kind).toBe('stuck');
    expect(session.retry()).toBe(true);
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.burger, session.game.used)?.[0],
    );
    expect(session.overlay.value).toBeNull();

    session.showHelp();
    expect(session.jump(1)).toBe(true);
    play(session, 'a', 'c', 'd');
    expect(session.requestHint()).toBe('rescue');
    expect(session.overlay.value?.kind).toBe('rescue');
    expect(session.retry()).toBe(true);
    expect(session.hintNode.value).toBe(
      findSolution(session.graph.value, session.game.node, session.game.burger, session.game.used)?.[0],
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
    const session = useGameSession();
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
    const session = useGameSession();
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

  it('uses retry as the stuck and rescue recovery path', () => {
    const session = useGameSession();
    session.welcomeStart();
    session.showHelp();
    session.jump(1);
    play(session, 'a', 'c', 'd', session.graph.value.park);
    const stuckLevel = session.game.level;
    expect(session.retry()).toBe(true);
    expect(session.game.level).toBe(stuckLevel);
    expect(session.game.node).toBe(session.graph.value.start);
    expect(session.game.stalled).toBe(false);
  });
});

describe('dialog wiring', () => {
  it('binds rescue to retry and only forwards cancel for help or rescue', () => {
    const source = readFileSync(join(root, 'src/components/GameDialogs.vue'), 'utf8');
    expect(source).toMatch(/id="rescueBtn"[^>]*@click="emit\('retry'\)"/);
    expect(source).not.toMatch(/emit\('rescue'\)/);
    expect(source).toMatch(
      /if \(props\.overlay\?\.kind === 'help' \|\| props\.overlay\?\.kind === 'rescue'\) emit\('close'\)/,
    );
    expect(source).not.toMatch(/kind: 'play'/);
    expect(source).not.toContain('箭嘴');
    expect(source).not.toContain('着急');
    expect(source).toContain('箭頭');
    expect(source).toContain('著急');
    expect(source).toMatch(/if \(kind === 'win'\)/);
    expect(source).toMatch(/openDialog\(\);\s*emit\('revealed'\)/);
    expect(source).toMatch(/props\.reduceMotion \? 100 : 650/);
    expect(source).toMatch(/if \(kind\) openDialog\(\);/);
    expect(source).toMatch(/else hideDialog\(\);/);

    const sessionSrc = readFileSync(join(root, 'src/composables/useGameSession.ts'), 'utf8');
    expect(sessionSrc).not.toMatch(/kind:\s*'play'/);
    expect(sessionSrc).not.toMatch(/motion\.value/);
    expect(sessionSrc).not.toMatch(/function boot\(/);
    expect(sessionSrc).not.toMatch(/650/);

    const typesSrc = readFileSync(join(root, 'src/game/types.ts'), 'utf8');
    expect(typesSrc).not.toMatch(/export type Motion/);
  });
});
