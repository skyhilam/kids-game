import type { NodeId, Point } from './types';
import { roadKey } from './graph';

/** Ordered stops are data, so another theme can use the same route rules. */
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
  delivered: number;
  pendingStamp: boolean;
  won: boolean;
  stalled: boolean;
}

export type RouteFailure = 'blocked' | 'not-adjacent' | 'used-road' | 'wrong-order' | 'unfinished';
export type RouteResult = { ok: true } | { ok: false; reason: RouteFailure };

export function createRouteState(mission: RouteMission): RouteState {
  return { node: mission.start, used: new Set(), delivered: 0, pendingStamp: false, won: false, stalled: false };
}

export function routeNeighbors(mission: RouteMission, node: NodeId): NodeId[] {
  return mission.edges.flatMap(([a, b]) => a === node ? [b] : b === node ? [a] : []);
}

export function checkRouteMove(mission: RouteMission, state: RouteState, to: NodeId): RouteResult {
  if (state.won || state.stalled || state.pendingStamp) return { ok: false, reason: 'blocked' };
  if (!routeNeighbors(mission, state.node).includes(to)) return { ok: false, reason: 'not-adjacent' };
  if (state.used.has(roadKey(state.node, to))) return { ok: false, reason: 'used-road' };
  const stop = mission.stops.findIndex((item) => item.node === to);
  if (stop > state.delivered) return { ok: false, reason: 'wrong-order' };
  if (to === mission.finish && state.delivered !== mission.stops.length) return { ok: false, reason: 'unfinished' };
  return { ok: true };
}

export function moveOnRoute(mission: RouteMission, state: RouteState, to: NodeId): RouteResult {
  const result = checkRouteMove(mission, state, to);
  if (!result.ok) return result;
  state.used.add(roadKey(state.node, to));
  state.node = to;
  state.pendingStamp = mission.stops[state.delivered]?.node === to;
  state.won = to === mission.finish && state.delivered === mission.stops.length;
  state.stalled = !state.won && !state.pendingStamp && isRouteDeadend(mission, state);
  return result;
}

function isRouteDeadend(mission: RouteMission, state: RouteState): boolean {
  return routeNeighbors(mission, state.node).every((to) => state.used.has(roadKey(state.node, to)));
}

/** A sticker records an actual arrival, never a tap on a distant house. */
export function stampDelivery(mission: RouteMission, state: RouteState): boolean {
  if (!state.pendingStamp || mission.stops[state.delivered]?.node !== state.node) return false;
  state.delivered += 1;
  state.pendingStamp = false;
  state.stalled = isRouteDeadend(mission, state);
  return true;
}

/** Search uses the same transitions as play, including stamping each stop. */
export function findRouteSolution(mission: RouteMission, state: RouteState): NodeId[] | null {
  const failed = new Set<string>();
  function search(current: RouteState): NodeId[] | null {
    if (current.won) return [];
    if (current.pendingStamp) stampDelivery(mission, current);
    if (current.stalled) return null;
    const key = `${current.node}/${current.delivered}/${[...current.used].sort().join(',')}`;
    if (failed.has(key)) return null;
    for (const to of routeNeighbors(mission, current.node)) {
      const next = { ...current, used: new Set(current.used) };
      if (!moveOnRoute(mission, next, to).ok) continue;
      const rest = search(next);
      if (rest) return [to, ...rest];
    }
    failed.add(key);
    return null;
  }
  return search({ ...state, used: new Set(state.used) });
}
