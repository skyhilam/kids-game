import { describe, expect, it } from 'vitest';
import {
  applyMove,
  available,
  createGame,
  findSolution,
  roadKey,
  tryMove,
} from '../src/game/rules';
import {
  ARRIVAL_GUIDE,
  HINT_GUIDE,
  NODE_LABELS,
  START_GUIDE,
  arrivalGuide,
  arrivalKind,
  hintGuide,
  overlayCopy,
  startGuide,
} from '../src/tooth/copy';
import { TOOTH_LEVELS } from '../src/tooth/levels';
import type { GameState, Graph, LevelDef, MoveResult, NodeId } from '../src/game/types';

function play(graph: Graph, state: GameState, to: NodeId): MoveResult {
  const result = tryMove(graph, state, to);
  if (result.ok) applyMove(state, result);
  return result;
}

describe('tooth-bug maze (shipped logic)', () => {
  it('names every tooth level', () => {
    expect(TOOTH_LEVELS.map((level) => level.name)).toEqual([
      '認識小路',
      '避開蛀蟲',
      '同一條路一次',
    ]);
  });

  it('does not invent picnic landmarks for tooth maps', () => {
    TOOTH_LEVELS.forEach((level) => {
      expect(level).not.toHaveProperty('shop');
      expect(level).not.toHaveProperty('park');
      expect(level.collect).toBeUndefined();
    });
    const { graph, state } = createGame(TOOTH_LEVELS, 0, false, NODE_LABELS);
    expect(graph.collect).toBeNull();
    expect(state.collected).toBe(true);
    expect(graph.titles[graph.hazards[0]]).toBe('蛀牙蟲');
    expect(graph.titles[graph.goal]).toBe('終點');
  });

  it('gives every level a start-to-goal path that avoids hazards', () => {
    TOOTH_LEVELS.forEach((_, index) => {
      const { graph, state } = createGame(TOOTH_LEVELS, index);
      const path = findSolution(graph, state.node, state.collected, state.used);
      expect(path, graph.name).not.toBeNull();
      if (!path) return;
      expect(path.some((node) => graph.hazards.includes(node))).toBe(false);
      expect(path[path.length - 1]).toBe(graph.goal);
    });
  });

  it('rejects reversing a used undirected road', () => {
    const { graph, state } = createGame(TOOTH_LEVELS);
    expect(play(graph, state, 'a').ok).toBe(true);
    const reverse = tryMove(graph, state, graph.start);
    expect(reverse.ok).toBe(false);
    if (reverse.ok) return;
    expect(reverse.reason).toBe('used-road');
  });

  it('treats stepping on a hazard as a stall, not a win', () => {
    const { graph, state } = createGame(TOOTH_LEVELS);
    expect(play(graph, state, 'a').ok).toBe(true);
    const hit = play(graph, state, graph.hazards[0]);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.stalled).toBe('hazard');
    expect(hit.won).toBe(false);
    expect(state.won).toBe(false);
    expect(state.stalled).toBe('hazard');
  });

  it('wins by reaching the goal without meeting a hazard', () => {
    const { graph, state } = createGame(TOOTH_LEVELS);
    expect(play(graph, state, 'a').ok).toBe(true);
    const atGoal = play(graph, state, graph.goal);
    expect(atGoal.ok).toBe(true);
    if (!atGoal.ok) return;
    expect(atGoal.won).toBe(true);
    expect(state.won).toBe(true);
  });

  it('hint never recommends a used road or a hazard node', () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 1);
    expect(play(graph, state, 'a').ok).toBe(true);
    const path = findSolution(graph, state.node, state.collected, state.used);
    expect(path).not.toBeNull();
    if (!path) return;
    let node = state.node;
    const used = new Set(state.used);
    for (const next of path) {
      expect(graph.hazards.includes(next)).toBe(false);
      expect(used.has(roadKey(node, next))).toBe(false);
      expect(available(graph, node, used).some((link) => link.to === next)).toBe(true);
      used.add(roadKey(node, next));
      node = next;
    }
    expect(node).toBe(graph.goal);
  });
});

