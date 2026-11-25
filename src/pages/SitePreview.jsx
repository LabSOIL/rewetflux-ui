import { CircleMarker, MapContainer, Polygon, TileLayer } from 'react-leaflet';
import { BASEMAP_LAYERS, DEFAULT_BASEMAP_ID, tileOptions } from '../components/maps/basemap';
import { getArea } from '../data';
import { siteView } from '../utils/siteView';
import { theme } from '../theme';

const AREA = getArea();
const SITE = siteView(AREA.geom);
const BASEMAP = BASEMAP_LAYERS.find(layer => layer.id === DEFAULT_BASEMAP_ID);

// One marker per position: a sensor appears once for each of its profile types.
const POSITIONS = [...new Map(AREA.sensors.map(s => [s.id, s.geom['4326']])).values()];

// The site outline in Leaflet's [lat, lng] order.
const OUTLINE = AREA.geom.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));

/** A still view of the site map: the aerial basemap, the site outline and the positions, fitted to the site. */
export default function SitePreview() {
  return (
    <MapContainer
      bounds={SITE.extent}
      boundsOptions={{ padding: [24, 24] }}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
    >
      <TileLayer {...tileOptions(BASEMAP)} opacity={1} />
      <Polygon
        positions={OUTLINE}
        pathOptions={{
          color: theme.selectedArea,
          weight: 2,
          fillOpacity: 0.08,
        }}
        interactive={false}
      />
      {POSITIONS.map(({ x, y }) => (
        <CircleMarker
          key={`${x},${y}`}
          center={[y, x]}
          radius={4}
          pathOptions={{
            color: theme.white,
            weight: 1.5,
            fillColor: theme.accent,
            fillOpacity: 1,
          }}
          interactive={false}
        />
      ))}
    </MapContainer>
  );
}
