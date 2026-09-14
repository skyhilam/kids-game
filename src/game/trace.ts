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

/** How close the truck must be to the far junction before the road locks. */
export function arrivalRadius(tolerance: number): number {
  return Math.max(16, Math.min(24, tolerance * 0.8));
}

/** Extra room at L/T corners so a finger can cut the apex without going off-road. */
export function junctionSlack(tolerance: number): number {
  return Math.max(tolerance * 2, 44);
}

export function junctionReach(tolerance: number): number {
  return junctionSlack(tolerance) * 2;
}

/** Finger must leave the junction this far before a road is chosen. */
export function continueAlong(tolerance: number): number {
  return Math.max(16, tolerance * 0.6);
}

function alongSegment(from: Point, to: Point, t: number): number {
  return t * Math.hypot(to[0] - from[0], to[1] - from[1]);
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

/** Prefer the arm the finger is heading toward, not whichever is a few pixels closer. */
export function pickHeadingRoad(
  pointer: Point,
  origin: Point,
  roads: readonly { to: string; point: Point }[],
  slack: number,
  minAlong: number,
): { to: string; t: number; distance: number; point: Point } | undefined {
  const vx = pointer[0] - origin[0];
  const vy = pointer[1] - origin[1];
  const away = Math.hypot(vx, vy);
  if (away < minAlong) return undefined;
  let best: { to: string; t: number; distance: number; point: Point; score: number } | undefined;
  for (const road of roads) {
    const rx = road.point[0] - origin[0];
    const ry = road.point[1] - origin[1];
    const rlen = Math.hypot(rx, ry) || 1;
    const dirDot = (vx * rx + vy * ry) / (away * rlen);
    if (dirDot < 0.42) continue;
    const proj = projectToRoad(pointer, origin, road.point);
    if (proj.distance > slack) continue;
    const along = alongSegment(origin, road.point, proj.t);
    if (along < minAlong * 0.4) continue;
    const score = dirDot * 100 - proj.distance + Math.min(along, 48) * 0.25;
    if (!best || score > best.score) best = { to: road.to, ...proj, score };
  }
  return best;
}

function roadPoints(
  from: string,
  nodes: Record<string, Point>,
  exits: (from: string) => string[],
): { to: string; point: Point }[] {
  return exits(from).map((to) => ({ to, point: nodes[to] }));
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
  const hit = pickHeadingRoad(pointer, junction, nextRoads, slack, continueAlong(tolerance) * 0.7);
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
  const t = projected.t < trace.t ? projected.t : Math.min(projected.t, trace.t + 0.55);
  const point: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const progressed = alongSegment(from, to, trace.t);
  const arrived = t >= 0.78
    && progressed >= Math.min(48, length * 0.4)
    && Math.hypot(point[0] - to[0], point[1] - to[1]) <= arrivalRadius(tolerance);
  return { trace: { ...trace, t, recovering: false }, point, arrived, offRoad: false };
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
  /** Stay put near the current node until the finger chooses a heading. */
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
 * Advance one pointer sample along the route. Uncommitted ink can rewind.
 * After a junction, the finger must head along an arm before the next road attaches.
 */
export function followRouteStroke(input: RouteStrokeInput): RouteStrokeResult {
  let { trace, needsReturn, node } = input;
  const arrivals: string[] = [];
  const slack = junctionSlack(input.tolerance);
  const minAlong = Math.max(input.settle, continueAlong(input.tolerance));
  const detach = Math.max(10, input.tolerance * 0.4);

  for (let hop = 0; hop < 8; hop += 1) {
    const from = input.nodes[node];
    if (!trace) {
      const roads = roadPoints(node, input.nodes, input.exits);
      const open = roads.filter((road) => input.canEnter(node, road.to));
      const nearby = pickHeadingRoad(input.pointer, from, open, slack, minAlong);
      const away = Math.hypot(input.pointer[0] - from[0], input.pointer[1] - from[1]);
      if (needsReturn && !nearby && away > input.tolerance) {
        return { trace: null, needsReturn: true, arrivals, offRoad: true };
      }
      if (!nearby) {
        if (away <= slack) {
          const blocked = pickHeadingRoad(input.pointer, from, roads, slack, minAlong);
          if (blocked && !input.canEnter(node, blocked.to)) {
            return { trace: null, needsReturn: false, arrivals, offRoad: false, blockedTo: blocked.to };
          }
          return { trace: null, needsReturn: false, arrivals, offRoad: false };
        }
        return { trace: null, needsReturn: true, arrivals, offRoad: true };
      }
      needsReturn = false;
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
        needsReturn = false;
        if (input.shouldContinue && !input.shouldContinue()) {
          return { trace: null, needsReturn: false, arrivals, offRoad: false };
        }
        continue;
      }
      return { trace: result.trace, needsReturn: true, arrivals, offRoad: true };
    }

    if (!result.arrived && alongSegment(from, dest, result.trace.t) <= detach) {
      return { trace: null, needsReturn: false, arrivals, offRoad: false };
    }

    trace = result.trace;
    if (!result.arrived) return { trace, needsReturn: false, arrivals, offRoad: false };

    arrivals.push(trace.to);
    input.onArrive?.(trace.to);
    node = trace.to;
    trace = null;
    needsReturn = false;
    if (input.shouldContinue && !input.shouldContinue()) {
      return { trace: null, needsReturn: false, arrivals, offRoad: false };
    }
  }

  return { trace, needsReturn, arrivals, offRoad: false };
}
