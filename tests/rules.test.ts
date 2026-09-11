import { describe, expect, it } from 'vitest';
import {
  available,
  applyMove,
  createGame,
  findSolution,
  isWin,
  makeGraph,
  mapSize,
  roadKey,
  tryMove,
} from '../src/game/rules';
import { SHOP_ART, shopArtOrigin } from '../src/picnic/art';
import { NODE_LABELS } from '../src/picnic/copy';
import { LEVELS } from '../src/picnic/levels';
import { TOOTH_LEVELS } from '../src/tooth/levels';
import type { GameState, Graph, MoveResult, NodeId } from '../src/game/types';

function play(graph: Graph, state: GameState, to: NodeId): MoveResult {
  const result = tryMove(graph, state, to);
  if (result.ok) applyMove(state, result);
  return result;
}

describe('picnic game rules (shipped logic)', () => {
  it('names every picnic level', () => {
    expect(LEVELS.map((level) => level.name)).toEqual([
      '沿路前行',
      '先購漢堡',
      '小小探路家',
      '繞路尋店',
      '雙路並行',
      '盡頭探險',
    ]);
  });

  it('starts uncollected when a level has a collectible', () => {
    expect(createGame(LEVELS).state.collected).toBe(false);
    expect(createGame(TOOTH_LEVELS).state.collected).toBe(true);
  });

  it('gives every level a collect-then-goal solution from the start', () => {
    LEVELS.forEach((_, index) => {
      const { graph, state } = createGame(LEVELS, index);
      const path = findSolution(graph, state.node, state.collected, state.used);
      expect(path, graph.name).not.toBeNull();
      if (!path) return;
      expect(graph.collect).not.toBeNull();
      expect(path).toContain(graph.collect);
      expect(path[path.length - 1]).toBe(graph.goal);
    });
  });

  it('rejects reversing a used undirected road from a fresh start', () => {
    const { graph, state } = createGame(LEVELS);
    expect(roadKey(graph.start, 'a')).toBe(roadKey('a', graph.start));
    expect(roadKey(graph.start, 'a')).toBe('a-s');

    const preview = tryMove(graph, state, 'a');
    expect(preview.ok).toBe(true);
    expect(state.node).toBe(graph.start);
    expect(state.used.size).toBe(0);

    const forward = play(graph, state, 'a');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.edgeId).toBe('a-s');
    expect(state.node).toBe('a');
    expect(state.used.has('a-s')).toBe(true);
    expect(state.usedFrom['a-s']).toBe(graph.start);

    const reverse = tryMove(graph, state, graph.start);
    expect(reverse.ok).toBe(false);
    if (reverse.ok) return;
    expect(reverse.reason).toBe('used-road');
    expect(state.node).toBe('a');
  });

  it('wins only by reaching the goal after the collectible', () => {
    const { graph, state } = createGame(LEVELS);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, graph.collect!).ok).toBe(true);
    expect(state.collected).toBe(true);
    expect(play(graph, state, 'b').ok).toBe(true);
    const atGoal = play(graph, state, graph.goal);
    expect(atGoal.ok).toBe(true);
    if (!atGoal.ok) return;
    expect(atGoal.won).toBe(true);
    expect(isWin(graph, state)).toBe(true);
    expect(state.node).toBe(graph.goal);
    expect(state.collected).toBe(true);
  });

  it('does not treat goal-without-collectible as a win', () => {
    const { graph, state } = createGame(LEVELS, 1);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, 'c').ok).toBe(true);
    expect(play(graph, state, 'd').ok).toBe(true);
    const atGoal = play(graph, state, graph.goal);
    expect(atGoal.ok).toBe(true);
    if (!atGoal.ok) return;
    expect(state.collected).toBe(false);
    expect(atGoal.won).toBe(false);
    expect(isWin(graph, state)).toBe(false);
    expect(state.stalled).toBe('missing-collect');
    expect(state.won).toBe(false);
  });

  it('hint never recommends a used undirected edge or a goal-without-collectible path', () => {
    const { graph, state } = createGame(LEVELS, 1);
    expect(play(graph, state, 'a').ok).toBe(true);

    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path.length).toBeGreaterThan(0);

    let node = state.node;
    let collected = state.collected;
    const used = new Set(state.used);
    for (const next of path) {
      const edgeId = roadKey(node, next);
      expect(used.has(edgeId), `hint reused road ${edgeId}`).toBe(false);
      const link = available(graph, node, used).find((item) => item.to === next);
      expect(link, `hint stepped to unreachable ${node}->${next}`).toBeTruthy();
      used.add(edgeId);
      node = next;
      if (node === graph.collect) collected = true;
      if (node === graph.goal) {
        expect(collected).toBe(true);
      }
    }
    expect(node).toBe(graph.goal);
    expect(collected).toBe(true);
    if (!state.collected) expect(path).toContain(graph.collect);
  });

  it('findSolution returns null when only goal-without-collectible remains', () => {
    const { graph, state } = createGame(LEVELS, 1);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, graph.collect!).ok).toBe(true);
    expect(play(graph, state, 'b').ok).toBe(true);
    expect(play(graph, state, graph.goal).ok).toBe(true);
    expect(isWin(graph, state)).toBe(true);
    expect(findSolution(graph, state.node, state.collected, state.used)).toEqual([]);

    const trapped = createGame(LEVELS, 1);
    expect(play(trapped.graph, trapped.state, 'a').ok).toBe(true);
    expect(play(trapped.graph, trapped.state, trapped.graph.collect!).ok).toBe(true);
    expect(play(trapped.graph, trapped.state, 'b').ok).toBe(true);
    const trappedPath = findSolution(
      trapped.graph,
      trapped.state.node,
      trapped.state.collected,
      trapped.state.used,
    );
    expect(trappedPath).not.toBeNull();
    if (!trappedPath) return;
    expect(trappedPath[trappedPath.length - 1]).toBe(trapped.graph.goal);

    const noCollect = createGame(LEVELS, 1);
    expect(play(noCollect.graph, noCollect.state, 'a').ok).toBe(true);
    expect(play(noCollect.graph, noCollect.state, 'c').ok).toBe(true);
    expect(play(noCollect.graph, noCollect.state, 'd').ok).toBe(true);
    const remaining = available(noCollect.graph, noCollect.state.node, noCollect.state.used).map((l) => l.to);
    expect(remaining).toContain(noCollect.graph.goal);
    const path = findSolution(
      noCollect.graph,
      noCollect.state.node,
      noCollect.state.collected,
      noCollect.state.used,
    );
    expect(path).toBeNull();
  });

  it('stalls a degree-1 arrival as deadend and blocks further moves', () => {
    const { graph, state } = createGame(LEVELS, 2);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, graph.collect!).ok).toBe(true);
    expect(play(graph, state, 'b').ok).toBe(true);
    expect(play(graph, state, 'u').ok).toBe(true);
    const atEnd = play(graph, state, 'v');
    expect(atEnd.ok).toBe(true);
    if (!atEnd.ok) return;
    expect(atEnd.stalled).toBe('deadend');
    expect(state.stalled).toBe('deadend');
    expect(tryMove(graph, state, 'u')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('does not invent shop/park landmarks on picnic maps', () => {
    LEVELS.forEach((level) => {
      expect(level).not.toHaveProperty('shop');
      expect(level).not.toHaveProperty('park');
      expect(level.collect).toBeTruthy();
      expect(level.hazards).toBeUndefined();
    });
  });
});

describe('graph presentation contract', () => {
  it('titles every node from the theme and keeps the shop sprite in the viewBox', () => {
    expect(shopArtOrigin([435, 155])[1]).toBe(0);
    expect(shopArtOrigin([435, 345])[1]).toBe(345 - SHOP_ART.dy);

    LEVELS.forEach((_, index) => {
      for (const narrow of [false, true]) {
        const graph = makeGraph(LEVELS, index, narrow, NODE_LABELS);
        const size = mapSize(narrow);
        Object.keys(graph.nodes).forEach((id) => {
          expect(graph.titles[id], `${graph.name} ${id}`).toBeTruthy();
        });
        expect(graph.titles[graph.collect!]).toBe('漢堡店');
        expect(graph.titles[graph.goal]).toBe('公園');
        const [x, y] = shopArtOrigin(graph.nodes[graph.collect!]);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + SHOP_ART.height).toBeLessThanOrEqual(size.height);
        expect(x + SHOP_ART.width).toBeGreaterThan(0);
        expect(x).toBeLessThan(size.width);
      }
    });
  });
});
