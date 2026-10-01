import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyMove, createGame, findSolution, tryMove } from '../src/game/rules';
import type { LevelDef } from '../src/game/types';
import { picnicLevel, LEVELS } from '../src/picnic/levels';
import { toothLevel, TOOTH_LEVELS } from '../src/tooth/levels';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('endless maze maps', () => {
  it('keeps the hand-drawn picnic maps as fixtures, not the live catalog', () => {
    expect(LEVELS.map((level) => level.name)).toEqual([
      '沿路前行',
      '先購漢堡',
      '小小探路家',
      '繞路尋店',
      '雙路並行',
      '盡頭探險',
    ]);
    expect(picnicLevel(0)).not.toBe(LEVELS[0]);
    expect(picnicLevel(0).tutorial).toBe(true);
    expect(picnicLevel(1).tutorial).toBeUndefined();
  });

  it('keeps the hand-drawn tooth maps as fixtures, not the live catalog', () => {
    expect(TOOTH_LEVELS.map((level) => level.name)).toEqual([
      '認識小路',
      '避開蛀蟲',
      '同一條路一次',
    ]);
    expect(toothLevel(0)).not.toBe(TOOTH_LEVELS[0]);
    expect(toothLevel(0).tutorial).toBe(true);
    expect(toothLevel(1).tutorial).toBeUndefined();
  });

  it('mints a solvable picnic map from the first level', () => {
    const first = picnicLevel(0);
    expect(picnicLevel(0)).toEqual(first);
    expect(first.collect).toBeTruthy();
    expect(first.edges.length).toBeLessThanOrEqual(24);

    const { graph, state } = createGame(picnicLevel, 0);
    expect(graph.tutorial).toBe(true);
    expect(graph.collect).toBe(first.collect);
    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path, graph.name).not.toBeNull();
    expect(path).toContain(graph.collect);
    expect(path?.at(-1)).toBe(graph.goal);
  });

  it('mints a solvable tooth map with a bug from the first level', () => {
    const first = toothLevel(0);
    expect(toothLevel(0)).toEqual(first);
    expect(first.collect).toBeUndefined();
    expect(first.hazards?.length).toBeGreaterThan(0);

    const { graph, state } = createGame(toothLevel, 0);
    expect(graph.tutorial).toBe(true);
    expect(state.collected).toBe(true);
    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path, graph.name).not.toBeNull();
    expect(path?.at(-1)).toBe(graph.goal);
    path?.forEach((node) => {
      expect(graph.hazards).not.toContain(node);
    });
  });

  it('keeps tooth bugs off other roads so they stand on their own junction', () => {
    const distToSegment = (px: number, py: number, a: readonly number[], b: readonly number[]) => {
      const dx = b[0]! - a[0]!;
      const dy = b[1]! - a[1]!;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) return Math.hypot(px - a[0]!, py - a[1]!);
      const t = Math.max(0, Math.min(1, ((px - a[0]!) * dx + (py - a[1]!) * dy) / len2));
      return Math.hypot(px - (a[0]! + dx * t), py - (a[1]! + dy * t));
    };
    for (const seed of [0, 7, 11, 42, 4242]) {
      for (let index = 0; index < 20; index += 1) {
        const { graph } = createGame((i) => toothLevel(i, seed), index);
        expect(graph.hazards.length, `tooth ${seed}/${index}`).toBeGreaterThan(0);
        for (const id of graph.hazards) {
          const [x, y] = graph.nodes[id];
          for (const edge of graph.edges) {
            if (edge.a === id || edge.b === id) continue;
            expect(
              distToSegment(x, y, graph.nodes[edge.a], graph.nodes[edge.b]),
              `bug ${id} on ${edge.id} (${seed}/${index})`,
            ).toBeGreaterThan(50);
          }
        }
      }
    }
  });

  it('gives picnic and tooth a solution on many maps', () => {
    for (let index = 0; index < 30; index += 1) {
      const picnic = createGame(picnicLevel, index);
      const picnicPath = findSolution(
        picnic.graph,
        picnic.state.node,
        picnic.state.collected,
        picnic.state.used,
      );
      expect(picnicPath, `picnic ${index} ${picnic.graph.name}`).not.toBeNull();
      expect(picnic.graph.edges.length, `picnic ${index}`).toBeLessThanOrEqual(24);

      const tooth = createGame(toothLevel, index);
      const toothPath = findSolution(
        tooth.graph,
        tooth.state.node,
        tooth.state.collected,
        tooth.state.used,
      );
      expect(toothPath, `tooth ${index} ${tooth.graph.name}`).not.toBeNull();
      expect(tooth.graph.hazards.length, `tooth ${index}`).toBeGreaterThan(0);
      expect(tooth.graph.edges.length, `tooth ${index}`).toBeLessThanOrEqual(24);
    }
  });

  it('does not stamp out one picnic layout for every map', () => {
    const seen = new Set(
      Array.from({ length: 16 }, (_, i) => JSON.stringify(picnicLevel(i))),
    );
    expect(seen.size).toBeGreaterThan(8);
  });

  it('keeps a map stable for one seed and shuffles when the seed changes', () => {
    expect(picnicLevel(0, 7)).toEqual(picnicLevel(0, 7));
    expect(toothLevel(0, 7)).toEqual(toothLevel(0, 7));
    const picnicLayouts = [1, 2, 9, 99, 12345].map((seed) => JSON.stringify(picnicLevel(0, seed)));
    const toothLayouts = [1, 2, 9, 99, 12345].map((seed) => JSON.stringify(toothLevel(0, seed)));
    expect(new Set(picnicLayouts).size).toBeGreaterThan(1);
    expect(new Set(toothLayouts).size).toBeGreaterThan(1);
  });

  it('still has a solution when the shuffle seed is not zero', () => {
    const picnic = createGame((index) => picnicLevel(index, 4242), 0);
    const tooth = createGame((index) => toothLevel(index, 4242), 0);
    expect(findSolution(picnic.graph, picnic.state.node, picnic.state.collected, picnic.state.used)).not.toBeNull();
    expect(findSolution(tooth.graph, tooth.state.node, tooth.state.collected, tooth.state.used)).not.toBeNull();
  });

  it('keeps known picnic and tooth maps after sharing the grid maze', () => {
    expect(picnicLevel(0, 0)).toEqual({
      name: '新的小路',
      short: '新路',
      start: 'r1c0',
      collect: 'r0c0',
      goal: 'r0c2',
      tutorial: true,
      nodes: {
        r0c0: [135, 215], r0c1: [435, 215], r0c2: [685, 215],
        r1c0: [135, 500], r1c1: [435, 500], r1c2: [685, 500],
      },
      edges: [
        ['r0c0', 'r0c1'], ['r0c1', 'r1c1'], ['r1c1', 'r1c2'],
        ['r0c0', 'r1c0'], ['r0c1', 'r0c2'], ['r1c0', 'r1c1'], ['r0c2', 'r1c2'],
      ],
    });
    expect(picnicLevel(0, 7)).toEqual({
      name: '新的小路',
      short: '新路',
      start: 'r1c2',
      collect: 'r0c1',
      goal: 'r0c0',
      tutorial: true,
      nodes: {
        r0c0: [135, 215], r0c1: [435, 215], r0c2: [685, 215],
        r1c0: [135, 500], r1c1: [435, 500], r1c2: [685, 500],
      },
      edges: [
        ['r0c1', 'r1c1'], ['r0c2', 'r1c2'], ['r1c1', 'r1c2'],
        ['r0c0', 'r1c0'], ['r1c0', 'r1c1'], ['r0c1', 'r0c2'], ['r0c0', 'r0c1'],
      ],
    });
    expect(toothLevel(0, 7)).toEqual({
      name: '新的小路',
      short: '新路',
      start: 'r1c2',
      goal: 'r0c0',
      tutorial: true,
      hazards: ['r1c1'],
      nodes: {
        r0c0: [135, 215], r0c1: [435, 215], r0c2: [685, 215],
        r1c0: [135, 500], r1c1: [435, 500], r1c2: [685, 500],
      },
      edges: [
        ['r0c2', 'r1c2'], ['r1c1', 'r1c2'], ['r0c0', 'r0c1'],
        ['r0c1', 'r1c1'], ['r0c0', 'r1c0'], ['r0c1', 'r0c2'], ['r1c0', 'r1c1'],
      ],
    });
    expect(picnicLevel(9, 7)).toEqual({
      name: '繞去公園',
      short: '繞園',
      start: 'r0c3',
      collect: 'r2c2',
      goal: 'r2c0',
      nodes: {
        r0c0: [120, 155], r0c1: [320, 155], r0c2: [520, 155], r0c3: [720, 155],
        r1c0: [120, 345], r1c1: [320, 345], r1c2: [520, 345], r1c3: [720, 345],
        r2c0: [120, 545], r2c1: [320, 545], r2c2: [520, 545], r2c3: [720, 545],
      },
      edges: [
        ['r0c1', 'r1c1'], ['r1c3', 'r2c3'], ['r0c2', 'r1c2'], ['r1c2', 'r1c3'],
        ['r2c2', 'r2c3'], ['r0c3', 'r1c3'], ['r1c1', 'r1c2'], ['r2c0', 'r2c1'],
        ['r0c0', 'r0c1'], ['r1c0', 'r1c1'], ['r2c1', 'r2c2'], ['r0c2', 'r0c3'],
        ['r0c1', 'r0c2'], ['r1c2', 'r2c2'],
      ],
    });
    expect(toothLevel(15, 0)).toEqual({
      name: '再探一探',
      short: '再探',
      start: 'r2c0',
      goal: 'r0c3',
      hazards: ['r2c2'],
      nodes: {
        r0c0: [120, 155], r0c1: [320, 155], r0c2: [520, 155], r0c3: [720, 155],
        r1c0: [120, 345], r1c1: [320, 345], r1c2: [520, 345], r1c3: [720, 345],
        r2c0: [120, 545], r2c1: [320, 545], r2c2: [520, 545], r2c3: [720, 545],
      },
      edges: [
        ['r0c2', 'r0c3'], ['r0c1', 'r0c2'], ['r1c0', 'r2c0'], ['r1c3', 'r2c3'],
        ['r2c1', 'r2c2'], ['r2c0', 'r2c1'], ['r0c3', 'r1c3'], ['r1c0', 'r1c1'],
        ['r0c2', 'r1c2'], ['r0c1', 'r1c1'], ['r0c0', 'r1c0'], ['r1c2', 'r1c3'],
        ['r0c0', 'r0c1'], ['r1c1', 'r1c2'], ['r1c1', 'r2c1'],
      ],
    });
  });

  it('gates the picnic park behind the shop from displayed L8 onward', () => {
    const reachesParkBeforeShop = (level: LevelDef) => {
      const collect = level.collect;
      if (!collect) return true;
      const adj = new Map<string, string[]>();
      for (const [a, b] of level.edges) {
        adj.set(a, [...(adj.get(a) ?? []), b]);
        adj.set(b, [...(adj.get(b) ?? []), a]);
      }
      const seen = new Set<string>();
      const stack = [level.start];
      while (stack.length) {
        const node = stack.pop();
        if (!node || node === collect || seen.has(node)) continue;
        if (node === level.goal) return true;
        seen.add(node);
        for (const next of adj.get(node) ?? []) stack.push(next);
      }
      return false;
    };

    for (const seed of [0, 1, 7, 11, 42, 99, 4242]) {
      for (let index = 0; index < 7; index += 1) {
        const early = picnicLevel(index, seed);
        expect(findSolution(
          createGame((i) => picnicLevel(i, seed), index).graph,
          early.start,
          false,
          new Set(),
        ), `picnic L${index + 1} seed ${seed}`).not.toBeNull();
      }
      for (let index = 7; index < 12; index += 1) {
        const level = picnicLevel(index, seed);
        expect(reachesParkBeforeShop(level), `L${index + 1} seed ${seed} bypass`).toBe(false);
        const { graph, state } = createGame((i) => picnicLevel(i, seed), index);
        const path = findSolution(graph, state.node, state.collected, state.used);
        expect(path, `L${index + 1} seed ${seed}`).not.toBeNull();
        expect(path).toContain(graph.collect);
        let sawParkChoice = false;
        for (const to of path ?? []) {
          const choices = graph.adj[state.node]?.filter((link) => !state.used.has(link.edge.id)) ?? [];
          if (!state.collected && choices.some((link) => link.to === graph.goal)) sawParkChoice = true;
          const move = tryMove(graph, state, to);
          expect(move.ok, `L${index + 1} seed ${seed} -> ${to}`).toBe(true);
          if (!move.ok) return;
          applyMove(state, move);
          expect(move.stalled, `L${index + 1} seed ${seed}`).toBe(false);
        }
        expect(sawParkChoice, `L${index + 1} seed ${seed} park before burger`).toBe(false);
        expect(state.won).toBe(true);
        expect(state.collected).toBe(true);
        expect(state.node).toBe(graph.goal);
      }
    }
  });

  it('does not export maze internals as a delivery toolkit', () => {
    const src = readFileSync(join(root, 'src/game/generate.ts'), 'utf8');
    expect(src).toMatch(/^export function generateMaze\(/m);
    expect(src).toMatch(/generateGridMaze\(/);
    expect(src).toMatch(/firstValid\(/);
    expect(src).toMatch(/mazeLoadBand\(/);
    expect(src).not.toMatch(/export function makeRng/);
    expect(src).not.toMatch(/export function hypot/);
    expect(src).not.toMatch(/export function pick/);
    expect(src).not.toMatch(/export function shuffle/);
    expect(src).not.toMatch(/export function spanningTree/);
    expect(src).not.toMatch(/export function randomSeed/);
  });
});
