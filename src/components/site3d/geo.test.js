import { describe, expect, it } from 'vitest';
import { cutLine, densifyRing, innerPoint, insideRing, localFrame, ringCentre, viewCutAngle } from './geo';
import { terrainModel } from './terrain';

describe('localFrame', () => {
  const frame = localFrame([2.0, 40.0, 2.004, 40.003]);

  it('puts the centre of the box at the origin', () => {
    const [e, n] = frame.toLocal(2.002, 40.0015);
    expect(Math.abs(e)).toBeLessThan(1e-6);
    expect(Math.abs(n)).toBeLessThan(0.01);
  });

  it('measures true metres at the middle latitude', () => {
    // 0.004 degrees of longitude at 40 degrees north: about 341 m
    expect(2 * frame.halfWidth).toBeCloseTo(341.3, 0);
    // 0.003 degrees of latitude: about 333 m
    expect(2 * frame.halfHeight).toBeCloseTo(333.6, 0);
  });

  it('turns local metres back into the same longitude and latitude', () => {
    const [lon, lat] = frame.toLonLat(...frame.toLocal(2.0031, 40.0007));
    expect(lon).toBeCloseTo(2.0031, 9);
    expect(lat).toBeCloseTo(40.0007, 9);
  });
});

describe('rings', () => {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it('tells points inside from points outside', () => {
    expect(insideRing([5, 5], ring)).toBe(true);
    expect(insideRing([15, 5], ring)).toBe(false);
  });

  it('densifies each edge to the step and closes the ring', () => {
    const points = densifyRing(ring, 2.5);
    expect(points).toHaveLength(17);
    expect(points[16]).toEqual(points[0]);
    expect(points[1]).toEqual([2.5, 0]);
  });

  it('finds the centre of the bounding box', () => {
    expect(ringCentre([[0, 0], [10, 2], [4, 8]])).toEqual([5, 4]);
  });

  it('takes the centre as the inner point when it lies inside', () => {
    expect(innerPoint(ring)).toEqual([5, 5]);
  });

  it('moves the inner point into the ring when the centre falls outside it', () => {
    // A U open to the north: the centre (5, 5) lies in the gap between the arms.
    const u = [[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10]];
    const point = innerPoint(u);
    expect(insideRing(point, u)).toBe(true);
    expect(point[1]).toBe(5);
    expect(point[0]).toBeCloseTo(1.5);
  });
});

describe('cutLine', () => {
  it('runs an east-west line from edge to edge of the box', () => {
    const line = cutLine([0, 0], 0, 0, 50, 30);
    expect(line.from).toEqual([-50, 0]);
    expect(line.to).toEqual([50, 0]);
  });

  it('moves the line along its left normal by the offset', () => {
    const line = cutLine([0, 0], 0, 10, 50, 30);
    expect(line.from[1]).toBeCloseTo(10);
    expect(line.normal[0]).toBeCloseTo(0);
    expect(line.normal[1]).toBeCloseTo(1);
  });

  it('clips a diagonal line to the box', () => {
    const line = cutLine([0, 0], 45, 0, 50, 30);
    expect(line.from[0]).toBeCloseTo(-30);
    expect(line.from[1]).toBeCloseTo(-30);
    expect(line.to[0]).toBeCloseTo(30);
  });

  it('runs across the line of sight at the camera heading, its normal pointing the way the camera looks', () => {
    for (const azimuth of [0, Math.PI / 2, 2.5, -1]) {
      // A camera at this azimuth looks along (-sin, cos) in east and north.
      const line = cutLine([0, 0], viewCutAngle(azimuth), 0, 50, 50);
      expect(line.normal[0]).toBeCloseTo(-Math.sin(azimuth));
      expect(line.normal[1]).toBeCloseTo(Math.cos(azimuth));
    }
    expect(viewCutAngle(-Math.PI / 2)).toBeCloseTo(270);
  });

  it('is null when the line misses the box', () => {
    expect(cutLine([0, 0], 0, 40, 50, 30)).toBeNull();
  });
});

describe('terrainModel', () => {
  // 3 x 2 heights in cm, the first row at the north
  const terrain = terrainModel({
    bounds: [2.0, 40.0, 2.002, 40.001],
    size: [3, 2],
    base: 500,
    heights: [100, 200, 300, 400, 500, 600],
  });

  it('reads the grid in metres above the base, row 0 at the north', () => {
    const west = terrain.eastOf(0);
    const north = terrain.northOf(0);
    expect(terrain.heightAt(west, north)).toBeCloseTo(1);
    expect(terrain.heightAt(terrain.eastOf(2), terrain.northOf(1))).toBeCloseTo(6);
  });

  it('interpolates between the grid heights', () => {
    const midEast = (terrain.eastOf(0) + terrain.eastOf(1)) / 2;
    const midNorth = (terrain.northOf(0) + terrain.northOf(1)) / 2;
    // the mean of 1, 2, 4 and 5 m
    expect(terrain.heightAt(midEast, midNorth)).toBeCloseTo(3);
  });

  it('takes the nearest edge for a point off the grid', () => {
    expect(terrain.heightAt(-1e6, 1e6)).toBeCloseTo(1);
  });

  it('knows its lowest and highest height', () => {
    expect([terrain.low, terrain.high]).toEqual([1, 6]);
  });
});
