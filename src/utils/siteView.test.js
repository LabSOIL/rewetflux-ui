import { describe, expect, it } from 'vitest';
import { siteView } from './siteView';

describe('siteView', () => {
  const geom = {
    type: 'Polygon',
    coordinates: [[[8, 46], [8.2, 46], [8.2, 46.2], [8, 46.2], [8, 46]]],
  };

  it('centres the default view on the middle of the polygon', () => {
    const { centroid } = siteView(geom);
    expect(centroid[0]).toBeCloseTo(46.1, 6);
    expect(centroid[1]).toBeCloseTo(8.1, 6);
  });

  it('returns the polygon\'s own bounding box as the extent', () => {
    const { extent } = siteView(geom);
    expect(extent[0][0]).toBeCloseTo(46, 6);
    expect(extent[0][1]).toBeCloseTo(8, 6);
    expect(extent[1][0]).toBeCloseTo(46.2, 6);
    expect(extent[1][1]).toBeCloseTo(8.2, 6);
  });

  it('reads every ring of a polygon with holes', () => {
    const withHole = {
      type: 'Polygon',
      coordinates: [
        [[8, 46], [8.2, 46], [8.2, 46.2], [8, 46.2], [8, 46]],
        [[8.05, 46.05], [8.1, 46.05], [8.1, 46.1], [8.05, 46.05]],
      ],
    };
    const { extent } = siteView(withHole);
    expect(extent[1][1]).toBeCloseTo(8.2, 6);
  });
});
