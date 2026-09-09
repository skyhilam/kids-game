export type NodeId = string;
export type Point = [number, number];

export interface LevelDef {
  name: string;
  nodes: Record<NodeId, Point>;
  edges: [NodeId, NodeId][];
}

export interface Edge {
  id: string;
  a: NodeId;
  b: NodeId;
  index: number;
  points: [Point, Point];
}

export interface Link {
  edge: Edge;
  to: NodeId;
}

export interface Graph {
  name: string;
  nodes: Record<NodeId, Point>;
  edges: Edge[];
  adj: Record<NodeId, Link[]>;
}

export interface GameState {
  level: number;
  node: NodeId;
  burger: boolean;
  used: Set<string>;
  won: boolean;
  stalled: false | 'burger' | 'deadend';
}

export type MoveFail = {
  ok: false;
  reason: 'used-road' | 'not-adjacent' | 'blocked';
};

export type MoveOk = {
  ok: true;
  from: NodeId;
  to: NodeId;
  edgeId: string;
  reverse: boolean;
  burger: boolean;
  boughtNow: boolean;
  won: boolean;
  stalled: false | 'burger' | 'deadend';
};

export type MoveResult = MoveFail | MoveOk;
