import { isLevelFn, makeGraph, type GraphLabels } from './graph';
import type { GameState, Graph, LevelSource, Link, MoveOk, MoveResult, NodeId } from './types';

export { isLevelFn, levelAt, makeGraph, roadKey, mapSize } from './graph';
export type { GraphLabels } from './graph';
export type { GameState, Graph, LevelSource, Link, MoveResult, NodeId, StallReason } from './types';

export function createGame(
  catalog: LevelSource,
  levelIndex = 0,
  narrow = false,
  labels: GraphLabels = {},
): { graph: Graph; state: GameState } {
  const level = isLevelFn(catalog)
    ? Math.max(0, Math.floor(levelIndex))
    : Math.max(0, Math.min(levelIndex, catalog.length - 1));
  const graph = makeGraph(catalog, level, narrow, labels);
  return {
    graph,
    state: {
      level,
      node: graph.start,
      collected: graph.collect === null,
      used: new Set(),
      usedFrom: {},
      won: false,
      stalled: false,
    },
  };
}

export function available(graph: Graph, node: NodeId, used: Set<string>): Link[] {
  return (graph.adj[node] ?? []).filter((x) => !used.has(x.edge.id));
}

/**
 * Exhaustive search over this small graph. It never recommends a reused road
 * or a hazard, and reaching the goal without the collectible is not a solution.
 */
export function findSolution(
  graph: Graph,
  node: NodeId,
  collected: boolean,
  used: Set<string>,
): NodeId[] | null {
  const failed = new Set<string>();
  const search = (n: NodeId, hasCollect: boolean, mask: number): NodeId[] | null => {
    if (n === graph.goal) return hasCollect ? [] : null;
    const key = `${n}/${hasCollect ? 1 : 0}/${mask}`;
    if (failed.has(key)) return null;
    for (const link of graph.adj[n]) {
      const bit = 1 << link.edge.index;
      if (mask & bit) continue;
      if (graph.hazards.includes(link.to)) continue;
      const nextCollect = hasCollect || (graph.collect !== null && link.to === graph.collect);
      const result = search(link.to, nextCollect, mask | bit);
      if (result !== null) return [link.to, ...result];
    }
    failed.add(key);
    return null;
  };
  let mask = 0;
  graph.edges.forEach((e) => {
    if (used.has(e.id)) mask |= 1 << e.index;
  });
  return search(node, collected, mask);
}

export function tryMove(graph: Graph, state: GameState, to: NodeId): MoveResult {
  if (state.won || state.stalled) return { ok: false, reason: 'blocked' };
  const neighbors = graph.adj[state.node] ?? [];
  const adjacent = neighbors.find((x) => x.to === to);
  if (!adjacent) return { ok: false, reason: 'not-adjacent' };
  if (state.used.has(adjacent.edge.id)) return { ok: false, reason: 'used-road' };

  const from = state.node;
  const reverse = adjacent.edge.a !== from;
  const collectedNow = graph.collect !== null && to === graph.collect && !state.collected;
  const collected = state.collected || collectedNow;
  const used = new Set(state.used);
  used.add(adjacent.edge.id);

  if (graph.hazards.includes(to)) {
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      collected, collectedNow, won: false, stalled: 'hazard',
    };
  }

  if (to === graph.goal) {
    if (collected) {
      return {
        ok: true, from, to, edgeId: adjacent.edge.id, reverse,
        collected, collectedNow, won: true, stalled: false,
      };
    }
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      collected, collectedNow, won: false, stalled: 'missing-collect',
    };
  }

  if (!available(graph, to, used).length) {
    return {
      ok: true, from, to, edgeId: adjacent.edge.id, reverse,
      collected, collectedNow, won: false, stalled: 'deadend',
    };
  }

  return {
    ok: true, from, to, edgeId: adjacent.edge.id, reverse,
    collected, collectedNow, won: false, stalled: false,
  };
}

export function applyMove(state: GameState, move: MoveOk): void {
  state.used.add(move.edgeId);
  state.usedFrom[move.edgeId] = move.from;
  state.node = move.to;
  state.collected = move.collected;
  state.won = move.won;
  state.stalled = move.stalled;
}

export function isWin(graph: Graph, state: GameState): boolean {
  return state.won === true && state.node === graph.goal && state.collected === true;
}
