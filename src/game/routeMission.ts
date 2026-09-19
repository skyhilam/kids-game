import type { NodeId, Point } from './types';
import { roadKey } from './graph';

/** Ordered stop labels are names on the map; delivery no longer requires that visit order. */
export interface RouteMission {
  name: string;
  width: number;
  height: number;
  start: NodeId;
  finish: NodeId;
  stops: { node: NodeId; label: string }[];
  nodes: Record<NodeId, Point>;
  edges: [NodeId, NodeId][];
}

export interface RouteState {
  node: NodeId;
  used: Set<string>;
  done: Set<NodeId>;
  delivered: number;
  won: boolean;
  stalled: boolean;
}

export type RouteFailure = 'blocked' | 'not-adjacent' | 'unfinished';
export type RouteResult = { ok: true } | { ok: false; reason: RouteFailure };

export function createRouteState(mission: RouteMission): RouteState {
  return { node: mission.start, used: new Set(), done: new Set(), delivered: 0, won: false, stalled: false };
}

export function routeNeighbors(mission: RouteMission, node: NodeId): NodeId[] {
  return mission.edges.flatMap(([a, b]) => a === node ? [b] : b === node ? [a] : []);
}

export function checkRouteMove(mission: RouteMission, state: RouteState, to: NodeId): RouteResult {
  if (state.won || state.stalled) return { ok: false, reason: 'blocked' };
  if (!routeNeighbors(mission, state.node).includes(to)) return { ok: false, reason: 'not-adjacent' };
  if (to === mission.finish && state.done.size !== mission.stops.length) return { ok: false, reason: 'unfinished' };
  return { ok: true };
}

export function moveOnRoute(mission: RouteMission, state: RouteState, to: NodeId): RouteResult {
  const result = checkRouteMove(mission, state, to);
  if (!result.ok) return result;
  state.used.add(roadKey(state.node, to));
  state.node = to;
  if (mission.stops.some((stop) => stop.node === to)) state.done.add(to);
  state.delivered = state.done.size;
  state.won = to === mission.finish && state.done.size === mission.stops.length;
  state.stalled = false;
  return result;
}

function clonePlay(state: RouteState): RouteState {
  return {
    ...state,
    used: new Set(state.used),
    done: new Set(state.done),
  };
}

/** Shortest hop path to deliver remaining houses, then finish. Roads may be reused. */
export function findRouteSolution(mission: RouteMission, state: RouteState): NodeId[] | null {
  if (state.won) return [];
  const seen = new Set<string>();
  const queue: { play: RouteState; path: NodeId[] }[] = [{ play: clonePlay(state), path: [] }];
  while (queue.length) {
    const { play, path } = queue.shift()!;
    const key = `${play.node}/${[...play.done].sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (play.won) return path;
    for (const to of routeNeighbors(mission, play.node)) {
      const next = clonePlay(play);
      if (!moveOnRoute(mission, next, to).ok) continue;
      queue.push({ play: next, path: [...path, to] });
    }
  }
  return null;
}
