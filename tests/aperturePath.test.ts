// @vitest-environment happy-dom
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MazeBoard from '../src/components/MazeBoard.vue';
import ToothBoard from '../src/components/ToothBoard.vue';
import { useGameSession } from '../src/composables/useGameSession';
import { moveDuration } from '../src/game/motion';
import { available, createGame, findSolution } from '../src/game/rules';
import type { GameState, Graph, InFlightMove, NodeId } from '../src/game/types';
import { NODE_LABELS as PICNIC_LABELS, sessionCopy as picnicSessionCopy } from '../src/picnic/copy';
import { LEVELS } from '../src/picnic/levels';
import { NODE_LABELS as TOOTH_LABELS, sessionCopy as toothSessionCopy } from '../src/tooth/copy';
import { TOOTH_LEVELS } from '../src/tooth/levels';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function defaultAria(graph: Graph, from: NodeId, to: NodeId): string {
  const [x0, y0] = graph.nodes[from];
  const [x1, y1] = graph.nodes[to];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '右' : '左') : (dy > 0 ? '下' : '上');
  return `向${direction}前往${graph.titles[to]}`;
}

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
}

function stepTargets(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*\bclass="[^"]*step-target[^"]*"[^>]*>/g)].map((match) => match[0]);
}

function pathReady(html: string): string | null {
  return html.match(/data-path-ready="(true|false)"/)?.[1] ?? null;
}

async function renderMaze(options: {
  graph: Graph;
  state: GameState;
  interactive: boolean;
  narrow?: boolean;
  inFlight?: InFlightMove | null;
  theme?: 'picnic' | 'tooth';
  tooth?: boolean;
}): Promise<string> {
  const common = {
    graph: options.graph,
    state: options.state,
    interactive: options.interactive,
    narrow: options.narrow ?? false,
    facing: 90,
    hintNode: null as NodeId | null,
    inFlight: options.inFlight ?? null,
  };
  if (options.tooth) {
    return renderToString(createSSRApp({
      render: () => h(ToothBoard, common),
    }));
  }
  return renderToString(createSSRApp({
    render: () => h(MazeBoard, {
      ...common,
      theme: options.theme ?? 'picnic',
      boardLabel: 'aperture test',
    }),
  }));
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

describe('甲 aperture / clear-path (picnic + tooth)', () => {
  it('P1 L1 a11y names match CUA dumps on wide and narrow boards', async () => {
    for (const narrow of [false, true]) {
      const picnic = createGame(LEVELS, 0, narrow, PICNIC_LABELS);
      const picnicLinks = available(picnic.graph, picnic.state.node, picnic.state.used);
      expect(picnicLinks).toHaveLength(1);
      expect(defaultAria(picnic.graph, picnic.state.node, picnicLinks[0]!.to)).toBe('向下前往路口');
      const picnicHtml = await renderMaze({ ...picnic, interactive: true, narrow, theme: 'picnic' });
      expect(pathReady(picnicHtml)).toBe('true');
      expect(ariaLabels(picnicHtml)).toContain('向下前往路口');
      expect(stepTargets(picnicHtml)).toHaveLength(1);

      const tooth = createGame(TOOTH_LEVELS, 0, narrow, TOOTH_LABELS);
      const toothLinks = available(tooth.graph, tooth.state.node, tooth.state.used);
      expect(toothLinks).toHaveLength(1);
      expect(`前往${tooth.graph.titles[toothLinks[0]!.to]}`).toBe('前往路口');
      const toothHtml = await renderMaze({ ...tooth, interactive: true, narrow, tooth: true });
      expect(pathReady(toothHtml)).toBe('true');
      expect(ariaLabels(toothHtml)).toContain('前往路口');
      expect(ariaLabels(toothHtml)).not.toContain('向下前往路口');
      expect(stepTargets(toothHtml)).toHaveLength(1);
    }
  });

  it('P2 TAP empties path buttons while in flight (CUA false FAIL shape)', async () => {
    const picnic = createGame(LEVELS, 0, true, PICNIC_LABELS);
    const to = available(picnic.graph, picnic.state.node, picnic.state.used)[0]!.to;
    const flight: InFlightMove = {
      ok: true,
      from: picnic.state.node,
      to,
      edgeId: 'a-s',
      reverse: false,
      collected: false,
      collectedNow: false,
      won: false,
      stalled: false,
      t: 0.4,
      startAngle: 90,
      duration: 650,
    };
    const flying = await renderMaze({
      graph: picnic.graph,
      state: picnic.state,
      interactive: false,
      narrow: true,
      inFlight: flight,
      theme: 'picnic',
    });
    expect(pathReady(flying)).toBe('false');
    expect(stepTargets(flying)).toHaveLength(0);
    expect(flying).toContain('moving');

    const styles = read('src/assets/styles.css');
    expect(styles).toMatch(/\.board\.moving\s+\.step-target\{[^}]*opacity:\s*0/);
    expect(styles).toMatch(/\.board\.moving\s+\.step-target\{[^}]*pointer-events:\s*none/);
    expect(moveDuration(1, false)).toBe(650);
    expect(moveDuration(10_000, false)).toBe(1080);
  });

  describe('P3 settle and clear', () => {
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
        value: 390,
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

    it('after settle the next rings return and L1 clears to win on a phone width', () => {
      for (const [label, catalog, copy] of [
        ['picnic', LEVELS, picnicSessionCopy] as const,
        ['tooth', TOOTH_LEVELS, toothSessionCopy] as const,
      ]) {
        const session = useGameSession({}, { catalog, copy });
        session.applyLayout(true);
        expect(session.welcomeStart()).toBe(true);
        expect(session.interactive.value).toBe(true);
        expect(session.narrow.value).toBe(true);

        const first = available(session.graph.value, session.game.node, session.game.used);
        expect(first.length, label).toBeGreaterThan(0);
        expect(session.requestMove(first[0]!.to).ok).toBe(true);
        expect(session.inFlight.value).not.toBeNull();
        expect(session.interactive.value).toBe(false);

        flushFrames();
        expect(session.inFlight.value).toBeNull();
        expect(session.interactive.value).toBe(true);
        const next = available(session.graph.value, session.game.node, session.game.used);
        expect(next.length, `${label} next rings`).toBeGreaterThan(0);

        for (let i = 0; i < 24; i += 1) {
          if (session.game.won) break;
          const path = findSolution(
            session.graph.value,
            session.game.node,
            session.game.collected,
            session.game.used,
          );
          expect(path, label).not.toBeNull();
          if (!path?.length) break;
          expect(session.requestMove(path[0]!).ok).toBe(true);
          flushFrames();
        }
        expect(session.game.won, label).toBe(true);
        expect(session.overlay.value).toEqual({ kind: 'win' });
      }
    });
  });

  it('P4 documents the path-ready playbook beside win-ready', () => {
    const doc = read('docs/APERTURE_PATH.md');
    expect(doc).toContain('data-path-ready');
    expect(doc).toContain('向下前往路口');
    expect(doc).toContain('前往路口');
    expect(doc).toContain('verdict B');
    expect(doc).toContain('WIN_READY');
    const board = read('src/components/MazeBoard.vue');
    expect(board).toContain('data-path-ready');
  });
});
