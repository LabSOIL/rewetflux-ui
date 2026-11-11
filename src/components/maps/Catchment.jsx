import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  Popup,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapCard from './MapCard';
import chroma from 'chroma-js';
import 'leaflet/dist/leaflet.css';
import { colormap, getColorScale, getPalette } from '../../utils/colourMap';
import { getLatestAt } from '../../data';
import { theme } from '../../theme';
import { flyToClearOfPanels } from './siteOpeningView';

const PROFILE_TYPE_FOR_DATA = {
  Temperature: 'chamber',
  Moisture: 'chamber',
  Redox: 'redox',
};

const VARIABLE_FOR_DATA = {
  Temperature: 'temperature',
  Moisture: 'moisture',
  Redox: 'redox',
};

export function CatchmentLayers({
  areas,
  activeAreaId,
  dataOption,
  onAreaClick,
  recenterSignal,
  onRecenterHandled,
  centroid,
  defaultColour,
  depth,
  redoxMin,
  redoxMax,
}) {
  const map = useMap();
  const [hasZoomed, setHasZoomed] = useState(false);

  const allAreaBounds = (areaList) => {
    const coords = areaList
      .filter(a => a.geom?.coordinates)
      .flatMap(a => a.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng])));
    return coords.length ? L.latLngBounds(coords).pad(0.15) : null;
  };

  useEffect(() => {
    if (!areas.length || !recenterSignal) return;
    setHasZoomed(false);

    const doFly = () => {
      // Registered before the fly: Leaflet emits moveend synchronously when it does not animate.
      map.once('moveend', () => {
        setHasZoomed(true);
        onRecenterHandled();
      });
      if (activeAreaId) {
        const coords = areas
          .find(a => a.id === activeAreaId)
          ?.geom.coordinates.flatMap(ring => ring.map(([lng, lat]) => [lat, lng]));
        flyToClearOfPanels(map, L.latLngBounds(coords));
      } else {
        const b = allAreaBounds(areas);
        if (b) {
          flyToClearOfPanels(map, b);
        } else {
          map.flyTo(centroid, 13, { duration: 1 });
        }
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
        .map(s => getLatestAt(s.id, VARIABLE_FOR_DATA[dataOption], depth))
        .filter(v => typeof v === 'number');

      if (sensorVals.length) {
        return {
          minVal: Math.floor(Math.min(...sensorVals)),
          maxVal: Math.ceil(Math.max(...sensorVals)),
        };
      }
      return { minVal: 0, maxVal: 1 };
    }

    if (dataOption === 'Redox') {
      return { minVal: redoxMin, maxVal: redoxMax };
    }

    return { minVal: 0, maxVal: 1 };
  }, [areas, activeAreaId, dataOption, depth, redoxMin, redoxMax]);

  const legendTitles = {
    Temperature: 'Temperature [°C]',
    Moisture: 'Moisture [VWC]',
    Redox: 'Redox [mV]',
  };

  const colorScale = useMemo(() => {
    if (dataOption === 'Redox') {
      return getColorScale('redox', minVal, maxVal);
    }
    return chroma
      .scale(getPalette(dataOption === 'Temperature' ? 'temperature' : 'moisture'))
      .domain([minVal, maxVal]);
  }, [dataOption, minVal, maxVal]);

  const getColor = (v, palette) => {
    if (dataOption === 'Redox') {
      return colormap(v, minVal, maxVal, 'redox') || defaultColour;
    }
    return colorScale(v).hex();
  };

  return (
    <>
      <MapCard
        legend={dataOption === 'Temperature' || dataOption === 'Moisture' || dataOption === 'Redox'
          ? { title: legendTitles[dataOption] || dataOption, colorScale, minVal, maxVal }
          : null}
      />

      {areas.map(area => {
        if (!area.geom?.coordinates) return null;
        const positions = area.geom.coordinates.map(
          ring => ring.map(([lng, lat]) => [lat, lng])
        );
        const isActive = area.id === activeAreaId;

        return (
          <React.Fragment key={area.id}>
            <Polygon
              positions={positions}
              pathOptions={{
                fillOpacity: 0.25,
                color: isActive ? theme.selectedArea : defaultColour,
              }}
              eventHandlers={{
                add: e => e.target.bringToBack(),
                click: () => !isActive && onAreaClick(area.id, true),
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
                  const c = sensor.geom['4326'];
                  if (!c) return null;
                  const { x: lon, y: lat } = c;

                  let clr;
                  let popupContent;

                  if (dataOption === 'Redox') {
                    const value = getLatestAt(sensor.id, 'redox', depth);
                    clr = value != null ? getColor(value) : defaultColour;
                    popupContent = value != null
                      ? `${value.toFixed(1)} mV at ${depth} cm`
                      : 'No data';
                  } else if (dataOption === 'Temperature') {
                    const value = getLatestAt(sensor.id, 'temperature', depth);
                    clr = value != null ? getColor(value) : defaultColour;
                    popupContent = value != null
                      ? `${value.toFixed(1)} °C`
                      : 'No data';
                  } else if (dataOption === 'Moisture') {
                    const value = getLatestAt(sensor.id, 'moisture', depth);
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
                  );
                })
            }
          </React.Fragment>
        );
      })}
    </>
  );
}
