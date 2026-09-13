import type { NodeId, Point } from './types';

/** SVG stroke widths for shared maze road layers. */
export const ROAD_BORDER_WIDTH = 72;
export const ROAD_FILL_WIDTH = 65;
export const ROAD_INNER_WIDTH = 48;
export const ROAD_USED_WIDTH = 18;

export const ROAD_BORDER_RADIUS = ROAD_BORDER_WIDTH / 2;
export const ROAD_FILL_RADIUS = ROAD_FILL_WIDTH / 2;
export const ROAD_INNER_RADIUS = ROAD_INNER_WIDTH / 2;
export const ROAD_USED_RADIUS = ROAD_USED_WIDTH / 2;

const AXIS_EPS = 1e-9;

/** Straight SVG path between two nodes. */
export function edgePath(a: Point, b: Point): string {
  return `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
}

/**
 * Draw left→right, else up→down, so dash phase can follow world position
 * instead of whichever way the undirected edge was stored.
 */
export function canonicalEnds(a: Point, b: Point): [Point, Point] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx < -AXIS_EPS || (Math.abs(dx) <= AXIS_EPS && dy < 0)) return [b, a];
  return [a, b];
}

/** Centerline path in canonical direction so collinear dashes share a phase. */
export function centerPath(a: Point, b: Point): string {
  const [from, to] = canonicalEnds(a, b);
  return edgePath(from, to);
}

/** Dash offset that makes pattern position equal projection on the canonical axis. */
export function centerDashOffset(a: Point, b: Point): number {
  const [from, to] = canonicalEnds(a, b);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < AXIS_EPS) return 0;
  return (from[0] * dx + from[1] * dy) / len;
}

/** Unique node ids that appear on any of the given edges, in first-seen order. */
export function jointIds(edges: ReadonlyArray<{ a: NodeId; b: NodeId }>): NodeId[] {
  const ids: NodeId[] = [];
  const seen = new Set<NodeId>();
  for (const edge of edges) {
    for (const id of [edge.a, edge.b]) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
