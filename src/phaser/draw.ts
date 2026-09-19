import Phaser from 'phaser';
import {
  ROAD_BORDER_RADIUS,
  ROAD_BORDER_WIDTH,
  ROAD_CENTER_DASH,
  ROAD_CENTER_GAP,
  ROAD_FILL_RADIUS,
  ROAD_FILL_WIDTH,
  ROAD_INNER_RADIUS,
  ROAD_INNER_WIDTH,
  ROAD_USED_INNER_DASH,
  ROAD_USED_INNER_GAP,
  ROAD_USED_RADIUS,
  ROAD_USED_WIDTH,
  dashedSegments,
  jointIds,
} from '../game/roads';
import { easeInOut } from '../game/motion';
import { traveledEnds } from '../game/trail';
import type { GameState, Graph, InFlightMove, NodeId, Point } from '../game/types';
import type { RouteMission } from '../game/routeMission';
import { rgb } from './textures';

type G = Phaser.GameObjects.Graphics;

function nodeAt(graph: Graph, id: NodeId): Point {
  return graph.nodes[id];
}

function strokeLine(g: G, width: number, color: string, a: Point, b: Point): void {
  g.lineStyle(width, rgb(color), 1);
  g.lineBetween(a[0], a[1], b[0], b[1]);
}

function fillDots(g: G, color: string, radius: number, points: Point[]): void {
  g.fillStyle(rgb(color), 1);
  for (const [x, y] of points) g.fillCircle(x, y, radius);
}

export function drawMazeRoads(
  g: G,
  graph: Graph,
  colors: { border: string; fill: string; inner?: string; center?: string },
): void {
  g.clear();
  const joints = jointIds(graph.edges).map((id) => nodeAt(graph, id));
  for (const edge of graph.edges) strokeLine(g, ROAD_BORDER_WIDTH, colors.border, graph.nodes[edge.a], graph.nodes[edge.b]);
  fillDots(g, colors.border, ROAD_BORDER_RADIUS, joints);
  for (const edge of graph.edges) strokeLine(g, ROAD_FILL_WIDTH, colors.fill, graph.nodes[edge.a], graph.nodes[edge.b]);
  fillDots(g, colors.fill, ROAD_FILL_RADIUS, joints);
  if (colors.inner) {
    for (const edge of graph.edges) strokeLine(g, ROAD_INNER_WIDTH, colors.inner, graph.nodes[edge.a], graph.nodes[edge.b]);
    fillDots(g, colors.inner, ROAD_INNER_RADIUS, joints);
  }
  const center = colors.center ?? '#fff9e8';
  g.lineStyle(3, rgb(center), colors.center ? 0.7 : 0.9);
  for (const edge of graph.edges) {
    for (const [from, to] of dashedSegments(graph.nodes[edge.a], graph.nodes[edge.b], ROAD_CENTER_DASH, ROAD_CENTER_GAP)) {
      g.lineBetween(from[0], from[1], to[0], to[1]);
    }
  }
}

export function drawMazeTrails(
  g: G,
  graph: Graph,
  state: GameState,
  inFlight: InFlightMove | null,
): void {
  g.clear();
  const used = graph.edges.filter((edge) => state.used.has(edge.id));
  g.lineStyle(ROAD_USED_WIDTH, rgb('#e6a557'), 1);
  for (const edge of used) {
    const [a, b] = traveledEnds(edge, state.usedFrom[edge.id]);
    const pa = graph.nodes[a];
    const pb = graph.nodes[b];
    g.lineBetween(pa[0], pa[1], pb[0], pb[1]);
  }
  g.lineStyle(5, rgb('#f8d498'), 1);
  for (const edge of used) {
    const [a, b] = traveledEnds(edge, state.usedFrom[edge.id]);
    for (const [from, to] of dashedSegments(graph.nodes[a], graph.nodes[b], ROAD_USED_INNER_DASH, ROAD_USED_INNER_GAP, 0)) {
      g.lineBetween(from[0], from[1], to[0], to[1]);
    }
  }
  fillDots(g, '#e6a557', ROAD_USED_RADIUS, jointIds(used).map((id) => nodeAt(graph, id)));
  if (!inFlight || inFlight.t >= 1) return;
  const edge = graph.edges.find((item) => item.id === inFlight.edgeId);
  if (!edge) return;
  const [a, b] = traveledEnds(edge, inFlight.from);
  const pa = graph.nodes[a];
  const pb = graph.nodes[b];
  const t = easeInOut(inFlight.t);
  g.lineStyle(ROAD_USED_WIDTH, rgb('#e6a557'), 1);
  g.lineBetween(pa[0], pa[1], pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t);
}

