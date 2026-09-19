import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import DeliveryBoard from '../src/components/DeliveryBoard.vue';
import { deliveryMission, generateDeliveryMission } from '../src/delivery/generate';
import { DELIVERY_MISSION } from '../src/delivery/mission';
import { roadKey } from '../src/game/graph';
import { checkRouteMove, createRouteState, findRouteSolution, moveOnRoute, type RouteMission, type RouteState } from '../src/game/routeMission';
import { clearOfRoads, deliveryFlowers, deliveryTrees, distToSegment } from '../src/delivery/scenery';
import { followRouteStroke, junctionSlack, projectToRoad, traceAlongRoad } from '../src/game/trace';
import type { Point } from '../src/game/types';

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
  it('delivers any house on arrival, then finish, and may reuse roads', () => {
    const state = createRouteState(DELIVERY_MISSION);
    const arrivals: string[] = [];
    for (const node of route) {
      const before = state.delivered;
      expect(moveOnRoute(DELIVERY_MISSION, state, node), node).toEqual({ ok: true });
      if (state.delivered > before) arrivals.push(node);
    }
    expect(arrivals).toEqual(['house1', 'house2', 'house3']);
    expect(state.delivered).toBe(3);
    expect(state.done).toEqual(new Set(['house1', 'house2', 'house3']));
    expect(state.used.size).toBe(route.length);
    expect(state.won).toBe(true);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'j')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('can deliver a nearer house first and still reverse along a used road', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of ['a', 'b']) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'house2')).toEqual({ ok: true });
    expect(state.node).toBe('house2');
    expect(state.delivered).toBe(1);
    expect(state.done.has('house2')).toBe(true);
    expect(state.used.has(roadKey('b', 'house2'))).toBe(true);
    expect(checkRouteMove(DELIVERY_MISSION, state, 'b')).toEqual({ ok: true });
    expect(moveOnRoute(DELIVERY_MISSION, state, 'b').ok).toBe(true);
    expect(state.node).toBe('b');
  });

  it('delivers on arrival at a house and can leave immediately', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of route.slice(0, 5)) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(state.node).toBe('house1');
    expect(state.delivered).toBe(1);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'd').ok).toBe(true);
  });

  it('does not finish early, and a dead-end is still reversible', () => {
    const mission: RouteMission = { name: 'test', width: 100, height: 100, start: 's', finish: 'f',
      stops: [{ node: 'h', label: 'house' }], nodes: { s: [0, 0], f: [100, 0], h: [0, 100], dead: [50, 50] },
      edges: [['s', 'f'], ['s', 'h'], ['s', 'dead']] };
    const state = createRouteState(mission);
    expect(moveOnRoute(mission, state, 'f')).toEqual({ ok: false, reason: 'unfinished' });
    expect(state.won).toBe(false);
    moveOnRoute(mission, state, 'dead');
    expect(state.stalled).toBe(false);
    expect(moveOnRoute(mission, state, 's').ok).toBe(true);
    expect(findRouteSolution(mission, state)).not.toBeNull();
  });

  it('offers a valid continuation at every point without mutating play', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of route) {
      const before = { ...state, used: new Set(state.used), done: new Set(state.done) };
      const path = findRouteSolution(DELIVERY_MISSION, state);
      expect(state).toEqual(before);
      expect(path).not.toBeNull();
      const preview = { ...state, used: new Set(state.used), done: new Set(state.done) };
      for (const next of path!) {
        expect(moveOnRoute(DELIVERY_MISSION, preview, next).ok).toBe(true);
      }
      expect(preview.won).toBe(true);
      moveOnRoute(DELIVERY_MISSION, state, node);
    }
  });

  it('can still finish after a detour that used to trap the Euler path', () => {
    const state = createRouteState(DELIVERY_MISSION);
    for (const node of ['a', 'b', 'd', 'house1']) moveOnRoute(DELIVERY_MISSION, state, node);
    expect(state.delivered).toBe(1);
    const path = findRouteSolution(DELIVERY_MISSION, state);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toBe('finish');
    const fresh = createRouteState(DELIVERY_MISSION);
    expect(fresh.delivered).toBe(0);
    expect(fresh.used.size).toBe(0);
    expect(fresh.done.size).toBe(0);
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

  it('keeps farthest-first house labels and still has a finish solution', () => {
    const mission = generateDeliveryMission(0);
    expect(geometricOrder(mission)).toEqual(['house1', 'house2', 'house3']);
    const path = findRouteSolution(mission, createRouteState(mission));
    expect(path).not.toBeNull();
    for (const id of ['house1', 'house2', 'house3']) {
      expect(path, id).toContain(id);
    }
    expect(path?.at(-1)).toBe('finish');
  });

  it('puts house art above the road only when that stop is on the top row', () => {
    expect(houseAbove(DELIVERY_MISSION, 'house2')).toBe(true);
    expect(houseAbove(DELIVERY_MISSION, 'house1')).toBe(false);
    expect(houseAbove(DELIVERY_MISSION, 'house3')).toBe(false);
    expect(houseAbove(generateDeliveryMission(0), 'house1')).toBe(true);
  });

  it('always has three spaced houses and a path that visits every house then finish', () => {
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
      for (const id of houseNodes) {
        expect(path, `seed ${seed} ${id}`).toContain(id);
      }
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

  it('rewinds uncommitted ink and does not lock a road from a poke at the far end', () => {
    const back = traceAlongRoad({ to: 'b', t: .6, recovering: false }, [0, 20], [0, 0], [0, 100], 20);
    expect(back.point).toEqual([0, 20]);
    expect(back.trace.t).toBe(.2);
    expect(back.arrived).toBe(false);
    const poke = traceAlongRoad({ to: 'b', t: .1, recovering: false }, [0, 100], [0, 0], [0, 100], 20);
    expect(poke.arrived).toBe(false);
    expect(poke.trace.t).toBeCloseTo(.65);
    expect(traceAlongRoad({ to: 'b', t: .8, recovering: false }, [0, 95], [0, 0], [0, 100], 20).arrived).toBe(true);
    expect(projectToRoad([50, 40], [0, 0], [100, 100]).point).toEqual([45, 45]);
  });
});

const CORNER_MAP: RouteMission = {
  name: 'corners',
  width: 400,
  height: 400,
  start: 'a',
  finish: 'e',
  stops: [{ node: 'house', label: 'house' }],
  nodes: {
    a: [40, 40],
    b: [240, 40],
    c: [240, 240],
    d: [40, 240],
    house: [240, 360],
    e: [40, 360],
  },
  edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['c', 'house'], ['d', 'e']],
};

function strokeAt(
  mission: RouteMission,
  state: RouteState,
  pointer: Point,
  trace: { to: string; t: number; recovering: boolean } | null,
  needsReturn = false,
  settle = 0,
) {
  return followRouteStroke({
    pointer,
    trace,
    needsReturn,
    node: state.node,
    nodes: mission.nodes,
    exits: (from) => mission.edges.flatMap(([x, y]) => x === from ? [y] : y === from ? [x] : []),
    canEnter: (from, to) => {
      if (from !== state.node) return false;
      return checkRouteMove(mission, state, to).ok;
    },
    tolerance: 26,
    settle,
    onArrive: (to) => { expect(moveOnRoute(mission, state, to).ok).toBe(true); },
  });
}

describe('corner tracing', () => {
  it('continues through two L corners on one stroke without lifting', () => {
    const state = createRouteState(CORNER_MAP);
    const first = strokeAt(CORNER_MAP, state, [80, 42], null);
    expect(first.arrivals).toEqual([]);
    expect(first.trace?.to).toBe('b');

    const atB = strokeAt(CORNER_MAP, state, [220, 72], first.trace);
    expect(atB.arrivals).toEqual(['b']);
    expect(atB.offRoad).toBe(false);
    expect(state.node).toBe('b');
    expect(atB.trace?.to).toBe('c');

    const atC = strokeAt(CORNER_MAP, state, [208, 256], atB.trace);
    expect(atC.arrivals).toEqual(['c']);
    expect(atC.offRoad).toBe(false);
    expect(state.node).toBe('c');
    expect(atC.trace?.to).toBe('d');
    expect(state.used.has(roadKey('a', 'b'))).toBe(true);
    expect(state.used.has(roadKey('b', 'c'))).toBe(true);
    expect(state.used.has(roadKey('c', 'd'))).toBe(false);
  });

  it('takes the intended T-junction branch when the finger cuts that corner', () => {
    const state = createRouteState(CORNER_MAP);
    const along = strokeAt(CORNER_MAP, state, [80, 40], null);
    const nearer = strokeAt(CORNER_MAP, state, [180, 40], along.trace);
    const throughB = strokeAt(CORNER_MAP, state, [240, 40], nearer.trace);
    expect(throughB.arrivals).toEqual(['b']);
    const cutTowardHouse = strokeAt(CORNER_MAP, state, [256, 268], { to: 'c', t: .7, recovering: false });
    expect(cutTowardHouse.arrivals).toEqual(['c']);
    expect(cutTowardHouse.trace?.to).toBe('house');
    expect(state.node).toBe('c');
    expect(state.used.has(roadKey('c', 'house'))).toBe(false);
  });

  it('does not instantly fail a modest cut-corner, but still flags a clear off-road miss', () => {
    const state = createRouteState(CORNER_MAP);
    const along = strokeAt(CORNER_MAP, state, [120, 40], null);
    const cut = strokeAt(CORNER_MAP, state, [220, 72], along.trace);
    expect(cut.offRoad).toBe(false);
    expect(cut.arrivals).toEqual(['b']);

    const lost = strokeAt(CORNER_MAP, state, [120, 160], along.trace);
    expect(lost.offRoad).toBe(true);
    expect(lost.arrivals).toEqual([]);
    expect(lost.trace?.recovering).toBe(true);
    expect(junctionSlack(26)).toBeGreaterThan(26);
  });

  it('ignores the just-used incoming road so a turn can attach after arrival', () => {
    const state = createRouteState(CORNER_MAP);
    const along = strokeAt(CORNER_MAP, state, [120, 40], null);
    const arrived = strokeAt(CORNER_MAP, state, [240, 40], along.trace);
    expect(arrived.arrivals).toEqual(['b']);
    const linger = strokeAt(CORNER_MAP, state, [225, 40], null, false, 0);
    expect(linger.offRoad).toBe(false);
    expect(linger.blockedTo).toBeUndefined();
    expect(linger.trace).toBeNull();
    const next = strokeAt(CORNER_MAP, state, [240, 60], null, false, 0);
    expect(next.offRoad).toBe(false);
    expect(next.trace?.to).toBe('c');
  });

  it('does not lock the next T-arm from a slight overshoot past the junction', () => {
    const state = createRouteState(CORNER_MAP);
    const along = strokeAt(CORNER_MAP, state, [120, 40], null);
    const arrived = strokeAt(CORNER_MAP, state, [240, 40], along.trace);
    expect(arrived.arrivals).toEqual(['b']);
    expect(state.node).toBe('b');
    const overshoot = strokeAt(CORNER_MAP, state, [240, 48], null, false, 0);
    expect(overshoot.offRoad).toBe(false);
    expect(overshoot.trace).toBeNull();
    expect(state.used.has(roadKey('b', 'c'))).toBe(false);
    const continueDown = strokeAt(CORNER_MAP, state, [240, 70], null, false, 0);
    expect(continueDown.offRoad).toBe(false);
    expect(continueDown.trace?.to).toBe('c');
    expect(continueDown.trace?.t).toBeGreaterThan(0);
    expect(state.used.has(roadKey('b', 'c'))).toBe(false);
  });

  it('lets a T-junction stroke rewind and take another arm before the road locks', () => {
    const tee: RouteMission = {
      ...CORNER_MAP,
      name: 'tee',
      nodes: { ...CORNER_MAP.nodes, n: [240, 0] },
      edges: [...CORNER_MAP.edges, ['b', 'n']],
    };
    const state = createRouteState(tee);
    const along = strokeAt(tee, state, [120, 40], null);
    const atB = strokeAt(tee, state, [240, 40], along.trace);
    expect(atB.arrivals).toEqual(['b']);
    const down = strokeAt(tee, state, [240, 80], null);
    expect(down.trace?.to).toBe('c');
    expect(state.used.has(roadKey('b', 'c'))).toBe(false);
    const back = strokeAt(tee, state, [240, 44], down.trace);
    expect(back.trace).toBeNull();
    const up = strokeAt(tee, state, [240, 16], null);
    expect(up.trace?.to).toBe('n');
    expect(state.used.has(roadKey('b', 'c'))).toBe(false);
    expect(state.used.has(roadKey('b', 'n'))).toBe(false);
  });

  it('keeps drawing into any adjacent road after a stroke arrives at a junction', () => {
    const state = createRouteState(DELIVERY_MISSION);
    const start = DELIVERY_MISSION.nodes.start;
    const a = DELIVERY_MISSION.nodes.a;
    const towardA: Point = [start[0] + 40, start[1]];
    const first = strokeAt(DELIVERY_MISSION, state, towardA, null);
    expect(first.trace?.to).toBe('a');
    const cutToE: Point = [a[0] - 16, a[1] + 28];
    const corner = strokeAt(DELIVERY_MISSION, state, cutToE, first.trace);
    expect(corner.arrivals).toEqual(['a']);
    expect(state.node).toBe('a');
    expect(state.used.has(roadKey('start', 'a'))).toBe(true);
    expect(state.used.size).toBe(1);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'b').ok).toBe(true);
    expect(moveOnRoute(DELIVERY_MISSION, state, 'house2')).toEqual({ ok: true });
    expect(state.delivered).toBe(1);
    expect(state.done.has('house2')).toBe(true);
  });
});

