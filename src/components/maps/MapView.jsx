import { Suspense, lazy, useEffect } from 'react';
import { MapContainer, Pane, ScaleControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CatchmentLayers } from './Catchment';
import MapLogos from './MapLogos';
import TowerMarker from './TowerMarker';
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
  return (
    <div className={`map-view${view?.shown ? ' three-d' : ''}`}>
      <MapContainer
        bounds={extent}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        maxBoundsViscosity={1.0}
      >
        <SiteOpeningView extent={extent} />
        <Prepare3D />
        <ReturnView />
        <RegisterMap />
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
        <TowerMarker />
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
