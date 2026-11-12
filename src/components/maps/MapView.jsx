import { Suspense, lazy, useEffect } from 'react';
import { MapContainer, Pane, ScaleControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CatchmentLayers } from './Catchment';
import MapLogos from './MapLogos';
import { MAX_ZOOM } from './basemap';
import { applySiteOpeningView, panelReach } from './siteOpeningView';
import { HANDOVER_ZOOM, mapViewOf, useView, zoomFor } from '../../contexts/ViewContext';
import './MapView.css';

const Site3D = lazy(() => import('../site3d/Site3D'));

/** The zoom from which tilting the map opens the 3D scene: the surroundings fill the view from here in. */
export const TILT_FROM_ZOOM = 16;
// How far up a tilt drag goes, in px, before it counts as a tilt.
const TILT_DRAG = 12;
// How long the map sits idle before the 3D view's code and imagery load in the background.
const PREPARE_AFTER_MS = 1500;

// Tilting as you zoom, scrolling in on the site from the handover zoom carries on in the 3D scene.
function ZoomHandover({ centroid }) {
  const map = useMap();
  const view = useView();
  useEffect(() => {
    if (!view?.autoTilt) return undefined;
    const holder = map.getContainer().parentElement;
    const wheel = event => {
      if (view.mode !== '2d' || event.deltaY >= 0 || map.getZoom() < HANDOVER_ZOOM) return;
      if (!map.getBounds().contains(centroid)) return;
      event.preventDefault();
      event.stopPropagation();
      view.open3D(mapViewOf(map, 'zoom'));
    };
    holder.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => holder.removeEventListener('wheel', wheel, { capture: true });
  }, [map, view, centroid]);
  return null;
}

// Once the map is idle, the 3D view's code, site model and imagery load, so it opens at once.
function Prepare3D() {
  const view = useView();
  const baseId = view?.baseId;
  const overlayIds = view?.overlayIds;
  useEffect(() => {
    if (!baseId || typeof window.WebGLRenderingContext === 'undefined') return undefined;
    const timer = setTimeout(() => {
      import('../site3d/Site3D').then(site => site.prepare(baseId, overlayIds));
    }, PREPARE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [baseId, overlayIds]);
  return null;
}

// A right-drag or Shift-drag upward on the map, with the site in view, tilts it into the 3D scene.
function TiltHandover({ centroid }) {
  const map = useMap();
  const view = useView();
  useEffect(() => {
    if (!view) return undefined;
    const container = map.getContainer();
    let start = null;
    const down = event => {
      const tilting = event.button === 2 || (event.button === 0 && event.shiftKey);
      start = view.mode === '2d' && tilting ? event.clientY : null;
    };
    const move = event => {
      if (start == null || start - event.clientY < TILT_DRAG) return;
      start = null;
      if (map.getZoom() < TILT_FROM_ZOOM || !map.getBounds().contains(centroid)) return;
      view.open3D(mapViewOf(map, 'tilt'));
    };
    const up = () => {
      start = null;
    };
    const menu = event => event.preventDefault();
    container.addEventListener('pointerdown', down);
    container.addEventListener('contextmenu', menu);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('contextmenu', menu);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [map, view, centroid]);
  return null;
}

// As the 3D scene hands back, the map takes over where it looked: the same centre and ground scale.
function ReturnView() {
  const map = useMap();
  const returnTo = useView()?.returnTo;
  useEffect(() => {
    if (!returnTo) return;
    const { lon, lat, metresPerPixel } = returnTo;
    map.setView([lat, lon], zoomFor(metresPerPixel, lat), { animate: false });
  }, [map, returnTo]);
  return null;
}

function SiteOpeningView({ extent }) {
  const map = useMap();
  useEffect(() => {
    applySiteOpeningView(map, extent, panelReach(map));
  }, [map, extent]);
  return null;
}

export default function MapView({
  areas,
  activeAreaId,
  selectedData,
  selectArea,
  setShouldRecenter,
  shouldRecenter,
  extent,
  centroid,
  defaultColour,
  depth,
  redoxMin,
  redoxMax,
}) {
  const view = useView();
  return (
    <div className={`map-view${view?.shown ? ' three-d' : ''}`}>
      <MapContainer
        bounds={extent}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        maxBoundsViscosity={1.0}
        boxZoom={false}
        zoomSnap={0.25}
      >
        <SiteOpeningView extent={extent} />
        <TiltHandover centroid={centroid} />
        <ZoomHandover centroid={centroid} />
        <Prepare3D />
        <ReturnView />
        <Pane name="rasterPane" style={{ zIndex: 450 }} />
        <ZoomControl position="bottomright" />
        <ScaleControl imperial={false} maxWidth={250} />
        <CatchmentLayers
          areas={areas}
          activeAreaId={activeAreaId}
          dataOption={selectedData}
          onAreaClick={selectArea}
          recenterSignal={shouldRecenter}
          onRecenterHandled={() => setShouldRecenter(false)}
          centroid={centroid}
          defaultColour={defaultColour}
          depth={depth}
          redoxMin={redoxMin}
          redoxMax={redoxMax}
        />
      </MapContainer>
      {view && view.mode !== '2d' && (
        <Suspense fallback={null}>
          <Site3D />
        </Suspense>
      )}
      <MapLogos />
    </div>
  );
}
