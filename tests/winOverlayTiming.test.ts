import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeGraph, mapSize } from '../src/game/graph';
import { moveDuration } from '../src/game/motion';
import { available, findSolution } from '../src/game/rules';
import { NODE_LABELS as PICNIC_LABELS } from '../src/picnic/copy';
import { picnicLevel } from '../src/picnic/levels';
import { NODE_LABELS as TOOTH_LABELS } from '../src/tooth/copy';
import { toothLevel } from '../src/tooth/levels';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function goalClearance(kind: 'tooth' | 'picnic', index: number, seed: number, narrow: boolean, board: { w: number; h: number }, button: number) {
  const level = kind === 'tooth' ? toothLevel(index, seed) : picnicLevel(index, seed);
  const labels = kind === 'tooth' ? TOOTH_LABELS : PICNIC_LABELS;
  const graph = makeGraph([level], 0, narrow, labels);
  const map = mapSize(narrow);
  const path = findSolution(graph, graph.start, graph.collect === null, new Set());
  if (!path?.length) return null;
  let node = graph.start;
  const used = new Set<string>();
  for (const to of path) {
    const link = graph.adj[node].find((item) => item.to === to);
    if (!link) return null;
    if (to === graph.goal) {
      const links = available(graph, node, used);
      const centers = links.map((item) => {
        const [x, y] = graph.nodes[item.to];
        return {
          title: graph.titles[item.to],
          cx: (x / map.width) * board.w,
          cy: (y / map.height) * board.h,
        };
      });
      const goal = centers.find((item) => item.title === graph.titles[graph.goal]);
      if (!goal) return null;
      const nearest = centers
        .filter((item) => item !== goal)
        .map((item) => Math.hypot(item.cx - goal.cx, item.cy - goal.cy));
      return {
        clearance: nearest.length ? Math.min(...nearest) - button : Infinity,
      };
    }
    used.add(link.edge.id);
    node = to;
  }
  return null;
}

describe('tooth/picnic win overlay detection window', () => {
  it('keeps the open dialog later than a short poll on long final edges', () => {
    const overlays = read('src/components/MazeOverlays.vue');
    const dialog = read('src/components/MazeDialog.vue');
    const reveal = overlays.match(/props\.reduceMotion \? 100 : (\d+)/);
    expect(reveal?.[1]).toBe('650');
    expect(overlays).toMatch(/winBeat/);
    expect(dialog).toMatch(/data-win-ready/);
    expect(dialog).toMatch(/aria-busy/);
    expect(dialog).toMatch(/Do not call showModal early/);
    const winRevealMs = Number(reveal?.[1]);
    const shortEdge = moveDuration(1, false);
    const longEdge = moveDuration(10_000, false);
    expect(shortEdge).toBe(650);
    expect(longEdge).toBe(1080);
    expect(moveDuration(1, true)).toBe(80);
    // Click → visible dialog. The card is in a closed <dialog> until this elapses.
    expect(shortEdge + winRevealMs).toBe(1300);
    expect(longEdge + winRevealMs).toBe(1730);
  });

  it('does not cover 前往終點 with a neighbour target on desktop or phone boards', () => {
    const layouts = [
      { narrow: false, board: { w: 614, h: 483 }, button: 62 },
      { narrow: false, board: { w: 960, h: 754 }, button: 62 },
      { narrow: true, board: { w: 350, h: 461 }, button: 54 },
    ];
    for (const kind of ['tooth', 'picnic'] as const) {
      for (const layout of layouts) {
        let covered = 0;
        let seen = 0;
        for (let index = 0; index < 24; index += 1) {
          for (let seed = 1; seed <= 12; seed += 1) {
            const row = goalClearance(kind, index, seed, layout.narrow, layout.board, layout.button);
            if (!row || !Number.isFinite(row.clearance)) continue;
            seen += 1;
            if (row.clearance < 0) covered += 1;
          }
        }
        expect(seen, kind).toBeGreaterThan(100);
        expect(covered, `${kind} ${layout.narrow ? 'narrow' : 'wide'}`).toBe(0);
      }
    }
  });
});
