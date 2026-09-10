import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_GUIDE,
  SPEECH,
  START_GUIDE,
  arrivalKind,
  startGuide,
} from '../src/game/copy';
import { applyMove, createGame, LEVELS, tryMove } from '../src/game/rules';

describe('start and arrival copy', () => {
  it('marks only the first picnic level as a tutorial', () => {
    expect(LEVELS.map((level) => !!level.tutorial)).toEqual([
      true, false, false, false, false, false,
    ]);
    expect(createGame(0).graph.tutorial).toBe(true);
    expect(createGame(1).graph.tutorial).toBe(false);
  });

  it('keys start copy off graph.tutorial, not level index 0', () => {
    const tutorial = createGame(0).graph;
    const standard = createGame(1).graph;
    expect(tutorial.tutorial).toBe(true);
    expect(standard.tutorial).toBe(false);

    expect(startGuide(tutorial, 0).main).toBe(START_GUIDE.tutorial.main);
    expect(startGuide(tutorial, 99).announce).toBe(START_GUIDE.tutorial.announce);

    expect(startGuide(standard, 0).main).toBe(START_GUIDE.standard.main);
    expect(startGuide(standard, 1).sub).toContain(standard.name);
    expect(startGuide({ ...standard, tutorial: true }, 1).main).toBe(START_GUIDE.tutorial.main);
  });

  it('does not hardcode a level count in the all-done win speech', () => {
    expect(SPEECH.winAllDone).toContain('所有關卡均已完成');
    expect(SPEECH.winAllDone).not.toMatch(/\d/);
    expect(SPEECH.winAllDone).not.toContain('三');
  });

  it('classifies shop arrival as bought even though the result already has a burger', () => {
    const { graph, state } = createGame(0);
    const toA = tryMove(graph, state, 'a');
    expect(toA.ok).toBe(true);
    if (!toA.ok) return;
    applyMove(state, toA);

    const bought = tryMove(graph, state, graph.shop);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.boughtNow).toBe(true);
    expect(bought.burger).toBe(true);
    expect(state.burger).toBe(false);
    expect(arrivalKind(graph, bought, state.used)).toBe('bought');
    expect(ARRIVAL_GUIDE.bought.main).toContain('漢堡');

    applyMove(state, bought);
    expect(state.burger).toBe(true);
    expect(arrivalKind(graph, bought, state.used)).toBe('bought');
  });

  it('derives fork/path from the result destination, before applyMove', () => {
    const line = createGame(0);
    const first = tryMove(line.graph, line.state, 'a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(line.state.node).toBe(line.graph.start);
    expect(arrivalKind(line.graph, first, line.state.used)).toBe('path');

    const fork = createGame(1);
    const step = tryMove(fork.graph, fork.state, 'a');
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(arrivalKind(fork.graph, step, fork.state.used)).toBe('fork');
  });

  it('uses result.burger for the to-park junction after the shop', () => {
    const { graph, state } = createGame(0);
    const toA = tryMove(graph, state, 'a');
    expect(toA.ok).toBe(true);
    if (!toA.ok) return;
    applyMove(state, toA);
    const toShop = tryMove(graph, state, graph.shop);
    expect(toShop.ok).toBe(true);
    if (!toShop.ok) return;
    applyMove(state, toShop);

    const toB = tryMove(graph, state, 'b');
    expect(toB.ok).toBe(true);
    if (!toB.ok) return;
    expect(toB.boughtNow).toBe(false);
    expect(toB.burger).toBe(true);
    expect(arrivalKind(graph, toB, state.used)).toBe('toPark');
  });

  it('classifies a tutorial park arrival as won before and after applyMove', () => {
    const { graph, state } = createGame(0);
    for (const to of ['a', graph.shop, 'b'] as const) {
      const step = tryMove(graph, state, to);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      applyMove(state, step);
    }
    const atPark = tryMove(graph, state, graph.park);
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(atPark.won).toBe(true);
    expect(arrivalKind(graph, atPark, state.used)).toBe('won');
    applyMove(state, atPark);
    expect(arrivalKind(graph, atPark, state.used)).toBe('won');
  });

  it('classifies park-without-burger as stuckBurger before and after applyMove', () => {
    const { graph, state } = createGame(1);
    for (const to of ['a', 'c', 'd'] as const) {
      const step = tryMove(graph, state, to);
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      applyMove(state, step);
    }
    const atPark = tryMove(graph, state, graph.park);
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(atPark.stalled).toBe('burger');
    expect(atPark.won).toBe(false);
    expect(arrivalKind(graph, atPark, state.used)).toBe('stuckBurger');
    applyMove(state, atPark);
    expect(arrivalKind(graph, atPark, state.used)).toBe('stuckBurger');
  });

  it('classifies the level-2 v cul-de-sac as stuckDeadend before and after applyMove', () => {
    const { graph, state } = createGame(2);
    for (const to of ['a', graph.shop, 'b', 'u'] as const) {
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
    applyMove(state, atV);
    expect(arrivalKind(graph, atV, state.used)).toBe('stuckDeadend');
  });
});
