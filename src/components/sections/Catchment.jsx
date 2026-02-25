import {
  MapContainer,
  Pane,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import TimeseriesPlot from '../timeseries/TimeseriesPlot';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'
import { CatchmentLayers } from '../maps/Catchment';


export default function Catchment({
  areas,
  activeAreaId,
  selectedData,
  viewMode,
  selectArea,
  handleSensorClick,
  sensorSeries,
  setSensorSeries,
  setShouldRecenter,
  shouldRecenter,
  sectionsRef,
  bounds,
  centroid,
  defaultColour,
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
                onSensorClick={handleSensorClick}
                onSensorClose={() => setSensorSeries(null)}
                recenterSignal={shouldRecenter}
                onRecenterHandled={() => setShouldRecenter(false)}
                bounds={bounds}
                centroid={centroid}
                defaultColour={defaultColour}
              />
            </MapContainer>
            {sensorSeries && (selectedData === 'Temperature' || selectedData === 'Moisture') && (
              <div className="overlay-chart">
                <TimeseriesPlot series={sensorSeries} dataOption={selectedData} />
              </div>
            )}
          </div>
        </section>
        </>
    );
}