function quad(start: Point, control: Point, end: Point, steps = 18): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push(new Phaser.Math.Vector2(
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ));
  }
  return points;
}

export function drawPicnicScenery(g: G, width: number, height: number): void {
  g.clear();
  g.fillStyle(rgb('#e4edd4'), 1);
  g.fillRect(0, 0, width, height);
  const sx = width / 840;
  const sy = height / 660;
  const p = (x: number, y: number): Point => [x * sx, y * sy];
  g.fillStyle(rgb('#d9e6c5'), 1);
  g.fillPoints([
    new Phaser.Math.Vector2(0, 0),
    ...quad(p(0, 20), p(179, -25), p(358, 60)),
    ...quad(p(358, 60), p(537, 145), p(840, 55)).slice(1),
    new Phaser.Math.Vector2(width, 0),
  ], true);
  g.fillStyle(rgb('#dce8c9'), 1);
  g.fillPoints([
    new Phaser.Math.Vector2(0, height),
    ...quad(p(0, 517), p(135, 423), p(271, 546)),
    ...quad(p(271, 546), p(407, 669), p(584, 535)).slice(1),
    ...quad(p(584, 535), p(740, 497), p(840, 497)).slice(1),
    new Phaser.Math.Vector2(width, height),
  ], true);
  g.fillStyle(rgb('#b7d7d1'), 1);
  g.fillEllipse(width * 0.97, height * 0.86, width * 0.44, height * 0.44);
  g.fillStyle(rgb('#f8faed'), 0.85);
  g.fillEllipse(width * 0.32, height * 0.1, 96 * sx, 32 * sy);
  g.fillEllipse(width * 0.6, height * 0.11, 72 * sx, 24 * sy);
  g.fillStyle(rgb('#b5c98c'), 1);
  g.fillEllipse(65 * sx, 436 * sy, 36 * sx, 20 * sy);
  g.fillEllipse(82 * sx, 432 * sy, 32 * sx, 26 * sy);
  g.fillEllipse(98 * sx, 438 * sy, 28 * sx, 16 * sy);
}

export function drawToothScenery(g: G, width: number, height: number): void {
  g.clear();
  g.fillStyle(rgb('#e7f2ee'), 1);
  g.fillRect(0, 0, width, height);
  g.lineStyle(1.5, rgb('#d5e6e1'), 1);
  for (let x = 0; x <= width; x += 48 * width / 840) g.lineBetween(x, 0, x, height);
  for (let y = 0; y <= height; y += 48 * height / 660) g.lineBetween(0, y, width, y);
  g.fillStyle(rgb('#d4ebe6'), 1);
  g.fillRect(0, 0, width, 48 * height / 660);
  g.fillStyle(rgb('#dceee9'), 1);
  g.fillRect(0, height - 90 * height / 660, width, 90 * height / 660);
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(width * 0.9, height * 0.12, 28 * width / 840);
  g.fillCircle(width * 0.09, height * 0.86, 22 * width / 840);
}

export function drawDeliveryScenery(g: G, width: number, height: number): void {
  g.clear();
  g.fillStyle(rgb('#eaf0df'), 1);
  g.fillRect(0, 0, width, height);
  g.fillStyle(rgb('#e0e9d1'), 1);
  g.fillEllipse(width * 0.76, height * 0.79, width * 0.38, height * 0.32);
  g.fillStyle(rgb('#dfe9d0'), 1);
  g.fillEllipse(width * 0.27, height * 0.36, width * 0.2, height * 0.18);
}

export const DELIVERY_ROAD_BORDER = 48;
export const DELIVERY_ROAD_FILL = 39;

export function drawDeliveryNetwork(g: G, mission: RouteMission): void {
  const points = Object.values(mission.nodes);
  for (const [a, b] of mission.edges) strokeLine(g, DELIVERY_ROAD_BORDER, '#ced8bf', mission.nodes[a], mission.nodes[b]);
  fillDots(g, '#ced8bf', DELIVERY_ROAD_BORDER / 2, points);
  for (const [a, b] of mission.edges) strokeLine(g, DELIVERY_ROAD_FILL, '#fffdf5', mission.nodes[a], mission.nodes[b]);
  fillDots(g, '#fffdf5', DELIVERY_ROAD_FILL / 2, points);
}
