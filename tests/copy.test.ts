import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_GUIDE,
  HINT_GUIDE,
  NODE_LABELS,
  SPEECH,
  START_GUIDE,
  arrivalGuide,
  arrivalKind,
  hintGuide,
  overlayCopy,
  startGuide,
} from '../src/picnic/copy';
import { picnicCollect } from '../src/picnic/board';
import { applyMove, createGame, tryMove } from '../src/game/rules';
import { LEVELS } from '../src/picnic/levels';
import type { LevelDef } from '../src/game/types';

describe('start and arrival copy', () => {
  it('marks only the first picnic level as a tutorial', () => {
    expect(LEVELS.map((level) => !!level.tutorial)).toEqual([
      true, false, false, false, false, false,
    ]);
    expect(createGame(LEVELS, 0).graph.tutorial).toBe(true);
    expect(createGame(LEVELS, 1).graph.tutorial).toBe(false);
  });

  it('keys start copy off graph.tutorial, not level index 0', () => {
    const tutorial = createGame(LEVELS, 0).graph;
    const standard = createGame(LEVELS, 1).graph;
    expect(tutorial.tutorial).toBe(true);
    expect(standard.tutorial).toBe(false);

    expect(startGuide(tutorial, 0).main).toBe(START_GUIDE.tutorial.main);
    expect(startGuide(tutorial, 99).announce).toBe(START_GUIDE.tutorial.announce);

    expect(startGuide(standard, 0).main).toBe(START_GUIDE.standard.main);
    expect(startGuide(standard, 1).sub).toContain('第 2 關 · 基礎');
    expect(startGuide(standard, 1).sub).not.toContain(standard.name);
    expect(startGuide(standard, 8).sub).toContain('益智');
    expect(startGuide({ ...standard, tutorial: true }, 1).main).toBe(START_GUIDE.tutorial.main);
  });

  it('requires a collectible on every picnic level', () => {
    LEVELS.forEach((level) => {
      expect(level.collect, level.name).toBeTruthy();
    });
    expect(picnicCollect(createGame(LEVELS, 0).graph)).toBe(LEVELS[0].collect);
  });

  it('throws when PicnicBoard is given a graph with no collectible', () => {
    const level: LevelDef = {
      name: '無漢堡',
      short: '無',
      start: 's',
      goal: 'g',
      nodes: { s: [0, 0], g: [10, 0] },
      edges: [['s', 'g']],
    };
    const { graph } = createGame([level], 0);
    expect(graph.collect).toBeNull();
    expect(() => picnicCollect(graph)).toThrow(/PicnicBoard requires graph.collect/);
  });

  it('does not hardcode a level count in the all-done win speech', () => {
    expect(SPEECH.winAllDone).toContain('所有關卡均已完成');
    expect(SPEECH.winAllDone).not.toMatch(/\d/);
    expect(SPEECH.winAllDone).not.toContain('三');
  });

  it('keeps picnic copy free of tooth-bug wording', () => {
    expect(JSON.stringify({ ARRIVAL_GUIDE, HINT_GUIDE, NODE_LABELS, SPEECH, START_GUIDE, overlayCopy })).not.toContain('蛀牙蟲');
  });

  it('points hintGuide at the shop before collect and the park after', () => {
    expect(HINT_GUIDE.beforeCollect.sub).toContain('漢堡店');
    expect(HINT_GUIDE.afterCollect.sub).toContain('公園');
    expect(HINT_GUIDE.beforeCollect).not.toEqual(HINT_GUIDE.afterCollect);
    expect(hintGuide(false)).toEqual(HINT_GUIDE.beforeCollect);
    expect(hintGuide(true)).toEqual(HINT_GUIDE.afterCollect);
  });

  it('selects overlay stuck and win copy from the stall or all-done branch', () => {
    expect(overlayCopy.stuck.title('missing-collect')).toBe('尚未購買漢堡');
    expect(overlayCopy.stuck.body('missing-collect')).toContain('漢堡店');
    expect(overlayCopy.stuck.title('deadend')).toBe('此路已經走到盡頭');
    expect(overlayCopy.stuck.body('deadend')).toContain('其他路線');
    expect(overlayCopy.stuck.title('hazard')).toBe('此路已經走到盡頭');
    expect(overlayCopy.stuck.body('hazard')).toBe(overlayCopy.stuck.body('deadend'));
    expect(overlayCopy.win.body(false)).toContain('一起坐下野餐');
    expect(overlayCopy.win.body(true)).toContain('所有關卡均已完成');
    expect(overlayCopy.help.task).toContain('漢堡店');
    expect(overlayCopy.help.task).toContain('箭頭');
    expect(overlayCopy.help.task).not.toContain('箭嘴');
    expect(overlayCopy.help.controls).not.toContain('箭嘴');
    expect(overlayCopy.stuck.footnote).toContain('著急');
    expect(overlayCopy.stuck.footnote).not.toContain('着急');
    expect(overlayCopy.rescue.title).toBe('此路線無法到達目的地');
    expect(overlayCopy.rescue.body).toContain('不重複通行');
    expect(overlayCopy.rescue.body).toContain('起點');
  });

  it('classifies collectible arrival as bought even though the result already has it', () => {
    const { graph, state } = createGame(LEVELS, 0);
    const toA = tryMove(graph, state, 'a');
    expect(toA.ok).toBe(true);
    if (!toA.ok) return;
    applyMove(state, toA);

    const bought = tryMove(graph, state, graph.collect!);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.collectedNow).toBe(true);
    expect(bought.collected).toBe(true);
    expect(state.collected).toBe(false);
    expect(arrivalKind(graph, bought, state.used)).toBe('bought');
    expect(arrivalGuide(graph, bought, state.used)).toEqual(ARRIVAL_GUIDE.bought);
    expect(ARRIVAL_GUIDE.bought.main).toContain('漢堡');

    applyMove(state, bought);
    expect(state.collected).toBe(true);
    expect(arrivalKind(graph, bought, state.used)).toBe('bought');
    expect(arrivalGuide(graph, bought, state.used)).toEqual(ARRIVAL_GUIDE.bought);
  });

  it('derives fork/path from the result destination, before applyMove', () => {
    const line = createGame(LEVELS, 0);
    const first = tryMove(line.graph, line.state, 'a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(line.state.node).toBe(line.graph.start);
    expect(arrivalKind(line.graph, first, line.state.used)).toBe('path');
    expect(arrivalGuide(line.graph, first, line.state.used)).toEqual(ARRIVAL_GUIDE.path);

    const fork = createGame(LEVELS, 1);
    const step = tryMove(fork.graph, fork.state, 'a');
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(arrivalKind(fork.graph, step, fork.state.used)).toBe('fork');
    expect(arrivalGuide(fork.graph, step, fork.state.used)).toEqual(ARRIVAL_GUIDE.fork);
  });

  it('uses result.collected for the toPark arrival key after the collectible', () => {
    const { graph, state } = createGame(LEVELS, 0);
    const toA = tryMove(graph, state, 'a');
    expect(toA.ok).toBe(true);
    if (!toA.ok) return;
    applyMove(state, toA);
    const toCollect = tryMove(graph, state, graph.collect!);
    expect(toCollect.ok).toBe(true);
    if (!toCollect.ok) return;
    applyMove(state, toCollect);

    const toB = tryMove(graph, state, 'b');
    expect(toB.ok).toBe(true);
    if (!toB.ok) return;
    expect(toB.collectedNow).toBe(false);
    expect(toB.collected).toBe(true);
    expect(arrivalKind(graph, toB, state.used)).toBe('toPark');
    expect(arrivalGuide(graph, toB, state.used)).toEqual(ARRIVAL_GUIDE.toPark);
  });

  it('classifies a tutorial goal arrival as won before and after applyMove', () => {
    const { graph, state } = createGame(LEVELS, 0);
    for (const to of ['a', graph.collect!, 'b'] as const) {
      const step = tryMove(graph, state, to);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      applyMove(state, step);
    }
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

  it('maps goal-without-collectible to the stuckBurger picnic arrival key', () => {
    const { graph, state } = createGame(LEVELS, 1);
    for (const to of ['a', 'c', 'd'] as const) {
      const step = tryMove(graph, state, to);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      applyMove(state, step);
    }
    const atGoal = tryMove(graph, state, graph.goal);
    expect(atGoal.ok).toBe(true);
    if (!atGoal.ok) return;
    expect(atGoal.stalled).toBe('missing-collect');
    expect(atGoal.won).toBe(false);
    expect(arrivalKind(graph, atGoal, state.used)).toBe('stuckBurger');
    expect(arrivalGuide(graph, atGoal, state.used)).toEqual(ARRIVAL_GUIDE.stuckBurger);
    applyMove(state, atGoal);
    expect(arrivalKind(graph, atGoal, state.used)).toBe('stuckBurger');
    expect(arrivalGuide(graph, atGoal, state.used)).toEqual(ARRIVAL_GUIDE.stuckBurger);
  });

  it('classifies the level-2 v cul-de-sac as stuckDeadend before and after applyMove', () => {
    const { graph, state } = createGame(LEVELS, 2);
    for (const to of ['a', graph.collect!, 'b', 'u'] as const) {
      const step = tryMove(graph, state, to);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      applyMove(state, step);
    }
    const atV = tryMove(graph, state, 'v');
    expect(atV.ok).toBe(true);
    if (!atV.ok) return;
    expect(atV.stalled).toBe('deadend');
    expect(arrivalKind(graph, atV, state.used)).toBe('stuckDeadend');
    expect(arrivalGuide(graph, atV, state.used)).toEqual(ARRIVAL_GUIDE.stuckDeadend);
    applyMove(state, atV);
    expect(arrivalKind(graph, atV, state.used)).toBe('stuckDeadend');
    expect(arrivalGuide(graph, atV, state.used)).toEqual(ARRIVAL_GUIDE.stuckDeadend);
  });
});
