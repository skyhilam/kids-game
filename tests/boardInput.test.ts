// @vitest-environment happy-dom
import { createApp, h, ref } from 'vue';
import { expect, it, vi } from 'vitest';
import { useBoardInput } from '../src/composables/useBoardInput';
import { createGame } from '../src/game/rules';
import { LEVELS } from '../src/picnic/levels';

it('releases stale swipe capture on resize, cancellation and second finger, then accepts a fresh swipe', () => {
  const board = document.createElement('div');
  const fresh = createGame(LEVELS, 0, false);
  const capture = new Set<number>();
  board.setPointerCapture = (id) => { capture.add(id); };
  board.hasPointerCapture = (id) => capture.has(id);
  board.releasePointerCapture = (id) => { capture.delete(id); };
  let width = 840;
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 660 } as DOMRect);
  const move = vi.fn();
  let input!: ReturnType<typeof useBoardInput>;
  const app = createApp({ setup() {
    input = useBoardInput({ boardEl: ref(board), targetLayer: ref(null), graph: () => fresh.graph,
      state: () => fresh.state, interactive: () => true, narrow: () => false, inFlight: () => null, onMove: move });
    return () => h('div');
  } });
  app.mount(document.createElement('div'));
  const [x, y] = fresh.graph.nodes[fresh.state.node];
  const event = (dx = 0) => ({ target: board, pointerId: 1, isPrimary: true, button: 0, clientX: x + dx, clientY: y } as unknown as PointerEvent);
  try {
    for (const cancel of [() => window.dispatchEvent(new Event('resize')), input.onPointerCancel,
      () => window.dispatchEvent(new PointerEvent('pointerdown', { isPrimary: false }))]) {
      input.onPointerDown(event());
      expect(capture.size).toBe(1);
      cancel();
      expect(capture.size).toBe(0);
      input.onPointerUp(event(100));
      expect(move).not.toHaveBeenCalled();
    }
    width = 0;
    input.onPointerDown(event());
    expect(capture.size).toBe(0);
    width = 840;
    const to = fresh.graph.edges.find((e) => e.a === fresh.state.node || e.b === fresh.state.node)!;
    const node = to.a === fresh.state.node ? to.b : to.a;
    const [tx, ty] = fresh.graph.nodes[node];
    input.onPointerDown(event());
    input.onPointerUp({ ...event(), clientX: tx, clientY: ty } as PointerEvent);
    expect(move).toHaveBeenCalledWith(node);
    expect(capture.size).toBe(0);
  } finally { app.unmount(); }
});
