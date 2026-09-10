import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  SHOP_ART,
  available,
  applyMove,
  createGame,
  findSolution,
  isWin,
  makeGraph,
  mapSize,
  roadKey,
  shopArtOrigin,
  tryMove,
} from '../src/game/rules';
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

  it('gives every level a burger-then-park solution from the start', () => {
    LEVELS.forEach((_, index) => {
      const { graph, state } = createGame(index);
      const path = findSolution(graph, state.node, state.burger, state.used);
      expect(path, graph.name).not.toBeNull();
      if (!path) return;
      expect(path).toContain(graph.shop);
      expect(path[path.length - 1]).toBe(graph.park);
    });
  });

  it('rejects reversing a used undirected road from a fresh start', () => {
    const { graph, state } = createGame(0);
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

    const reverse = tryMove(graph, state, graph.start);
    expect(reverse.ok).toBe(false);
    if (reverse.ok) return;
    expect(reverse.reason).toBe('used-road');
    expect(state.node).toBe('a');
  });

  it('wins only by reaching the park after the burger shop', () => {
    const { graph, state } = createGame(0);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, graph.shop).ok).toBe(true);
    expect(state.burger).toBe(true);
    expect(play(graph, state, 'b').ok).toBe(true);
    const atPark = play(graph, state, graph.park);
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(atPark.won).toBe(true);
    expect(isWin(graph, state)).toBe(true);
    expect(state.node).toBe(graph.park);
    expect(state.burger).toBe(true);
  });

  it('does not treat park-without-burger as a win', () => {
    const { graph, state } = createGame(1);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, 'c').ok).toBe(true);
    expect(play(graph, state, 'd').ok).toBe(true);
    const atPark = play(graph, state, graph.park);
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(state.burger).toBe(false);
    expect(atPark.won).toBe(false);
    expect(isWin(graph, state)).toBe(false);
    expect(state.stalled).toBe('burger');
    expect(state.won).toBe(false);
  });

  it('hint never recommends a used undirected edge or a park-without-burger path', () => {
    const { graph, state } = createGame(1);
    expect(play(graph, state, 'a').ok).toBe(true);

    const path = findSolution(graph, state.node, state.burger, state.used);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path.length).toBeGreaterThan(0);

    let node = state.node;
    let burger = state.burger;
    const used = new Set(state.used);
    for (const next of path) {
      const edgeId = roadKey(node, next);
      expect(used.has(edgeId), `hint reused road ${edgeId}`).toBe(false);
      const link = available(graph, node, used).find((item) => item.to === next);
      expect(link, `hint stepped to unreachable ${node}->${next}`).toBeTruthy();
      used.add(edgeId);
      node = next;
      if (node === graph.shop) burger = true;
      if (node === graph.park) {
        expect(burger).toBe(true);
      }
    }
    expect(node).toBe(graph.park);
    expect(burger).toBe(true);
    if (!state.burger) expect(path).toContain(graph.shop);
  });

  it('findSolution returns null when only park-without-burger remains', () => {
    const { graph, state } = createGame(1);
    expect(play(graph, state, 'a').ok).toBe(true);
    expect(play(graph, state, graph.shop).ok).toBe(true);
    expect(play(graph, state, 'b').ok).toBe(true);
    expect(play(graph, state, graph.park).ok).toBe(true);
    expect(isWin(graph, state)).toBe(true);

    const trapped = createGame(1);
    expect(play(trapped.graph, trapped.state, 'a').ok).toBe(true);
    expect(play(trapped.graph, trapped.state, trapped.graph.shop).ok).toBe(true);
    expect(play(trapped.graph, trapped.state, 'b').ok).toBe(true);

    const noShop = createGame(1);
    expect(play(noShop.graph, noShop.state, 'a').ok).toBe(true);
    expect(play(noShop.graph, noShop.state, 'c').ok).toBe(true);
    expect(play(noShop.graph, noShop.state, 'd').ok).toBe(true);
    const remaining = available(noShop.graph, noShop.state.node, noShop.state.used).map((l) => l.to);
    expect(remaining).toContain(noShop.graph.park);
    const path = findSolution(
      noShop.graph,
      noShop.state.node,
      noShop.state.burger,
      noShop.state.used,
    );
    expect(path).toBeNull();
  });
});

describe('graph presentation contract', () => {
  it('titles every node and keeps the shop sprite in the viewBox', () => {
    expect(shopArtOrigin([435, 155])[1]).toBe(0);
    expect(shopArtOrigin([435, 345])[1]).toBe(345 - SHOP_ART.dy);

    LEVELS.forEach((_, index) => {
      for (const narrow of [false, true]) {
        const graph = makeGraph(index, narrow);
        const size = mapSize(narrow);
        Object.keys(graph.nodes).forEach((id) => {
          expect(graph.titles[id], `${graph.name} ${id}`).toBeTruthy();
        });
        const [x, y] = shopArtOrigin(graph.nodes[graph.shop]);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + SHOP_ART.height).toBeLessThanOrEqual(size.height);
        expect(x + SHOP_ART.width).toBeGreaterThan(0);
        expect(x).toBeLessThan(size.width);
      }
    });
  });
});
