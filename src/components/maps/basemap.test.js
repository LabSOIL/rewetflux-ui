import { describe, expect, it } from 'vitest';
import { BASEMAP_LAYERS, DEFAULT_BASEMAP_ID, MAX_ZOOM, thumbnailTiles, tileOptions } from './basemap';

describe('basemap layers', () => {
  it('lists exactly the two swisstopo base layers', () => {
    expect(BASEMAP_LAYERS.map(layer => layer.id)).toEqual(['topo', 'aerial']);
    for (const layer of BASEMAP_LAYERS) {
      expect(layer.url.startsWith('https://wmts20.geo.admin.ch/')).toBe(true);
    }
  });

  it('shows aerial by default', () => {
    expect(DEFAULT_BASEMAP_ID).toBe('aerial');
  });
});

describe('basemap zoom', () => {
  it('gives each layer the deepest zoom its swisstopo tiles reach', () => {
    const nativeZoom = Object.fromEntries(BASEMAP_LAYERS.map(layer => [layer.id, layer.maxNativeZoom]));
    expect(nativeZoom).toEqual({ topo: 19, aerial: 20 });
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

describe('basemap thumbnails', () => {
  const layer = { url: 'https://tiles.test/{z}/{x}/{y}.png' };

  it('takes the tiles around a point, placed from the thumbnail centre', () => {
    // The Web Mercator origin is the corner the four tiles of zoom 1 share.
    const tiles = thumbnailTiles(layer, [0, 0], { zoom: 1, scale: 0.5, width: 100, height: 60 });
    expect(tiles).toEqual([
      { url: 'https://tiles.test/1/0/0.png', dx: -128, dy: -128, size: 128 },
      { url: 'https://tiles.test/1/1/0.png', dx: 0, dy: -128, size: 128 },
      { url: 'https://tiles.test/1/0/1.png', dx: -128, dy: 0, size: 128 },
      { url: 'https://tiles.test/1/1/1.png', dx: 0, dy: 0, size: 128 },
    ]);
  });

  it('needs one tile for a thumbnail inside it', () => {
    // A quarter of the way into the north-east tile of zoom 1, both ways.
    const quarter = (2 * Math.PI * 6378137) / 8;
    const tiles = thumbnailTiles(layer, [quarter, quarter], { zoom: 1, scale: 1, width: 40, height: 40 });
    expect(tiles).toEqual([{ url: 'https://tiles.test/1/1/0.png', dx: -64, dy: -192, size: 256 }]);
  });
});
