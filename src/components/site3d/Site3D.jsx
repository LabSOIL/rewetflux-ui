import { useEffect, useMemo, useRef, useState } from 'react';
import Slider from '@mui/material/Slider';
import { getArea, getRedoxProfiles } from '../../data';
import { getSurroundings, getTerrain } from '../../data/terrain';
import { useSelection } from '../../contexts/SelectionContext';
import { useView } from '../../contexts/ViewContext';
import { theme } from '../../theme';
import { getColorScale } from '../../utils/colourMap';
import { stops } from '../../utils/stops';
import { BASEMAP_LAYERS } from '../maps/basemap';
import { BaseChooser } from '../maps/Layers';
import Legend from '../maps/Legend';
import ViewSwitch from '../maps/ViewSwitch';
import { DEPTHS, colourLookup, crossSection, depthField, hexChannels, paintField, readingRange, ringCoverage } from './fields';
import { cutLine, ringCentre } from './geo';
import ProfilePanel from './ProfilePanel';
import { LEVEL_STEP, SiteScene } from './scene';
import { terrainModel } from './terrain';
import { basemapCanvas } from './tiles';
import './Site3D.css';

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
const SHOW_MS = 350;
const FADE_MS = 450;

// The site in local metres: its ground, polygon, raster grid and the positions, from the built-in data.
function siteModel() {
  const terrain = terrainModel(getTerrain());
  const area = getArea();
  const { toLocal, halfWidth, halfHeight } = terrain.frame;
  const ring = area.geom.coordinates[0].map(([lon, lat]) => toLocal(lon, lat));
  const grid = { width: TEXTURE_CELLS, height: Math.round((TEXTURE_CELLS * halfHeight) / halfWidth), halfWidth, halfHeight };
  const sensors = [...new Map(area.sensors.map(s => [s.id, s])).values()];
  const positions = sensors.map(s => {
    const [x, y] = toLocal(s.geom['4326'].x, s.geom['4326'].y);
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
  const hole = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    around.frame.toLocal(...terrain.frame.toLonLat(sx * (halfWidth - inset), sy * (halfHeight - inset))),
  );
  return {
    terrain,
    ring,
    grid,
    coverage: ringCoverage(ring, grid),
    positions,
    centre,
    reach: Math.max(...ring.map(([e, n]) => Math.hypot(e - centre[0], n - centre[1]))),
    campaigns: stops('redox', { sensors }),
    surroundings: { terrain: around, grid: aroundGrid, coverage: ringCoverage(hole, aroundGrid) },
  };
}

// The generated rasters of one campaign: a field per depth through the probe readings, painted over the grid.
function campaignRasters(model, campaign) {
  const { toLocal } = model.terrain.frame;
  const probes = getRedoxProfiles(campaign.date, campaign.until).map(p => {
    const [x, y] = toLocal(p.geom['4326'].x, p.geom['4326'].y);
    return { name: p.name, x, y, values: DEPTHS.map(d => p.values[d]) };
  });
  const range = readingRange(probes) ?? { min: -1, max: 1 };
  const scale = getColorScale('redox', range.min, range.max);
  const colour = colourLookup(value => hexChannels(scale(value).hex()), range.min, range.max);
  const fields = DEPTHS.map((_, k) => depthField(probes, k, NOISE_SHARE * (range.max - range.min), NOISE_SEED));
  return {
    probes,
    fields,
    colour,
    range,
    scale,
    rasters: fields.map(field => paintField(field, model.coverage, model.grid, colour)),
  };
}

// The 2D map's view in local metres: its centre and the ground it spans north to south.
function mapView(model, from) {
  const { toLocal } = model.terrain.frame;
  if (!from) return { centre: model.centre, height: 2 * model.terrain.frame.halfHeight };
  const [lat, lng] = from.centre;
  return {
    centre: toLocal(lng, lat),
    height: toLocal(lng, from.north)[1] - toLocal(lng, from.south)[1],
  };
}

function tooltipText(hover) {
  if (hover.kind === 'slice') {
    return Number.isFinite(hover.value) ? `${hover.depth} cm: ${Math.round(hover.value)} mV (generated)` : `${hover.depth} cm: no data`;
  }
  if (hover.kind === 'probe') {
    return Number.isFinite(hover.value) ? `${hover.name}, ${hover.depth} cm: ${Math.round(hover.value)} mV` : `${hover.name}, ${hover.depth} cm: no reading`;
  }
  if (hover.kind === 'ground') return `Ground ${hover.elevation.toFixed(1)} m`;
  return hover.name;
}

const sliderSx = { color: theme.accent, py: '10px', '& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible': { boxShadow: 'none' } };

/**
 * The site in 3D over the map: it opens from above, framed as the map was, and tilts to show
 * the redox slices at four depths hanging under the ground, with an optional cross-section.
 */
export default function Site3D() {
  const view = useView();
  const { variable, option, date, selectVariable, selectOption } = useSelection();
  const model = useMemo(siteModel, []);
  const holder = useRef(null);
  const scene = useRef(null);
  const start = useRef(mapView(model, view.from));
  const [phase, setPhase] = useState('loading');
  const [spacing, setSpacing] = useState(DEFAULT_SPACING);
  const [groundOn, setGroundOn] = useState(true);
  const [cutOn, setCutOn] = useState(false);
  const [cutOffset, setCutOffset] = useState(0);
  const [cutAngle, setCutAngle] = useState(90);
  const [hover, setHover] = useState(null);

  const campaign = model.campaigns.find(c => c.date === date) ?? model.campaigns[model.campaigns.length - 1];
  const rasters = useMemo(() => campaignRasters(model, campaign), [model, campaign]);

  const samples = useMemo(() => {
    if (!cutOn) return null;
    const { halfWidth, halfHeight } = model.terrain.frame;
    const line = cutLine(model.centre, cutAngle, cutOffset * model.reach, halfWidth, halfHeight);
    if (!line) return null;
    return {
      line,
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
    if (variable !== 'redox') selectVariable('redox');
  }, [variable, selectVariable]);

  const { leave3D } = view;
  useEffect(() => {
    const site = new SiteScene(holder.current, { ...model, onHover: setHover, onPick: selectOption, onZoomOut: leave3D });
    site.show(site.topDownView(start.current.centre, start.current.height));
    scene.current = site;
    return () => site.dispose();
  }, [model, selectOption, leave3D]);

  // The block's basemap and the coarse surroundings' first, then the sharper surroundings'.
  useEffect(() => {
    let cancelled = false;
    const layers = BASEMAP_LAYERS.filter(l => l.id === view.baseId || view.overlayIds.includes(l.id));
    const draw = (bounds, zoom) => basemapCanvas(layers, bounds, zoom, theme.sceneBlank);
    const aroundBounds = model.surroundings.terrain.frame.mercatorBounds;
    Promise.all([draw(model.terrain.frame.mercatorBounds, BASEMAP_ZOOM), draw(aroundBounds, SURROUNDINGS_ZOOMS[0])])
      .then(([block, around]) => {
        if (cancelled) return null;
        scene.current.setBasemap(block);
        scene.current.setSurroundingsBasemap(around);
        setPhase(current => (current === 'loading' ? 'showing' : current));
        return draw(aroundBounds, SURROUNDINGS_ZOOMS[1]);
      })
      .then(sharper => {
        if (!cancelled && sharper) scene.current.setSurroundingsBasemap(sharper);
      });
    return () => {
      cancelled = true;
    };
  }, [view.baseId, view.overlayIds, model]);

  useEffect(() => {
    scene.current.setRasters({ ...rasters, grid: model.grid });
  }, [rasters, model]);

  useEffect(() => {
    scene.current.setSelectedDepth(variable === 'redox' ? option : null);
  }, [variable, option]);

  useEffect(() => {
    scene.current.setCut(samples && { line: samples.line, samples: samples.points });
  }, [samples]);

  useEffect(() => {
    if (phase === 'open') scene.current.chooseSpacing(spacing);
  }, [spacing, phase]);

  useEffect(() => {
    scene.current.setGroundShown(groundOn);
  }, [groundOn]);

  useEffect(() => {
    if (phase === 'showing') {
      const timer = setTimeout(() => {
        const site = scene.current;
        const top = site.topDownView(start.current.centre, start.current.height);
        const deep = site.obliqueView(DEFAULT_SPACING);
        view.setShown(true);
        if (view.from?.via === 'zoom') {
          // Opened by scrolling in: the scroll goes on tilting from where the map was.
          site.followScroll(top, deep, 0, LEVEL_STEP);
          setPhase('open');
          return;
        }
        setPhase('flying');
        site.flyTo(deep, () => {
          site.followScroll(top, deep, 1);
          setPhase('open');
        });
      }, SHOW_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'fading') {
      const timer = setTimeout(view.closed, FADE_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, view]);

  useEffect(() => {
    if (view.mode !== 'leaving' || phase === 'returning' || phase === 'fading') return;
    setPhase('returning');
    setHover(null);
    setCutOn(false);
    setGroundOn(true);
    const back = () => {
      view.setShown(false);
      setPhase('fading');
    };
    if (phase === 'loading') back();
    else scene.current.leave(scene.current.topDownView(start.current.centre, start.current.height), back);
  }, [view, phase]);

  const visible = phase !== 'loading' && phase !== 'fading';
  const legend = {
    title: 'Redox [mV]',
    colorScale: rasters.scale,
    minVal: Math.round(rasters.range.min),
    maxVal: Math.round(rasters.range.max),
  };

  return (
    <div className={`site3d${visible ? ' visible' : ''}`}>
      <div className="site3d-canvas" ref={holder} />
      {phase === 'open' && (
        <div className="site3d-hint">
          Scroll in to tilt and drop the slices, then to come closer; once tilted, drag to turn and right-drag to move.
          Scroll out to go back to the map. Click a slice to pick its depth.
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
            disabled={phase !== 'open'}
            onChange={(_, value) => setSpacing(value)}
            aria-label="Depth spacing"
            sx={sliderSx}
          />
        </div>
        <label className="site3d-check">
          <input type="checkbox" checked={groundOn} onChange={event => setGroundOn(event.target.checked)} />
          <span>Ground</span>
        </label>
        <label className="site3d-check">
          <input type="checkbox" checked={cutOn} onChange={event => setCutOn(event.target.checked)} />
          <span>Cross-section</span>
        </label>
        {cutOn && (
          <div className="site3d-control">
            <div className="site3d-control-label">
              <span>Position</span>
            </div>
            <Slider size="small" min={-1} max={1} step={0.01} value={cutOffset} onChange={(_, value) => setCutOffset(value)} aria-label="Cut position" sx={sliderSx} />
            <div className="site3d-control-label">
              <span>Direction</span>
              <span className="site3d-control-value">{cutAngle}°</span>
            </div>
            <Slider size="small" min={0} max={179} value={cutAngle} onChange={(_, value) => setCutAngle(value)} aria-label="Cut direction" sx={sliderSx} />
          </div>
        )}
        <hr className="map-card-separator" />
        <Legend {...legend} />
        <p className="site3d-note">
          {variable === 'redox' ? 'Slices generated from the probe readings' : 'The slices show redox'}
        </p>
      </div>
      {samples && <ProfilePanel samples={samples.points} colour={rasters.colour} base={model.terrain.base} />}
      {hover && (
        <div className="site3d-tooltip" style={{ left: hover.clientX, top: hover.clientY }}>
          {tooltipText(hover)}
        </div>
      )}
      <div className="site3d-attribution">
        Terrain and basemap &copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer">swisstopo</a>
      </div>
    </div>
  );
}
