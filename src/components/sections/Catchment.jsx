import {
  MapContainer,
  Pane,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'
import { CatchmentLayers } from '../maps/Catchment';


export default function Catchment({
  areas,
  activeAreaId,
  selectedData,
  viewMode,
  selectArea,
  setShouldRecenter,
  shouldRecenter,
  sectionsRef,
  bounds,
  centroid,
  defaultColour,
  redoxDepth,
  redoxMin,
  redoxMax,
}) {
    return (
    <>
       <section
          className="section"
          data-section="catchment"
          ref={el => sectionsRef.current[1] = el}
        >
          <h2>{areas.find(a => a.id === activeAreaId)?.name || 'Select a catchment'}</h2>
          <div className="map-wrapper">
            <MapContainer
              center={centroid}
              zoom={13}
              minZoom={11}
              scrollWheelZoom
              className="leaflet-container"
              maxBounds={bounds}
              maxBoundsViscosity={1.0}
            >
              <Pane name="rasterPane" style={{ zIndex: 450 }} />
              <CatchmentLayers
                areas={areas}
                activeAreaId={activeAreaId}
                dataOption={selectedData}
                onAreaClick={selectArea}
                recenterSignal={shouldRecenter}
                onRecenterHandled={() => setShouldRecenter(false)}
                bounds={bounds}
                centroid={centroid}
                defaultColour={defaultColour}
                redoxDepth={redoxDepth}
                redoxMin={redoxMin}
                redoxMax={redoxMax}
              />
            </MapContainer>
          </div>
        </section>
        </>
    );
}
