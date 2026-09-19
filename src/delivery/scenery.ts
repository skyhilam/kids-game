import type { Point } from '../game/types';
import type { RouteMission } from '../game/routeMission';

const TREE_CANDIDATES = [
  [0.12, 0.22], [0.29, 0.34], [0.48, 0.1], [0.55, 0.12], [0.72, 0.22],
  [0.88, 0.38], [0.79, 0.69], [0.18, 0.62], [0.08, 0.78], [0.62, 0.88],
] as const;

const FLOWER_CANDIDATES = [
  [0.3, 0.59], [0.56, 0.91], [0.42, 0.78], [0.7, 0.5], [0.2, 0.88],
] as const;

export function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.hypot(px - a[0], py - a[1]);
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

export function clearOfRoads(mission: RouteMission, x: number, y: number, minDist = 58): boolean {
  for (const point of Object.values(mission.nodes)) {
    if (Math.hypot(x - point[0], y - point[1]) < minDist) return false;
  }
  for (const [a, b] of mission.edges) {
    if (distToSegment(x, y, mission.nodes[a], mission.nodes[b]) < minDist) return false;
  }
  return true;
}

function pickSpots(
  mission: RouteMission,
  candidates: readonly (readonly [number, number])[],
  count: number,
  probe: readonly [number, number] = [0, 0],
): Point[] {
  const picked: Point[] = [];
  for (const [nx, ny] of candidates) {
    const x = mission.width * nx;
    const y = mission.height * ny;
    if (!clearOfRoads(mission, x + probe[0], y + probe[1])) continue;
    if (picked.some((point) => Math.hypot(point[0] - x, point[1] - y) < 90)) continue;
    picked.push([x, y]);
    if (picked.length >= count) break;
  }
  return picked;
}

export function deliveryTrees(mission: RouteMission): Point[] {
  return pickSpots(mission, TREE_CANDIDATES, 4);
}

export function deliveryFlowers(mission: RouteMission): Point[] {
  return pickSpots(mission, FLOWER_CANDIDATES, 2, [23, 20]);
}
