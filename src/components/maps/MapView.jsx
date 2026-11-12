import { Suspense, lazy, useEffect } from 'react';
import { MapContainer, Pane, ScaleControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CatchmentLayers } from './Catchment';
import MapLogos from './MapLogos';
import { MAX_ZOOM } from './basemap';
import { applySiteOpeningView, panelReach } from './siteOpeningView';
import { mapViewOf, useView } from '../../contexts/ViewContext';
import './MapView.css';

const Site3D = lazy(() => import('../site3d/Site3D'));

/** The zoom from which scrolling in on the site hands the map over to the 3D scene. */
export const HANDOVER_ZOOM = 18;

// Scrolling in at the handover zoom with the site in view opens the 3D scene, from this view, in
// place of zooming the map further.
function ZoomHandover({ centroid }) {
  const map = useMap();
  const view = useView();
  useEffect(() => {
    if (!view) return undefined;
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
        <ZoomHandover centroid={centroid} />
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
