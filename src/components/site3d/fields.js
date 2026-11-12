import { insideRing } from './geo';

/** The depths in cm the slices are drawn at, shallowest first. */
export const DEPTHS = [5, 15, 25, 35];

// The generated variation: its length scale in metres, the distance over which it fades in from
// a probe, and the noise distance between adjacent depths, small so neighbouring slices look alike.
const NOISE_LENGTH = 45;
const PROBE_REACH = 14;
const DEPTH_STEP = 0.45;

function hash(i, j, k, seed) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x9e3779b1) ^ Math.imul(seed, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function noise(x, y, z, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const k = Math.floor(z);
  const u = smooth(x - i);
  const v = smooth(y - j);
  const w = smooth(z - k);
  const c = (a, b, d) => hash(i + a, j + b, k + d, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

const fractal = (x, y, z, seed) =>
  (noise(x, y, z, seed) + 0.5 * noise(2 * x + 17.3, 2 * y - 9.1, 2 * z, seed) + 0.25 * noise(4 * x - 5.7, 4 * y + 3.3, 4 * z, seed)) /
  1.75;

/**
 * A generated field at one depth: inverse-distance weighting of the probes' readings there, plus
 * seeded noise of `amplitude` that fades out towards each probe, so the field passes through every
 * reading. `probes` are [{ x, y, values }] with `values[depthIndex]` null where a probe has none.
 * Returns (x, y) => value; NaN everywhere when no probe has a reading at the depth.
 */
export function depthField(probes, depthIndex, amplitude, seed = 1) {
  const points = probes
    .filter(p => Number.isFinite(p.values[depthIndex]))
    .map(p => [p.x, p.y, p.values[depthIndex]]);
  if (!points.length) return () => NaN;
  return (x, y) => {
    let weights = 0;
    let sum = 0;
    let nearest = Infinity;
    for (const [px, py, value] of points) {
      const d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < 1e-12) return value;
      weights += 1 / d2;
      sum += value / d2;
      nearest = Math.min(nearest, d2);
    }
    const reach = 1 - Math.exp(-nearest / PROBE_REACH ** 2);
    return sum / weights + amplitude * reach * fractal(x / NOISE_LENGTH, y / NOISE_LENGTH, depthIndex * DEPTH_STEP, seed);
  };
}

/** The lowest and highest reading over every probe and depth, `{ min, max }`, or null with none. */
export function readingRange(probes) {
  const values = probes.flatMap(p => p.values).filter(Number.isFinite);
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

/**
 * The centre of each cell of a `width` x `height` grid spanning a block of half-extents
 * `halfWidth` and `halfHeight` about the origin, row 0 at the north.
 */
const cellCentre = ({ width, height, halfWidth, halfHeight }, i, j) => [
  -halfWidth + ((i + 0.5) * 2 * halfWidth) / width,
  halfHeight - ((j + 0.5) * 2 * halfHeight) / height,
];

/** The share of each grid cell inside the ring, 0 to 255, from four sub-samples per cell. */
export function ringCoverage(ring, grid) {
  const { width, height, halfWidth, halfHeight } = grid;
  const qx = halfWidth / width / 2;
  const qy = halfHeight / height / 2;
  const coverage = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const [x, y] = cellCentre(grid, i, j);
      let inside = 0;
      for (const [sx, sy] of [[-qx, -qy], [qx, -qy], [-qx, qy], [qx, qy]]) {
        if (insideRing([x + sx, y + sy], ring)) inside++;
      }
      coverage[j * width + i] = Math.round((inside * 255) / 4);
    }
  }
  return coverage;
}

/**
 * RGBA pixels of a field over the grid, row 0 at the north: each cell coloured by
 * `colour(value)` → [r, g, b] (or `missing` where the field has no value), its alpha the cell's
 * coverage, so the raster is empty outside the ring.
 */
export function paintField(field, coverage, grid, colour, missing = [128, 128, 128]) {
  const { width, height } = grid;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const value = field(...cellCentre(grid, i, j));
      const [r, g, b] = Number.isFinite(value) ? colour(value) : missing;
      const p = (j * width + i) * 4;
      pixels[p] = r;
      pixels[p + 1] = g;
      pixels[p + 2] = b;
      pixels[p + 3] = coverage[j * width + i];
    }
  }
  return pixels;
}

/** The 0 to 255 red, green and blue channels of a six-digit hex colour. */
export const hexChannels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** A colour function over [min, max] read from `steps` samples of `rgbAt(value)` → [r, g, b]. */
export function colourLookup(rgbAt, min, max, steps = 256) {
  const span = max - min || 1;
  const table = Array.from({ length: steps }, (_, k) => rgbAt(min + (span * k) / (steps - 1)));
  return value => table[Math.round(Math.min(1, Math.max(0, (value - min) / span)) * (steps - 1))];
}

/**
 * Samples the line from `from` to `to` at `count` points: the distance along it, the ground
 * height, whether the point is inside the ring, and each depth field's value there.
 */
export function crossSection({ from, to, count, heightAt, fields, ring }) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return Array.from({ length: count }, (_, k) => {
    const t = k / (count - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    return {
      distance: t * length,
      x,
      y,
      ground: heightAt(x, y),
      inside: insideRing([x, y], ring),
      values: fields.map(field => field(x, y)),
    };
  });
}
