/** Axis-aligned box described by its centre and half extents. */
export interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

export function overlaps(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
}
