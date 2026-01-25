/**
 * Geographic utility functions
 */

/**
 * Check if a point is inside a polygon using the ray-casting algorithm
 *
 * @param point - [longitude, latitude] coordinates of the point
 * @param polygon - Array of [longitude, latitude] pairs forming the polygon
 * @returns true if the point is inside the polygon
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: number[][],
): boolean {
  if (!polygon || polygon.length < 3) {
    return false;
  }

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Ray-casting: check if a horizontal ray from point crosses the edge
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
