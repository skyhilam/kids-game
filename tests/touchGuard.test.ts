// @vitest-environment happy-dom
import { createApp, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { installTouchGuard, useTouchGuard } from '../src/composables/useTouchGuard';

function touch(type: string, count: number, cancelable = true) {
  const event = new Event(type, { bubbles: true, cancelable });
  Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, () => ({})) });
  return event;
}

describe('touch zoom guard', () => {
  it('blocks multi-finger zoom on the home page, game and dialog without stopping delivery', () => {
    const cleanup = installTouchGuard(document);
    for (const tag of ['main', 'canvas', 'dialog']) {
      const element = document.createElement(tag);
      document.body.append(element);
      for (const type of ['touchstart', 'touchmove']) {
        const delivered = vi.fn();
        element.addEventListener(type, delivered, { once: true });
        const event = touch(type, 2);
        element.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(delivered).toHaveBeenCalledOnce();
      }
      element.remove();
    }
    cleanup();
  });

  it('preserves single-finger drawing, dragging, scrolling and normal button clicks', () => {
    const cleanup = installTouchGuard(document);
    const button = document.createElement('button');
    document.body.append(button);
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      const event = touch(type, type === 'touchend' ? 0 : 1);
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    button.click();
    expect(clicked).toHaveBeenCalledOnce();
    button.remove();
    cleanup();
  });

  it('blocks double-click and Safari gesture defaults only when cancelable', () => {
    const cleanup = installTouchGuard(document);
    for (const type of ['dblclick', 'gesturestart', 'gesturechange', 'gestureend']) {
      const event = new Event(type, { cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      const nonCancelable = new Event(type);
      document.dispatchEvent(nonCancelable);
      expect(nonCancelable.defaultPrevented).toBe(false);
    }
    const event = touch('touchmove', 2, false);
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    cleanup();
  });

  it('mounts non-passive capture listeners and removes every listener on App unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const host = document.createElement('div');
    const app = createApp({ setup() { useTouchGuard(); return () => h('div'); } });
    app.mount(host);
    const types = ['touchstart', 'touchmove', 'dblclick', 'gesturestart', 'gesturechange', 'gestureend'];
    const registrations = add.mock.calls.filter(([type]) => types.includes(type));
    expect(registrations).toHaveLength(types.length);
    app.unmount();
    for (const [type, listener, options] of registrations) {
      expect(options).toEqual({ capture: true, passive: false });
      expect(remove).toHaveBeenCalledWith(type, listener, options);
      const event = type.startsWith('touch') ? touch(type, 2) : new Event(type, { cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    add.mockRestore();
    remove.mockRestore();
  });
});
