type Handler = (...args: unknown[]) => void;

const listeners = new Map<string, Set<Handler>>();

/** Vue ↔ Phaser bridge, same role as the official template EventBus. */
export const EventBus = {
  on(event: string, fn: Handler): void {
    const set = listeners.get(event) ?? new Set();
    set.add(fn);
    listeners.set(event, set);
  },
  off(event: string, fn: Handler): void {
    listeners.get(event)?.delete(fn);
  },
  emit(event: string, ...args: unknown[]): void {
    listeners.get(event)?.forEach((fn) => fn(...args));
  },
};
