import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import MazeBoard from '../src/components/MazeBoard.vue';
import { applyMove, available, createGame, tryMove } from '../src/game/rules';
import { traveledEnds, traveledPath } from '../src/game/trail';
import type { GameState, Graph, LevelDef, NodeId } from '../src/game/types';
import { LEVELS } from '../src/picnic/levels';
import { TOOTH_LEVELS } from '../src/tooth/levels';

function play(graph: Graph, state: GameState, to: NodeId): void {
  const result = tryMove(graph, state, to);
  expect(result.ok, `move to ${to}`).toBe(true);
  if (result.ok) applyMove(state, result);
}

function pathD(nodes: Graph['nodes'], from: NodeId, to: NodeId): string {
  const a = nodes[from];
  const b = nodes[to];
  return `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
}

const REVERSE_LINE: LevelDef = {
  name: '反向小路',
  short: '反向',
  start: 's',
  collect: 'h',
  goal: 'p',
  nodes: { s: [100, 100], a: [300, 100], h: [500, 100], p: [500, 300] },
  edges: [['a', 's'], ['h', 'a'], ['p', 'h']],
};

async function renderBoard(graph: Graph, state: GameState): Promise<string> {
  return renderToString(createSSRApp({
    render: () => h(MazeBoard, {
      graph,
      state,
      interactive: true,
      narrow: false,
      facing: 90,
      hintNode: null,
      inFlight: null,
      boardLabel: 'trail test',
    }),
  }));
}

function usedTrailDs(html: string): { edge: string; d: string }[] {
  return [...html.matchAll(/<path\b[^>]*class="road-used"[^>]*>/g)].flatMap((match) => {
    const tag = match[0];
    const d = tag.match(/\bd="([^"]+)"/)?.[1];
    const edge = tag.match(/\bdata-edge="([^"]+)"/)?.[1];
    return d && edge ? [{ d, edge }] : [];
  });
}

function targetNodes(html: string): string[] {
  return [...html.matchAll(/data-node="([^"]+)"/g)].map((match) => match[1]).sort();
}

describe('used-trail travel direction', () => {
  it('orients a path from the node that was left', () => {
    const edge = { a: 'east', b: 'west' };
    expect(traveledEnds(edge)).toEqual(['east', 'west']);
    expect(traveledEnds(edge, 'east')).toEqual(['east', 'west']);
    expect(traveledEnds(edge, 'west')).toEqual(['west', 'east']);
    expect(traveledPath({ east: [300, 100], west: [100, 100] }, edge, 'west'))
      .toBe('M100,100 L300,100');
  });

  it('records usedFrom on picnic and tooth moves without inventing extra roads', () => {
    const picnic = createGame(LEVELS, 0);
    play(picnic.graph, picnic.state, 'a');
    play(picnic.graph, picnic.state, picnic.graph.collect!);
    expect(picnic.state.usedFrom['a-s']).toBe('s');
    expect(picnic.state.usedFrom['a-h']).toBe('a');
    expect(Object.keys(picnic.state.usedFrom).sort()).toEqual([...picnic.state.used].sort());

    const tooth = createGame(TOOTH_LEVELS, 0);
    play(tooth.graph, tooth.state, 'a');
    play(tooth.graph, tooth.state, tooth.graph.goal);
    expect(tooth.state.usedFrom['a-s']).toBe('s');
    expect(tooth.state.usedFrom['a-g']).toBe('a');
    expect(tooth.state.node).toBe(tooth.graph.goal);
  });

  it('draws picnic used trails in travel order after two moves', async () => {
    const { graph, state } = createGame(LEVELS, 0);
    play(graph, state, 'a');
    play(graph, state, graph.collect!);

    const html = await renderBoard(graph, state);
    expect(usedTrailDs(html)).toEqual([
      { d: pathD(graph.nodes, 's', 'a'), edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'h'), edge: 'a-h' },
    ]);
    expect(html.match(/class="road-used"/g)).toHaveLength(2);
    expect(html.match(/class="road-used-inner"/g)).toHaveLength(2);
    expect(targetNodes(html)).toEqual(available(graph, state.node, state.used).map((link) => link.to).sort());
    expect(targetNodes(html)).toEqual(['b']);
  });

  it('draws a reverse-stored road in the direction traveled, not edge.a→edge.b', async () => {
    const { graph, state } = createGame([REVERSE_LINE], 0);
    const first = graph.edges.find((edge) => edge.id === 'a-s');
    expect(first?.a).toBe('a');
    expect(first?.b).toBe('s');

    play(graph, state, 'a');
    play(graph, state, 'h');
    expect(state.usedFrom['a-s']).toBe('s');
    expect(state.usedFrom['a-h']).toBe('a');

    const html = await renderBoard(graph, state);
    const stored = pathD(graph.nodes, 'a', 's');
    const traveled = pathD(graph.nodes, 's', 'a');
    expect(stored).not.toBe(traveled);
    expect(usedTrailDs(html)).toEqual([
      { d: traveled, edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'h'), edge: 'a-h' },
    ]);
    expect(usedTrailDs(html).some((item) => item.d === stored)).toBe(false);
    expect(targetNodes(html)).toEqual(['p']);
  });

  it('keeps tooth used trails on traveled roads only after two moves', async () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    play(graph, state, 'a');
    play(graph, state, 'x');

    const html = await renderBoard(graph, state);
    expect(usedTrailDs(html)).toEqual([
      { d: pathD(graph.nodes, 's', 'a'), edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'x'), edge: 'a-x' },
    ]);
    expect(html).not.toContain('data-edge="a-g"');
    expect(targetNodes(html)).toEqual([]);
  });
});
