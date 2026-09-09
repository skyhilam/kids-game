import { LEVELS } from './levels';
import type { Edge, Graph, Link, NodeId, Point } from './types';

/** Undirected road id. `s-a` and `a-s` are the same road. */
export function roadKey(a: NodeId, b: NodeId): string {
  return [a, b].sort().join('-');
}

export function mapSize(narrow: boolean): { width: number; height: number } {
  return narrow ? { width: 600, height: 790 } : { width: 840, height: 660 };
}

export function makeGraph(index: number, narrow = false): Graph {
  const source = LEVELS[index];
  if (!source) throw new Error(`Unknown level ${index}`);
  const nodes: Record<NodeId, Point> = Object.fromEntries(
    Object.entries(source.nodes).map(([id, [x, y]]) => [
      id,
      narrow ? [x / 840 * 600, 150 + (y - 155) * 1.22] as Point : [x, y] as Point,
    ]),
  );
  const edges: Edge[] = source.edges.map(([a, b], i) => ({
    id: roadKey(a, b),
    a,
    b,
    index: i,
    points: [nodes[a], nodes[b]],
  }));
  const adj: Record<NodeId, Link[]> = {};
  Object.keys(nodes).forEach((n) => { adj[n] = []; });
  edges.forEach((edge) => {
    adj[edge.a].push({ edge, to: edge.b });
    adj[edge.b].push({ edge, to: edge.a });
  });
  return { name: source.name, nodes, edges, adj };
}
