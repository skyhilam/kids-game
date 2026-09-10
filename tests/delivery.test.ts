import { describe, expect, it } from 'vitest';
import { DELIVERY_MISSION } from '../src/delivery/mission';
import { roadKey } from '../src/game/graph';
import { checkRouteMove, createRouteState, findRouteSolution, moveOnRoute, stampDelivery, type RouteMission } from '../src/game/routeMission';
import { projectToRoad, traceAlongRoad } from '../src/game/trace';

const route = ['a', 'e', 'end', 'g', 'house1', 'd', 'b', 'house2', 'c', 'd', 'e', 'f', 'house3', 'j', 'finish'];

describe('delivery mission', () => {
  it('completes the photographed rules: 1 → 2 → 3, stickers, then finish, without reusing roads', () => {
    const state = createRouteState(DELIVERY_MISSION);
    const arrivals: string[] = [];
    for (const node of route) {
      expect(moveOnRoute(DELIVERY_MISSION, state, node), node).toEqual({ ok: true });
      if (state.pendingStamp) {
        arrivals.push(node);
        expect(state.delivered).toBe(arrivals.length - 1);
        expect(stampDelivery(DELIVERY_MISSION, state)).toBe(true);
      }
    }
    expect(arrivals).toEqual(['house1', 'house2', 'house3']);
    expect(state.delivered).toBe(3);
    expect(state.used.size).toBe(route.length);
    expect(state.won).toBe(true);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'j')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('blocks a future house without consuming the road or changing progress', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of ['a', 'b']) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'house2')).toEqual({ ok: false, reason: 'wrong-order' });
    expect(state.node).toBe('b');
    expect(state.delivered).toBe(0);
    expect(state.used.has(roadKey('b', 'house2'))).toBe(false);
  });

  it('requires an arrival and exactly one sticker before departing each house', () => {
    const state = createRouteState(DELIVERY_MISSION);
    expect(stampDelivery(DELIVERY_MISSION, state)).toBe(false);
    for (const node of route.slice(0, 5)) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(state.pendingStamp).toBe(true);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'd')).toEqual({ ok: false, reason: 'blocked' });
    expect(stampDelivery(DELIVERY_MISSION, state)).toBe(true);
    expect(stampDelivery(DELIVERY_MISSION, state)).toBe(false);
    expect(state.delivered).toBe(1);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'd').ok).toBe(true);
  });

  it('rejects reverse traversal but permits returning to a junction on different roads', () => {
    const state = createRouteState(DELIVERY_MISSION);
    moveOnRoute(DELIVERY_MISSION, state, 'a');
    expect(checkRouteMove(DELIVERY_MISSION, state, 'start')).toEqual({ ok: false, reason: 'used-road' });
    const other = createRouteState(DELIVERY_MISSION);
    for (const node of route.slice(0, 11)) {
      expect(moveOnRoute(DELIVERY_MISSION, other, node).ok).toBe(true);
      if (other.pendingStamp) stampDelivery(DELIVERY_MISSION, other);
    }
    expect(other.node).toBe('e'); // Second visit to e is legal.
  });

  it('does not finish early and handles real dead ends', () => {
    const mission: RouteMission = { name: 'test', width: 100, height: 100, start: 's', finish: 'f',
      stops: [{ node: 'h', label: 'house' }], nodes: { s: [0, 0], f: [100, 0], h: [0, 100], dead: [50, 50] },
      edges: [['s', 'f'], ['s', 'h'], ['s', 'dead']] };
    const state = createRouteState(mission);
    expect(moveOnRoute(mission, state, 'f')).toEqual({ ok: false, reason: 'unfinished' });
    expect(state.won).toBe(false);
    moveOnRoute(mission, state, 'dead');
    expect(state.stalled).toBe(true);
    expect(findRouteSolution(mission, state)).toBeNull();
  });

  it('offers a valid continuation at every point, even while awaiting a sticker, without mutating play', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of route) {
      const before = { ...state, used: new Set(state.used) };
      const path = findRouteSolution(DELIVERY_MISSION, state);
      expect(state).toEqual(before);
      expect(path).not.toBeNull();
      const preview = { ...state, used: new Set(state.used) };
      if (preview.pendingStamp) stampDelivery(DELIVERY_MISSION, preview);
      for (const next of path!) {
        expect(moveOnRoute(DELIVERY_MISSION, preview, next).ok).toBe(true);
        if (preview.pendingStamp) stampDelivery(DELIVERY_MISSION, preview);
      }
      expect(preview.won).toBe(true);
      if (state.pendingStamp) stampDelivery(DELIVERY_MISSION, state);
      moveOnRoute(DELIVERY_MISSION, state, node);
    }
  });

  it('reports an unsolvable detour and resets all parcels and ink', () => {
    const state = createRouteState(DELIVERY_MISSION);
    // This uses the road needed to leave house 1 before reaching it.
    for (const node of ['a', 'b', 'd', 'house1']) moveOnRoute(DELIVERY_MISSION, state, node);
    stampDelivery(DELIVERY_MISSION, state);
    expect(findRouteSolution(DELIVERY_MISSION, state)).toBeNull();
    const fresh = createRouteState(DELIVERY_MISSION);
    expect(fresh.delivered).toBe(0);
    expect(fresh.used.size).toBe(0);
    expect(fresh.pendingStamp).toBe(false);
  });
});

describe('continuous road tracing', () => {
  it('follows the hand position on the road instead of jumping to the next junction', () => {
    const result = traceAlongRoad({ to: 'b', t: 0, recovering: false }, [45, 6], [0, 0], [100, 0], 20);
    expect(result.point).toEqual([45, 0]);
    expect(result.arrived).toBe(false);
    expect(result.trace.t).toBe(.45);
  });

  it('freezes off-road and prevents re-entry farther ahead from skipping the path', () => {
    const off = traceAlongRoad({ to: 'b', t: .4, recovering: false }, [50, 50], [0, 0], [100, 0], 20);
    expect(off.point).toEqual([40, 0]);
    expect(off.offRoad).toBe(true);
    const skip = traceAlongRoad(off.trace, [100, 0], [0, 0], [100, 0], 20);
    expect(skip.arrived).toBe(false);
    expect(skip.point).toEqual([40, 0]);
    const resumed = traceAlongRoad(skip.trace, [45, 0], [0, 0], [100, 0], 20);
    expect(resumed.offRoad).toBe(false);
    expect(traceAlongRoad(resumed.trace, [100, 0], [0, 0], [100, 0], 20).arrived).toBe(true);
  });

  it('does not rewind the vehicle or ink and recognizes vertical road arrival', () => {
    expect(traceAlongRoad({ to: 'b', t: .6, recovering: false }, [0, 20], [0, 0], [0, 100], 20).point).toEqual([0, 60]);
    expect(traceAlongRoad({ to: 'b', t: .6, recovering: false }, [0, 95], [0, 0], [0, 100], 20).arrived).toBe(true);
    expect(projectToRoad([50, 40], [0, 0], [100, 100]).point).toEqual([45, 45]);
  });
});
