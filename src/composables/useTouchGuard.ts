import { onMounted, onUnmounted } from 'vue';

/** Document-level coverage includes native dialogs and content outside #app. */
export function installTouchGuard(target: Document): () => void {
  const options = { capture: true, passive: false };
  const preventZoom = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const preventMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) preventZoom(event);
  };

  // Keep single-finger events and click delivery intact for drawing, dragging,
  // buttons and scrolling. CSS handles double taps; dblclick is a fallback.
  target.addEventListener('touchstart', preventMultiTouch, options);
  target.addEventListener('touchmove', preventMultiTouch, options);
  target.addEventListener('dblclick', preventZoom, options);
  // Safari exposes pinch gestures separately from standard touch events.
  target.addEventListener('gesturestart', preventZoom, options);
  target.addEventListener('gesturechange', preventZoom, options);
  target.addEventListener('gestureend', preventZoom, options);

  return () => {
    target.removeEventListener('touchstart', preventMultiTouch, options);
    target.removeEventListener('touchmove', preventMultiTouch, options);
    target.removeEventListener('dblclick', preventZoom, options);
    target.removeEventListener('gesturestart', preventZoom, options);
    target.removeEventListener('gesturechange', preventZoom, options);
    target.removeEventListener('gestureend', preventZoom, options);
  };
}

export function useTouchGuard() {
  let cleanup: (() => void) | undefined;
  onMounted(() => { cleanup = installTouchGuard(document); });
  onUnmounted(() => { cleanup?.(); });
}
