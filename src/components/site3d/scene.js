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
const FLY_MS = 1800;
const RETURN_MS = 1400;
const OBLIQUE = { polar: 1.02, azimuth: -0.38 };
// The share of their colour the surroundings keep once the slices hang below, so the site stands out.
const SHADED = 0.8;
// The scroll: one wheel notch moves the zoom level this far; level 1 is the oblique view and
// each level past it halves the distance this many times; the level eases to the wanted one.
export const LEVEL_STEP = 0.25;
const DOLLY = 1.5;
const MAX_LEVEL = 2.6;
const FOLLOW = 0.18;
// Unselected slices are drawn at this share of their colour.
const DIMMED = 0.5;

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
  spacing: lerp(from.spacing, to.spacing, k),
  shade: lerp(from.shade, to.shade, k),
});
// A colour from 0 to 255 sRGB channels, or the no-data grey when there is no value.
const channels = rgb => (rgb ? new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace) : MISSING.clone());
// The vertical drop in metres below the ground of a depth in cm, at `spacing` metres per 10 cm.
const drop = (spacing, depth) => (spacing * depth) / 10;

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
  constructor(container, { terrain, ring, grid, coverage, positions, surroundings, onHover, onPick, onZoomOut }) {
    this.container = container;
    this.terrain = terrain;
    this.ring = ring;
    this.onHover = onHover;
    this.onPick = onPick;
    this.onZoomOut = onZoomOut;
    this.spacing = 0;
    this.shade = 1;
    this.law = null;
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
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: true,
      maxPolarAngle: Math.PI * 0.6,
      minDistance: 1,
      maxDistance: 1e5,
      enableZoom: false,
      enabled: false,
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
      this.track(new THREE.MeshLambertMaterial({ color: theme.sceneBlank, alphaMap: this.outsideMask, alphaTest: 0.5 }), false),
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
    const [e, n] = this.eastmost;
    const label = makeLabel('Ground');
    label.position.set(e + 8, heightAt(e, n), -n);
    this.groundParts = [this.surface, wall, outline, label];
    this.context.add(this.blockAround);
    this.scene.add(...this.groundParts);
  }

  // The coarser ground around the block, placed in the block's frame and base, with a hole where
  // the block's own ground lies; it sits a metre low so the block's ground wins where they meet.
  buildSurroundings({ terrain, grid, coverage }) {
    this.holeMask = rowsTexture(maskPixels(coverage, true), grid.width, grid.height, false);
    this.around = new THREE.Mesh(
      groundGeometry(terrain),
      this.track(new THREE.MeshLambertMaterial({ color: theme.sceneBlank, alphaMap: this.holeMask, alphaTest: 0.5 }), false),
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
    const shown = spacing > 0.3;
    for (const slice of this.slices) {
      slice.group.position.y = -drop(spacing, slice.depth);
      slice.group.visible = shown;
    }
    const bottom = -drop(spacing, DEPTHS[DEPTHS.length - 1]) - SLICE_SLAB;
    for (const { rod, beads } of this.probeParts ?? []) {
      rod.scale.y = PROBE_TOP - Math.min(bottom, -1);
      rod.position.y = (PROBE_TOP + Math.min(bottom, -1)) / 2;
      beads.forEach((bead, k) => {
        bead.position.y = -drop(spacing, DEPTHS[k]);
        bead.visible = shown;
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

  /** The slices' spacing the user chose: it holds at the oblique view and past it. */
  chooseSpacing(spacing) {
    if (this.law) this.law.deep.spacing = spacing;
    if (!this.law || this.law.level >= 1) this.setSpacing(spacing);
  }

  /**
   * The cross-section: `{ line: { from, normal }, samples }` from `crossSection`, or null for none.
   * Everything on the camera's side of the line is cut away and the cut face is drawn on it.
   */
  setCut(cut) {
    this.cut = cut;
    if (this.curtain) {
      this.scene.remove(this.curtain.group);
      this.curtain.group.traverse(o => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.curtain = null;
    }
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
    const soil = strip(() => true, () => SOIL, () => SOIL_DEEP);
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
    // The soil band stops short of the first slice, so the two never meet on the cut.
    const soilDepth = shown ? Math.min(GROUND_SLAB, 0.5 * drop(spacing, DEPTHS[0])) : GROUND_SLAB;
    const place = (mesh, top, thickness) => {
      const positions = mesh.geometry.getAttribute('position');
      grounds.forEach((g, c) => {
        positions.setY(2 * c, g - top);
        positions.setY(2 * c + 1, g - top - thickness);
      });
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    };
    place(soil, 0, soilDepth);
    for (const { depth, mesh } of bands) {
      place(mesh, drop(spacing, depth), SLICE_SLAB);
      mesh.visible = shown;
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
      spacing: 0,
      shade: 1,
    };
  }

  /** The oblique view of the polygon and its slices at a spacing. */
  obliqueView(spacing) {
    const top = this.terrain.high;
    const bottom = this.terrain.low - drop(spacing, DEPTHS[DEPTHS.length - 1]);
    const vertical = (FOV * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const radius = Math.hypot(this.reach, (top - bottom) / 2) / Math.sin(Math.min(vertical, horizontal) / 2);
    return {
      target: new THREE.Vector3(this.centre[0], (top + bottom) / 2, -this.centre[1]),
      radius: radius * 0.92,
      ...OBLIQUE,
      spacing,
      shade: SHADED,
    };
  }

  currentView() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return {
      target: this.controls.target.clone(),
      radius: spherical.radius,
      polar: spherical.phi,
      azimuth: spherical.theta,
      spacing: this.spacing,
      shade: this.shade,
    };
  }

  applyView({ target, radius, polar, azimuth, spacing, shade }) {
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(radius, polar, azimuth));
    this.camera.lookAt(target);
    if (spacing !== this.spacing) this.setSpacing(spacing);
    if (shade !== this.shade) this.setShade(shade);
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
    this.controls.enabled = true;
    this.controls.update();
    done?.();
  }

  /**
   * Puts the camera under the scroll. The zoom level runs from 0, the view `top` from above, to 1,
   * the view `deep`, tilting and dropping the slices on the way; past 1 the camera moves closer and
   * turns and pans freely. Scrolling out below 0 calls `onZoomOut`.
   */
  followScroll(top, deep, level, wanted = level) {
    this.law = { top, deep, level, wanted };
    this.controls.enabled = true;
    this.lawControls(level);
  }

  /** Flies back to the view from above and calls `done`, at once when the scroll has already brought it there. */
  leave(top, done) {
    const there = this.law && this.law.level <= 0;
    this.law = null;
    this.flyTo(top, done, there ? 1 : RETURN_MS);
  }

  lawControls(level) {
    this.controls.enableRotate = level > 1;
    this.controls.enablePan = level > 1;
  }

  stepLaw() {
    const law = this.law;
    const before = law.level;
    law.level += (law.wanted - law.level) * FOLLOW;
    if (Math.abs(law.wanted - law.level) < 1e-3) law.level = law.wanted;
    if (law.level < -0.02) {
      this.law = null;
      this.onZoomOut?.();
      return;
    }
    this.lawControls(law.level);
    if (law.level <= 1) {
      // Coming back from closer in, the tilt eases from wherever the camera was turned and moved to.
      if (before > 1) law.deep = { ...this.currentView(), radius: law.deep.radius };
      this.applyView(blendViews(law.top, law.deep, ease(Math.max(0, law.level))));
      return;
    }
    const radius = law.deep.radius * 2 ** (-(law.level - 1) * DOLLY);
    this.camera.position.sub(this.controls.target).setLength(radius).add(this.controls.target);
    this.controls.update();
  }

  wheel(event) {
    event.preventDefault();
    if (!this.law || this.flight) return;
    const notches = event.deltaMode === 1 ? event.deltaY / 3 : event.deltaMode === 2 ? event.deltaY : event.deltaY / 100;
    this.law.wanted = Math.min(MAX_LEVEL, Math.max(-0.2, this.law.wanted - notches * LEVEL_STEP));
  }

  // --- Frame, pointer and size ---

  frame() {
    const now = performance.now();
    if (this.flight) this.stepFlight(now);
    else if (this.law) this.stepLaw();
    else this.controls.update();
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
    const wheel = event => this.wheel(event);
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    this.unbindPointer = () => {
      element.removeEventListener('wheel', wheel);
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
