import { describe, expect, it } from 'vitest';
import { deliveryMission, generateDeliveryMission } from '../src/delivery/generate';
import { DELIVERY_MISSION } from '../src/delivery/mission';
import { roadKey } from '../src/game/graph';
import { checkRouteMove, createRouteState, findRouteSolution, moveOnRoute, type RouteMission } from '../src/game/routeMission';
import { projectToRoad, traceAlongRoad } from '../src/game/trace';

const route = ['a', 'e', 'end', 'g', 'house1', 'd', 'b', 'house2', 'c', 'd', 'e', 'f', 'house3', 'j', 'finish'];

function playableGraph(mission: RouteMission) {
  return {
    start: mission.nodes.start,
    finish: mission.nodes.finish,
    houses: mission.stops.map((stop) => mission.nodes[stop.node]),
    roads: mission.edges.map(([a, b]) => roadKey(a, b)).sort(),
  };
}

function dist(mission: RouteMission, a: string, b: string): number {
  const pa = mission.nodes[a]!;
  const pb = mission.nodes[b]!;
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

function minSpacing(mission: RouteMission): number {
  const ids = ['start', 'finish', 'house1', 'house2', 'house3'];
  let min = Infinity;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      min = Math.min(min, dist(mission, ids[i]!, ids[j]!));
    }
  }
  return min;
}

