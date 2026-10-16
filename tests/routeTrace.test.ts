// @vitest-environment happy-dom
import { createApp, h, ref } from 'vue';
import { expect, it, vi } from 'vitest';
import { useRouteTrace } from '../src/composables/useRouteTrace';
import { createRouteState, type RouteMission } from '../src/game/routeMission';

it('clears partial route and capture on rotation, lost capture and multi-touch without losing deliveries', () => {
  const mission: RouteMission = { name: 'test', width: 400, height: 200, start: 'a', finish: 'c',
    nodes: { a: [50, 100], b: [250, 100], c: [350, 100] }, edges: [['a', 'b'], ['b', 'c']], stops: [] };
  const state = createRouteState(mission);
  const surface = document.createElement('div');
  let width = 400;
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 200 } as DOMRect);
  const captures = new Set<number>();
  surface.setPointerCapture = (id) => { captures.add(id); };
  surface.hasPointerCapture = (id) => captures.has(id);
  surface.releasePointerCapture = (id) => { captures.delete(id); };
  const move = vi.fn();
  let input!: ReturnType<typeof useRouteTrace>;
  const app = createApp({ setup() {
    input = useRouteTrace({ surface: ref(surface), mission: () => mission, state: () => state,
      enabled: () => true, move, feedback: vi.fn() });
    return () => h('div');
  } });
  app.mount(document.createElement('div'));
  const pointer = (x: number) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 100, preventDefault() {} } as PointerEvent);
  try {
    for (const cancel of [() => window.dispatchEvent(new Event('resize')), input.stopPointer,
      () => window.dispatchEvent(new PointerEvent('pointerdown', { isPrimary: false }))]) {
      input.onPointerDown(pointer(50));
      input.onPointerMove(pointer(120));
      expect(input.trace.value).not.toBeNull();
      cancel();
      expect(input.trace.value).toBeNull();
      expect(captures.size).toBe(0);
      input.onPointerUp(pointer(250));
      expect(move).not.toHaveBeenCalled();
    }
    width = 0;
    input.onPointerDown(pointer(50));
    expect(captures.size).toBe(0);
    width = 400;
    input.onPointerDown(pointer(50));
    input.onPointerMove(pointer(120));
    input.onPointerMove(pointer(250));
    expect(move).toHaveBeenCalledWith('b');
    expect(state.done.size).toBe(0);
  } finally { app.unmount(); }
  expect(captures.size).toBe(0);
});
