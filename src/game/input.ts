import { available } from './rules';
import type { Graph, NodeId, Point } from './types';

export function bestByVector<T>(
  origin: Point,
  candidates: readonly { to: T; point: Point }[],
  vector: readonly [number, number],
): { to: T; score: number } | undefined {
  const [vx, vy] = vector;
  const mag = Math.hypot(vx, vy);
  if (mag === 0) return undefined;
  const [x, y] = origin;
  return candidates
    .map((item) => {
      const [nx, ny] = item.point;
      const dx = nx - x;
      const dy = ny - y;
      const len = Math.hypot(dx, dy);
      return { to: item.to, score: len === 0 ? 0 : (dx * vx + dy * vy) / (len * mag) };
    })
    .sort((a, b) => b.score - a.score)[0];
}

export function bestNeighbor(
  graph: Graph,
  from: NodeId,
  used: Set<string>,
  vector: readonly [number, number],
): { to: NodeId; score: number } | undefined {
  return bestByVector(
    graph.nodes[from],
    available(graph, from, used).map((link) => ({
      to: link.to,
      point: graph.nodes[link.to],
    })),
    vector,
  );
}

export function nearestNeighbor(
  graph: Graph,
  from: NodeId,
  used: Set<string>,
  point: Point,
  scale: Point,
): { to: NodeId; d: number } | undefined {
  return available(graph, from, used)
    .map((link) => {
      const [nx, ny] = graph.nodes[link.to];
      return {
        to: link.to,
        d: Math.hypot((nx - point[0]) * scale[0], (ny - point[1]) * scale[1]),
      };
    })
    .sort((a, b) => a.d - b.d)[0];
}
