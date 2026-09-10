import type { Graph, NodeId } from '../game/types';

export function picnicCollect(graph: Graph): NodeId {
  if (!graph.collect) throw new Error('PicnicBoard requires graph.collect');
  return graph.collect;
}
