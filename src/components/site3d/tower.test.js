import { describe, expect, it } from 'vitest';
import { symbolScale } from './tower';

describe('symbolScale', () => {
  // A 90 degree view 400 px high spans 2 m of height at 1 m, so 1 m is 200 px.
  const fov = 90;
  const viewport = 400;

  it('keeps the true size where it already meets the minimum height on screen', () => {
    expect(symbolScale(2.5, 1, fov, viewport, 64)).toBe(1);
  });

  it('grows the object to the minimum height on screen further out', () => {
    // 2.5 m at 100 m is 5 px high, so it grows 64 / 5 times.
    expect(symbolScale(2.5, 100, fov, viewport, 64)).toBeCloseTo(12.8);
  });
});
