import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { bestNeighbor, nearestNeighbor } from '../game/input';
import { mapSize } from '../game/rules';
import type { GameState, Graph, InFlightMove, NodeId } from '../game/types';

export function useBoardInput(opts: {
  boardEl: Ref<HTMLElement | null>;
  targetLayer: Ref<HTMLElement | null>;
  graph: () => Graph;
  state: () => GameState;
  interactive: () => boolean;
  narrow: () => boolean;
  inFlight: () => InFlightMove | null;
  onMove: (to: NodeId) => void;
}) {
  const keyboardMode = ref(false);
  let pointerStart: { id: number; x: number; y: number } | null = null;

  function eventToMap(event: PointerEvent, rect: DOMRect): [number, number] {
    const size = mapSize(opts.narrow());
    return [
      (event.clientX - rect.left) / rect.width * size.width,
      (event.clientY - rect.top) / rect.height * size.height,
    ];
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Tab') keyboardMode.value = true;
    if (!opts.interactive()) return;
    const dirs: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    const dir = dirs[event.key];
    if (!dir) return;
    event.preventDefault();
    keyboardMode.value = true;
    const state = opts.state();
    const choice = bestNeighbor(opts.graph(), state.node, state.used, dir);
    if (choice && choice.score > 0.7) opts.onMove(choice.to);
  }

  function onPointerDownWindow(): void {
    keyboardMode.value = false;
  }

  function onPointerDown(event: PointerEvent): void {
    keyboardMode.value = false;
    if ((event.target as HTMLElement).closest('button') || !opts.interactive()) return;
    const board = opts.boardEl.value;
    if (!board) return;
    const graph = opts.graph();
    const state = opts.state();
    const size = mapSize(opts.narrow());
    const rect = board.getBoundingClientRect();
    const [x, y] = eventToMap(event, rect);
    const [cx, cy] = graph.nodes[state.node];
    if (Math.hypot(x - cx, y - cy) < Math.max(60, 38 / rect.width * size.width)) {
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      board.setPointerCapture(event.pointerId);
    } else {
      const nearest = nearestNeighbor(
        graph,
        state.node,
        state.used,
        [x, y],
        [rect.width / size.width, rect.height / size.height],
      );
      if (nearest && nearest.d < 45) opts.onMove(nearest.to);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (!opts.interactive() || Math.hypot(dx, dy) < 20) return;
    const state = opts.state();
    const best = bestNeighbor(opts.graph(), state.node, state.used, [dx, dy]);
    if (best && best.score > 0.68) opts.onMove(best.to);
  }

  function onPointerCancel(): void {
    pointerStart = null;
  }

  watch(opts.inFlight, (cur, prev) => {
    if (!keyboardMode.value || cur || !prev) return;
    nextTick(() => opts.targetLayer.value?.querySelector('button')?.focus({ preventScroll: true }));
  });

  onMounted(() => {
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDownWindow, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onPointerDownWindow);
  });

  return { onPointerDown, onPointerUp, onPointerCancel };
}
