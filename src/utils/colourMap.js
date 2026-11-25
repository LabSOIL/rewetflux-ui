import chroma from 'chroma-js';
import { theme } from '../theme';

const PALETTES = theme.scales;

export function colormap(value, min, max, palette = 'redox') {
  if (value == null || !isFinite(value)) return null;
  
  const range = max - min;
  if (range === 0) return PALETTES[palette][0];
  
  const normalized = (value - min) / range;
  const clampedNorm = Math.max(0, Math.min(1, normalized));
  
  const colorStops = PALETTES[palette] || PALETTES.redox;
  const color = chroma.scale(colorStops).domain([0, 1])(clampedNorm);
  
  return color.hex();
}

export function getColorScale(palette = 'redox', min, max) {
  const colorStops = PALETTES[palette] || PALETTES.redox;
  return chroma.scale(colorStops).domain([min, max]);
}

export function getPalette(palette = 'redox') {
  return PALETTES[palette] || PALETTES.redox;
}
