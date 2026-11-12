import { useEffect, useMemo, useRef, useState } from "react";
import Slider from "@mui/material/Slider";
import { getArea, getRedoxProfiles } from "../../data";
import { getSurroundings, getTerrain } from "../../data/terrain";
import { useSelection } from "../../contexts/SelectionContext";
import {
  HANDOVER_ZOOM,
  metresPerPixel,
  useView,
} from "../../contexts/ViewContext";
import { theme } from "../../theme";
import { getColorScale } from "../../utils/colourMap";
import { stops } from "../../utils/stops";
import { BASEMAP_LAYERS } from "../maps/basemap";
import { BaseChooser } from "../maps/Layers";
import Legend from "../maps/Legend";
import ViewSwitch from "../maps/ViewSwitch";
import {
  DEPTHS,
  colourLookup,
  crossSection,
  depthField,
  hexChannels,
  paintField,
  readingRange,
  ringCoverage,
} from "./fields";
import { cutLine, ringCentre } from "./geo";
import ProfilePanel from "./ProfilePanel";
import { SiteScene, TILTED, ZOOM_STEP } from "./scene";
import { terrainModel } from "./terrain";
import { basemapCanvas } from "./tiles";
import "./Site3D.css";

const TEXTURE_CELLS = 320;
const SURROUNDINGS_CELLS = 512;
const BASEMAP_ZOOM = 19;
// The surroundings' basemap: a coarse one first, which loads quickly, then a sharper one.
const SURROUNDINGS_ZOOMS = [16, 17];
// Metres of drop per 10 cm of depth when the scene opens.
const DEFAULT_SPACING = 30;
// The generated variation as a share of the readings' range.
const NOISE_SHARE = 0.3;
const NOISE_SEED = 7;
const CUT_SAMPLES = 240;
const LANDSCAPE_SAMPLES = 400;
const SHOW_MS = 120;
const FADE_MS = 200;
const TILT_MS = 600;
const FLATTEN_MS = 500;
const FOV = 30;
// How much closer the first scroll in from the map comes, as a factor on the distance.
const ENTRY_STEP = 1.15;

// The site in local metres: its ground, polygon, raster grid and the positions, from the built-in data.
function siteModel() {
  const terrain = terrainModel(getTerrain());
  const area = getArea();
  const { toLocal, halfWidth, halfHeight } = terrain.frame;
  const ring = area.geom.coordinates[0].map(([lon, lat]) => toLocal(lon, lat));
  const grid = {
    width: TEXTURE_CELLS,
    height: Math.round((TEXTURE_CELLS * halfHeight) / halfWidth),
    halfWidth,
    halfHeight,
  };
  const sensors = [...new Map(area.sensors.map((s) => [s.id, s])).values()];
  const positions = sensors.map((s) => {
    const [x, y] = toLocal(s.geom["4326"].x, s.geom["4326"].y);
    return { name: s.name, x, y };
  });
  const centre = ringCentre(ring);

  // The surroundings, with a hole one coarse cell inside the block, whose own ground fills it.
  const around = terrainModel(getSurroundings());
  const aroundGrid = {
    width: SURROUNDINGS_CELLS,
    height: SURROUNDINGS_CELLS,
    halfWidth: around.frame.halfWidth,
    halfHeight: around.frame.halfHeight,
  };
  const inset = (2 * around.frame.halfWidth) / (around.nx - 1);
  const aroundOffset = terrain.frame.toLocal(...around.frame.toLonLat(0, 0));
  const hole = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) =>
    around.frame.toLocal(
      ...terrain.frame.toLonLat(
        sx * (halfWidth - inset),
        sy * (halfHeight - inset),
      ),
    ),
  );
  return {
    terrain,
    ring,
    grid,
    coverage: ringCoverage(ring, grid),
    positions,
    centre,
    reach: Math.max(
      ...ring.map(([e, n]) => Math.hypot(e - centre[0], n - centre[1])),
    ),
    campaigns: stops("redox", { sensors }),
    surroundings: {
      terrain: around,
      grid: aroundGrid,
      coverage: ringCoverage(hole, aroundGrid),
    },
    landscape: {
      offset: aroundOffset,
      halfWidth: around.frame.halfWidth,
      halfHeight: around.frame.halfHeight,
    },
    // The ground in the block's frame and base: the block's own inside it, the surroundings' outside,
    // a metre low as the scene draws them.
    landscapeHeight: (e, n) =>
      Math.abs(e) <= halfWidth && Math.abs(n) <= halfHeight
        ? terrain.heightAt(e, n)
        : around.heightAt(e - aroundOffset[0], n - aroundOffset[1]) +
          around.base -
          terrain.base -
          1,
  };
}

