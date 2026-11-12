const TILE = 256;
const WORLD = 2 * Math.PI * 6378137;

const loadImage = url =>
  new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

/**
 * A canvas of basemap layers over Web Mercator bounds [x0, y0, x1, y1] at `zoom`, one canvas
 * pixel per tile pixel, on a `blank` colour. Each layer is drawn from its own deepest zoom up to `zoom`; a base is
 * painted over the last, an overlay is multiplied onto it. A tile that fails to load stays blank.
 */
export async function basemapCanvas(layers, [x0, y0, x1, y1], zoom, blank) {
  const pixel = x => ((x + WORLD / 2) / WORLD) * TILE * 2 ** zoom;
  const left = pixel(x0);
  const right = pixel(x1);
  const top = pixel(-y1);
  const bottom = pixel(-y0);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(right - left);
  canvas.height = Math.round(bottom - top);
  const context = canvas.getContext('2d');
  context.fillStyle = blank;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const layer of layers) {
    const level = Math.min(zoom, layer.maxNativeZoom);
    const scale = 2 ** (zoom - level);
    const size = TILE * scale;
    const tiles = [];
    for (let ty = Math.floor(top / size); ty <= Math.floor(bottom / size); ty++) {
      for (let tx = Math.floor(left / size); tx <= Math.floor(right / size); tx++) {
        const url = layer.url.replace('{z}', level).replace('{x}', tx).replace('{y}', ty);
        tiles.push(loadImage(url).then(image => ({ image, tx, ty })));
      }
    }
    context.globalCompositeOperation = layer.kind === 'overlay' ? 'multiply' : 'source-over';
    for (const { image, tx, ty } of await Promise.all(tiles)) {
      if (image) context.drawImage(image, tx * size - left, ty * size - top, size, size);
    }
  }
  context.globalCompositeOperation = 'source-over';
  return canvas;
}
