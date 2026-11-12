import { describe, expect, it } from 'vitest';
import { BASEMAP_LAYERS, DEFAULT_BASEMAP_ID, MAX_ZOOM, tileOptions } from './basemap';

describe('basemap layers', () => {
  it('lists exactly the three swisstopo layers', () => {
    expect(BASEMAP_LAYERS.map(layer => layer.id)).toEqual(['topo', 'aerial', 'relief']);
    for (const layer of BASEMAP_LAYERS) {
      expect(layer.url.startsWith('https://wmts20.geo.admin.ch/')).toBe(true);
    }
  });

  it('shows aerial by default, as a base layer', () => {
    expect(DEFAULT_BASEMAP_ID).toBe('aerial');
    const aerial = BASEMAP_LAYERS.find(layer => layer.id === DEFAULT_BASEMAP_ID);
    expect(aerial.kind).toBe('base');
  });

  it('draws relief as an overlay over the base layers', () => {
    const relief = BASEMAP_LAYERS.find(layer => layer.id === 'relief');
    expect(relief.kind).toBe('overlay');
  });
});

describe('basemap zoom', () => {
  it('gives each layer the deepest zoom its swisstopo tiles reach', () => {
    const nativeZoom = Object.fromEntries(BASEMAP_LAYERS.map(layer => [layer.id, layer.maxNativeZoom]));
    expect(nativeZoom).toEqual({ topo: 19, aerial: 20, relief: 18 });
  });

  it('lets the map zoom to the deepest native zoom of any layer', () => {
    expect(MAX_ZOOM).toBe(20);
    for (const layer of BASEMAP_LAYERS) {
      expect(MAX_ZOOM).toBeGreaterThanOrEqual(layer.maxNativeZoom);
    }
  });

  it('gives each tile layer the map maximum, so tiles scale up past their native zoom', () => {
    for (const layer of BASEMAP_LAYERS) {
      const options = tileOptions(layer);
      expect(options.url).toBe(layer.url);
      expect(options.maxNativeZoom).toBe(layer.maxNativeZoom);
      expect(options.maxZoom).toBe(MAX_ZOOM);
    }
  });
});
