import type { Edge, NodeId, Point } from './types';

/** Ends of a used road in the order it was traveled. Missing `from` keeps stored orientation. */
export function traveledEnds(edge: Pick<Edge, 'a' | 'b'>, from?: NodeId): [NodeId, NodeId] {
  if (from === edge.b) return [edge.b, edge.a];
  return [edge.a, edge.b];
}

/** SVG path for a used road, drawn in the direction it was traveled. */
export function traveledPath(
  nodes: Record<NodeId, Point>,
  edge: Pick<Edge, 'a' | 'b'>,
  from?: NodeId,
): string {
  const [a, b] = traveledEnds(edge, from);
  const pa = nodes[a];
  const pb = nodes[b];
  return `M${pa[0]},${pa[1]} L${pb[0]},${pb[1]}`;
}
