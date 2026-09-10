import type { Graph, InFlightMove, NodeId, Point } from './types';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function heading(from: Point, to: Point): number {
  return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
}

export function moveDuration(length: number, reduceMotion: boolean): number {
  return reduceMotion ? 80 : clamp(length * 3, 650, 1080);
}

export function carPose(
  graph: Graph,
  node: NodeId,
  facing: number,
  flight: InFlightMove | null,
): { x: number; y: number; angle: number } {
  if (!flight) {
    const [x, y] = graph.nodes[node];
    return { x, y, angle: facing };
  }
  const a = graph.nodes[flight.from];
  const b = graph.nodes[flight.to];
  const e = easeInOut(flight.t);
  const target = heading(a, b);
  const delta = ((target - flight.startAngle + 540) % 360) - 180;
  return {
    x: a[0] + (b[0] - a[0]) * e,
    y: a[1] + (b[1] - a[1]) * e,
    angle: flight.startAngle + delta * Math.min(flight.t * 4, 1),
  };
}
