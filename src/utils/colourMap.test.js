import { describe, expect, it } from 'vitest';
import { colormap, getPalette } from './colourMap';

describe('colormap', () => {
  it('returns null for a value that is not finite', () => {
    expect(colormap(null, 0, 1)).toBeNull();
    expect(colormap(undefined, 0, 1)).toBeNull();
    expect(colormap(NaN, 0, 1)).toBeNull();
    expect(colormap(Infinity, 0, 1)).toBeNull();
  });

  it('returns the first palette colour when min equals max', () => {
    expect(colormap(5, 5, 5, 'redox')).toBe(getPalette('redox')[0]);
    expect(colormap(5, 5, 5, 'moisture')).toBe(getPalette('moisture')[0]);
  });
});
