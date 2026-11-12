import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { DEPTHS } from './fields';
import { densifyRing, insideRing, ringCentre } from './geo';
import { theme } from '../../theme';

// Scene axes: x east, y metres above the terrain base, z south.
const FOV = 30;
const GROUND_SLAB = 3;
const SLICE_SLAB = 1.2;
const EDGE_STEP = 1.5;
const PROBE_TOP = 8;
// How far below the lowest ground along a cut the landscape's cut face reaches, in metres.
const LANDSCAPE_FLOOR = 40;
const FLY_MS = 1000;
const OBLIQUE = { polar: 0.9, azimuth: -0.38 };
// The share of their colour the surroundings keep once the slices hang below, so the site stands out.
const SHADED = 0.8;
// The tilt in radians at which the slices hang at their full spacing; they drop as the view tilts towards it.
export const TILTED = 0.9;
// A view tilted less than this counts as flat, so handing back to the map needs no flight.
const FLAT = 0.035;
// The slices sit this far above where they hang, so the top one lies on the ground without flickering into it.
const SURFACE_LIFT = 0.3;
// The camera's distance in metres, and the most tilt allowed: high close in, lower far out, so
// the edge of the surroundings stays below the horizon.
const MIN_DISTANCE = 30;
const MAX_DISTANCE = 3500;
const TILT_NEAR = { distance: 800, tilt: 1.25 };
const TILT_FAR = { distance: 3000, tilt: 0.75 };
// One step of the zoom buttons and of the keys, and the wheel's speed: about a quarter closer a notch.
export const ZOOM_STEP = 1.4;
const WHEEL_SPEED = 3;
// Tilting as you zoom: from flat at the flat distance the view tilts fully by this share of it,
// easing towards the tilt each frame.
const TILT_SPAN = 0.5;
const TILT_EASE = 0.35;
const KEY_TURN = (5 * Math.PI) / 180;
// Unselected slices are drawn at this share of their colour.
const DIMMED = 0.5;
// Peeled layers, those above the picked depth, fade to this opacity, a step a frame.
const PEELED = 0.1;
const PEEL_STEP = 0.12;

const SOIL = new THREE.Color(theme.soilCut);
const SOIL_DEEP = new THREE.Color(theme.soilCutDeep);
const MISSING = new THREE.Color(theme.disabled);

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
// The angle from a to b the short way round.
const turn = (a, b) => ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const blendViews = (from, to, k) => ({
  target: from.target.clone().lerp(to.target, k),
  radius: lerp(from.radius, to.radius, k),
  polar: lerp(from.polar, to.polar, k),
  azimuth: from.azimuth + turn(from.azimuth, to.azimuth) * k,
});
const clamp01 = t => Math.min(1, Math.max(0, t));
const smooth = t => t * t * (3 - 2 * t);
const maxTilt = distance =>
  lerp(TILT_NEAR.tilt, TILT_FAR.tilt, clamp01((distance - TILT_NEAR.distance) / (TILT_FAR.distance - TILT_NEAR.distance)));
// A colour from 0 to 255 sRGB channels, or the no-data grey when there is no value.
const channels = rgb => (rgb ? new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace) : MISSING.clone());
// The vertical drop in metres below the ground of a depth's slice, at `spacing` metres per 10 cm:
// the shallowest lies on the ground, each deeper one a step further down.
const drop = (spacing, depth) => (spacing * (depth - DEPTHS[0])) / 10;

function groundGeometry(terrain) {
  const { nx, ny, heights, eastOf, northOf } = terrain;
  const positions = new Float32Array(nx * ny * 3);
  const uvs = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      positions.set([eastOf(i), heights[k], -northOf(j)], k * 3);
      uvs.set([i / (nx - 1), 1 - j / (ny - 1)], k * 2);
    }
  }
  const index = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      index.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// A wall hanging `thickness` metres under the ground along the edge points, coloured per point.
