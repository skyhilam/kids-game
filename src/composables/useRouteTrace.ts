import { computed, ref, watch, type Ref } from 'vue';
import { checkRouteMove, routeNeighbors, type RouteFailure, type RouteMission, type RouteState } from '../game/routeMission';
import { projectToRoad, traceAlongRoad, type RoadTrace } from '../game/trace';
import type { Point } from '../game/types';

export function useRouteTrace(options: {
  surface: Ref<SVGSVGElement | null>;
  mission: () => RouteMission;
  state: () => RouteState;
  enabled: () => boolean;
  move: (to: string) => void;
  feedback: (reason: RouteFailure | 'off-road' | 'start-at-truck') => void;
}) {
  const trace = ref<RoadTrace | null>(null);
  let pointerId: number | null = null;
  let needsReturn = false;
  const position = computed<Point>(() => {
    const from = options.mission().nodes[options.state().node];
    if (!trace.value) return from;
    const to = options.mission().nodes[trace.value.to];
    return [from[0] + (to[0] - from[0]) * trace.value.t, from[1] + (to[1] - from[1]) * trace.value.t];
  });

  function pointerPoint(event: PointerEvent): Point {
    const rect = options.surface.value!.getBoundingClientRect();
    const mission = options.mission();
    return [(event.clientX - rect.left) / rect.width * mission.width, (event.clientY - rect.top) / rect.height * mission.height];
  }

  function tolerance(): number {
    const rect = options.surface.value!.getBoundingClientRect();
    return Math.max(22, 12 / rect.width * options.mission().width);
  }

  function stopPointer(): void {
    const captured = pointerId;
    pointerId = null;
    if (captured !== null && options.surface.value?.hasPointerCapture(captured)) {
      options.surface.value.releasePointerCapture(captured);
    }
  }

  function reset(): void { stopPointer(); trace.value = null; needsReturn = false; }

  function onPointerDown(event: PointerEvent): void {
    if (!options.enabled() || !event.isPrimary || event.button !== 0) return;
    const point = pointerPoint(event);
    if (Math.hypot(point[0] - position.value[0], point[1] - position.value[1]) > tolerance() * 1.7) {
      options.feedback('start-at-truck');
      return;
    }
    event.preventDefault();
    needsReturn = false;
    pointerId = event.pointerId;
    options.surface.value!.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId || !options.enabled()) return;
    const pointer = pointerPoint(event);
    const mission = options.mission();
    const state = options.state();
    const from = mission.nodes[state.node];
    if (!trace.value) {
      if (needsReturn && Math.hypot(pointer[0] - from[0], pointer[1] - from[1]) > tolerance()) {
        options.feedback('off-road');
        return;
      }
      needsReturn = false;
      if (Math.hypot(pointer[0] - from[0], pointer[1] - from[1]) < 10) return;
      const candidate = routeNeighbors(mission, state.node)
        .map((to) => ({ to, ...projectToRoad(pointer, from, mission.nodes[to]) }))
        .filter((item) => item.t > 0 && item.distance <= tolerance())
        .sort((a, b) => a.distance - b.distance)[0];
      if (!candidate) { needsReturn = true; options.feedback('off-road'); return; }
      const permitted = checkRouteMove(mission, state, candidate.to);
      if (!permitted.ok) { options.feedback(permitted.reason); return; }
      trace.value = { to: candidate.to, t: 0, recovering: false };
    }
    const result = traceAlongRoad(trace.value, pointer, from, mission.nodes[trace.value.to], tolerance());
    trace.value = result.trace;
    if (result.offRoad) options.feedback('off-road');
    if (result.arrived) {
      const to = trace.value.to;
      trace.value = null;
      options.move(to);
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
