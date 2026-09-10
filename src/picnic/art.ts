import type { Point } from '../game/types';

/** Shop sprite sits above the node; clamp so a top-rail shop stays in the viewBox. */
export const SHOP_ART = { width: 164, height: 135, dx: 82, dy: 165 } as const;

export function shopArtOrigin(shop: Point): Point {
  return [shop[0] - SHOP_ART.dx, Math.max(0, shop[1] - SHOP_ART.dy)];
}
