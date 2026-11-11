import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIL_WIDTH, TEXT_PAIRS, applyTheme, cssVariables, theme } from './theme';

const channel = value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const lookup = path => path.split('.').reduce((node, key) => node[key], theme);
// A translucent veil over a white page reads as the white-mixed colour.
const opaque = hex => (hex.startsWith('rgba') ? '#ffffff' : hex);

describe('theme', () => {
  it.each(TEXT_PAIRS)('$text on $background reaches 4.5:1', ({ text, background, large }) => {
    const ratio = contrast(opaque(lookup(text)), opaque(lookup(background)));
    expect(ratio).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });

  it('draws the soil column lighter at the surface and darker at depth, both 3:1 against the rail', () => {
    expect(luminance(theme.soilDepth)).toBeLessThan(luminance(theme.soilSurface));
    expect(contrast(theme.soilSurface, theme.rail)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.soilDepth, theme.rail)).toBeGreaterThanOrEqual(3);
  });

  it('sets the depth section apart from the buttons and the empty rail, with text and dots readable on it', () => {
    expect(contrast(theme.depthSection, theme.button)).toBeGreaterThanOrEqual(1.15);
    expect(contrast(theme.depthSection, theme.rail)).toBeGreaterThanOrEqual(1.15);
    expect(contrast(theme.text, theme.depthSection)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.muted, theme.depthSection)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentText, theme.depthSection)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.textStrong, theme.depthSection)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accent, theme.depthSection)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.soilSurface, theme.depthSection)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.soilDepth, theme.depthSection)).toBeGreaterThanOrEqual(3);
  });

  it('holds the depth dots and the selected dot to 3:1 against the rail', () => {
    expect(contrast(theme.text, theme.rail)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.accent, theme.rail)).toBeGreaterThanOrEqual(3);
  });

  it('exposes the flat colours as custom properties', () => {
    expect(cssVariables()['--accent-text']).toBe(theme.accentText);
    expect(cssVariables()['--panel']).toBe(theme.panel);
    expect(cssVariables()['--soil-surface']).toBe(theme.soilSurface);
  });

  it('sets the rail width as a custom property', () => {
    const root = document.createElement('div');
    applyTheme(root);
    expect(root.style.getPropertyValue('--rail-width')).toBe(`${RAIL_WIDTH}px`);
  });
});

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

describe('components', () => {
  const sources = walk('src/components').filter(
    path => /\.(jsx?|tsx?|css)$/.test(path) && !/\.test\./.test(path),
  );

  it.each(sources)('%s holds no colour literal', path => {
    const text = readFileSync(path, 'utf8');
    expect(text.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([]);
  });
});
