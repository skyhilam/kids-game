export type NodeId = string;
export type Point = [number, number];

export interface LevelDef {
  name: string;
  short: string;
  start: NodeId;
  goal: NodeId;
  collect?: NodeId;
  tutorial?: boolean;
  hazards?: NodeId[];
  nodes: Record<NodeId, Point>;
  edges: [NodeId, NodeId][];
}

/** A finite list, or a function that can mint the next map forever. */
export type LevelSource = readonly LevelDef[] | ((index: number) => LevelDef);

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
  short: string;
  start: NodeId;
  goal: NodeId;
  collect: NodeId | null;
  tutorial: boolean;
  hazards: NodeId[];
  titles: Record<NodeId, string>;
  deadends: NodeId[];
  nodes: Record<NodeId, Point>;
  edges: Edge[];
  adj: Record<NodeId, Link[]>;
}

export type StallReason = 'missing-collect' | 'deadend' | 'hazard';

export interface GameState {
  level: number;
  node: NodeId;
  collected: boolean;
  used: Set<string>;
  /** Node left when each undirected road was first traveled. Used only to draw the trail. */
  usedFrom: Record<string, NodeId>;
  won: boolean;
  stalled: false | StallReason;
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
  collected: boolean;
  collectedNow: boolean;
  won: boolean;
  stalled: false | StallReason;
};

export type MoveResult = MoveFail | MoveOk;

export type InFlightMove = MoveOk & {
  t: number;
  startAngle: number;
  duration: number;
};

export type Overlay =
  | { kind: 'welcome' }
  | { kind: 'help' }
  | { kind: 'rescue' }
  | { kind: 'stuck'; reason: StallReason }
  | { kind: 'win' };
