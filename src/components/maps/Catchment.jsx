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

const PROFILE_TYPE_FOR_DATA = {
  Temperature: 'chamber',
  Moisture: 'chamber',
  Redox: 'redox',
};

const FIXED_MARKER_COLOR = {
  Redox: '#2ca02c',
  Temperature: '#ff7f00',
  Moisture: '#1f77b4',
};

export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  recenterSignal,
  onRecenterHandled,
  bounds,
  centroid,
  defaultColour,
  redoxDepth,
}) {
  const map = useMap()
  const [hasZoomed, setHasZoomed] = useState(false)
  const prevAreasLengthRef = useRef(0)

  const allAreaBounds = (areaList) => {
    const coords = areaList
      .filter(a => a.geom?.coordinates)
      .flatMap(a => a.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng])));
    return coords.length ? L.latLngBounds(coords).pad(0.15) : null;
  };

  useEffect(() => {
    if (!areas.length || prevAreasLengthRef.current > 0 || activeAreaId) return;
    prevAreasLengthRef.current = areas.length;
    const fitAll = () => {
      const b = allAreaBounds(areas);
      if (b) map.fitBounds(b);
    };
    map._loaded ? fitAll() : map.once('load', fitAll);
  }, [areas]);

  useEffect(() => {
    if (!areas.length || !recenterSignal) return;
    setHasZoomed(false);

    const doFly = () => {
      if (activeAreaId) {
        const coords = areas
          .find(a => a.id === activeAreaId)
          ?.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng]));
        map.flyToBounds(L.latLngBounds(coords).pad(0.2), { duration: 1 });
        map.once('moveend', () => {
          setHasZoomed(true);
          onRecenterHandled();
        });
      } else {
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
        .filter(s => s.profile_type === PROFILE_TYPE_FOR_DATA[dataOption])
        .map(s => {
          const val = dataOption === 'Temperature' ? s.temperature : s.moisture;
          return typeof val === 'number' ? val : null;
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
    Temperature: 'Temperature [°C]',
    Moisture: 'Moisture [VWC]',
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
                  let popupContent;
                  
                  if (dataOption === 'Redox') {
                    clr = FIXED_MARKER_COLOR.Redox;
                    const value = sensor.redox?.[redoxDepth];
                    popupContent = value != null 
                      ? `${redoxDepth.charAt(0).toUpperCase() + redoxDepth.slice(1)}: ${value} mV`
                      : 'No data';
                  } else if (dataOption === 'Temperature') {
                    const value = sensor.temperature;
                    clr = value != null ? getColor(value) : defaultColour;
                    popupContent = value != null 
                      ? `${value.toFixed(1)} °C`
                      : 'No data';
                  } else if (dataOption === 'Moisture') {
                    const value = sensor.moisture;
                    clr = value != null ? getColor(value) : defaultColour;
                    popupContent = value != null 
                      ? `${(value * 100).toFixed(1)} %`
                      : 'No data';
                  } else {
                    clr = defaultColour;
                    popupContent = 'No data';
                  }

                  return (
                    <CircleMarker
                      key={sensor.id}
                      center={[lat, lon]}
                      pathOptions={{ color: clr, fillColor: clr, fillOpacity: 1 }}
                      radius={8}
                    >
                      <Popup>
                        <strong>{sensor.name}</strong>
                        <br /><br />
                        {popupContent}
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
