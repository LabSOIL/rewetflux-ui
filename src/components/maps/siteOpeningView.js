import L from 'leaflet';
import { SWITZERLAND_BOUNDS } from './basemap';

const FIT_PADDING = [20, 20];
const COVERAGE_MARGIN = 0.02;
// Space in px kept between a view's edge and a panel that reaches into the map from that edge.
const PANEL_CLEARANCE = 10;

// A panel's box, or null when it is not in the page or not drawn (hidden, or empty, has no size).
function drawn(panel) {
  const box = panel?.getBoundingClientRect();
  return box && box.width > 0 && box.height > 0 ? box : null;
}

/**
 * How far the panels reach into the map from its right and bottom edges, in px: the map card
 * at the top right, and at the bottom the higher of the date bar and the basemap switcher. Read from the drawn panels; a panel that is not drawn reaches zero.
 */
export function panelReach(map) {
  const container = map.getContainer();
  const edge = container.getBoundingClientRect();
  const view = container.closest('.map-view');
  const card = drawn(container.querySelector('.map-card'));
  const tops = [
    container.closest('.App')?.querySelector('.bottom-bar'),
    view?.querySelector('.map-basemap'),
  ]
    .map(drawn)
    .filter(Boolean)
    .map(box => box.top);
  return {
    right: card ? Math.max(0, edge.right - card.left) : 0,
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
