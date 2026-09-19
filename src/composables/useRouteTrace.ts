import { computed, ref, watch, type Ref } from 'vue';
import { roadKey } from '../game/graph';
import { checkRouteMove, routeNeighbors, type RouteFailure, type RouteMission, type RouteState } from '../game/routeMission';
import { continueAlong, followRouteStroke, type RoadTrace } from '../game/trace';
import type { Point } from '../game/types';

export function useRouteTrace(options: {
  surface: Ref<HTMLElement | null>;
  mission: () => RouteMission;
  state: () => RouteState;
  enabled: () => boolean;
  move: (to: string) => void;
  feedback: (reason: RouteFailure | 'off-road' | 'start-at-truck') => void;
}) {
  const trace = ref<RoadTrace | null>(null);
  let pointerId: number | null = null;
  let needsReturn = false;
  let drawing = false;
  const position = computed<Point>(() => {
    const from = options.mission().nodes[options.state().node];
    if (!trace.value) return from;
    const to = options.mission().nodes[trace.value.to];
    return [from[0] + (to[0] - from[0]) * trace.value.t, from[1] + (to[1] - from[1]) * trace.value.t];
  });

  function pointerPoint(event: PointerEvent): Point {
    const el = options.surface.value!;
    const rect = el.getBoundingClientRect();
    const mission = options.mission();
    return [
      (event.clientX - rect.left) / rect.width * mission.width,
      (event.clientY - rect.top) / rect.height * mission.height,
    ];
  }

  function tolerance(): number {
    const rect = options.surface.value!.getBoundingClientRect();
    return Math.max(30, 16 / rect.width * options.mission().width);
  }

  function stopPointer(): void {
    const captured = pointerId;
    pointerId = null;
    if (captured !== null && options.surface.value?.hasPointerCapture(captured)) {
      options.surface.value.releasePointerCapture(captured);
    }
  }

  function reset(): void { stopPointer(); trace.value = null; needsReturn = false; drawing = false; }

  function onPointerDown(event: PointerEvent): void {
    if (!options.enabled() || !event.isPrimary || event.button !== 0) return;
    const point = pointerPoint(event);
    if (Math.hypot(point[0] - position.value[0], point[1] - position.value[1]) > tolerance() * 1.7) {
      options.feedback('start-at-truck');
      return;
    }
    event.preventDefault();
    needsReturn = false;
    drawing = false;
    pointerId = event.pointerId;
    try { options.surface.value!.setPointerCapture(event.pointerId); } catch { /* synthetic pointers */ }
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId || !options.enabled()) return;
    const mission = options.mission();
    const result = followRouteStroke({
      pointer: pointerPoint(event),
      trace: trace.value,
      needsReturn,
      node: options.state().node,
      nodes: mission.nodes,
      exits: (from) => routeNeighbors(mission, from),
      canEnter: (from, to) => {
        const state = options.state();
        if (from === state.node) return checkRouteMove(mission, state, to).ok;
        const preview = { ...state, node: from, used: new Set(state.used) };
        preview.used.add(roadKey(state.node, from));
        if (mission.stops[preview.delivered]?.node === from) preview.delivered += 1;
        return checkRouteMove(mission, preview, to).ok;
      },
      tolerance: tolerance(),
      settle: drawing ? continueAlong(tolerance()) : Math.max(12, continueAlong(tolerance()) * 0.75),
      onArrive: (to) => options.move(to),
      shouldContinue: () => options.enabled(),
    });
    trace.value = result.trace;
    needsReturn = result.needsReturn;
    if (result.trace || result.arrivals.length) drawing = true;
    if (result.offRoad) options.feedback('off-road');
    if (result.blockedTo) {
      const blocked = checkRouteMove(mission, options.state(), result.blockedTo);
      if (!blocked.ok) options.feedback(blocked.reason);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    onPointerMove(event);
    stopPointer();
  }

  watch(options.enabled, (enabled) => { if (!enabled) stopPointer(); });
  return { trace, position, reset, onPointerDown, onPointerMove, onPointerUp, stopPointer };
}
