import chroma from 'chroma-js';

const PALETTES = {
  redox: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
  temperature: ['#ffffcc', '#c2e699', '#31a354', '#006837'],
  moisture: ['#ffffcc', '#c2e699', '#31a354', '#006837'],
};

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
