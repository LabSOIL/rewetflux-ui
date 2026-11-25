import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MapView from './MapView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SITE = {
  extent: [[46.93, 8.03], [46.995, 8.09]],
  centroid: [46.964, 8.06],
};

describe('MapView', () => {
  let container;
  let root;
  let recentred;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    recentred = [];
    await act(async () => {
      root.render(
        <MapView
          areas={[]}
          activeAreaId={null}
          selectedData="Redox"
          selectArea={() => {}}
          setShouldRecenter={value => recentred.push(value)}
          shouldRecenter={false}
          extent={SITE.extent}
          centroid={SITE.centroid}
          defaultColour="#000000"
          depth={5}
          redoxMin={0}
          redoxMax={1}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('draws a scale bar on the map', () => {
    expect(container.querySelector('.leaflet-control-scale')).not.toBeNull();
  });

  it('draws no zoom box on a Shift-drag', () => {
    const map = container.querySelector('.leaflet-container');
    const mouse = (type, x) =>
      new MouseEvent(type, { bubbles: true, shiftKey: true, button: 0, which: 1, clientX: x, clientY: x });
    map.dispatchEvent(mouse('mousedown', 10));
    document.dispatchEvent(mouse('mousemove', 60));
    expect(container.querySelector('.leaflet-zoom-box')).toBeNull();
    document.dispatchEvent(mouse('mouseup', 60));
  });

  const controls = () => container.querySelector('.map-view > .view-controls');
  const control = name => controls().querySelector(`button[aria-label="${name}"]`);

  it('keeps the view controls outside the map, a recentre button above Zoom in and Zoom out', () => {
    expect(controls().closest('.leaflet-container')).toBeNull();
    const names = [...controls().querySelectorAll('button')].map(b => b.getAttribute('aria-label'));
    expect(names).toEqual(['Recentre on the site', 'Zoom in', 'Zoom out']);
    expect(container.querySelector('.leaflet-control-zoom')).toBeNull();
  });

  it('shows no compass on the 2D map, which is always north up, and recentres on the site', async () => {
    expect(controls().querySelector('.view-controls-north')).toBeNull();
    await act(async () => control('Recentre on the site').click());
    expect(recentred).toEqual([true]);
  });

  const switcher = () => container.querySelector('.map-view > .map-basemap');
  const thumbnail = () => switcher().querySelector('.map-basemap-thumbnail').style.backgroundImage;

  it('switches the basemap from a thumbnail of the other layer at the corner of the map', async () => {
    expect(switcher().closest('.leaflet-container')).toBeNull();
    expect(switcher().textContent.trim()).toBe('Topo');
    expect(thumbnail()).toContain('ch.swisstopo.pixelkarte-farbe');
    expect(container.querySelector('.leaflet-tile-pane .leaflet-layer')).not.toBeNull();
    await act(async () => switcher().click());
    expect(switcher().textContent.trim()).toBe('Aerial');
    expect(thumbnail()).toContain('ch.swisstopo.swissimage');
  });

  it('carries no logos', () => {
    expect(container.querySelector('.map-view img[alt$="Logo"]')).toBeNull();
  });

  it('holds the legend alone in the card at the top right', () => {
    const card = container.querySelector('.map-card');
    expect(container.querySelectorAll('.map-card')).toHaveLength(1);
    expect(card.querySelector('.legend-title').textContent).toBe('Redox [mV]');
    expect(card.querySelector('input, hr')).toBeNull();
  });
});
