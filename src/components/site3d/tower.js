import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import towerUrl from '../../data/tower.glb?url';

/** The tower's height in metres, as scripts/tower.py scales it. */
export const TOWER_HEIGHT = 2.5;

// Faces meeting at more than this angle in radians keep a sharp edge between them.
const CREASE = Math.PI / 6;

let loading = null;

/** The tower's geometry in metres, its foot at the origin and y up; loaded once, null when it fails. */
export function loadTower() {
  loading ??= new GLTFLoader()
    .loadAsync(towerUrl)
    .then(gltf => {
      let geometry = null;
      gltf.scene.traverse(o => {
        if (o.isMesh) geometry ??= o.geometry;
      });
      return geometry && toCreasedNormals(geometry, CREASE);
    })
    .catch(() => null);
  return loading;
}

/**
 * The factor that keeps an object `height` metres tall, `distance` metres from a camera with a
 * vertical field of view of `fov` degrees over `viewport` pixels, at least `minPixels` tall on screen.
 */
export function symbolScale(height, distance, fov, viewport, minPixels) {
  const pixels = (height * viewport) / (2 * distance * Math.tan((fov * Math.PI) / 360));
  return Math.max(1, minPixels / pixels);
}
