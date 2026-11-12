import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import MapView from './MapView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SITE = {
  extent: [[46.93, 8.03], [46.995, 8.09]],
  centroid: [46.964, 8.06],
};

describe('MapView', () => {
  let container;
  let root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MapView
          areas={[]}
          activeAreaId={null}
          selectedData="Redox"
          selectArea={() => {}}
          setShouldRecenter={() => {}}
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

  it('places the zoom control at the bottom right', () => {
    expect(container.querySelector('.leaflet-bottom.leaflet-right .leaflet-control-zoom')).not.toBeNull();
    expect(container.querySelector('.leaflet-top.leaflet-left .leaflet-control-zoom')).toBeNull();
  });

  it('lists the basemap layers in the map card', () => {
    const baseNames = [...container.querySelectorAll('.map-card-base label')]
      .map(label => label.textContent.trim());
    const overlayNames = [...container.querySelectorAll('.map-card-overlays label')]
      .map(label => label.textContent.trim());
    expect(baseNames).toEqual(['Topo', 'Aerial']);
    expect(overlayNames).toEqual(['LiDAR / Relief']);
  });

  it('holds the basemap chooser and the legend in one card, a separator between them', () => {
    const card = container.querySelector('.map-card');
    expect(card).not.toBeNull();
    expect(container.querySelectorAll('.map-card')).toHaveLength(1);
    const radio = card.querySelector('.map-card-base input[type="radio"]');
    const title = card.querySelector('.legend-title');
    const separator = card.querySelector('hr');
    expect(radio).not.toBeNull();
    expect(title.textContent).toBe('Redox [mV]');
    expect(separator).not.toBeNull();
    expect(radio.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separator.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switches the base layer with the radio buttons', async () => {
    const radios = [...container.querySelectorAll('.map-card-base input[type="radio"]')];
    expect(radios.map(r => r.checked)).toEqual([false, true]);
    await act(async () => radios[0].click());
    expect([...container.querySelectorAll('.map-card-base input[type="radio"]')].map(r => r.checked))
      .toEqual([true, false]);
  });

  it('shows the funder logos as links in one overlay beside the map, outside the leaflet container', () => {
    const overlay = container.querySelector('.map-view > .map-logos');
    expect(overlay).not.toBeNull();
    expect(overlay.closest('.leaflet-container')).toBeNull();
    const links = [...overlay.querySelectorAll('a')];
    expect(links.map(a => a.querySelector('img').alt)).toEqual([
      'EPFL Logo',
      'Enterprise for Society Center Logo',
      'Pro Natura Logo',
    ]);
    links.forEach(a => expect(a.getAttribute('href')).toMatch(/^https:\/\//));
  });
});

describe('MapView.css', () => {
  const css = readFileSync('src/components/maps/MapView.css', 'utf8');
  const rule = selector =>
    [...css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'g'))]
      .map(m => m[1])
      .join('\n');

  it('places the logo overlay at the bottom right, above the date bar and clear of the zoom control', () => {
    expect(rule('.map-logos')).toMatch(/right:\s*50px/);
    expect(rule('.map-logos')).toMatch(/bottom:\s*115px/);
    expect(rule('.map-logos')).toMatch(/z-index:\s*1000/);
  });

  it('backs the logos with the theme logo background', () => {
    expect(rule('.map-logos')).toMatch(/background:\s*var\(--logo-background\)/);
  });

  it('sizes every logo to a 40px height with the width following its shape', () => {
    expect(rule('.map-logos img')).toMatch(/height:\s*40px/);
    expect(rule('.map-logos img')).toMatch(/width:\s*auto/);
  });

  it('shows the logos semi-transparent until they are hovered', () => {
    expect(rule('.map-logos')).toMatch(/opacity:\s*0\.55/);
    expect(rule('.map-logos:hover')).toMatch(/opacity:\s*1\b/);
  });
});
