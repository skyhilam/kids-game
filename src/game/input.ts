import { available } from './rules';
import type { Graph, NodeId, Point } from './types';

export function bestNeighbor(
  graph: Graph,
  from: NodeId,
  used: Set<string>,
  vector: readonly [number, number],
): { to: NodeId; score: number } | undefined {
  const [vx, vy] = vector;
  const mag = Math.hypot(vx, vy);
  if (mag === 0) return undefined;
  const origin = graph.nodes[from];
  const [x, y] = origin;
  return available(graph, from, used)
    .map((link) => {
      const [nx, ny] = graph.nodes[link.to];
      const dx = nx - x;
      const dy = ny - y;
      const len = Math.hypot(dx, dy);
      return { to: link.to, score: len === 0 ? 0 : (dx * vx + dy * vy) / (len * mag) };
    })
    .sort((a, b) => b.score - a.score)[0];
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
