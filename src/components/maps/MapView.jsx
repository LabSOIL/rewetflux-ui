import { Suspense, lazy, useEffect, useState } from 'react';
import { MapContainer, Pane, ScaleControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CatchmentLayers } from './Catchment';
import { BaseLayers, BaseSwitcher, DEFAULT_BASEMAP_ID } from './Layers';
import MapLogos from './MapLogos';
import TowerMarker from './TowerMarker';
import ViewControls from './ViewControls';
import { MAX_ZOOM } from './basemap';
import { applySiteOpeningView, panelReach } from './siteOpeningView';
import { mapViewOf, useView, zoomFor } from '../../contexts/ViewContext';
import './MapView.css';

const Site3D = lazy(() => import('../site3d/Site3D'));

// How long the map sits idle before the 3D view's code and imagery load in the background.
const PREPARE_AFTER_MS = 1500;

// Once the map is idle, the 3D view's code, site model and imagery load, so it opens at once.
function Prepare3D() {
  const view = useView();
  const baseId = view?.baseId;
  useEffect(() => {
    if (!baseId || typeof window.WebGLRenderingContext === 'undefined') return undefined;
    const timer = setTimeout(() => {
      import('../site3d/Site3D').then(site => site.prepare(baseId));
    }, PREPARE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [baseId]);
  return null;
}

// Lets the view context read the map's view, so the 3D layers open from where the map is.
function RegisterMap() {
  const map = useMap();
  const registerMap = useView()?.registerMap;
  useEffect(() => {
    registerMap?.(() => mapViewOf(map));
  }, [map, registerMap]);
  return null;
}

// As the 3D scene hands back, the map takes over where it looked: the same centre, at the whole
// zoom that shows at least as much ground.
function ReturnView() {
  const map = useMap();
  const returnTo = useView()?.returnTo;
  useEffect(() => {
    if (!returnTo) return;
    const { lon, lat, metresPerPixel } = returnTo;
    map.setView([lat, lon], Math.floor(zoomFor(metresPerPixel, lat)), { animate: false });
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
  // The basemap is the view's, shared with the 3D scene, when there is one.
  const [ownBaseId, setOwnBaseId] = useState(DEFAULT_BASEMAP_ID);
  const baseId = view?.baseId ?? ownBaseId;
  const setBaseId = view?.setBaseId ?? setOwnBaseId;
  const [map, setMap] = useState(null);
  return (
    <div className={`map-view${view?.shown ? ' three-d' : ''}`}>
      <MapContainer
        ref={setMap}
        bounds={extent}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        // Shift-drag would draw Leaflet's zoom box, which nothing in the site explains.
        boxZoom={false}
        zoomControl={false}
        maxBoundsViscosity={1.0}
      >
        <SiteOpeningView extent={extent} />
        <Prepare3D />
        <ReturnView />
        <RegisterMap />
        <BaseLayers baseId={baseId} />
        <Pane name="rasterPane" style={{ zIndex: 450 }} />
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
        <TowerMarker />
      </MapContainer>
      {view && view.mode !== '2d' && (
        <Suspense fallback={null}>
          <Site3D />
        </Suspense>
      )}
      <MapLogos />
      <BaseSwitcher baseId={baseId} onBase={setBaseId} />
      <ViewControls map={map} onReset={() => setShouldRecenter(true)} />
    </div>
  );
}
