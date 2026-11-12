const EARTH_RADIUS = 6378137;
const RAD = Math.PI / 180;

/** Web Mercator (EPSG:3857) metres of a longitude and latitude. */
export const mercator = (lon, lat) => [
  EARTH_RADIUS * lon * RAD,
  EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
];

/** The longitude and latitude of Web Mercator metres. */
export const lonLat = (x, y) => [
  x / EARTH_RADIUS / RAD,
  (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) / RAD,
];

/**
 * Local metres east and north of the centre of a [west, south, east, north] box: Web Mercator
 * scaled to true metres at the box's middle latitude, so basemap tiles map onto it linearly.
 */
export function localFrame([west, south, east, north]) {
  const [x0, y0] = mercator(west, south);
  const [x1, y1] = mercator(east, north);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const scale = Math.cos(((south + north) / 2) * RAD);
  return {
    mercatorBounds: [x0, y0, x1, y1],
    halfWidth: ((x1 - x0) / 2) * scale,
    halfHeight: ((y1 - y0) / 2) * scale,
    toLocal: (lon, lat) => {
      const [x, y] = mercator(lon, lat);
      return [(x - cx) * scale, (y - cy) * scale];
    },
    toLonLat: (e, n) => lonLat(cx + e / scale, cy + n / scale),
  };
}

/** Whether a point lies inside a ring of [x, y] points, by the even-odd rule. */
export function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The ring's points at most `step` apart along its edges, closed back to the first. */
export function densifyRing(ring, step) {
  const points = [];
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const parts = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < parts; k++) points.push([x0 + ((x1 - x0) * k) / parts, y0 + ((y1 - y0) * k) / parts]);
  }
  points.push(points[0]);
  return points;
}

/** The centre of a ring's bounding box. */
export function ringCentre(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/**
 * A point inside the ring near its centre: the centre of its bounding box when that is inside, else
 * the middle of the stretch inside the ring, along the line east-west through the centre, nearest to it.
 */
export function innerPoint(ring) {
  const [cx, cy] = ringCentre(ring);
  if (insideRing([cx, cy], ring)) return [cx, cy];
  const crossings = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > cy !== yj > cy) crossings.push(((xj - xi) * (cy - yi)) / (yj - yi) + xi);
  }
  crossings.sort((a, b) => a - b);
  let best = null;
  for (let k = 0; k + 1 < crossings.length; k += 2) {
    const [from, to] = [crossings[k], crossings[k + 1]];
    const gap = Math.max(from - cx, cx - to, 0);
    if (!best || gap < best.gap) best = { gap, x: (from + to) / 2 };
  }
  return best ? [best.x, cy] : [cx, cy];
}

/** The inner point of a ring of [lon, lat], found in Web Mercator as the 3D view's local frame finds it. */
export const innerLonLat = ring => lonLat(...innerPoint(ring.map(([lon, lat]) => mercator(lon, lat))));

/**
 * The direction in degrees, anticlockwise from east, of a cut line across the line of sight of a
 * camera at `azimuth` (radians, 0 looking north): its left normal points the way the camera looks.
 */
export const viewCutAngle = azimuth => ((((azimuth * 180) / Math.PI) % 360) + 360) % 360;

/**
 * The cut line through `centre` at `angle` degrees anticlockwise from east, moved `offset` metres
 * along its left normal and clipped to the box of half-extents `halfWidth` and `halfHeight`.
 * Returns `{ from, to, normal }`, or null when the line misses the box.
 */
export function cutLine(centre, angle, offset, halfWidth, halfHeight) {
  const dx = Math.cos(angle * RAD);
  const dy = Math.sin(angle * RAD);
  const normal = [-dy, dx];
  const px = centre[0] + normal[0] * offset;
  const py = centre[1] + normal[1] * offset;
  let lo = -Infinity;
  let hi = Infinity;
  for (const [p, d, half] of [[px, dx, halfWidth], [py, dy, halfHeight]]) {
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(p) > half) return null;
      continue;
    }
    const a = (-half - p) / d;
    const b = (half - p) / d;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  if (lo >= hi) return null;
  return { from: [px + dx * lo, py + dy * lo], to: [px + dx * hi, py + dy * hi], normal };
}
