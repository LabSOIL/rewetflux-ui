import { localFrame } from './geo';

/**
 * The site block's ground from a height grid document ({ bounds, size, base, heights in cm above
 * base, rows from the north }): heights in metres above `base` in local metres east and north.
 */
export function terrainModel({ bounds, size: [nx, ny], base, heights: cm }) {
  const frame = localFrame(bounds);
  const heights = Float32Array.from(cm, h => h / 100);
  const west = -frame.halfWidth;
  const north = frame.halfHeight;
  const dx = (2 * frame.halfWidth) / (nx - 1);
  const dy = (2 * frame.halfHeight) / (ny - 1);
  const at = (i, j) => heights[j * nx + i];

  // Bilinear between the four nearest heights; a point off the grid takes the nearest edge.
  const heightAt = (e, n) => {
    const fx = Math.min(nx - 1, Math.max(0, (e - west) / dx));
    const fy = Math.min(ny - 1, Math.max(0, (north - n) / dy));
    const i = Math.min(nx - 2, Math.floor(fx));
    const j = Math.min(ny - 2, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - j;
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  let low = Infinity;
  let high = -Infinity;
  for (const h of heights) {
    low = Math.min(low, h);
    high = Math.max(high, h);
  }

  return {
    frame,
    nx,
    ny,
    base,
    heights,
    low,
    high,
    heightAt,
    eastOf: i => west + i * dx,
    northOf: j => north - j * dy,
  };
}
