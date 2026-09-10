import { describe, expect, it } from 'vitest';
import { createGame, findSolution } from '../src/game/rules';
import { picnicLevel, LEVELS } from '../src/picnic/levels';
import { toothLevel, TOOTH_LEVELS } from '../src/tooth/levels';

describe('endless maze maps', () => {
  it('keeps the hand-drawn opening picnic maps', () => {
    LEVELS.forEach((level, index) => {
      expect(picnicLevel(index)).toBe(level);
    });
  });

  it('keeps the hand-drawn opening tooth maps', () => {
    TOOTH_LEVELS.forEach((level, index) => {
      expect(toothLevel(index)).toBe(level);
    });
  });

  it('mints a solvable picnic map after the opening set', () => {
    const first = picnicLevel(LEVELS.length);
    const again = picnicLevel(LEVELS.length);
    expect(first).toEqual(again);
    expect(first.tutorial).toBeUndefined();
    expect(first.collect).toBeTruthy();
    expect(first.edges.length).toBeLessThanOrEqual(24);

    const { graph, state } = createGame(picnicLevel, LEVELS.length);
    expect(graph.collect).toBe(first.collect);
    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path, graph.name).not.toBeNull();
    expect(path).toContain(graph.collect);
    expect(path?.at(-1)).toBe(graph.goal);
  });

  it('mints a solvable tooth map with a bug after the opening set', () => {
    const first = toothLevel(TOOTH_LEVELS.length);
    expect(toothLevel(TOOTH_LEVELS.length)).toEqual(first);
    expect(first.collect).toBeUndefined();
    expect(first.hazards?.length).toBeGreaterThan(0);

    const { graph, state } = createGame(toothLevel, TOOTH_LEVELS.length);
    expect(state.collected).toBe(true);
    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path, graph.name).not.toBeNull();
    expect(path?.at(-1)).toBe(graph.goal);
    path?.forEach((node) => {
      expect(graph.hazards).not.toContain(node);
    });
  });

  it('gives picnic and tooth a solution on many later maps', () => {
    for (let index = 6; index < 36; index += 1) {
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

  it('does not stamp out one picnic layout for every later map', () => {
    const seen = new Set(
      Array.from({ length: 16 }, (_, i) => JSON.stringify(picnicLevel(LEVELS.length + i))),
    );
    expect(seen.size).toBeGreaterThan(8);
  });
});
