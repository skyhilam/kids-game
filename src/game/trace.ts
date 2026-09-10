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
    arrived: Math.hypot(point[0] - to[0], point[1] - to[1]) <= Math.min(12, tolerance / 2),
    offRoad: false,
  };
}
