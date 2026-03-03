import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import {
  Popup,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseLayers } from './Layers';
import chroma from 'chroma-js';
import Legend from './Legend';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css'

// As there are more than one depth value (10, 30cm usually), we must only display one in the map,
// so we define the depth for temperature and moisture here
const DEPTH_TEMPERATURE_CM = 10;
const DEPTH_MOISTURE_CM = 10;

// Which sensor profile_type to show for each data option
const PROFILE_TYPE_FOR_DATA = {
  Temperature: 'tms',
  Moisture: 'tms',
  GasFlux: 'chamber',
  Redox: 'redox',
};

// Fixed marker colours for data types without an average value scale
const FIXED_MARKER_COLOR = {
  GasFlux: '#d62728',
  Redox: '#2ca02c',
};

export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  onSensorClick,
  onSensorClose,
  recenterSignal,
  onRecenterHandled,
  bounds,
  centroid,
  defaultColour,
}) {
  const map = useMap()
  const [hasZoomed, setHasZoomed] = useState(false)
  const prevAreasLengthRef = useRef(0)

  // Helper: compute padded bounds that fit all area polygons
  const allAreaBounds = (areaList) => {
    const coords = areaList
      .filter(a => a.geom?.coordinates)
      .flatMap(a => a.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng])));
    return coords.length ? L.latLngBounds(coords).pad(0.15) : null;
  };

  // Auto-fit to all areas on first load (no user interaction required)
  useEffect(() => {
    if (!areas.length || prevAreasLengthRef.current > 0 || activeAreaId) return;
    prevAreasLengthRef.current = areas.length;
    const fitAll = () => {
      const b = allAreaBounds(areas);
      if (b) map.fitBounds(b);
    };
    map._loaded ? fitAll() : map.once('load', fitAll);
  }, [areas]);

  // Fly to bounds when area selection changes
  useEffect(() => {
    if (!areas.length || !recenterSignal) return;
    setHasZoomed(false);

    const doFly = () => {
      if (activeAreaId) {
        // fly to the selected area's padded bounds
        const coords = areas
          .find(a => a.id === activeAreaId)
          ?.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng]));
        map.flyToBounds(L.latLngBounds(coords).pad(0.2), { duration: 1 });
        map.once('moveend', () => {
          setHasZoomed(true);
          onRecenterHandled();
        });
      } else {
        // no activeAreaId -> fit all available areas
        const b = allAreaBounds(areas);
        if (b) {
          map.flyToBounds(b, { duration: 1 });
        } else {
          map.flyTo(centroid, 13, { duration: 1 });
        }
        map.once('moveend', () => {
          setHasZoomed(true);
          onRecenterHandled();
        });
      }
    };

    map._loaded ? doFly() : map.once('load', doFly);
  }, [areas, activeAreaId, recenterSignal]);

  const { minVal, maxVal } = useMemo(() => {
    if (dataOption === 'Temperature' || dataOption === 'Moisture') {
      const sensorVals = (activeAreaId
        ? areas.find(a => a.id === activeAreaId)?.sensors || []
        : areas.flatMap(a => a.sensors)
      )
        .map(s => {
          const depths =
            dataOption === 'Temperature'
              ? s.average_temperature || {}
              : s.average_moisture || {};
          const temp_depths = depths[DEPTH_TEMPERATURE_CM];
          return typeof temp_depths === 'number' ? temp_depths : null;
        })
        .filter(v => v != null);

      if (sensorVals.length) {
        return {
          minVal: Math.floor(Math.min(...sensorVals)),
          maxVal: Math.ceil(Math.max(...sensorVals)),
        };
      }
      return { minVal: 0, maxVal: 1 };
    }

    return { minVal: 0, maxVal: 1 };
  }, [areas, activeAreaId, dataOption]);

  const legendTitles = {
    Temperature: `Avg. temperature (${DEPTH_TEMPERATURE_CM} cm)<br/>[°C]`,
    Moisture: `Moisture (${DEPTH_MOISTURE_CM} cm)<br/>[VWC (m³/m³)]`,
  };

  const colorScale = useMemo(() => {
    return chroma
      .scale(['#ffffcc', '#c2e699', '#31a354', '#006837'])
      .domain([minVal, maxVal]);
  }, [dataOption, minVal, maxVal]);
  const getColor = v => colorScale(v).hex()

  return (
    <>
      <BaseLayers />

      {areas.map(area => {
        if (!area.geom?.coordinates) return null
        const positions = area.geom.coordinates.map(
          ring => ring.map(([lng, lat]) => [lat, lng])
        )
        const isActive = area.id === activeAreaId

        return (
          <React.Fragment key={area.id}>
            <Polygon
              positions={positions}
              pathOptions={{
                fillOpacity: 0.25,
                color: isActive ? '#2b8cbe' : defaultColour
              }}
              eventHandlers={{
                add: e => e.target.bringToBack(),
                click: () => !isActive && onAreaClick(area.id, true)
              }}
            >
              {!isActive && (
                <Tooltip permanent interactive
                  eventHandlers={{ click: () => onAreaClick(area.id, true) }}
                >
                  {area.name}
                </Tooltip>
              )}
            </Polygon>

            {isActive && hasZoomed && PROFILE_TYPE_FOR_DATA[dataOption] &&
              area.sensors
                .filter(s => s.profile_type === PROFILE_TYPE_FOR_DATA[dataOption])
                .map(sensor => {
                  const c = sensor.geom['4326']; if (!c) return null
                  const { x: lon, y: lat } = c

                  let clr;
                  let popupExtra = null;
                  if (dataOption === 'Temperature' || dataOption === 'Moisture') {
                    const avg = dataOption === 'Temperature'
                      ? sensor.average_temperature
                      : sensor.average_moisture;
                    const depth = dataOption === 'Temperature'
                      ? DEPTH_TEMPERATURE_CM
                      : DEPTH_MOISTURE_CM;
                    const valueAtDepth = avg?.[depth] ?? null;
                    clr = valueAtDepth != null ? getColor(valueAtDepth) : defaultColour;
                    popupExtra = (
                      <>
                        <br /><br />
                        {Object.entries(avg || {}).map(([d, v]) => (
                          <div key={d}>
                            <strong>{d} cm</strong>: {v.toFixed(2)}
                            {dataOption === 'Temperature' ? ' \u00b0C' : ' m\u00b3/m\u00b3'}
                          </div>
                        ))}
                      </>
                    );
                  } else {
                    clr = FIXED_MARKER_COLOR[dataOption] || defaultColour;
                  }

                  return (
                    <CircleMarker
                      key={sensor.id}
                      center={[lat, lon]}
                      pathOptions={{ color: clr, fillColor: clr, fillOpacity: 1 }}
                      radius={8}
                      eventHandlers={{ click: () => onSensorClick(sensor.id) }}
                    >
                      <Popup eventHandlers={{ remove: () => onSensorClose() }}>
                        <strong>{sensor.name}</strong>
                        {popupExtra}
                      </Popup>
                    </CircleMarker>
                  )
                })
            }

            {(dataOption === 'Temperature' || dataOption === 'Moisture') && (
              <Legend
                dataOption={dataOption}
                title={legendTitles[dataOption] || dataOption}
                colorScale={colorScale}
                minVal={minVal}
                maxVal={maxVal}
              />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
