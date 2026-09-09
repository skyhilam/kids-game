import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  available,
  createGame,
  findSolution,
  isWin,
  roadKey,
  tryMove,
} from '../src/game/rules';

describe('picnic game rules (shipped logic)', () => {
  it('keeps the three original named levels', () => {
    expect(LEVELS.map((level) => level.name)).toEqual([
      '跟住小路走',
      '記得買漢堡',
      '小小探路家',
    ]);
  });

  it('rejects reversing a used undirected road from a fresh start', () => {
    const { graph, state } = createGame(0);
    expect(roadKey('s', 'a')).toBe(roadKey('a', 's'));
    expect(roadKey('s', 'a')).toBe('a-s');

    const forward = tryMove(graph, state, 'a');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.edgeId).toBe('a-s');
    expect(state.node).toBe('a');
    expect(state.used.has('a-s')).toBe(true);

    const reverse = tryMove(graph, state, 's');
    expect(reverse.ok).toBe(false);
    if (reverse.ok) return;
    expect(reverse.reason).toBe('used-road');
    expect(state.node).toBe('a');
  });

  it('wins only by reaching the park after the burger shop', () => {
    const { graph, state } = createGame(0);
    expect(tryMove(graph, state, 'a').ok).toBe(true);
    expect(tryMove(graph, state, 'h').ok).toBe(true);
    expect(state.burger).toBe(true);
    expect(tryMove(graph, state, 'b').ok).toBe(true);
    const atPark = tryMove(graph, state, 'p');
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(atPark.won).toBe(true);
    expect(isWin(state)).toBe(true);
    expect(state.node).toBe('p');
    expect(state.burger).toBe(true);
  });

  it('does not treat park-without-burger as a win', () => {
    const { graph, state } = createGame(1);
    expect(tryMove(graph, state, 'a').ok).toBe(true);
    expect(tryMove(graph, state, 'c').ok).toBe(true);
    expect(tryMove(graph, state, 'd').ok).toBe(true);
    const atPark = tryMove(graph, state, 'p');
    expect(atPark.ok).toBe(true);
    if (!atPark.ok) return;
    expect(state.burger).toBe(false);
    expect(atPark.won).toBe(false);
    expect(isWin(state)).toBe(false);
    expect(state.stalled).toBe('burger');
    expect(state.won).toBe(false);
  });

  it('hint never recommends a used undirected edge or a park-without-burger path', () => {
    const { graph, state } = createGame(1);
    expect(tryMove(graph, state, 'a').ok).toBe(true);

    const path = findSolution(graph, state.node, state.burger, state.used);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path.length).toBeGreaterThan(0);

    let node = state.node;
    let burger = state.burger;
    const used = new Set(state.used);
    for (const next of path) {
      const edgeId = roadKey(node, next);
      expect(used.has(edgeId), `hint reused road ${edgeId}`).toBe(false);
      const link = available(graph, node, used).find((item) => item.to === next);
      expect(link, `hint stepped to unreachable ${node}->${next}`).toBeTruthy();
      used.add(edgeId);
      node = next;
      if (node === 'h') burger = true;
      if (node === 'p') {
        expect(burger).toBe(true);
      }
    }
    expect(node).toBe('p');
    expect(burger).toBe(true);
    if (!state.burger) expect(path).toContain('h');
  });

  it('findSolution returns null when only park-without-burger remains', () => {
    const { graph, state } = createGame(1);
    // Burn the burger-shop roads, leave the lower path to the park.
    expect(tryMove(graph, state, 'a').ok).toBe(true);
    expect(tryMove(graph, state, 'h').ok).toBe(true);
    expect(tryMove(graph, state, 'b').ok).toBe(true);
    expect(tryMove(graph, state, 'p').ok).toBe(true);
    expect(isWin(state)).toBe(true);

    const trapped = createGame(1);
    expect(tryMove(trapped.graph, trapped.state, 'a').ok).toBe(true);
    expect(tryMove(trapped.graph, trapped.state, 'h').ok).toBe(true);
    expect(tryMove(trapped.graph, trapped.state, 'b').ok).toBe(true);
    // From b, skip park; go... actually from b only park and maybe nothing else unused
    // Leave burger unbought and take the only remaining path that can hit park.
    const noShop = createGame(1);
    expect(tryMove(noShop.graph, noShop.state, 'a').ok).toBe(true);
    expect(tryMove(noShop.graph, noShop.state, 'c').ok).toBe(true);
    expect(tryMove(noShop.graph, noShop.state, 'd').ok).toBe(true);
    const remaining = available(noShop.graph, noShop.state.node, noShop.state.used).map((l) => l.to);
    expect(remaining).toContain('p');
    const path = findSolution(
      noShop.graph,
      noShop.state.node,
      noShop.state.burger,
      noShop.state.used,
    );
    expect(path).toBeNull();
  });
});
