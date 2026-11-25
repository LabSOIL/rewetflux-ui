import { TileLayer } from 'react-leaflet';
import { getArea } from '../../data';
import { mercator } from '../site3d/geo';
import { BASEMAP_LAYERS, DEFAULT_BASEMAP_ID, thumbnailTiles, tileOptions } from './basemap';

export { DEFAULT_BASEMAP_ID };

// The thumbnails show each layer's own tiles around the middle of the site, at half their size so
// they stay sharp on high-density screens; the tiles fill the switcher.
const THUMBNAIL = { zoom: 16, scale: 0.5, width: 72, height: 72 };

function siteCentre() {
  const ring = getArea()?.geom?.coordinates?.[0];
  if (!ring) return [0, 0];
  const points = ring.map(([lon, lat]) => mercator(lon, lat));
  const middle = axis => (Math.min(...points.map(p => p[axis])) + Math.max(...points.map(p => p[axis]))) / 2;
  return [middle(0), middle(1)];
}

/** The background of a layer's thumbnail: its tiles, each placed from the thumbnail's centre. */
function thumbnailStyle(layer, centre) {
  const tiles = thumbnailTiles(layer, centre, THUMBNAIL);
  return {
    backgroundImage: tiles.map(t => `url("${t.url}")`).join(', '),
    backgroundPosition: tiles.map(t => `calc(50% + ${t.dx + t.size / 2}px) calc(50% + ${t.dy + t.size / 2}px)`).join(', '),
    backgroundSize: tiles.map(t => `${t.size}px ${t.size}px`).join(', '),
    backgroundRepeat: 'no-repeat',
  };
}

const CENTRE = siteCentre();
const THUMBNAILS = Object.fromEntries(BASEMAP_LAYERS.map(layer => [layer.id, thumbnailStyle(layer, CENTRE)]));

/** The tile layer of the chosen base. */
export const BaseLayers = ({ baseId }) => (
    <>
        {BASEMAP_LAYERS.filter(layer => layer.id === baseId).map(layer => (
            <TileLayer key={layer.id} {...tileOptions(layer)} />
        ))}
    </>
);

/**
 * The basemap switcher: a thumbnail of the layer it switches to, over the site, with that layer's
 * name; pressing it shows that layer. With more than two bases it steps through them in turn.
 */
export function BaseSwitcher({ baseId, onBase }) {
    const at = BASEMAP_LAYERS.findIndex(layer => layer.id === baseId);
    const next = BASEMAP_LAYERS[(at + 1) % BASEMAP_LAYERS.length];
    return (
        <button
            type="button"
            className="map-basemap"
            onClick={() => onBase(next.id)}
            aria-label={`${next.name} basemap`}
            title={`Show the ${next.name} basemap`}
        >
            <span className="map-basemap-thumbnail" style={THUMBNAILS[next.id]} aria-hidden="true" />
            <span className="map-basemap-name">{next.name}</span>
        </button>
    );
}
