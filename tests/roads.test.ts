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
  dashedSegments,
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
  theme: 'picnic' | 'tooth' = 'picnic',
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
      theme,
      boardLabel: 'road test',
      roads,
    }),
  }));
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
    expect(dashedSegments(west, mid).length).toBeGreaterThan(0);
    expect(dashedSegments(mid, east).length).toBeGreaterThan(0);
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
  it('keeps tooth T-junction discs and accessible targets over the Phaser board', async () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    expect(graph.adj.a.map((link) => link.to).sort()).toEqual(['g', 's', 'x']);
    expect(jointIds(graph.edges)).toHaveLength(Object.keys(graph.nodes).length);
    expect(ROAD_BORDER_RADIUS).toBe(36);
    expect(ROAD_FILL_RADIUS).toBeGreaterThan(ROAD_INNER_RADIUS);
    const html = await renderBoard(graph, state, 'tooth', { border: '#c5d4ce', fill: '#f7fffc' });
    expect(html).toContain('phaser-board');
    expect(html).toContain('step-target');
    expect(html).toContain('可選的小路');
    expect(html).toContain('data-node="');
    expect(html).not.toContain('class="road-edge"');
  });

  it('phases picnic center dashes across a through-junction and tracks used joints', async () => {
    const { graph, state } = createGame(LEVELS, 1);
    expect(graph.adj.a.map((link) => link.to).sort()).toEqual(['c', 'h', 's']);
    const sa = [graph.nodes.s, graph.nodes.a] as const;
    const ac = [graph.nodes.a, graph.nodes.c] as const;
    expect(centerPath(sa[0], sa[1])).toBe(edgePath(...canonicalEnds(sa[0], sa[1])));
    expect(centerPath(ac[0], ac[1])).toBe(edgePath(...canonicalEnds(ac[0], ac[1])));
    expect(centerDashOffset(sa[0], sa[1]) + 190).toBe(centerDashOffset(ac[0], ac[1]));
    play(graph, state, 'a');
    play(graph, state, 'h');
    const used = graph.edges.filter((edge) => state.used.has(edge.id));
    expect(jointIds(used).sort()).toEqual(['a', 'h', 's']);
    expect(ROAD_USED_RADIUS).toBe(9);
    const html = await renderBoard(graph, state);
    expect(html).toContain('phaser-board');
    expect(html).toContain('step-target');
  });
});