describe('tooth start and arrival copy', () => {
  it('keys start copy off graph.tutorial, not level index 0', () => {
    const tutorial = createGame(TOOTH_LEVELS, 0).graph;
    const standard = createGame(TOOTH_LEVELS, 1).graph;
    expect(tutorial.tutorial).toBe(true);
    expect(standard.tutorial).toBe(false);
    expect(startGuide(tutorial, 0).main).toBe(START_GUIDE.tutorial.main);
    expect(startGuide(tutorial, 99).announce).toBe(START_GUIDE.tutorial.announce);
    expect(startGuide(standard, 0).main).toBe(START_GUIDE.standard.main);
    expect(startGuide(standard, 1).sub).toContain('第 2 關 · 基礎');
    expect(startGuide(standard, 1).sub).not.toContain(standard.name);
    expect(startGuide({ ...standard, tutorial: true }, 1).main).toBe(START_GUIDE.tutorial.main);
  });

  it('uses the same hint copy whether collected or not', () => {
    expect(hintGuide(false)).toEqual(HINT_GUIDE);
    expect(hintGuide(true)).toEqual(HINT_GUIDE);
    expect(hintGuide(true).sub).toContain('蛀牙蟲');
  });

  it('selects overlay stuck copy from the hazard or deadend branch', () => {
    expect(overlayCopy.stuck.title('hazard')).toBe('途中遇到蛀牙蟲');
    expect(overlayCopy.stuck.body('hazard')).toContain('蛀牙蟲');
    expect(overlayCopy.stuck.title('deadend')).toBe('此路已經走到盡頭');
    expect(overlayCopy.stuck.body('deadend')).toContain('其他路線');
    expect(overlayCopy.stuck.title('missing-collect')).toBe('請再試一次');
    expect(overlayCopy.stuck.body('missing-collect')).toBe(overlayCopy.stuck.body('deadend'));
    expect(overlayCopy.win.body(false)).toContain('天天刷牙');
    expect(overlayCopy.win.body(true)).toContain('所有關卡均已完成');
    expect(overlayCopy.help.task).toContain('蛀牙蟲');
    expect(overlayCopy.help.task).toContain('終點');
    expect(overlayCopy.help.controls).not.toContain('箭嘴');
    expect(overlayCopy.rescue.title).toContain('終點');
    expect(overlayCopy.rescue.body).toContain('蛀牙蟲');
    expect(JSON.stringify(overlayCopy)).not.toContain('漢堡');
  });

  it('classifies a hazard stall as stuckHazard before and after applyMove', () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    expect(play(graph, state, 'a').ok).toBe(true);
    const hit = tryMove(graph, state, graph.hazards[0]);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.stalled).toBe('hazard');
    expect(arrivalKind(graph, hit, state.used)).toBe('stuckHazard');
    expect(arrivalGuide(graph, hit, state.used)).toEqual(ARRIVAL_GUIDE.stuckHazard);
    applyMove(state, hit);
    expect(arrivalKind(graph, hit, state.used)).toBe('stuckHazard');
    expect(arrivalGuide(graph, hit, state.used)).toEqual(ARRIVAL_GUIDE.stuckHazard);
    expect(ARRIVAL_GUIDE.stuckHazard.main).toContain('蛀牙蟲');
  });

  it('classifies a tutorial goal arrival as won before and after applyMove', () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 0);
    expect(play(graph, state, 'a').ok).toBe(true);
    const atGoal = tryMove(graph, state, graph.goal);
    expect(atGoal.ok).toBe(true);
    if (!atGoal.ok) return;
    expect(atGoal.won).toBe(true);
    expect(arrivalKind(graph, atGoal, state.used)).toBe('won');
    expect(arrivalGuide(graph, atGoal, state.used)).toEqual(ARRIVAL_GUIDE.won);
    applyMove(state, atGoal);
    expect(arrivalKind(graph, atGoal, state.used)).toBe('won');
    expect(arrivalGuide(graph, atGoal, state.used)).toEqual(ARRIVAL_GUIDE.won);
  });

  it('classifies a corridor arrival as path, not fork', () => {
    const { graph, state } = createGame(TOOTH_LEVELS, 1);
    expect(play(graph, state, 'a').ok).toBe(true);
    const along = tryMove(graph, state, 'c');
    expect(along.ok).toBe(true);
    if (!along.ok) return;
    expect(arrivalKind(graph, along, state.used)).toBe('path');
    expect(arrivalKind(graph, along, state.used)).not.toBe('fork');
    expect(arrivalGuide(graph, along, state.used)).toEqual(ARRIVAL_GUIDE.path);
    applyMove(state, along);
    expect(arrivalKind(graph, along, state.used)).toBe('path');
    expect(arrivalGuide(graph, along, state.used)).toEqual(ARRIVAL_GUIDE.path);
  });

  it('classifies the first junction as fork and a synthetic cul-de-sac as stuckDeadend', () => {
    const line = createGame(TOOTH_LEVELS, 0);
    const first = tryMove(line.graph, line.state, 'a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(arrivalKind(line.graph, first, line.state.used)).toBe('fork');
    expect(arrivalGuide(line.graph, first, line.state.used)).toEqual(ARRIVAL_GUIDE.fork);

    const dead: LevelDef = {
      name: '盡頭',
      short: '盡頭',
      start: 's',
      goal: 'g',
      hazards: ['x'],
      nodes: { s: [0, 0], a: [10, 0], g: [20, 0], d: [10, 10], x: [10, -10] },
      edges: [['s', 'a'], ['a', 'g'], ['a', 'd'], ['a', 'x']],
    };
    const { graph, state } = createGame([dead], 0);
    expect(play(graph, state, 'a').ok).toBe(true);
    const atEnd = tryMove(graph, state, 'd');
    expect(atEnd.ok).toBe(true);
    if (!atEnd.ok) return;
    expect(atEnd.stalled).toBe('deadend');
    expect(arrivalKind(graph, atEnd, state.used)).toBe('stuckDeadend');
    expect(arrivalGuide(graph, atEnd, state.used)).toEqual(ARRIVAL_GUIDE.stuckDeadend);
    applyMove(state, atEnd);
    expect(arrivalKind(graph, atEnd, state.used)).toBe('stuckDeadend');
    expect(arrivalGuide(graph, atEnd, state.used)).toEqual(ARRIVAL_GUIDE.stuckDeadend);
  });
});
