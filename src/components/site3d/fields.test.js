import { describe, expect, it } from 'vitest';
import {
  DEPTHS,
  colourLookup,
  crossSection,
  hexChannels,
  depthField,
  paintField,
  readingRange,
  ringCoverage,
} from './fields';

const SQUARE = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
const PROBES = [
  { x: -10, y: 5, values: [100, 50, -20, -80] },
  { x: 12, y: -8, values: [300, null, 40, 10] },
  { x: 3, y: 14, values: [-150, -60, 0, 90] },
];
const GRID = { width: 16, height: 16, halfWidth: 40, halfHeight: 40 };

describe('depthField', () => {
  it('passes through every probe reading at its position', () => {
    DEPTHS.forEach((_, depthIndex) => {
      const field = depthField(PROBES, depthIndex, 80);
      for (const probe of PROBES) {
        if (probe.values[depthIndex] == null) continue;
        expect(field(probe.x, probe.y)).toBe(probe.values[depthIndex]);
      }
    });
  });

  it('gives the same values for the same inputs and other values for another seed', () => {
    const points = [[0, 0], [7.5, -3.2], [-18, 19]];
    const first = points.map(p => depthField(PROBES, 2, 80, 4)(...p));
    const again = points.map(p => depthField(PROBES, 2, 80, 4)(...p));
    const other = points.map(p => depthField(PROBES, 2, 80, 5)(...p));
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('stays within the readings when it carries no noise', () => {
    const field = depthField(PROBES, 0, 0);
    for (const [x, y] of [[0, 0], [-30, 30], [25, -25]]) {
      expect(field(x, y)).toBeGreaterThanOrEqual(-150);
      expect(field(x, y)).toBeLessThanOrEqual(300);
    }
  });

  it('is NaN everywhere when no probe has a reading at the depth', () => {
    const field = depthField([{ x: 0, y: 0, values: [null, null, null, null] }], 1, 80);
    expect(field(1, 1)).toBeNaN();
  });
});

describe('readingRange', () => {
  it('spans every reading over the probes and depths', () => {
    expect(readingRange(PROBES)).toEqual({ min: -150, max: 300 });
  });

  it('is null with no readings', () => {
    expect(readingRange([])).toBeNull();
  });
});

describe('ringCoverage and paintField', () => {
  const coverage = ringCoverage(SQUARE, GRID);
  const pixels = paintField(() => 1, coverage, GRID, () => [10, 20, 30]);
  // 16 cells over 80 m: 5 m each, cell centres from -37.5 to 37.5
  const alphaAt = (i, j) => pixels[(j * GRID.width + i) * 4 + 3];

  it('leaves the raster empty outside the ring', () => {
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(15, 8)).toBe(0);
    expect(alphaAt(8, 15)).toBe(0);
  });

  it('fills the cells inside the ring with the colour of the field', () => {
    expect(alphaAt(8, 8)).toBe(255);
    expect([...pixels.slice((8 * GRID.width + 8) * 4, (8 * GRID.width + 8) * 4 + 3)]).toEqual([10, 20, 30]);
  });

  it('paints the missing colour where the field has no value', () => {
    const blank = paintField(() => NaN, coverage, GRID, () => [10, 20, 30], [1, 2, 3]);
    expect([...blank.slice(0, 3)]).toEqual([1, 2, 3]);
  });
});

describe('hexChannels', () => {
  it('reads the red, green and blue of a hex colour', () => {
    expect(hexChannels('#ff8001')).toEqual([255, 128, 1]);
  });
});

describe('colourLookup', () => {
  it('reads the ends of the range and clamps beyond them', () => {
    const colour = colourLookup(value => [value, 0, 0], 0, 255);
    expect(colour(0)).toEqual([0, 0, 0]);
    expect(colour(255)).toEqual([255, 0, 0]);
    expect(colour(-50)).toEqual([0, 0, 0]);
    expect(colour(999)).toEqual([255, 0, 0]);
  });
});

describe('crossSection', () => {
  const fields = DEPTHS.map((depth, k) => (x, y) => x + y + k);
  const samples = crossSection({
    from: [-33, 0],
    to: [33, 0],
    count: 7,
    heightAt: (x, y) => 2 * x + y,
    fields,
    ring: SQUARE,
  });

  it('samples evenly along the line from one end to the other', () => {
    expect(samples.map(s => s.distance)).toEqual([0, 11, 22, 33, 44, 55, 66]);
    expect(samples[0].x).toBe(-33);
    expect(samples[6].x).toBe(33);
  });

  it('carries the ground height and every depth value at each sample', () => {
    expect(samples[1].ground).toBe(-44);
    expect(samples[1].values).toEqual([-22, -21, -20, -19]);
  });

  it('marks the samples inside the ring', () => {
    expect(samples.map(s => s.inside)).toEqual([false, false, true, true, true, false, false]);
  });
});
