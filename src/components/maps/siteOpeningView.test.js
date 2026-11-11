import L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { applySiteOpeningView, flyToClearOfPanels, panelReach } from './siteOpeningView';

// swisstopo WMTS capabilities for EPSG:3857: WGS84BoundingBox of the layers, [[south, west], [north, east]]
const SWITZERLAND = [[45.398181, 5.140242], [48.230651, 11.47757]];

// The panels as the app lays them out on a 1430x830 window: the map card at the top right,
// the date bar 30px above the bottom edge, the map starting past the rail.
const LAYOUT = {
  map: { left: 101, top: 0, right: 1430, bottom: 830 },
  card: { left: 1280, top: 10, right: 1420, bottom: 337 },
  bar: { left: 110, top: 729, right: 1380, bottom: 800 },
  // The logo overlay sits 115px above the bottom edge: a 40px row with its 6px backing each side.
  logos: { left: 1000, top: 663, right: 1380, bottom: 715 },
};
const REACH = { right: 150, bottom: 101 };

function placed(el, box) {
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top });
  return el;
}

// The map's container with its card, inside the app's layout with the date bar beside the map.
function appWith({ card = true, bar = true, logos = false } = {}) {
  const app = document.createElement('div');
  app.className = 'App';
  const mapView = document.createElement('div');
  mapView.className = 'map-view';
  const container = placed(document.createElement('div'), LAYOUT.map);
  container.className = 'leaflet-container';
  if (card) {
    const mapCard = placed(document.createElement('div'), LAYOUT.card);
    mapCard.className = 'map-card';
    container.appendChild(mapCard);
  }
  mapView.appendChild(container);
  if (logos) {
    const overlay = placed(document.createElement('div'), LAYOUT.logos);
    overlay.className = 'map-logos';
    mapView.appendChild(overlay);
  }
  app.appendChild(mapView);
  if (bar) {
    const dateBar = placed(document.createElement('div'), LAYOUT.bar);
    dateBar.className = 'bottom-bar';
    app.appendChild(dateBar);
  }
  return container;
}

function fakeMap({ fittedZoom = 14, switzerlandZoom = 8, container = appWith() } = {}) {
  const calls = {};
  return {
    calls,
    getContainer: () => container,
    fitBounds: (b, o) => { calls.fit = [b, o]; },
    flyToBounds: (b, o) => { calls.fly = [b, o]; },
    setMaxBounds: (b) => { calls.max = b; },
    setMinZoom: (z) => { calls.minZoom = z; },
    getZoom: () => fittedZoom,
    getBoundsZoom: (b, inside, padding) => {
      calls.switzerland = [b, inside, padding];
      return switzerlandZoom;
    },
  };
}

describe('applySiteOpeningView', () => {
  const siteExtent = [[46.9, 8.0], [47.0, 8.2]];

  it('fits the site extent without animation and with a 20px padding', () => {
    const map = fakeMap();
    applySiteOpeningView(map, siteExtent, REACH);
    expect(map.calls.fit[0].equals(L.latLngBounds(siteExtent))).toBe(true);
    expect(map.calls.fit[1]).toMatchObject({ animate: false, padding: [20, 20] });
  });

  it('fits the site clear of the card on the right and the date bar at the bottom', () => {
    const map = fakeMap();
    applySiteOpeningView(map, siteExtent, REACH);
    const [right, bottom] = map.calls.fit[1].paddingBottomRight;
    expect(right).toBeGreaterThanOrEqual(REACH.right);
    expect(bottom).toBeGreaterThanOrEqual(REACH.bottom);
  });

  it('bounds panning to Switzerland padded by a small margin', () => {
    const map = fakeMap();
    applySiteOpeningView(map, siteExtent, REACH);
    expect(map.calls.max.equals(L.latLngBounds(SWITZERLAND).pad(0.02))).toBe(true);
  });

  it('sets the minimum zoom to the zoom at which all of Switzerland fits', () => {
    const map = fakeMap();
    applySiteOpeningView(map, siteExtent, REACH);
    expect(map.calls.switzerland[0].equals(L.latLngBounds(SWITZERLAND))).toBe(true);
    expect(map.calls.minZoom).toBe(8);
  });
});

describe('panelReach', () => {
  it('measures how far the card and the date bar reach into the map from its right and bottom edges', () => {
    expect(panelReach(fakeMap())).toEqual(REACH);
  });

  it('reaches zero for a panel that is not rendered', () => {
    expect(panelReach(fakeMap({ container: appWith({ card: false, bar: false }) }))).toEqual({ right: 0, bottom: 0 });
  });

  it('reaches up to the logo overlay where the overlay sits above the date bar', () => {
    const reach = panelReach(fakeMap({ container: appWith({ logos: true }) }));
    expect(reach.bottom).toBe(LAYOUT.map.bottom - LAYOUT.logos.top);
  });
});

describe('flyToClearOfPanels', () => {
  it('flies to the bounds with the padding that keeps them clear of the panels', () => {
    const map = fakeMap();
    const bounds = L.latLngBounds([[46.9, 8.0], [47.0, 8.2]]);
    flyToClearOfPanels(map, bounds);
    expect(map.calls.fly[0]).toBe(bounds);
    expect(map.calls.fly[1].duration).toBe(1);
    const [right, bottom] = map.calls.fly[1].paddingBottomRight;
    expect(right).toBeGreaterThanOrEqual(REACH.right);
    expect(bottom).toBeGreaterThanOrEqual(REACH.bottom);
  });
});