function geometricOrder(mission: RouteMission): string[] {
  const remaining = ['house1', 'house2', 'house3'];
  const taken = [mission.start, mission.finish];
  const order: string[] = [];
  while (remaining.length) {
    let best = remaining[0]!;
    let bestScore = -1;
    for (const id of remaining) {
      const score = Math.min(...taken.map((other) => dist(mission, id, other)));
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    order.push(best);
    taken.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return order;
}

function houseAbove(mission: RouteMission, node: string): boolean {
  return mission.nodes[node]![1] < mission.height * 0.42;
}

describe('delivery mission', () => {
  it('completes the photographed rules: 1 → 2 → 3 on arrival, then finish, without reusing roads', () => {
    const state = createRouteState(DELIVERY_MISSION);
    const arrivals: string[] = [];
    for (const node of route) {
      const before = state.delivered;
      expect(moveOnRoute(DELIVERY_MISSION, state, node), node).toEqual({ ok: true });
      if (state.delivered > before) arrivals.push(node);
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

  it('delivers on arrival at the next house and can leave immediately', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of route.slice(0, 5)) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(state.node).toBe('house1');
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

  it('offers a valid continuation at every point without mutating play', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of route) {
      const before = { ...state, used: new Set(state.used) };
      const path = findRouteSolution(DELIVERY_MISSION, state);
      expect(state).toEqual(before);
      expect(path).not.toBeNull();
      const preview = { ...state, used: new Set(state.used) };
      for (const next of path!) {
        expect(moveOnRoute(DELIVERY_MISSION, preview, next).ok).toBe(true);
      }
      expect(preview.won).toBe(true);
      moveOnRoute(DELIVERY_MISSION, state, node);
    }
  });

  it('reports an unsolvable detour and resets all parcels and ink', () => {
    const state = createRouteState(DELIVERY_MISSION);
    // This uses the road needed to leave house 1 before reaching it.
    for (const node of ['a', 'b', 'd', 'house1']) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(state.delivered).toBe(1);
    expect(findRouteSolution(DELIVERY_MISSION, state)).toBeNull();
    const fresh = createRouteState(DELIVERY_MISSION);
    expect(fresh.delivered).toBe(0);
    expect(fresh.used.size).toBe(0);
  });
});

describe('random delivery maps', () => {
  it('keeps a map stable for one seed and shuffles the playable graph when the seed changes', () => {
    expect(playableGraph(generateDeliveryMission(11))).toEqual(playableGraph(generateDeliveryMission(11)));
    expect(deliveryMission(11)).toEqual(generateDeliveryMission(11));
    const layouts = [1, 2, 9, 99, 12345].map((seed) => JSON.stringify(playableGraph(generateDeliveryMission(seed))));
    expect(new Set(layouts).size).toBe(5);
    expect(playableGraph(generateDeliveryMission(1))).not.toEqual(playableGraph(DELIVERY_MISSION));
  });

  it('reorders the three houses when the farthest-first visit has no route', () => {
    const mission = generateDeliveryMission(0);
    expect(geometricOrder(mission)).toEqual(['house1', 'house3', 'house2']);
    const geometric: RouteMission = {
      ...mission,
      stops: [
        { node: 'house1', label: '1 號屋' },
        { node: 'house3', label: '3 號屋' },
        { node: 'house2', label: '2 號屋' },
      ],
    };
    expect(findRouteSolution(geometric, createRouteState(geometric))).toBeNull();
    const path = findRouteSolution(mission, createRouteState(mission));
    expect(path).not.toBeNull();
    const first = (id: string) => path!.indexOf(id);
    expect(first('house1')).toBeGreaterThanOrEqual(0);
    expect(first('house2')).toBeGreaterThan(first('house1'));
    expect(first('house3')).toBeGreaterThan(first('house2'));
    expect(path?.at(-1)).toBe('finish');
  });

  it('puts house art above the road only when that stop is on the top row', () => {
    expect(houseAbove(DELIVERY_MISSION, 'house2')).toBe(true);
    expect(houseAbove(DELIVERY_MISSION, 'house1')).toBe(false);
    expect(houseAbove(DELIVERY_MISSION, 'house3')).toBe(false);
    expect(houseAbove(generateDeliveryMission(0), 'house1')).toBe(true);
  });

  it('always has three spaced houses and a 1 → 2 → 3 → finish solution', () => {
    expect(Object.keys(generateDeliveryMission(2).nodes)).toHaveLength(9);
    expect(generateDeliveryMission(2).edges.length).toBeLessThan(12);
    expect(Object.keys(generateDeliveryMission(0).nodes)).toHaveLength(12);
    expect(generateDeliveryMission(0).edges.length).toBeLessThan(17);
    for (let seed = 0; seed < 24; seed += 1) {
      const mission = generateDeliveryMission(seed);
      expect(playableGraph(mission)).not.toEqual(playableGraph(DELIVERY_MISSION));
      expect(mission.start).toBe('start');
      expect(mission.finish).toBe('finish');
      const houseNodes = mission.stops.map((stop) => stop.node);
      expect(houseNodes).toEqual(['house1', 'house2', 'house3']);
      expect(mission.edges.length, `seed ${seed}`).toBeLessThanOrEqual(24);
      expect(new Set([...houseNodes, 'start', 'finish']).size).toBe(5);
      houseNodes.forEach((node) => {
        expect(mission.nodes[node], `seed ${seed} ${node}`).toBeTruthy();
      });
      const cells = Object.keys(mission.nodes).length;
      if (cells === 9) expect(mission.edges.length, `seed ${seed} 3x3`).toBeLessThan(12);
      if (cells === 12) expect(mission.edges.length, `seed ${seed} 4x3`).toBeLessThan(17);
      expect(minSpacing(mission), `seed ${seed}`).toBeGreaterThanOrEqual(200);
      const path = findRouteSolution(mission, createRouteState(mission));
      expect(path, `seed ${seed}`).not.toBeNull();
      expect(path?.at(-1), `seed ${seed}`).toBe('finish');
      const first = (id: string) => path!.indexOf(id);
      expect(first('house1'), `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(first('house2'), `seed ${seed}`).toBeGreaterThan(first('house1'));
      expect(first('house3'), `seed ${seed}`).toBeGreaterThan(first('house2'));
      expect(first('finish'), `seed ${seed}`).toBeGreaterThan(first('house3'));
    }
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