describe('delivery tap mode', () => {
  it('still offers junction buttons and does not require a draw stroke', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h(DeliveryBoard, {
        mission: DELIVERY_MISSION,
        state: createRouteState(DELIVERY_MISSION),
        enabled: true,
        mode: 'tap',
        hint: null,
      }),
    }));
    expect(html).toContain('data-node="a"');
    expect(html).toContain('選擇下一個路口');
    expect(html).toContain('delivery-target');
    expect(html).not.toContain('class="delivery-board tracing"');
  });
});

describe('delivery scenery placement', () => {
  it('keeps trees and flowers off generated roads and junctions', () => {
    for (const seed of [1, 2, 7, 11, 19, 42, 91]) {
      const mission = generateDeliveryMission(seed);
      for (const [x, y] of deliveryTrees(mission)) {
        expect(clearOfRoads(mission, x, y), `tree seed ${seed} at ${x},${y}`).toBe(true);
      }
      for (const [x, y] of deliveryFlowers(mission)) {
        expect(clearOfRoads(mission, x + 23, y + 20), `flower seed ${seed} at ${x},${y}`).toBe(true);
      }
    }
    expect(distToSegment(0, 10, [0, 0], [100, 0])).toBe(10);
    expect(distToSegment(50, 0, [0, 0], [100, 0])).toBe(0);
  });
});
