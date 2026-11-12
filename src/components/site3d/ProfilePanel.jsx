import { useEffect, useRef } from 'react';
import { theme } from '../../theme';
import { DEPTHS, hexChannels } from './fields';

const WIDTH = 440;
const HEIGHT = 170;
const MARGIN = { left: 44, right: 46, top: 10, bottom: 22 };
// The soil column's drawn depth in px under the ground line, for the deepest slice.
const COLUMN = 36;
const SOIL_BAND = 2;
// The drawn height in px of each depth's band.
const BAND = 4;

function draw(canvas, samples, colour, base) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = WIDTH * ratio;
  canvas.height = HEIGHT * ratio;
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, WIDTH, HEIGHT);
  if (samples.length < 2) return null;

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const length = samples[samples.length - 1].distance;
  const grounds = samples.map(s => s.ground);
  const low = Math.min(...grounds);
  const high = Math.max(...grounds);
  const perMetre = (plotHeight - COLUMN - 4) / Math.max(1, high - low);
  const x = distance => MARGIN.left + (distance / length) * plotWidth;
  const y = ground => MARGIN.top + (high - ground) * perMetre;
  const deepest = DEPTHS[DEPTHS.length - 1];
  // A depth's band centre under the ground line: the shallowest band lies on the ground, the deepest ends the column.
  const below = depth => BAND / 2 + ((depth - DEPTHS[0]) / (deepest - DEPTHS[0])) * (COLUMN - BAND);

  // Under each pixel column, from the nearest sample: a soil band under the ground and, inside the
  // polygon, a thin band at each depth in that depth's colour, the gaps between them left open.
  const pixels = context.createImageData(Math.round(plotWidth * ratio), Math.round(plotHeight * ratio));
  const soil = hexChannels(theme.soilCut);
  const missing = hexChannels(theme.disabled);
  const paint = (px, from, rows, rgb) => {
    for (let row = Math.max(0, from); row < from + rows && row < pixels.height; row++) {
      pixels.data.set([...rgb, 255], (row * pixels.width + px) * 4);
    }
  };
  const band = Math.max(1, Math.round(BAND * ratio));
  for (let px = 0; px < pixels.width; px++) {
    const s = samples[Math.round((px / (pixels.width - 1)) * (samples.length - 1))];
    const top = Math.round((y(s.ground) - MARGIN.top) * ratio);
    if (!s.inside) {
      paint(px, top, Math.round(SOIL_BAND * ratio), soil);
      continue;
    }
    DEPTHS.forEach((depth, k) => {
      const centre = top + Math.round(below(depth) * ratio);
      paint(px, centre - Math.floor(band / 2), band, Number.isFinite(s.values[k]) ? colour(s.values[k]) : missing);
    });
  }
  context.putImageData(pixels, MARGIN.left * ratio, MARGIN.top * ratio);

  context.strokeStyle = theme.white;
  context.lineWidth = 1.5;
  context.beginPath();
  samples.forEach((s, k) => (k ? context.lineTo(x(s.distance), y(s.ground)) : context.moveTo(x(s.distance), y(s.ground))));
  context.stroke();

  context.fillStyle = theme.muted;
  context.font = '11px Barlow, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.fillText(`${Math.round(base + high)} m`, MARGIN.left - 6, y(high));
  context.fillText(`${Math.round(base + low)} m`, MARGIN.left - 6, y(low));
  context.textBaseline = 'top';
  context.textAlign = 'left';
  context.fillText('0 m', MARGIN.left, HEIGHT - MARGIN.bottom + 6);
  context.textAlign = 'right';
  context.fillText(`${Math.round(length)} m`, WIDTH - MARGIN.right, HEIGHT - MARGIN.bottom + 6);

  // The depth key at the right: the soil column's ticks under the last inside sample's ground.
  const last = [...samples].reverse().find(s => s.inside) ?? samples[samples.length - 1];
  const keyX = WIDTH - MARGIN.right + 8;
  const keyTop = y(last.ground);
  context.strokeStyle = theme.muted;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(keyX, keyTop);
  context.lineTo(keyX, keyTop + COLUMN);
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  for (const depth of DEPTHS) {
    const ty = keyTop + below(depth);
    context.moveTo(keyX, ty);
    context.lineTo(keyX + 4, ty);
  }
  context.stroke();
  context.fillText(`${DEPTHS[0]}`, keyX + 7, keyTop + below(DEPTHS[0]));
  context.fillText(`${deepest} cm`, keyX + 7, keyTop + below(deepest));
  // The column is drawn COLUMN px deep for the deepest slice; the ground at `perMetre` px per m.
  return Math.round(COLUMN / (deepest / 100) / perMetre);
}

/** The cross-section as a profile: the ground line along the cut and a band per depth under it. */
export default function ProfilePanel({ samples, colour, base }) {
  const canvas = useRef(null);
  const exaggeration = useRef(null);
  useEffect(() => {
    const factor = draw(canvas.current, samples, colour, base);
    if (exaggeration.current) exaggeration.current.textContent = factor ? `soil column ×${factor}` : '';
  }, [samples, colour, base]);
  return (
    <div className="site3d-profile" role="img" aria-label="Cross-section profile">
      <div className="site3d-profile-title">
        Cross-section <span ref={exaggeration} className="site3d-profile-note" />
      </div>
      <canvas ref={canvas} style={{ width: WIDTH, height: HEIGHT }} />
    </div>
  );
}
