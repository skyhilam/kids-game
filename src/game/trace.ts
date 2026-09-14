import type { Point } from './types';

export function projectToRoad(point: Point, from: Point, to: Point): { t: number; distance: number; point: Point } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / length2)) : 0;
  const projected: Point = [from[0] + t * dx, from[1] + t * dy];
  return { t, distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]), point: projected };
}

export interface RoadTrace { to: string; t: number; recovering: boolean }

/** Straight-road corridor. Junctions use the wider slack below. */
export function arrivalRadius(tolerance: number): number {
  return Math.max(22, Math.min(36, tolerance * 1.15));
}

/** Extra room at L/T corners so a finger can cut the apex without going off-road. */
export function junctionSlack(tolerance: number): number {
  return Math.max(tolerance * 1.8, 38);
}

export function junctionReach(tolerance: number): number {
  return junctionSlack(tolerance) * 2;
}

export function pickNearestRoad(
  pointer: Point,
  origin: Point,
  roads: readonly { to: string; point: Point }[],
  maxDistance: number,
  minT = 1e-6,
): { to: string; t: number; distance: number; point: Point } | undefined {
  return roads
    .map((road) => ({ to: road.to, ...projectToRoad(pointer, origin, road.point) }))
    .filter((item) => item.t > minT && item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0];
}

function roadPoints(
  from: string,
  nodes: Record<string, Point>,
  exits: (from: string) => string[],
): { to: string; point: Point }[] {
  return exits(from).map((to) => ({ to, point: nodes[to] }));
}

function alongSegment(from: Point, to: Point, t: number): number {
  return t * Math.hypot(to[0] - from[0], to[1] - from[1]);
}

function cutCornerHit(
  pointer: Point,
  junction: Point,
  nextRoads: readonly { to: string; point: Point }[],
  tolerance: number,
): { to: string; t: number; distance: number; point: Point } | undefined {
  const slack = junctionSlack(tolerance);
  const reach = junctionReach(tolerance);
  if (Math.hypot(pointer[0] - junction[0], pointer[1] - junction[1]) > reach) return undefined;
  const hit = pickNearestRoad(pointer, junction, nextRoads, slack);
  if (!hit) return undefined;
  if (alongSegment(junction, nextRoads.find((road) => road.to === hit.to)!.point, hit.t) > reach) return undefined;
  return hit;
}

/** Off-road excursions must return to the last valid position before continuing. */
export function traceAlongRoad(trace: RoadTrace, pointer: Point, from: Point, to: Point, tolerance: number): {
  trace: RoadTrace; point: Point; arrived: boolean; offRoad: boolean;
} {
  const previous: Point = [from[0] + (to[0] - from[0]) * trace.t, from[1] + (to[1] - from[1]) * trace.t];
  const projected = projectToRoad(pointer, from, to);
  const away = projected.distance > tolerance
    || (trace.recovering && Math.hypot(pointer[0] - previous[0], pointer[1] - previous[1]) > tolerance);
  if (away) return { trace: { ...trace, recovering: true }, point: previous, arrived: false, offRoad: true };
  // Ink never retreats along a partially drawn road.
  const t = Math.max(trace.t, projected.t);
  const point: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  return {
    trace: { ...trace, t, recovering: false }, point,
    arrived: Math.hypot(point[0] - to[0], point[1] - to[1]) <= arrivalRadius(tolerance),
    offRoad: false,
  };
}

export interface RouteStrokeInput {
  pointer: Point;
  trace: RoadTrace | null;
  needsReturn: boolean;
  node: string;
  nodes: Record<string, Point>;
  exits: (from: string) => string[];
  canEnter: (from: string, to: string) => boolean;
  tolerance: number;
  /** Stay put near the current node until the finger chooses a heading. 0 after a same-stroke arrival. */
  settle: number;
  onArrive?: (to: string) => void;
  shouldContinue?: () => boolean;
}

export interface RouteStrokeResult {
  trace: RoadTrace | null;
  needsReturn: boolean;
  arrivals: string[];
  offRoad: boolean;
  blockedTo?: string;
}

/**
 * Advance one pointer sample along the route. After a junction arrival, the same
 * sample can attach to the next unused edge so an L/T corner stays one stroke.
 */
export function followRouteStroke(input: RouteStrokeInput): RouteStrokeResult {
  let { trace, needsReturn, node } = input;
  const arrivals: string[] = [];
  let settle = input.settle;
  const slack = junctionSlack(input.tolerance);

  for (let hop = 0; hop < 8; hop += 1) {
    const from = input.nodes[node];
    if (!trace) {
      const hits = roadPoints(node, input.nodes, input.exits)
        .map((road) => ({ to: road.to, ...projectToRoad(input.pointer, from, road.point) }))
        .filter((item) => item.t > 1e-6 && item.distance <= slack)
        .sort((a, b) => a.distance - b.distance);
      const nearby = hits.find((item) => input.canEnter(node, item.to));
      const away = Math.hypot(input.pointer[0] - from[0], input.pointer[1] - from[1]);
      if (needsReturn && !nearby && away > input.tolerance) {
        return { trace: null, needsReturn: true, arrivals, offRoad: true };
      }
      if (!nearby) {
        if (away <= slack) {
          if (hits[0] && away > slack * 0.55) {
            return { trace: null, needsReturn: false, arrivals, offRoad: false, blockedTo: hits[0].to };
          }
          return { trace: null, needsReturn: false, arrivals, offRoad: false };
        }
        return { trace: null, needsReturn: true, arrivals, offRoad: true };
      }
      if (away < settle) {
        return { trace: null, needsReturn: false, arrivals, offRoad: false };
      }
      needsReturn = false;
      settle = 0;
      trace = { to: nearby.to, t: 0, recovering: false };
    }

    const dest = input.nodes[trace.to];
    const result = traceAlongRoad(trace, input.pointer, from, dest, input.tolerance);
    if (result.offRoad) {
      const nextRoads = roadPoints(trace.to, input.nodes, input.exits).filter((road) => road.to !== node);
      if (cutCornerHit(input.pointer, dest, nextRoads, input.tolerance)) {
        arrivals.push(trace.to);
        input.onArrive?.(trace.to);
        node = trace.to;
        trace = null;
        settle = 0;
        needsReturn = false;
        if (input.shouldContinue && !input.shouldContinue()) {
          return { trace: null, needsReturn: false, arrivals, offRoad: false };
        }
        continue;
      }
      return { trace: result.trace, needsReturn: true, arrivals, offRoad: true };
    }

    trace = result.trace;
    if (!result.arrived) return { trace, needsReturn: false, arrivals, offRoad: false };

    arrivals.push(trace.to);
    input.onArrive?.(trace.to);
    node = trace.to;
    trace = null;
    settle = 0;
    needsReturn = false;
    if (input.shouldContinue && !input.shouldContinue()) {
      return { trace: null, needsReturn: false, arrivals, offRoad: false };
    }
  }

  return { trace, needsReturn, arrivals, offRoad: false };
}
