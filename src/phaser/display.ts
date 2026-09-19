/** Cap fill-rate on 3x phones; 2x already matches typical desktop boards. */
export const MAX_BOARD_DPR = 2;

export type BoardBacking = {
  dpr: number;
  cssW: number;
  cssH: number;
  width: number;
  height: number;
};

export function boardDpr(dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1): number {
  return Math.min(Math.max(1, dpr), MAX_BOARD_DPR);
}

export function boardBacking(
  parent: { clientWidth: number; clientHeight: number } | null,
  logical: { width: number; height: number },
  dpr = boardDpr(),
): BoardBacking {
  const cssW = Math.max(1, parent?.clientWidth || logical.width);
  const cssH = Math.max(1, parent?.clientHeight || logical.height);
  const fit = Math.min(cssW / logical.width, cssH / logical.height);
  const displayW = logical.width * fit;
  const displayH = logical.height * fit;
  const width = Math.max(1, Math.round(displayW * dpr));
  const scale = width / logical.width;
  return {
    dpr,
    cssW: displayW,
    cssH: displayH,
    width,
    height: Math.max(1, Math.round(logical.height * scale)),
  };
}

export function worldScale(backing: BoardBacking, logical: { width: number; height: number }): { x: number; y: number } {
  const scale = backing.width / logical.width;
  return { x: scale, y: scale };
}

/** Rasterize labels at backing scale so the world container does not blur the glyphs. */
export function labelRaster(worldScale: number): { fontMul: number; zoom: number } {
  const fontMul = Math.max(1, worldScale);
  return { fontMul, zoom: 1 / fontMul };
}

/** Fit `src` inside `box` the way SVG `meet` does — never stretch. */
export function fitSize(
  srcWidth: number,
  srcHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  if (srcWidth < 1 || srcHeight < 1) return { width: boxWidth, height: boxHeight };
  const scale = Math.min(boxWidth / srcWidth, boxHeight / srcHeight);
  return { width: srcWidth * scale, height: srcHeight * scale };
}

/** Match the canvas backing store to CSS size × DPR, keep map coordinates in a uniformly scaled world. */
export function syncBoardCanvas(
  scene: { scale: { width: number; height: number; resize: (width: number, height: number) => void }; game: { canvas: HTMLCanvasElement } },
  logical: { width: number; height: number },
): { resized: boolean; scale: { x: number; y: number } } {
  const backing = boardBacking(scene.game.canvas.parentElement, logical);
  const resized = scene.scale.width !== backing.width || scene.scale.height !== backing.height;
  if (resized) scene.scale.resize(backing.width, backing.height);
  const canvas = scene.game.canvas;
  canvas.style.width = `${backing.cssW}px`;
  canvas.style.height = `${backing.cssH}px`;
  return { resized, scale: worldScale(backing, logical) };
}
