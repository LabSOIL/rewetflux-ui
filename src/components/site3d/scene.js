import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { DEPTHS, valueAtDepth } from './fields';
import { densifyRing, insideRing, ringCentre } from './geo';
import { theme } from '../../theme';

// Scene axes: x east, y metres above the terrain base, z south.
const FOV = 30;
const GROUND_SLAB = 3;
const SLICE_SLAB = 1.2;
const EDGE_STEP = 1.5;
const PROBE_TOP = 8;
const CURTAIN_ROWS = 40;
const FLY_MS = 1800;
const OBLIQUE = { polar: 1.02, azimuth: -0.38 };
// The context around the polygon once the slices hang below it, so they show through.
const CONTEXT_FADED = 0.22;
// Unselected slices are drawn at this share of their colour.
const DIMMED = 0.5;

const SOIL = new THREE.Color(theme.soilCut);
const SOIL_DEEP = new THREE.Color(theme.soilCutDeep);
const MISSING = new THREE.Color(theme.disabled);

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
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
 * The 3D site: the ground of the block draped with the basemap, the four depth slices hanging
 * under the polygon, the probes, and a cut face along a cross-section line. Owns its renderer,
 * camera and controls; the React view drives it through the set* methods.
 */
export class SiteScene {
  constructor(container, { terrain, ring, grid, coverage, positions, onHover, onPick }) {
    this.container = container;
    this.terrain = terrain;
    this.ring = ring;
    this.onHover = onHover;
    this.onPick = onPick;
    this.spacing = 0;
    this.contextOpacity = 1;
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
    container.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.setSize(width, height);
    this.labels.domElement.className = 'site3d-labels';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: true,
      maxPolarAngle: Math.PI * 0.6,
      minDistance: 40,
      maxDistance: 6000,
      enabled: false,
    });

    this.scene.add(new THREE.HemisphereLight(theme.white, theme.groundLight, 2.1));
    const sun = new THREE.DirectionalLight(theme.white, 1.7);
    sun.position.set(-300, 420, 260);
    this.scene.add(sun);

    this.plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    this.centre = ringCentre(ring);
    this.reach = Math.max(...ring.map(([e, n]) => Math.hypot(e - this.centre[0], n - this.centre[1])));
    this.edge = densifyRing(ring, EDGE_STEP);
    this.eastmost = this.edge.reduce((a, p) => (p[0] > a[0] ? p : a));

    this.buildGround(grid, coverage);
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

    this.context = new THREE.Mesh(
      this.geometry,
      this.track(new THREE.MeshLambertMaterial({
        color: theme.sceneBlank,
        alphaMap: this.outsideMask,
        transparent: true,
        alphaTest: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 4,
      })),
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
    this.scene.add(this.context, ...this.groundParts);
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

  /** The basemap drawn over the block, as a canvas spanning the terrain's bounds. */
  setBasemap(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    for (const mesh of [this.context, this.surface]) {
      mesh.material.map?.dispose();
      mesh.material.map = texture;
      mesh.material.color.set(theme.white);
      mesh.material.needsUpdate = true;
    }
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

  setContextOpacity(opacity) {
    this.contextOpacity = opacity;
    const { material } = this.context;
    material.opacity = opacity;
    material.depthWrite = opacity > 0.98;
    this.context.visible = opacity > 0.01;
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

  // The cut face: under each sample a column from the ground down, coloured through the depths
  // inside the polygon and plain soil outside it; a line along the ground and one at each depth.
  buildCurtain(samples) {
    const columns = samples.length;
    const rows = CURTAIN_ROWS + 1;
    const grounds = new Float32Array(columns * rows);
    const depths = new Float32Array(columns * rows);
    const positions = new Float32Array(columns * rows * 3);
    const colours = new Float32Array(columns * rows * 3);
    const deepest = DEPTHS[DEPTHS.length - 1];
    samples.forEach((s, c) => {
      for (let r = 0; r < rows; r++) {
        const k = c * rows + r;
        const share = r / CURTAIN_ROWS;
        grounds[k] = s.ground;
        // Outside the polygon a negative depth stands for a fixed drop in metres.
        depths[k] = s.inside ? share * deepest : -share * GROUND_SLAB;
        positions.set([s.x, s.ground, -s.y], k * 3);
        let colour;
        if (s.inside) {
          const value = valueAtDepth(s.values, share * deepest);
          colour = channels(Number.isFinite(value) && this.colour(value));
        } else {
          colour = SOIL.clone().lerp(SOIL_DEEP, share);
        }
        colours.set([colour.r, colour.g, colour.b], k * 3);
      }
    });
    const index = [];
    for (let c = 0; c < columns - 1; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const a = c * rows + r;
        index.push(a, a + 1, a + rows, a + rows, a + 1, a + rows + 1);
      }
    }
    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    face.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    face.setIndex(index);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(face, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // The ground line, then a dashed line at each depth wherever the section is inside the polygon.
    const groundLine = new THREE.Line(
      lineGeometry(samples.map(s => [s.x, s.ground + 0.25, -s.y])),
      new THREE.LineBasicMaterial({ color: theme.white }),
    );
    group.add(groundLine);
    const depthLines = DEPTHS.map(depth => {
      const points = [];
      for (let c = 0; c < columns - 1; c++) {
        if (!samples[c].inside || !samples[c + 1].inside) continue;
        points.push([samples[c].x, samples[c].ground, -samples[c].y], [samples[c + 1].x, samples[c + 1].ground, -samples[c + 1].y]);
      }
      const line = new THREE.LineSegments(
        lineGeometry(points),
        new THREE.LineBasicMaterial({ color: theme.cutDepthLine, transparent: true, opacity: 0.45 }),
      );
      line.userData = { depth, grounds: points.map(p => p[1]) };
      group.add(line);
      return line;
    });
    return { group, face, grounds, depths, depthLines };
  }

  layoutCurtain() {
    const { face, grounds, depths, depthLines } = this.curtain;
    const positions = face.getAttribute('position');
    for (let k = 0; k < grounds.length; k++) {
      const d = depths[k];
      positions.setY(k, grounds[k] - (d >= 0 ? drop(this.spacing, d) : -d));
    }
    positions.needsUpdate = true;
    face.computeBoundingSphere();
    for (const line of depthLines) {
      const attribute = line.geometry.getAttribute('position');
      line.userData.grounds.forEach((g, k) => attribute.setY(k, g - drop(this.spacing, line.userData.depth)));
      attribute.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.visible = this.spacing > 0.3;
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
      context: 1,
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
      context: CONTEXT_FADED,
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
      context: this.contextOpacity,
    };
  }

  applyView({ target, radius, polar, azimuth, spacing, context }) {
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(radius, polar, azimuth));
    this.camera.lookAt(target);
    if (spacing !== this.spacing) this.setSpacing(spacing);
    if (context !== this.contextOpacity) this.setContextOpacity(context);
  }

  /** Jumps to a view. */
  show(view) {
    this.applyView(view);
    this.controls.update();
  }

  /** Flies from the current view to another, then calls `done`; the controls wait meanwhile. */
  flyTo(view, done, ms = FLY_MS) {
    this.controls.enabled = false;
    const from = this.currentView();
    let turn = view.azimuth - from.azimuth;
    turn = ((turn + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.flight = { from, to: { ...view, azimuth: from.azimuth + turn }, start: performance.now(), ms, done };
  }

  stepFlight(now) {
    const { from, to, start, ms, done } = this.flight;
    const t = Math.min(1, (now - start) / ms);
    const k = ease(t);
    this.applyView({
      target: from.target.clone().lerp(to.target, k),
      radius: lerp(from.radius, to.radius, k),
      polar: lerp(from.polar, to.polar, k),
      azimuth: lerp(from.azimuth, to.azimuth, k),
      spacing: lerp(from.spacing, to.spacing, k),
      context: lerp(from.context, to.context, k),
    });
    if (t < 1) return;
    this.flight = null;
    this.controls.enabled = true;
    this.controls.update();
    done?.();
  }

  // --- Frame, pointer and size ---

  frame() {
    const now = performance.now();
    if (this.flight) this.stepFlight(now);
    else this.controls.update();
    if (this.cut && this.plane.distanceToPoint(this.camera.position) > 0) this.plane.negate();
    if (this.pointer?.moved && !this.flight) {
      this.pointer.moved = false;
      const hit = this.pick(this.pointer.ndc);
      this.onHover?.(hit && { ...hit, clientX: this.pointer.x, clientY: this.pointer.y });
    }
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
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    this.unbindPointer = () => {
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
    this.scene.traverse(o => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.insideMask.dispose();
    this.outsideMask.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
