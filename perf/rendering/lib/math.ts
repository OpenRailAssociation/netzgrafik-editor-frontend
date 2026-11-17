import type {Box, Vector} from "./types.ts";

export const getMedian = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const getBoxCenter = (box: Box): Vector => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/**
 * Smallest box containing all points.
 */
export const getBoundingBox = (points: Vector[]): Box => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
};

/**
 * Area where a move by `v` can start, so that it ends inside `box`.
 * Returns an area rather than a point, so that the caller can then pick in it a point where
 * nothing is drawn (no node, no section).
 */
export const getMoveStartArea = (box: Box, v: Vector): Box => {
  const range = (start: number, size: number, d: number): [number, number] => {
    if (Math.abs(d) >= size) throw new Error("Move larger than the box");
    return [start + Math.max(0, -d), size - Math.abs(d)];
  };
  const [x, width] = range(box.x, box.width, v.x);
  const [y, height] = range(box.y, box.height, v.y);
  return {x, y, width, height};
};
