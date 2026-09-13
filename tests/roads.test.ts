import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import MazeBoard from '../src/components/MazeBoard.vue';
import { applyMove, createGame, tryMove } from '../src/game/rules';
import {
  ROAD_BORDER_RADIUS,
  ROAD_FILL_RADIUS,
  ROAD_INNER_RADIUS,
  ROAD_USED_RADIUS,
  canonicalEnds,
  centerDashOffset,
  centerPath,
  edgePath,
  jointIds,
} from '../src/game/roads';
import type { GameState, Graph, NodeId } from '../src/game/types';
import { LEVELS } from '../src/picnic/levels';
import { TOOTH_LEVELS } from '../src/tooth/levels';

function play(graph: Graph, state: GameState, to: NodeId): void {
  const result = tryMove(graph, state, to);
  expect(result.ok, `move to ${to}`).toBe(true);
  if (result.ok) applyMove(state, result);
}

async function renderBoard(
  graph: Graph,
  state: GameState,
  roads?: { border: string; fill: string; inner?: string },
): Promise<string> {
  return renderToString(createSSRApp({
    render: () => h(MazeBoard, {
      graph,
      state,
      interactive: true,
      narrow: false,
      facing: 90,
      hintNode: null,
      inFlight: null,
      boardLabel: 'road test',
      roads,
    }),
  }));
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function tags(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

describe('road geometry', () => {
  it('keeps collinear center dashes on the same world phase', () => {
    const west: [number, number] = [100, 200];
    const mid: [number, number] = [300, 200];
    const east: [number, number] = [500, 200];
    expect(canonicalEnds(east, west)).toEqual([west, east]);
    expect(centerPath(east, west)).toBe(edgePath(west, east));
    expect(centerDashOffset(west, mid) + 200).toBe(centerDashOffset(mid, east));
    expect(centerDashOffset(east, mid)).toBe(centerDashOffset(mid, east));
    expect(jointIds([{ a: 'w', b: 'm' }, { a: 'm', b: 'e' }])).toEqual(['w', 'm', 'e']);
  });

  it('aligns vertical center dashes the same way', () => {
    const north: [number, number] = [400, 120];
    const mid: [number, number] = [400, 340];
    const south: [number, number] = [400, 520];
    expect(centerPath(south, north)).toBe(edgePath(north, south));
    expect(centerDashOffset(north, mid) + 220).toBe(centerDashOffset(mid, south));
  });
});

describe('maze road seams', () => {
  it('draws tooth T-junction layers with butt caps and shared node discs', async () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    expect(graph.adj.a.map((link) => link.to).sort()).toEqual(['g', 's', 'x']);

    const html = await renderBoard(graph, state, { border: '#c5d4ce', fill: '#f7fffc' });
    const edges = tags(html, /<path\b[^>]*class="road-edge"[^>]*>/g);
    expect(edges.length).toBe(graph.edges.length * 2);
    expect(edges.every((tag) => attr(tag, 'stroke-linecap') === 'butt')).toBe(true);
    expect(html).not.toMatch(/class="road-edge"[^>]*stroke-linecap="round"/);

    const borderJoins = tags(html, /<circle\b[^>]*class="road-join-border"[^>]*>/g);
    const fillJoins = tags(html, /<circle\b[^>]*class="road-join-fill"[^>]*>/g);
    expect(borderJoins).toHaveLength(Object.keys(graph.nodes).length);
    expect(fillJoins).toHaveLength(Object.keys(graph.nodes).length);
    expect(html).not.toContain('road-join-inner');

    const atA = borderJoins.find((tag) => attr(tag, 'data-node') === 'a');
    expect(atA).toBeTruthy();
    expect(Number(attr(atA!, 'cx'))).toBe(graph.nodes.a[0]);
    expect(Number(attr(atA!, 'cy'))).toBe(graph.nodes.a[1]);
    expect(Number(attr(atA!, 'r'))).toBe(ROAD_BORDER_RADIUS);
    expect(Number(attr(fillJoins.find((tag) => attr(tag, 'data-node') === 'a')!, 'r'))).toBe(ROAD_FILL_RADIUS);

    const centers = tags(html, /<path\b[^>]*class="road-center"[^>]*>/g);
    const byNodes = new Map(graph.edges.map((edge, index) => [
      [edge.a, edge.b].sort().join('-'),
      centers[index],
    ]));
    const sa = byNodes.get('a-s');
    const ag = byNodes.get('a-g');
    expect(sa && ag).toBeTruthy();
    expect(Number(attr(sa!, 'stroke-dashoffset')) + 220).toBe(Number(attr(ag!, 'stroke-dashoffset')));
  });

  it('phases picnic center dashes across a through-junction and joins used trails', async () => {
    const { graph, state } = createGame(LEVELS, 1);
    expect(graph.adj.a.map((link) => link.to).sort()).toEqual(['c', 'h', 's']);

    const html = await renderBoard(graph, state);
    const centers = tags(html, /<path\b[^>]*class="road-center"[^>]*>/g);
    expect(centers).toHaveLength(graph.edges.length);
    const byNodes = new Map(graph.edges.map((edge, index) => {
      const ends = [edge.a, edge.b].sort().join('-');
      return [ends, centers[index]];
    }));
    const sa = byNodes.get(['a', 's'].sort().join('-'));
    const ac = byNodes.get(['a', 'c'].sort().join('-'));
    expect(sa && ac).toBeTruthy();
    expect(attr(sa!, 'd')).toBe(centerPath(graph.nodes.s, graph.nodes.a));
    expect(attr(ac!, 'd')).toBe(centerPath(graph.nodes.a, graph.nodes.c));
    expect(Number(attr(sa!, 'stroke-dashoffset')) + 190).toBe(Number(attr(ac!, 'stroke-dashoffset')));

    const innerJoin = tags(html, /<circle\b[^>]*class="road-join-inner"[^>]*>/g)
      .find((tag) => attr(tag, 'data-node') === 'a');
    expect(Number(attr(innerJoin!, 'r'))).toBe(ROAD_INNER_RADIUS);

    play(graph, state, 'a');
    play(graph, state, 'h');
    const used = await renderBoard(graph, state);
    const joins = tags(used, /<circle\b[^>]*class="road-used-join"[^>]*>/g);
    expect(joins.map((tag) => attr(tag, 'data-node')).sort()).toEqual(['a', 'h', 's']);
    expect(joins.every((tag) => Number(attr(tag, 'r')) === ROAD_USED_RADIUS)).toBe(true);
    expect(used).toContain('class="road-used"');
  });
});
