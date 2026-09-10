import { makeGraph } from './graph';
import { LEVELS } from './levels';
import type { GameState, Graph, Link, MoveOk, MoveResult, NodeId } from './types';

export { LEVELS } from './levels';
export { makeGraph, roadKey, mapSize, shopArtOrigin, SHOP_ART } from './graph';
export type { GameState, Graph, Link, MoveResult, NodeId } from './types';

export function createGame(levelIndex = 0, narrow = false): { graph: Graph; state: GameState } {
  const level = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
  const graph = makeGraph(level, narrow);
  return {
    graph,
    state: {
      level,
      node: graph.start,
      burger: false,
      used: new Set(),
      won: false,
      stalled: false,
    },
  };
}

export function available(graph: Graph, node: NodeId, used: Set<string>): Link[] {
  return (graph.adj[node] ?? []).filter((x) => !used.has(x.edge.id));
}

/**
 * Exhaustive search over this small graph. It never recommends a reused road,
 * and reaching the park without a burger is not a solution.
 */
export function findSolution(
  graph: Graph,
  node: NodeId,
  burger: boolean,
  used: Set<string>,
): NodeId[] | null {
  const failed = new Set<string>();
  const search = (n: NodeId, hasBurger: boolean, mask: number): NodeId[] | null => {
    if (n === graph.park) return hasBurger ? [] : null;
    const key = `${n}/${hasBurger ? 1 : 0}/${mask}`;
    if (failed.has(key)) return null;
    for (const link of graph.adj[n]) {
      const bit = 1 << link.edge.index;
      if (mask & bit) continue;
      const result = search(link.to, hasBurger || link.to === graph.shop, mask | bit);
      if (result !== null) return [link.to, ...result];
    }
    failed.add(key);
    return null;
  };
  let mask = 0;
  graph.edges.forEach((e) => {
    if (used.has(e.id)) mask |= 1 << e.index;
  });
  return search(node, burger, mask);
}

export function tryMove(graph: Graph, state: GameState, to: NodeId): MoveResult {
  if (state.won || state.stalled) return { ok: false, reason: 'blocked' };
  const neighbors = graph.adj[state.node] ?? [];
  const adjacent = neighbors.find((x) => x.to === to);
  if (!adjacent) return { ok: false, reason: 'not-adjacent' };
  if (state.used.has(adjacent.edge.id)) return { ok: false, reason: 'used-road' };

  const from = state.node;
  const reverse = adjacent.edge.a !== from;
  const boughtNow = to === graph.shop && !state.burger;
  const burger = state.burger || boughtNow;
  const used = new Set(state.used);
  used.add(adjacent.edge.id);

  if (to === graph.park) {
    if (burger) {
      return {
        ok: true, from, to, edgeId: adjacent.edge.id, reverse,
        burger, boughtNow, won: true, stalled: false,
      };
    }
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      burger, boughtNow, won: false, stalled: 'burger',
    };
  }

  if (!available(graph, to, used).length) {
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      burger, boughtNow, won: false, stalled: 'deadend',
    };
  }

  return {
    ok: true, from, to, edgeId: adjacent.edge.id, reverse,
    burger, boughtNow, won: false, stalled: false,
  };
}

export function applyMove(state: GameState, move: MoveOk): void {
  state.used.add(move.edgeId);
  state.node = move.to;
  state.burger = move.burger;
  state.won = move.won;
  state.stalled = move.stalled;
}

export function isWin(graph: Graph, state: GameState): boolean {
  return state.won === true && state.node === graph.park && state.burger === true;
}
