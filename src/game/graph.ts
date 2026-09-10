import { LEVELS } from './levels';
import type { Edge, Graph, Link, NodeId, Point } from './types';

/** Undirected road id. `s-a` and `a-s` are the same road. */
export function roadKey(a: NodeId, b: NodeId): string {
  return [a, b].sort().join('-');
}

export function mapSize(narrow: boolean): { width: number; height: number } {
  return narrow ? { width: 600, height: 790 } : { width: 840, height: 660 };
}

/** Shop sprite sits above the node; clamp so a top-rail shop stays in the viewBox. */
export const SHOP_ART = { width: 164, height: 135, dx: 82, dy: 165 } as const;

export function shopArtOrigin(shop: Point): Point {
  return [shop[0] - SHOP_ART.dx, Math.max(0, shop[1] - SHOP_ART.dy)];
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
  const { start, shop, park } = source;
  const deadends = Object.keys(nodes).filter(
    (id) => id !== start && id !== shop && id !== park && adj[id].length === 1,
  );
  const titles: Record<NodeId, string> = {};
  Object.keys(nodes).forEach((id) => { titles[id] = '路口'; });
  titles[start] = '出發';
  titles[shop] = '漢堡店';
  titles[park] = '公園';
  deadends.forEach((id) => { titles[id] = '小路盡頭'; });
  return {
    name: source.name,
    short: source.short,
    start,
    shop,
    park,
    tutorial: !!source.tutorial,
    titles,
    deadends,
    nodes,
    edges,
    adj,
  };
}
