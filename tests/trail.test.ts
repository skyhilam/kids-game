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

function usedTrails(graph: Graph, state: GameState): { edge: string; d: string }[] {
  return graph.edges
    .filter((edge) => state.used.has(edge.id))
    .map((edge) => ({ edge: edge.id, d: traveledPath(graph.nodes, edge, state.usedFrom[edge.id]) }));
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

async function renderBoard(graph: Graph, state: GameState, theme: 'picnic' | 'tooth' = 'picnic'): Promise<string> {
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
      boardLabel: 'trail test',
    }),
  }));
}

function targetNodes(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*\bdata-node="([^"]+)"/g)].map((match) => match[1]).sort();
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

    expect(usedTrails(graph, state)).toEqual([
      { d: pathD(graph.nodes, 's', 'a'), edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'h'), edge: 'a-h' },
    ]);
    const html = await renderBoard(graph, state);
    expect(html).toContain('phaser-board');
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

    const stored = pathD(graph.nodes, 'a', 's');
    const traveled = pathD(graph.nodes, 's', 'a');
    expect(stored).not.toBe(traveled);
    expect(usedTrails(graph, state)).toEqual([
      { d: traveled, edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'h'), edge: 'a-h' },
    ]);
    expect(usedTrails(graph, state).some((item) => item.d === stored)).toBe(false);
    const html = await renderBoard(graph, state);
    expect(targetNodes(html)).toEqual(['p']);
  });

  it('keeps tooth used trails on traveled roads only after two moves', async () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    play(graph, state, 'a');
    play(graph, state, 'x');

    expect(usedTrails(graph, state)).toEqual([
      { d: pathD(graph.nodes, 's', 'a'), edge: 'a-s' },
      { d: pathD(graph.nodes, 'a', 'x'), edge: 'a-x' },
    ]);
    expect(usedTrails(graph, state).some((item) => item.edge === 'a-g')).toBe(false);
    const html = await renderBoard(graph, state, 'tooth');
    expect(html).toContain('phaser-board');
    expect(targetNodes(html)).toEqual([]);
  });
});
