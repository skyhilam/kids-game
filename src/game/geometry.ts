import type { Point } from './types';

export type Segment = readonly [Point, Point];

export function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - a[0], py - a[1]);
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

/** FNV-1a over canonical rounded geometry, independent of node/edge order or direction. */
export function mapKey(points: readonly Point[], segments: readonly Segment[]): number {
  const coordinate = (p: Point) => `${Math.round(p[0])},${Math.round(p[1])}`;
  const canonical = JSON.stringify([
    points.map(coordinate).sort(),
    segments.map(([a, b]) => [coordinate(a), coordinate(b)].sort().join(':')).sort(),
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = Math.imul(hash ^ canonical.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}