let modelCache = null;
const cachedModel = () => {
  modelCache ??= siteModel();
  return modelCache;
};

// Basemap canvases by layers, bounds and zoom: drawn once, whether ahead of time or on opening.
const canvases = new Map();
const cachedCanvas = (layers, bounds, zoom) => {
  const key = `${layers.map((l) => l.id).join("+")}|${zoom}|${bounds.join(",")}`;
  if (!canvases.has(key))
    canvases.set(key, basemapCanvas(layers, bounds, zoom, theme.sceneBlank));
  return canvases.get(key);
};
const layersOf = (baseId, overlayIds) =>
  BASEMAP_LAYERS.filter((l) => l.id === baseId || overlayIds.includes(l.id));

/** Builds the site model and draws the basemaps the scene opens with, ahead of opening it. */
export function prepare(baseId, overlayIds) {
  const model = cachedModel();
  const layers = layersOf(baseId, overlayIds);
  cachedCanvas(layers, model.terrain.frame.mercatorBounds, BASEMAP_ZOOM);
  cachedCanvas(
    layers,
    model.surroundings.terrain.frame.mercatorBounds,
    SURROUNDINGS_ZOOMS[0],
  );
}

// The generated rasters of one campaign: a field per depth through the probe readings, painted over the grid.
function campaignRasters(model, campaign) {
  const { toLocal } = model.terrain.frame;
  const probes = getRedoxProfiles(campaign.date, campaign.until).map((p) => {
    const [x, y] = toLocal(p.geom["4326"].x, p.geom["4326"].y);
    return { name: p.name, x, y, values: DEPTHS.map((d) => p.values[d]) };
  });
  const range = readingRange(probes) ?? { min: -1, max: 1 };
  const scale = getColorScale("redox", range.min, range.max);
  const colour = colourLookup(
    (value) => hexChannels(scale(value).hex()),
    range.min,
    range.max,
  );
  const fields = DEPTHS.map((_, k) =>
    depthField(probes, k, NOISE_SHARE * (range.max - range.min), NOISE_SEED),
  );
  return {
    probes,
    fields,
    colour,
    range,
    scale,
    rasters: fields.map((field) =>
      paintField(field, model.coverage, model.grid, colour),
    ),
  };
}

// The 2D map's view in local metres: its centre and the ground it spans north to south.
function mapView(model, from) {
  const { toLocal } = model.terrain.frame;
  if (!from?.centre)
    return { centre: model.centre, height: 2 * model.terrain.frame.halfHeight };
  const [lat, lng] = from.centre;
  return {
    centre: toLocal(lng, lat),
    height: toLocal(lng, from.north)[1] - toLocal(lng, from.south)[1],
  };
}

function tooltipText(hover) {
  if (hover.kind === "slice") {
    return Number.isFinite(hover.value)
      ? `${hover.depth} cm: ${Math.round(hover.value)} mV (generated)`
      : `${hover.depth} cm: no data`;
  }
  if (hover.kind === "probe") {
    return Number.isFinite(hover.value)
      ? `${hover.name}, ${hover.depth} cm: ${Math.round(hover.value)} mV`
      : `${hover.name}, ${hover.depth} cm: no reading`;
  }
  if (hover.kind === "ground") return `Ground ${hover.elevation.toFixed(1)} m`;
  return hover.name;
}

