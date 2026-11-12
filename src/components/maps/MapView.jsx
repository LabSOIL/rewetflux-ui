import { Suspense, lazy, useEffect } from 'react';
import { MapContainer, Pane, ScaleControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CatchmentLayers } from './Catchment';
import MapLogos from './MapLogos';
import { MAX_ZOOM } from './basemap';
import { applySiteOpeningView, panelReach } from './siteOpeningView';
import { useView } from '../../contexts/ViewContext';
import './MapView.css';

const Site3D = lazy(() => import('../site3d/Site3D'));

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
