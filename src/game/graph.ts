import type { Edge, Graph, LevelDef, Link, NodeId, Point } from './types';

/** Undirected road id. `s-a` and `a-s` are the same road. */
export function roadKey(a: NodeId, b: NodeId): string {
  return [a, b].sort().join('-');
}

export function mapSize(narrow: boolean): { width: number; height: number } {
  return narrow ? { width: 600, height: 790 } : { width: 840, height: 660 };
}

/** Omitted keys fall back to generic maze words (出發 / 終點 / 路口). */
export type GraphLabels = {
  start?: string;
  goal?: string;
  collect?: string;
  hazard?: string;
  junction?: string;
  deadend?: string;
};

export function makeGraph(
  catalog: readonly LevelDef[],
  index: number,
  narrow = false,
  labels: GraphLabels = {},
): Graph {
  const source = catalog[index];
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
  const { start, goal } = source;
  const collect = source.collect ?? null;
  const hazards = [...(source.hazards ?? [])];
  const reserved = new Set<NodeId>([start, goal, ...hazards]);
  if (collect) reserved.add(collect);
  const deadends = Object.keys(nodes).filter(
    (id) => !reserved.has(id) && adj[id].length === 1,
  );
  const junction = labels.junction ?? '路口';
  const titles: Record<NodeId, string> = {};
  Object.keys(nodes).forEach((id) => { titles[id] = junction; });
  titles[start] = labels.start ?? '出發';
  titles[goal] = labels.goal ?? '終點';
  if (collect && collect !== start && collect !== goal) {
    titles[collect] = labels.collect ?? titles[collect];
  }
  hazards.forEach((id) => { titles[id] = labels.hazard ?? titles[id]; });
  deadends.forEach((id) => { titles[id] = labels.deadend ?? '小路盡頭'; });
  return {
    name: source.name,
    short: source.short,
    start,
    goal,
    collect,
    tutorial: !!source.tutorial,
    hazards,
    titles,
    deadends,
    nodes,
    edges,
    adj,
  };
}
