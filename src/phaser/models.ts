import type { RouteMission, RouteState } from '../game/routeMission';
import type { GameState, Graph, InFlightMove, Point } from '../game/types';

export type MazeTheme = 'picnic' | 'tooth';

export type MazeBoardModel = {
  kind: 'maze';
  theme: MazeTheme;
  width: number;
  height: number;
  graph: Graph;
  state: GameState;
  facing: number;
  inFlight: InFlightMove | null;
  reduceMotion: boolean;
  roads: { border: string; fill: string; inner?: string };
};

export type DeliveryHouse = {
  node: string;
  artY: number;
  stickerY: number;
};

export type DeliveryBoardModel = {
  kind: 'delivery';
  width: number;
  height: number;
  mission: RouteMission;
  state: RouteState;
  position: Point;
  angle: number;
  hint: string | null;
  mode: 'trace' | 'tap';
  enabled: boolean;
  reduceMotion: boolean;
  houses: DeliveryHouse[];
};

export type BoardModel = MazeBoardModel | DeliveryBoardModel;
