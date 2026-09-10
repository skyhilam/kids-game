import { describe, expect, it } from 'vitest';
import { createGame, findSolution } from '../src/game/rules';
import { picnicLevel, LEVELS } from '../src/picnic/levels';
import { toothLevel, TOOTH_LEVELS } from '../src/tooth/levels';

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
});
