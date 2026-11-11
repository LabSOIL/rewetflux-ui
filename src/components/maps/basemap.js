const WMTS_BASE = 'https://wmts20.geo.admin.ch/1.0.0';
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>';

/**
 * The swisstopo layers' coverage, [[south, west], [north, east]]: the WGS84 bounding box
 * the WMTS capabilities give for the EPSG:3857 layers.
 */
export const SWITZERLAND_BOUNDS = [[45.398181, 5.140242], [48.230651, 11.47757]];

/**
 * The map's background layers, in the order the layer control lists them.
 * `kind` is `base` for a layer one of which is always shown, or `overlay` for a
 * layer drawn over the chosen base. `maxNativeZoom` is the deepest level the
 * layer's EPSG:3857 tile matrix set holds, from the WMTS capabilities.
 */
export const BASEMAP_LAYERS = [
  {
    id: 'topo',
    name: 'Topo',
    kind: 'base',
    url: `${WMTS_BASE}/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg`,
    attribution: SWISSTOPO_ATTRIBUTION,
    opacity: 0.5,
    maxNativeZoom: 19,
  },
  {
    id: 'aerial',
    name: 'Aerial',
    kind: 'base',
    url: `${WMTS_BASE}/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg`,
    attribution: SWISSTOPO_ATTRIBUTION,
    opacity: 0.5,
    maxNativeZoom: 20,
  },
  {
    id: 'relief',
    name: 'LiDAR / Relief',
    kind: 'overlay',
    url: `${WMTS_BASE}/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png`,
    attribution: '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo swissALTI3D</a>',
    opacity: 0.5,
    maxNativeZoom: 18,
  },
];

export const DEFAULT_BASEMAP_ID = 'topo';

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
