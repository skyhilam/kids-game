import { makeGraph } from './graph';
import { LEVELS } from './levels';
import type { GameState, Graph, Link, MoveResult, NodeId } from './types';

export { LEVELS } from './levels';
export { makeGraph, roadKey, mapSize } from './graph';
export type { GameState, Graph, Link, MoveResult, NodeId } from './types';

export function createGame(levelIndex = 0, narrow = false): { graph: Graph; state: GameState } {
  const level = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
  return {
    graph: makeGraph(level, narrow),
    state: {
      level,
      node: 's',
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
    if (n === 'p') return hasBurger ? [] : null;
    const key = `${n}/${hasBurger ? 1 : 0}/${mask}`;
    if (failed.has(key)) return null;
    for (const link of graph.adj[n]) {
      const bit = 1 << link.edge.index;
      if (mask & bit) continue;
      const result = search(link.to, hasBurger || link.to === 'h', mask | bit);
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
  state.used.add(adjacent.edge.id);
  state.node = to;
  let boughtNow = false;
  if (to === 'h' && !state.burger) {
    state.burger = true;
    boughtNow = true;
  }

  if (to === 'p') {
    if (state.burger) {
      state.won = true;
      return {
        ok: true, from, to, edgeId: adjacent.edge.id, reverse,
        burger: true, boughtNow, won: true, stalled: false,
      };
    }
    state.stalled = 'burger';
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      burger: state.burger, boughtNow, won: false, stalled: 'burger',
    };
  }

  if (!available(graph, state.node, state.used).length) {
    state.stalled = 'deadend';
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      burger: state.burger, boughtNow, won: false, stalled: 'deadend',
    };
  }

  return {
    ok: true, from, to, edgeId: adjacent.edge.id, reverse,
    burger: state.burger, boughtNow, won: false, stalled: false,
  };
}

export function isWin(state: GameState): boolean {
  return state.won === true && state.node === 'p' && state.burger === true;
}
