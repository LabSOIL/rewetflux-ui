const WMTS_BASE = 'https://wmts20.geo.admin.ch/1.0.0';
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>';

/**
 * The swisstopo layers' coverage, [[south, west], [north, east]]: the WGS84 bounding box
 * the WMTS capabilities give for the EPSG:3857 layers.
 */
export const SWITZERLAND_BOUNDS = [[45.398181, 5.140242], [48.230651, 11.47757]];

/**
 * The map's background layers, one of which is always shown, in the order the chooser lists them.
 * `maxNativeZoom` is the deepest level the layer's EPSG:3857 tile matrix set holds, from the WMTS
 * capabilities.
 */
export const BASEMAP_LAYERS = [
  {
    id: 'topo',
    name: 'Topo',
    url: `${WMTS_BASE}/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg`,
    attribution: SWISSTOPO_ATTRIBUTION,
    opacity: 0.5,
    maxNativeZoom: 19,
  },
  {
    id: 'aerial',
    name: 'Aerial',
    url: `${WMTS_BASE}/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg`,
    attribution: SWISSTOPO_ATTRIBUTION,
    opacity: 0.5,
    maxNativeZoom: 20,
  },
];

export const DEFAULT_BASEMAP_ID = 'aerial';

/** The map's deepest zoom: the deepest native zoom of any of the layers. */
export const MAX_ZOOM = Math.max(...BASEMAP_LAYERS.map(layer => layer.maxNativeZoom));

/**
 * The options for a layer's tile layer. Its tiles stop at `maxNativeZoom` and are scaled
 * up to the map's `MAX_ZOOM`; Leaflet blanks a tile layer past its own `maxZoom`, which
 * defaults to 18, so that is set to the map's maximum as well.
 */
export const tileOptions = layer => ({
  url: layer.url,
  attribution: layer.attribution,
  opacity: layer.opacity,
  maxNativeZoom: layer.maxNativeZoom,
  maxZoom: MAX_ZOOM,
});

const TILE = 256;
const WORLD = 2 * Math.PI * 6378137;

/**
 * The tiles of a layer that fill a thumbnail centred on a Web Mercator point, at `zoom` and drawn
 * at `scale` of their size: each tile's URL, the offset in px of its top left corner from the
 * thumbnail's centre, and its size in px. `width` and `height` are the most the thumbnail spans.
 */
export function thumbnailTiles(layer, [x, y], { zoom, scale, width, height }) {
  const span = TILE * 2 ** zoom;
  const cx = ((x + WORLD / 2) / WORLD) * span;
  const cy = ((WORLD / 2 - y) / WORLD) * span;
  const halfWidth = width / 2 / scale;
  const halfHeight = height / 2 / scale;
  const tiles = [];
  for (let ty = Math.floor((cy - halfHeight) / TILE); ty <= Math.floor((cy + halfHeight) / TILE); ty++) {
    for (let tx = Math.floor((cx - halfWidth) / TILE); tx <= Math.floor((cx + halfWidth) / TILE); tx++) {
      tiles.push({
        url: layer.url.replace('{z}', zoom).replace('{x}', tx).replace('{y}', ty),
        dx: (tx * TILE - cx) * scale,
        dy: (ty * TILE - cy) * scale,
        size: TILE * scale,
      });
    }
  }
  return tiles;
}