function wallGeometry(edge, heightAt, thickness, colourAt) {
  const positions = new Float32Array(edge.length * 6);
  const colours = new Float32Array(edge.length * 6);
  edge.forEach(([e, n], k) => {
    const h = heightAt(e, n);
    const top = colourAt(e, n);
    const bottom = top.clone().multiplyScalar(0.7);
    positions.set([e, h, -n, e, h - thickness, -n], k * 6);
    colours.set([top.r, top.g, top.b, bottom.r, bottom.g, bottom.b], k * 6);
  });
  const index = [];
  for (let k = 0; k < edge.length - 1; k++) {
    const a = 2 * k;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function lineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

// A texture from RGBA rows listed from the north, uploaded so row 0 sits at the top (v = 1).
function rowsTexture(pixels, width, height, colour) {
  const flipped = new Uint8Array(pixels.length);
  const row = width * 4;
  for (let j = 0; j < height; j++) flipped.set(pixels.subarray(j * row, (j + 1) * row), (height - 1 - j) * row);
  const texture = new THREE.DataTexture(flipped, width, height, THREE.RGBAFormat);
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function maskPixels(coverage, invert) {
  const pixels = new Uint8Array(coverage.length * 4);
  coverage.forEach((c, k) => pixels.fill(invert ? 255 - c : c, k * 4, k * 4 + 4));
  return pixels;
}

function makeLabel(text, onClick) {
  const element = document.createElement('div');
  element.className = 'site3d-label';
  element.textContent = text;
  if (onClick) {
    element.classList.add('site3d-label-button');
    element.addEventListener('pointerdown', event => {
      event.stopPropagation();
      onClick();
    });
  }
  const label = new CSS2DObject(element);
  label.center.set(0, 0.5);
  return label;
}

/**
 * The 3D site: the surroundings, then over them the ground of the block draped with the basemap,
 * the four depth slices hanging under the polygon, the probes, and a cut face along a
 * cross-section line. The surroundings are drawn first and the site over them, so the slices
 * show through the hills. Owns its renderer, camera and controls; the React view drives it
 * through the set* methods.
 */
export class SiteScene {
  constructor(container, { terrain, ring, grid, coverage, positions, surroundings, spacing, flat, autoTilt, onHover, onPick, onCompass }) {
    this.container = container;
    this.terrain = terrain;
    this.ring = ring;
    this.onHover = onHover;
    this.onPick = onPick;
    this.onCompass = onCompass;
    this.chosenSpacing = spacing;
    this.spacing = 0;
    this.shade = 1;
    this.dragging = false;
    this.steering = false;
    this.compass = null;
    this.flat = flat;
    this.autoTilt = autoTilt;
    this.manual = false;
    this.autoPolar = null;
    this.flight = null;
    this.cut = null;
    this.fields = [];
    this.pointer = null;
    this.clippable = [];
    this.disposables = [];

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.localClippingEnabled = true;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.setSize(width, height);
    this.labels.domElement.className = 'site3d-labels';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.context = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Map gestures: left-drag moves over the ground, right-drag (or a modifier with left-drag)
    // turns and tilts, the wheel zooms towards the pointer; one finger moves, two pinch and tilt.
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: false,
      zoomToCursor: true,
      zoomSpeed: WHEEL_SPEED,
      minDistance: MIN_DISTANCE,
      maxDistance: MAX_DISTANCE,
      maxPolarAngle: TILT_NEAR.tilt,
      mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE },
      touches: { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE },
      enabled: false,
    });
    this.controls.addEventListener('start', () => {
      this.dragging = true;
    });
    this.controls.addEventListener('end', () => {
      this.dragging = false;
    });

    for (const target of [this.scene, this.context]) {
      target.add(new THREE.HemisphereLight(theme.white, theme.groundLight, 2.1));
      const sun = new THREE.DirectionalLight(theme.white, 1.7);
      sun.position.set(-300, 420, 260);
      target.add(sun);
    }

    this.plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    this.centre = ringCentre(ring);
    this.reach = Math.max(...ring.map(([e, n]) => Math.hypot(e - this.centre[0], n - this.centre[1])));
    this.edge = densifyRing(ring, EDGE_STEP);
    this.eastmost = this.edge.reduce((a, p) => (p[0] > a[0] ? p : a));

    this.buildGround(grid, coverage);
    this.buildSurroundings(surroundings);
    this.buildSlices();
    this.buildPositions(positions);
    this.probes = new THREE.Group();
    this.scene.add(this.probes);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindPointer();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  track(material, clip = true) {
    this.disposables.push(material);
    if (clip) this.clippable.push(material);
    return material;
  }

  buildGround(grid, coverage) {
    const { heightAt } = this.terrain;
    this.geometry = groundGeometry(this.terrain);
    this.insideMask = rowsTexture(maskPixels(coverage, false), grid.width, grid.height, false);
    this.outsideMask = rowsTexture(maskPixels(coverage, true), grid.width, grid.height, false);

    this.blockAround = new THREE.Mesh(
      this.geometry,
      this.track(new THREE.MeshLambertMaterial({ color: theme.sceneBlank, alphaMap: this.outsideMask, alphaTest: 0.5 })),
    );
    this.surface = new THREE.Mesh(
      this.geometry,
      this.track(new THREE.MeshLambertMaterial({ color: theme.sceneBlank, alphaMap: this.insideMask, alphaTest: 0.5 })),
    );
    this.surface.userData.kind = 'ground';
    const wall = new THREE.Mesh(
      wallGeometry(this.edge, heightAt, GROUND_SLAB, () => SOIL.clone()),
      this.track(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })),
    );
    const outline = new THREE.Line(
      lineGeometry(this.edge.map(([e, n]) => [e, heightAt(e, n) + 0.2, -n])),
      this.track(new THREE.LineBasicMaterial({ color: theme.white, transparent: true, opacity: 0.85 })),
    );
    this.groundParts = [this.surface, wall, outline];
    this.groundMaterials = [this.surface.material, wall.material];
    this.context.add(this.blockAround);
    this.scene.add(...this.groundParts);
  }

  // The coarser ground around the block, placed in the block's frame and base, with a hole where
  // the block's own ground lies; it sits a metre low so the block's ground wins where they meet.
  buildSurroundings({ terrain, grid, coverage }) {
    this.holeMask = rowsTexture(maskPixels(coverage, true), grid.width, grid.height, false);
    this.around = new THREE.Mesh(
      groundGeometry(terrain),
      this.track(new THREE.MeshLambertMaterial({ color: theme.sceneBlank, alphaMap: this.holeMask, alphaTest: 0.5 })),
    );
    const [e, n] = this.terrain.frame.toLocal(...terrain.frame.toLonLat(0, 0));
    this.around.position.set(e, terrain.base - this.terrain.base - 1, -n);
    this.context.add(this.around);
  }

  /** Shows or hides the ground over the polygon and the positions on it, uncovering the slices. */
  setGroundShown(shown) {
    for (const part of [...this.groundParts, ...this.dots]) part.visible = shown;
  }

  buildSlices() {
    const [e, n] = this.eastmost;
    this.slices = DEPTHS.map(depth => {
      const group = new THREE.Group();
      const material = this.track(new THREE.MeshLambertMaterial({ color: theme.disabled, alphaTest: 0.5, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.userData = { kind: 'slice', depth };
      const outline = new THREE.Line(
        lineGeometry(this.edge.map(([x, y]) => [x, this.terrain.heightAt(x, y) + 0.2, -y])),
        this.track(new THREE.LineBasicMaterial({ color: theme.white, transparent: true, opacity: 0.55 })),
      );
      const label = makeLabel(`${depth} cm`, () => this.onPick?.(depth));
      label.position.set(e + 8, this.terrain.heightAt(e, n), -n);
      group.add(mesh, outline, label);
      group.visible = false;
      this.scene.add(group);
      return { depth, group, mesh, material, outline, label, wall: null };
    });
  }

  buildPositions(positions) {
    const geometry = new THREE.SphereGeometry(1.1, 12, 8);
    const material = this.track(new THREE.MeshLambertMaterial({ color: theme.white }));
    this.dots = positions.map(({ name, x, y }) => {
      const dot = new THREE.Mesh(geometry, material);
      dot.position.set(x, this.terrain.heightAt(x, y) + 1.1, -y);
      dot.userData = { kind: 'position', name };
      this.scene.add(dot);
      return dot;
    });
    this.disposables.push(geometry);
  }

  canvasTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  /** The basemap drawn over the block, as a canvas spanning the terrain's bounds. */
  setBasemap(canvas) {
    const texture = this.canvasTexture(canvas);
    this.surface.material.map?.dispose();
    for (const mesh of [this.blockAround, this.surface]) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }
    this.surface.material.color.set(theme.white);
    this.setShade(this.shade);
  }

  /** The basemap drawn over the surroundings, as a canvas spanning their bounds. */
  setSurroundingsBasemap(canvas) {
    this.around.material.map?.dispose();
    this.around.material.map = this.canvasTexture(canvas);
    this.around.material.needsUpdate = true;
    this.setShade(this.shade);
  }

  /**
   * The slices' rasters and the probes: `rasters` RGBA rows per depth over `grid`, `fields` the
   * value functions they were painted from, `colour` value → [r, g, b], and `probes` the
   * positions with readings, [{ name, x, y, values }].
   */
  setRasters({ rasters, grid, fields, colour, probes }) {
    this.fields = fields;
    this.colour = colour;
    this.slices.forEach((slice, k) => {
      slice.material.map?.dispose();
      slice.material.map = rowsTexture(rasters[k], grid.width, grid.height, true);
      slice.material.needsUpdate = true;
      if (slice.wall) {
        slice.group.remove(slice.wall);
        slice.wall.geometry.dispose();
      }
      slice.wall = new THREE.Mesh(
        wallGeometry(this.edge, this.terrain.heightAt, SLICE_SLAB, (x, y) => {
          const value = fields[k](x, y);
          return channels(Number.isFinite(value) && colour(value));
        }),
        slice.wallMaterial ?? (slice.wallMaterial = this.track(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))),
      );
      slice.group.add(slice.wall);
    });
    this.buildProbes(probes);
    if (this.cut) this.setCut(this.cut);
    this.applySelection();
  }

  buildProbes(probes) {
    for (const child of [...this.probes.children]) {
      this.probes.remove(child);
      child.traverse(o => o.isMesh && o.material !== this.probeRodMaterial && o.material.dispose());
    }
    this.probeRodMaterial ??= this.track(new THREE.MeshLambertMaterial({ color: theme.probe }));
    this.probeRod ??= new THREE.CylinderGeometry(0.35, 0.35, 1, 10);
    this.probeBead ??= new THREE.SphereGeometry(1.7, 16, 12);
    this.probeParts = probes.map(probe => {
      const group = new THREE.Group();
      group.position.set(probe.x, this.terrain.heightAt(probe.x, probe.y), -probe.y);
      const rod = new THREE.Mesh(this.probeRod, this.probeRodMaterial);
      const head = new THREE.Mesh(this.probeBead, this.probeRodMaterial);
      head.position.y = PROBE_TOP;
      head.scale.setScalar(0.8);
      head.userData = { kind: 'position', name: probe.name };
      const beads = DEPTHS.map((depth, k) => {
        const value = probe.values[k];
        const material = new THREE.MeshLambertMaterial({ color: channels(Number.isFinite(value) && this.colour(value)) });
        material.clippingPlanes = this.cut ? [this.plane] : [];
        const bead = new THREE.Mesh(this.probeBead, material);
        bead.userData = { kind: 'probe', name: probe.name, depth, value };
        return bead;
      });
      group.add(rod, head, ...beads);
      this.probes.add(group);
      return { rod, beads };
    });
    this.layout();
  }

  /** Highlights the slice at a depth in cm; the others are dimmed. */
  setSelectedDepth(depth) {
    this.depth = depth;
    this.applySelection();
  }

  /** Whether the layers above the picked depth, the ground among them, peel away to show it whole. */
  setPeel(on) {
    this.peel = on;
  }

  // The ground and each slice, with its depth (the ground's is 0) and the materials that fade when it peels.
  peelLayers() {
    return [
      { depth: 0, materials: this.groundMaterials },
      ...this.slices.map(s => ({ depth: s.depth, materials: [s.material, s.wallMaterial].filter(Boolean) })),
    ];
  }

  // Each frame the peeled layers fade a step towards faint, the others back to solid.
  stepPeel() {
    for (const { depth, materials } of this.peelLayers()) {
      const target = this.peel && this.depth != null && depth < this.depth ? PEELED : 1;
      for (const material of materials) {
        const now = material.userData.peel ?? 1;
        if (now === target) continue;
        const next = now < target ? Math.min(target, now + PEEL_STEP) : Math.max(target, now - PEEL_STEP);
        material.userData.peel = next;
        material.transparent = next < 1;
        material.depthWrite = next === 1;
        material.opacity = next;
        // An alpha-masked layer keeps its edge as it fades: the mask cut-off falls with the opacity.
        if (material.alphaTest > 0) material.alphaTest = 0.5 * next;
        material.needsUpdate = true;
      }
    }
  }

  applySelection() {
    for (const slice of this.slices) {
      const selected = slice.depth === this.depth;
      slice.material.color.setScalar(selected || this.depth == null ? 1 : DIMMED);
      slice.outline.material.opacity = selected ? 1 : 0.5;
      slice.outline.material.color.set(selected ? theme.accentText : theme.white);
      slice.label.element.classList.toggle('selected', selected);
    }
  }

  /** The vertical spacing of the slices, in metres per 10 cm of depth. */
  setSpacing(spacing) {
    this.spacing = spacing;
    this.layout();
  }

  layout() {
    const { spacing } = this;
    // Flat, the deeper slices would lie in the top one, so only the top one shows until the view tilts.
    const shown = spacing > 0.3;
    const showing = depth => depth === DEPTHS[0] || shown;
    for (const slice of this.slices) {
      slice.group.position.y = SURFACE_LIFT - drop(spacing, slice.depth);
      slice.group.visible = showing(slice.depth);
    }
    const bottom = -drop(spacing, DEPTHS[DEPTHS.length - 1]) - SLICE_SLAB;
    for (const { rod, beads } of this.probeParts ?? []) {
      rod.scale.y = PROBE_TOP - Math.min(bottom, -1);
      rod.position.y = (PROBE_TOP + Math.min(bottom, -1)) / 2;
      beads.forEach((bead, k) => {
        bead.position.y = SURFACE_LIFT - drop(spacing, DEPTHS[k]);
        bead.visible = showing(DEPTHS[k]);
      });
    }
    if (this.curtain) this.layoutCurtain();
  }

  /** The share of their colour the block's edges and the surroundings are drawn at, once they carry a basemap. */
  setShade(shade) {
    this.shade = shade;
    for (const mesh of [this.blockAround, this.around]) {
      if (mesh.material.map) mesh.material.color.setScalar(shade);
    }
  }

  /** The slices' spacing at full tilt, in metres per 10 cm of depth. */
  chooseSpacing(spacing) {
    this.chosenSpacing = spacing;
  }

  /**
   * The cross-section: `{ line: { from, normal }, samples, landscape }`, the samples along the
   * block from `crossSection` and the landscape's along the whole surroundings, or null for none.
   * Everything on the camera's side of the line, landscape and site, is cut away and the cut
   * faces are drawn on it.
   */
  setCut(cut) {
    this.cut = cut;
    const drop = (root, part) => {
      if (!part) return;
      root.remove(part);
      part.traverse(o => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    };
    drop(this.scene, this.curtain?.group);
    drop(this.context, this.landscapeFace);
    this.curtain = null;
    this.landscapeFace = null;
    const planes = cut ? [this.plane] : [];
    for (const material of this.clippable) material.clippingPlanes = planes;
    this.probes.traverse(o => {
      if (o.isMesh) o.material.clippingPlanes = planes;
    });
    if (!cut) return;

    const [nx, ny] = cut.line.normal;
    const [fx, fy] = cut.line.from;
    this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(nx, 0, -ny), new THREE.Vector3(fx, 0, -fy));
    this.curtain = this.buildCurtain(cut.samples);
    this.scene.add(this.curtain.group);
    this.layoutCurtain();
    if (cut.landscape) {
      this.landscapeFace = this.buildLandscapeFace(cut.landscape);
      this.context.add(this.landscapeFace);
    }
  }

  // The landscape's cut face, outside the polygon: soil from the ground down to a floor below the
  // lowest ground along the line, so the cut reads as a slice through solid land.
  buildLandscapeFace(samples) {
    const floor = Math.min(...samples.map(s => s.ground)) - LANDSCAPE_FLOOR;
    const positions = new Float32Array(samples.length * 6);
    const colours = new Float32Array(samples.length * 6);
    samples.forEach((s, c) => {
      positions.set([s.x, s.ground, -s.y, s.x, floor, -s.y], c * 6);
      colours.set([SOIL.r, SOIL.g, SOIL.b, SOIL_DEEP.r, SOIL_DEEP.g, SOIL_DEEP.b], c * 6);
    });
    const index = [];
    for (let c = 0; c < samples.length - 1; c++) {
      if (samples[c].inside || samples[c + 1].inside) continue;
      index.push(2 * c, 2 * c + 1, 2 * c + 2, 2 * c + 2, 2 * c + 1, 2 * c + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setIndex(index);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    group.add(new THREE.Line(
      lineGeometry(samples.map(s => [s.x, s.ground + 0.5, -s.y])),
      new THREE.LineBasicMaterial({ color: theme.white }),
    ));
    return group;
  }

  // The cut face: a soil band under the ground along the whole line and, inside the polygon, a
  // band at each slice's drop coloured by that depth alone, the gaps between them left open.
  buildCurtain(samples) {
    const group = new THREE.Group();
    const grounds = Float32Array.from(samples, s => s.ground);
    const strip = (included, topColour, bottomColour) => {
      const positions = new Float32Array(samples.length * 6);
      const colours = new Float32Array(samples.length * 6);
      samples.forEach((s, c) => {
        const top = topColour(s);
        const bottom = bottomColour(s);
        positions.set([s.x, s.ground, -s.y, s.x, s.ground, -s.y], c * 6);
        colours.set([top.r, top.g, top.b, bottom.r, bottom.g, bottom.b], c * 6);
      });
      const index = [];
      for (let c = 0; c < samples.length - 1; c++) {
        if (!included(samples[c]) || !included(samples[c + 1])) continue;
        const a = 2 * c;
        index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      geometry.setIndex(index);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      group.add(mesh);
      return mesh;
    };
    const soil = strip(s => !s.inside, () => SOIL, () => SOIL_DEEP);
    const bands = DEPTHS.map((depth, k) => {
      const colourOf = s => channels(Number.isFinite(s.values[k]) && this.colour(s.values[k]));
      return { depth, mesh: strip(s => s.inside, colourOf, s => colourOf(s).multiplyScalar(0.7)) };
    });
    group.add(new THREE.Line(
      lineGeometry(samples.map(s => [s.x, s.ground + 0.25, -s.y])),
      new THREE.LineBasicMaterial({ color: theme.white }),
    ));
    return { group, grounds, soil, bands };
  }

  layoutCurtain() {
    const { spacing } = this;
    const { grounds, soil, bands } = this.curtain;
    const shown = spacing > 0.3;
    const place = (mesh, top, thickness) => {
      const positions = mesh.geometry.getAttribute('position');
      grounds.forEach((g, c) => {
        positions.setY(2 * c, g - top);
        positions.setY(2 * c + 1, g - top - thickness);
      });
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    };
    place(soil, 0, GROUND_SLAB);
    for (const { depth, mesh } of bands) {
      place(mesh, drop(spacing, depth) - SURFACE_LIFT, SLICE_SLAB);
      mesh.visible = depth === DEPTHS[0] || shown;
    }
  }

  // --- Camera ---

  /** The view straight down on a point of the ground, framing `height` metres north to south. */
  topDownView([e, n], height) {
    return {
      target: new THREE.Vector3(e, this.terrain.heightAt(e, n), -n),
      radius: height / 2 / Math.tan((FOV / 2) * (Math.PI / 180)),
      polar: 0.0001,
      azimuth: 0,
    };
  }

  /** The oblique view of the polygon and its slices at the chosen spacing. */
  obliqueView() {
    const top = this.terrain.high;
    const bottom = this.terrain.low - drop(this.chosenSpacing, DEPTHS[DEPTHS.length - 1]);
    const vertical = (FOV * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const radius = Math.hypot(this.reach, (top - bottom) / 2) / Math.sin(Math.min(vertical, horizontal) / 2);
    return {
      target: new THREE.Vector3(this.centre[0], (top + bottom) / 2, -this.centre[1]),
      radius: radius * 0.92,
      ...OBLIQUE,
    };
  }

  /** The current view tilted to `polar`, about the same point. */
  tiltedView(polar) {
    return { ...this.currentView(), polar };
  }

  /** The current view turned north up and flat, about the point on the ground under its centre. */
  flatView() {
    const view = this.currentView();
    const e = view.target.x;
    const n = -view.target.z;
    return { ...view, target: new THREE.Vector3(e, this.terrain.heightAt(e, n), -n), polar: 0.0001, azimuth: 0 };
  }

  /** Whether the view is flat and north up already, so handing back to the map needs no flight. */
  isFlat() {
    const { polar, azimuth } = this.currentView();
    return polar < FLAT && Math.abs(turn(azimuth, 0)) < 0.02;
  }

  /**
   * Where the view looks, for the map to take over: the longitude and latitude under its centre
   * and the ground metres one pixel spans there.
   */
  groundView() {
    const { target, radius } = this.currentView();
    const [lon, lat] = this.terrain.frame.toLonLat(target.x, -target.z);
    const height = 2 * radius * Math.tan((FOV / 2) * (Math.PI / 180));
    return { lon, lat, metresPerPixel: height / (this.container.clientHeight || 1) };
  }

  currentView() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return { target: this.controls.target.clone(), radius: spherical.radius, polar: spherical.phi, azimuth: spherical.theta };
  }

  applyView({ target, radius, polar, azimuth }) {
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(radius, polar, azimuth));
    this.camera.lookAt(target);
  }

  /** Jumps to a view. */
  show(view) {
    this.applyView(view);
    this.controls.update();
  }

  /** Flies from the current view to another, then calls `done`; the controls wait meanwhile. */
  flyTo(view, done, ms = FLY_MS) {
    this.controls.enabled = false;
    this.flight = { from: this.currentView(), to: view, start: performance.now(), ms, done };
  }

  stepFlight(now) {
    const { from, to, start, ms, done } = this.flight;
    const t = Math.min(1, (now - start) / ms);
    this.applyView(blendViews(from, to, ease(t)));
    if (t < 1) return;
    this.flight = null;
    this.controls.enabled = this.steering;
    this.controls.update();
    done?.();
  }

  /** Lets the user steer once the view has opened; off while it hands back to the map. */
  setSteering(on) {
    this.steering = on;
    this.controls.enabled = on && !this.flight;
  }

  /** Turns, tilts and zooms by steps: `turn` and `tilt` in radians, `zoom` a factor on the distance. */
  nudge({ turn: by = 0, tilt = 0, zoom = 1 }) {
    if (!this.steering || this.flight) return;
    const view = this.currentView();
    this.applyView({
      ...view,
      azimuth: view.azimuth + by,
      polar: Math.min(maxTilt(view.radius), Math.max(0.0001, view.polar + tilt)),
      radius: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, view.radius * zoom)),
    });
    this.controls.update();
  }

  /** Whether the view tilts as it zooms; off, only drags and keys tilt it. */
  setAutoTilt(on) {
    this.autoTilt = on;
    this.manual = false;
  }

  /** The tilt that goes with a distance when tilting as you zoom: flat at the flat distance, full a span closer. */
  tiltFor(radius) {
    return TILTED * smooth(clamp01((this.flat - radius) / (this.flat * (1 - TILT_SPAN))));
  }

  /** Turns the view north up, keeping its tilt. */
  faceNorth() {
    if (this.steering && !this.flight) this.flyTo({ ...this.currentView(), azimuth: 0 }, null, 600);
  }

  // The slices drop and the surroundings dim as the view tilts; the compass follows the camera.
  followTilt() {
    this.tiltWithZoom();
    const { radius, polar, azimuth } = this.currentView();
    this.controls.maxPolarAngle = maxTilt(radius);
    const k = smooth(clamp01(polar / TILTED));
    const spacing = this.chosenSpacing * k;
    if (Math.abs(spacing - this.spacing) > 0.01) this.setSpacing(spacing);
    const shade = lerp(1, SHADED, k);
    if (Math.abs(shade - this.shade) > 0.002) this.setShade(shade);
    if (!this.compass || Math.abs(this.compass[0] - azimuth) > 0.003 || Math.abs(this.compass[1] - polar) > 0.003) {
      this.compass = [azimuth, polar];
      this.onCompass?.(azimuth, polar);
    }
  }

  // While tilting as you zoom, the tilt eases towards the one for the distance, until the user
  // tilts by hand; zooming back out past the flat distance lets it follow the zoom again.
  tiltWithZoom() {
    if (!this.autoTilt || !this.steering || this.flight) return;
    const view = this.currentView();
    if (this.dragging) {
      if (this.autoPolar != null && Math.abs(view.polar - this.autoPolar) > 0.03) this.manual = true;
      return;
    }
    if (view.radius > this.flat) this.manual = false;
    if (this.manual) return;
    const polar = view.polar + (this.tiltFor(view.radius) - view.polar) * TILT_EASE;
    this.applyView({ ...view, polar });
    this.autoPolar = polar;
  }

  // --- Frame, pointer and size ---

  frame() {
    const now = performance.now();
    if (this.flight) this.stepFlight(now);
    else this.controls.update();
    this.followTilt();
    this.stepPeel();
    if (this.cut && this.plane.distanceToPoint(this.camera.position) > 0) this.plane.negate();
    if (this.pointer?.moved && !this.flight) {
      this.pointer.moved = false;
      const hit = this.pick(this.pointer.ndc);
      this.onHover?.(hit && { ...hit, clientX: this.pointer.x, clientY: this.pointer.y });
    }
    this.renderer.clear();
    this.renderer.render(this.context, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  pick(ndc) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const targets = [
      ...this.dots,
      ...(this.probeParts ?? []).flatMap(p => p.beads),
      ...this.probes.children.map(g => g.children[1]),
      this.surface,
      ...this.slices.filter(s => s.group.visible).map(s => s.mesh),
    ].filter(o => o.visible);
    for (const hit of raycaster.intersectObjects(targets, false)) {
      if (this.cut && this.plane.distanceToPoint(hit.point) < 0) continue;
      const { kind } = hit.object.userData;
      const e = hit.point.x;
      const n = -hit.point.z;
      if ((hit.object.material.userData.peel ?? 1) < 0.5) continue;
      if (kind === 'ground' || kind === 'slice') {
        if (!insideRing([e, n], this.ring)) continue;
        if (kind === 'ground') return { kind, elevation: this.terrain.base + this.terrain.heightAt(e, n) };
        const depth = hit.object.userData.depth;
        return { kind, depth, value: this.fields[DEPTHS.indexOf(depth)]?.(e, n) };
      }
      return hit.object.userData;
    }
    return null;
  }

  bindPointer() {
    const element = this.renderer.domElement;
    const move = event => {
      const box = element.getBoundingClientRect();
      this.pointer = {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
        ndc: new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1),
        moved: true,
      };
    };
    const leave = () => {
      this.pointer = null;
      this.onHover?.(null);
    };
    let down = null;
    const press = event => {
      down = [event.clientX, event.clientY];
    };
    const release = event => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 4 || this.flight) return;
      move(event);
      const hit = this.pick(this.pointer.ndc);
      if (hit?.kind === 'slice' || hit?.kind === 'probe') this.onPick?.(hit.depth);
    };
    // Shift with the arrows tilts and turns, plus and minus zoom, as on other 3D maps.
    const keys = event => {
      const step = {
        ArrowUp: { tilt: -KEY_TURN },
        ArrowDown: { tilt: KEY_TURN },
        ArrowLeft: { turn: KEY_TURN },
        ArrowRight: { turn: -KEY_TURN },
      }[event.key];
      if (step && event.shiftKey) this.nudge(step);
      else if (event.key === '+' || event.key === '=') this.nudge({ zoom: 1 / ZOOM_STEP });
      else if (event.key === '-') this.nudge({ zoom: ZOOM_STEP });
      else return;
      event.preventDefault();
    };
    const menu = event => event.preventDefault();
    element.tabIndex = 0;
    element.addEventListener('keydown', keys);
    element.addEventListener('contextmenu', menu);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    this.unbindPointer = () => {
      element.removeEventListener('keydown', keys);
      element.removeEventListener('contextmenu', menu);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      element.removeEventListener('pointerdown', press);
      element.removeEventListener('pointerup', release);
    };
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.labels.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.unbindPointer();
    this.controls.dispose();
    for (const root of [this.scene, this.context]) {
      root.traverse(o => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    this.holeMask.dispose();
    this.insideMask.dispose();
    this.outsideMask.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
