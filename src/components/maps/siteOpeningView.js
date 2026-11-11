import L from 'leaflet';
import { SWITZERLAND_BOUNDS } from './basemap';

const FIT_PADDING = [20, 20];
const COVERAGE_MARGIN = 0.02;
// Space in px kept between a view's edge and a panel that reaches into the map from that edge.
const PANEL_CLEARANCE = 10;

/**
 * How far the panels reach into the map from its right and bottom edges, in px: the map card
 * at the top right, and at the bottom the higher of the date bar and the logo overlay. Read
 * from the rendered panels; a panel that is not rendered reaches zero.
 */
export function panelReach(map) {
  const container = map.getContainer();
  const edge = container.getBoundingClientRect();
  const card = container.querySelector('.map-card');
  const bar = container.closest('.App')?.querySelector('.bottom-bar');
  const logos = container.closest('.map-view')?.querySelector('.map-logos');
  const tops = [bar, logos].filter(Boolean).map(panel => panel.getBoundingClientRect().top);
  return {
    right: card ? Math.max(0, edge.right - card.getBoundingClientRect().left) : 0,
    bottom: tops.length ? Math.max(0, edge.bottom - Math.min(...tops)) : 0,
  };
}

/** The Leaflet padding that keeps a view's content clear of the panels in `reach`. */
export function clearOfPanels(reach) {
  return {
    padding: FIT_PADDING,
    paddingBottomRight: [reach.right + PANEL_CLEARANCE, reach.bottom + PANEL_CLEARANCE],
  };
}

/**
 * Opens a map on a site extent ([[south, west], [north, east]]): fits the extent without
 * animation, clear of the panels in `reach`, bounds panning to Switzerland, the swisstopo
 * coverage, padded by a small margin, and sets the minimum zoom to the zoom at which all of
 * Switzerland fits, so the map can zoom out to the country but no further.
 */
export function applySiteOpeningView(map, siteExtent, reach) {
  map.fitBounds(L.latLngBounds(siteExtent), { animate: false, ...clearOfPanels(reach) });
  const coverage = L.latLngBounds(SWITZERLAND_BOUNDS);
  map.setMaxBounds(coverage.pad(COVERAGE_MARGIN));
  map.setMinZoom(map.getBoundsZoom(coverage, false, FIT_PADDING));
}

/** Flies the map to `bounds` for one-second animation, clear of the panels as they are now drawn. */
export function flyToClearOfPanels(map, bounds) {
  map.flyToBounds(bounds, { duration: 1, ...clearOfPanels(panelReach(map)) });
}
