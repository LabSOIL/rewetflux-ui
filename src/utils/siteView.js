/**
 * Derives the map's default centre and its extent from a site polygon in
 * GeoJSON order ([lng, lat] pairs). Returns Leaflet's [lat, lng] shapes.
 */
export function siteView(geom) {
  const points = geom.coordinates.flat();
  const lats = points.map(([, lat]) => lat);
  const lngs = points.map(([lng]) => lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  return {
    centroid: [(south + north) / 2, (west + east) / 2],
    extent: [
      [south, west],
      [north, east],
    ],
  };
}
