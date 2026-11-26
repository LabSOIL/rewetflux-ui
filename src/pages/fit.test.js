import { describe, expect, it } from 'vitest';
import { largestFitting } from './fit';

describe('largestFitting', () => {
  const range = { min: 12, max: 18, step: 0.5 };

  it('finds the largest size that fits', () => {
    expect(largestFitting(px => px <= 15.5, range)).toBe(15.5);
  });

  it('takes the largest size when everything fits', () => {
    expect(largestFitting(() => true, range)).toBe(18);
  });

  it('falls back to the smallest size when nothing fits', () => {
    expect(largestFitting(() => false, range)).toBe(12);
  });
});
