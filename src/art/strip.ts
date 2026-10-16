export type StripBox = {
  width: number;
  height: number;
  padX: number;
  padY: number;
  gap: number;
};

/** Equal square cells, centered within the padded box. Gap shrinks when space is tight. */
export function stripLayout(count: number, box: StripBox): { x: number; y: number; width: number; height: number }[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const width = Math.max(0, box.width - 2 * box.padX);
  const height = Math.max(0, box.height - 2 * box.padY);
  const gap = count > 1 ? Math.min(Math.max(0, box.gap), width / (count - 1)) : 0;
  const size = Math.min(height, (width - gap * (count - 1)) / count);
  const startX = (box.width - (count * size + (count - 1) * gap)) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (size + gap),
    y: (box.height - size) / 2,
    width: size,
    height: size,
  }));
}
