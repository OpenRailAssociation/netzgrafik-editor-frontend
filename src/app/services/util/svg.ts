import {Vec2D} from "../../utils/vec2D";

/**
 * SVG path string through the given points. Corners are cut by a diagonal of
 * length `cut` (0 for a plain polyline), like transitions within nodes.
 */
export function buildPathString(path: Vec2D[], cut: number): string {
  const points = Vec2D.dedupe(path);
  if (points.length === 0) {
    return "";
  }
  const coords = (p: Vec2D) => p.getX() + "," + p.getY();
  let svg = "M" + coords(points[0]);
  for (let i = 1; i < points.length; i++) {
    if (cut === 0 || i === points.length - 1) {
      svg += "L" + coords(points[i]);
      continue;
    }
    const corner = points[i];
    const inVec = Vec2D.sub(corner, points[i - 1]);
    const outVec = Vec2D.sub(points[i + 1], corner);
    const r = Math.min(cut, Vec2D.norm(inVec) / 2, Vec2D.norm(outVec) / 2);
    const cutStart = Vec2D.sub(corner, Vec2D.scale(Vec2D.normalize(inVec), r));
    const cutEnd = Vec2D.add(corner, Vec2D.scale(Vec2D.normalize(outVec), r));
    svg += "L" + coords(cutStart) + "L" + coords(cutEnd);
  }
  return svg;
}