const sliderSx = {
  color: theme.accent,
  py: "10px",
  "& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible": {
    boxShadow: "none",
  },
};

/**
 * The site in 3D over the map: it opens from above, framed as the map was, and tilts to show
 * the redox slices at four depths hanging under the ground, with an optional cross-section.
 */
export default function Site3D() {
  const view = useView();
  const { variable, option, date, selectVariable, selectOption } =
    useSelection();
  const model = useMemo(cachedModel, []);
  const holder = useRef(null);
  const scene = useRef(null);
  const start = useRef(mapView(model, view.from));
  const [phase, setPhase] = useState("loading");
  const [spacing, setSpacing] = useState(DEFAULT_SPACING);
  const [groundOn, setGroundOn] = useState(true);
  const [peel, setPeel] = useState(false);
  const [cutOn, setCutOn] = useState(false);
  const [cutOffset, setCutOffset] = useState(0);
  const [cutAngle, setCutAngle] = useState(90);
  const [hover, setHover] = useState(null);

  const campaign =
    model.campaigns.find((c) => c.date === date) ??
    model.campaigns[model.campaigns.length - 1];
  const rasters = useMemo(
    () => campaignRasters(model, campaign),
    [model, campaign],
  );

  const samples = useMemo(() => {
    if (!cutOn) return null;
    const { halfWidth, halfHeight } = model.terrain.frame;
    const line = cutLine(
      model.centre,
      cutAngle,
      cutOffset * model.reach,
      halfWidth,
      halfHeight,
    );
    if (!line) return null;
    // The same line, run across the whole surroundings.
    const {
      offset: [oe, on],
      halfWidth: aw,
      halfHeight: ah,
    } = model.landscape;
    const long = cutLine(
      [model.centre[0] - oe, model.centre[1] - on],
      cutAngle,
      cutOffset * model.reach,
      aw,
      ah,
    );
    return {
      line,
      landscape:
        long &&
        crossSection({
          from: [long.from[0] + oe, long.from[1] + on],
          to: [long.to[0] + oe, long.to[1] + on],
          count: LANDSCAPE_SAMPLES,
          heightAt: model.landscapeHeight,
          fields: [],
          ring: model.ring,
        }),
      points: crossSection({
        from: line.from,
        to: line.to,
        count: CUT_SAMPLES,
        heightAt: model.terrain.heightAt,
        fields: rasters.fields,
        ring: model.ring,
      }),
    };
  }, [cutOn, cutAngle, cutOffset, model, rasters]);

  // The slices are redox, so the rail switches to it once, as the view opens.
  const entered = useRef(false);
  useEffect(() => {
    if (entered.current) return;
    entered.current = true;
    if (variable !== "redox") selectVariable("redox");
  }, [variable, selectVariable]);

  const needle = useRef(null);
  const { leave3D } = view;
  useEffect(() => {
    const onCompass = (azimuth, polar) => {
      if (needle.current)
        needle.current.style.transform = `rotateX(${polar}rad) rotateZ(${azimuth}rad)`;
    };
    // The distance at which the scene shows what the map shows at the handover zoom.
    const lat = model.terrain.frame.toLonLat(...model.centre)[1];
    const handover =
      (metresPerPixel(HANDOVER_ZOOM, lat) * holder.current.clientHeight) /
      2 /
      Math.tan((FOV / 2) * (Math.PI / 180));
    const site = new SiteScene(holder.current, {
      ...model,
      spacing: DEFAULT_SPACING,
      handover,
      autoTilt: view.autoTilt,
      onHover: setHover,
      onPick: selectOption,
      onFlat: leave3D,
      onCompass,
    });
    site.show(site.topDownView(start.current.centre, start.current.height));
    scene.current = site;
    return () => site.dispose();
  }, [model, selectOption, leave3D]);

  // The block's basemap and the coarse surroundings' first, then the sharper surroundings'.
  useEffect(() => {
    let cancelled = false;
    const layers = layersOf(view.baseId, view.overlayIds);
    const draw = (bounds, zoom) => cachedCanvas(layers, bounds, zoom);
    const aroundBounds = model.surroundings.terrain.frame.mercatorBounds;
    Promise.all([
      draw(model.terrain.frame.mercatorBounds, BASEMAP_ZOOM),
      draw(aroundBounds, SURROUNDINGS_ZOOMS[0]),
    ])
      .then(([block, around]) => {
        if (cancelled) return null;
        scene.current.setBasemap(block);
        scene.current.setSurroundingsBasemap(around);
        setPhase((current) => (current === "loading" ? "showing" : current));
        return draw(aroundBounds, SURROUNDINGS_ZOOMS[1]);
      })
      .then((sharper) => {
        if (!cancelled && sharper)
          scene.current.setSurroundingsBasemap(sharper);
      });
    return () => {
      cancelled = true;
    };
  }, [view.baseId, view.overlayIds, model]);

  useEffect(() => {
    scene.current.setRasters({ ...rasters, grid: model.grid });
  }, [rasters, model]);

  useEffect(() => {
    scene.current.setSelectedDepth(variable === "redox" ? option : null);
  }, [variable, option]);

  // Picking a depth, on the rail or on a slice, peels the layers above it away.
  const shownDepth = useRef(option);
  useEffect(() => {
    if (option !== shownDepth.current) setPeel(true);
    shownDepth.current = option;
  }, [option]);

  useEffect(() => {
    scene.current.setPeel(peel);
  }, [peel]);

  useEffect(() => {
    scene.current.setCut(
      samples && {
        line: samples.line,
        samples: samples.points,
        landscape: samples.landscape,
      },
    );
  }, [samples]);

  useEffect(() => {
    scene.current.chooseSpacing(spacing);
  }, [spacing]);

  useEffect(() => {
    scene.current.setGroundShown(groundOn);
  }, [groundOn]);

  useEffect(() => {
    scene.current.setAutoTilt(view.autoTilt);
  }, [view.autoTilt]);

  useEffect(() => {
    if (phase === "showing") {
      const timer = setTimeout(() => {
        const site = scene.current;
        view.setShown(true);
        setPhase("flying");
        const opened = () => {
          site.setSteering(true);
          setPhase("open");
        };
        // Opening the site: the oblique view at once; scrolling in: the zoom carries on and the tilt
        // follows it; tilting the map: it tilts in place; the switch: it flies to the oblique view.
        if (view.from?.via === "start") {
          site.show(site.obliqueView());
          opened();
        } else if (view.from?.via === "zoom") {
          opened();
          site.nudge({ zoom: 1 / ENTRY_STEP });
        } else if (view.from?.via === "tilt")
          site.flyTo(site.tiltedView(TILTED), opened, TILT_MS);
        else site.flyTo(site.obliqueView(), opened);
      }, SHOW_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "fading") {
      const timer = setTimeout(view.closed, FADE_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, view]);

  useEffect(() => {
    if (view.mode !== "leaving" || phase === "returning" || phase === "fading")
      return;
    setPhase("returning");
    setHover(null);
    setCutOn(false);
    setGroundOn(true);
    const site = scene.current;
    site.setSteering(false);
    // The map takes over where the scene looks, once it is flat and north up.
    const back = () => {
      if (phase !== "loading") view.setReturnTo(site.groundView());
      view.setShown(false);
      setPhase("fading");
    };
    if (phase === "loading" || site.isFlat()) back();
    else site.flyTo(site.flatView(), back, FLATTEN_MS);
  }, [view, phase]);

  const visible = phase !== "loading" && phase !== "fading";
  const legend = {
    title: "Redox [mV]",
    colorScale: rasters.scale,
    minVal: Math.round(rasters.range.min),
    maxVal: Math.round(rasters.range.max),
  };

  return (
    <>
      {phase === "loading" && (
        <div className="site3d-loading">Loading the 3D view</div>
      )}
      <div className={`site3d${visible ? " visible" : ""}`}>
        <div className="site3d-canvas" ref={holder} />
        {phase === "open" && (
          <div className="site3d-hint">
            Scroll to zoom, drag to move, right-drag or Shift-drag to turn and
            tilt. Zoom out, or tilt back to flat, to return to the map. Click a
            slice to pick its depth.
          </div>
        )}
        <div className="map-card site3d-card">
          <ViewSwitch mode="3d" onChange={view.leave3D} />
          <BaseChooser
            name="basemap-3d"
            baseId={view.baseId}
            overlayIds={view.overlayIds}
            onBase={view.setBaseId}
            onOverlay={view.toggleOverlay}
          />
          <hr className="map-card-separator" />
          <div className="site3d-control">
            <div className="site3d-control-label">
              <span>Depth spacing</span>
              <span className="site3d-control-value">×{spacing * 10}</span>
            </div>
            <Slider
              size="small"
              min={2}
              max={60}
              value={spacing}
              disabled={phase !== "open"}
              onChange={(_, value) => setSpacing(value)}
              aria-label="Depth spacing"
              sx={sliderSx}
            />
          </div>
          <label className="site3d-check">
            <input
              type="checkbox"
              checked={view.autoTilt}
              onChange={(event) => view.setAutoTilt(event.target.checked)}
            />
            <span>Tilt as you zoom</span>
          </label>
          <label className="site3d-check">
            <input
              type="checkbox"
              checked={groundOn}
              onChange={(event) => setGroundOn(event.target.checked)}
            />
            <span>Ground</span>
          </label>
          <label className="site3d-check">
            <input
              type="checkbox"
              checked={peel}
              onChange={(event) => setPeel(event.target.checked)}
            />
            <span>Peel layers above the depth</span>
          </label>
          <label className="site3d-check">
            <input
              type="checkbox"
              checked={cutOn}
              onChange={(event) => setCutOn(event.target.checked)}
            />
            <span>Cross-section</span>
          </label>
          {cutOn && (
            <div className="site3d-control">
              <div className="site3d-control-label">
                <span>Position</span>
              </div>
              <Slider
                size="small"
                min={-1}
                max={1}
                step={0.01}
                value={cutOffset}
                onChange={(_, value) => setCutOffset(value)}
                aria-label="Cut position"
                sx={sliderSx}
              />
              <div className="site3d-control-label">
                <span>Direction</span>
                <span className="site3d-control-value">{cutAngle}°</span>
              </div>
              <Slider
                size="small"
                min={0}
                max={179}
                value={cutAngle}
                onChange={(_, value) => setCutAngle(value)}
                aria-label="Cut direction"
                sx={sliderSx}
              />
            </div>
          )}
          <hr className="map-card-separator" />
          <Legend {...legend} />
          <p className="site3d-note">
            {variable === "redox"
              ? "Slices generated from the probe readings"
              : "The slices show redox"}
          </p>
        </div>
        {samples && (
          <ProfilePanel
            samples={samples.points}
            colour={rasters.colour}
            base={model.terrain.base}
          />
        )}
        {hover && (
          <div
            className="site3d-tooltip"
            style={{ left: hover.clientX, top: hover.clientY }}
          >
            {tooltipText(hover)}
          </div>
        )}
        <div className="site3d-nav" role="group" aria-label="Camera">
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => scene.current.nudge({ zoom: 1 / ZOOM_STEP })}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => scene.current.nudge({ zoom: ZOOM_STEP })}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Face north"
            title="Face north"
            onClick={() => scene.current.faceNorth()}
          >
            <svg
              ref={needle}
              className="site3d-compass"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path className="site3d-compass-north" d="M12 2 L16 12 L8 12 Z" />
              <path
                className="site3d-compass-south"
                d="M12 22 L16 12 L8 12 Z"
              />
            </svg>
          </button>
        </div>
        <div className="site3d-attribution">
          Terrain and basemap &copy;{" "}
          <a
            href="https://www.swisstopo.admin.ch/"
            target="_blank"
            rel="noopener noreferrer"
          >
            swisstopo
          </a>
        </div>
      </div>
    </>
  );
}
