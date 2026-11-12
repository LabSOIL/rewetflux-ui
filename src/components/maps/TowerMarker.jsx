import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import { getArea } from '../../data';
import { getTowerIcon } from '../../data/tower';
import { theme } from '../../theme';
import { innerLonLat } from '../site3d/geo';

const layout = getTowerIcon();
const [width, height] = layout.size;

// The tower drawn from its 3D model, its foot on the spot and a light halo so it reads on any basemap.
const icon = L.divIcon({
  className: 'tower-marker',
  html: `<img src="${layout.url}" width="${width}" height="${height}" alt="" style="filter: drop-shadow(0 0 1px ${theme.white}) drop-shadow(0 0 1px ${theme.white})">`,
  iconSize: layout.size,
  iconAnchor: layout.anchor,
});

const ring = getArea()?.geom?.coordinates?.[0];
const spot = ring && innerLonLat(ring);

/** The site's tower on the map, where the 3D view stands it. */
export default function TowerMarker() {
  if (!spot) return null;
  return (
    <Marker position={[spot[1], spot[0]]} icon={icon} keyboard={false}>
      <Tooltip direction="top" offset={[0, -layout.anchor[1]]}>
        Tower
      </Tooltip>
    </Marker>
  );
}
