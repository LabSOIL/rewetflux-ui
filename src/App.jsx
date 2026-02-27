import { useState, useEffect, useRef } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css';
import About from './components/sections/About';
import Catchment from './components/sections/Catchment';
import Cover from './components/sections/Cover';
import SideBar from './components/sections/SideBar';

const dataOptions = [
  { key: 'Temperature', color: '#ff7f00' },
  { key: 'Moisture', color: '#1f77b4' },
  // Phase 2: { key: 'GasFlux', color: '#d62728' },
  // Phase 2: { key: 'Redox', color: '#2ca02c' },
];
const modelOptions = [];

const DEFAULT_COLOUR = '#000000';
const BOUNDS_BALMOOS = [[46.93, 8.03], [46.995, 8.09]];
const CENTROID_BALMOOS = [46.964, 8.060];
const WEBSITE_SLUG = 'rewetflux';



export default function App() {
  const [areas, setAreas] = useState([]);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [viewMode, setViewMode] = useState('experimental');
  const [sensorSeries, setSensorSeries] = useState(null);
  const [zoomRange, setZoomRange] = useState(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const sensorCacheRef = useRef({});
  const activeSensorRef = useRef(null);
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);

  const fetchSensorData = async (sensorId, dataType, zoom) => {
    const zoomKey = zoom ? `${zoom.start}_${zoom.end}` : 'full';
    const cacheKey = `${sensorId}_${dataType}_${zoomKey}`;
    const cached = sensorCacheRef.current[cacheKey];
    if (cached) {
      setSensorSeries(cached);
      return;
    }

    let endpoint;
    if (dataType === 'Temperature') {
      endpoint = `/api/public/sensors/${sensorId}/temperature?website=${WEBSITE_SLUG}`;
    } else if (dataType === 'Moisture') {
      endpoint = `/api/public/sensors/${sensorId}/moisture?website=${WEBSITE_SLUG}`;
    } else {
      return;
    }

    if (zoom) {
      endpoint += `&start=${encodeURIComponent(zoom.start)}&end=${encodeURIComponent(zoom.end)}`;
    }

    try {
      setSensorLoading(true);
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to load sensor data (${res.status})`);
      const json = await res.json();
      sensorCacheRef.current[cacheKey] = json;
      setSensorSeries(json);
    } catch (err) {
      console.error(err);
    } finally {
      setSensorLoading(false);
    }
  };

  const handleSensorClick = async (sensorId) => {
    activeSensorRef.current = sensorId;
    setZoomRange(null);
    await fetchSensorData(sensorId, selectedData, null);
  };

  const handleZoom = async (zoom) => {
    setZoomRange(zoom);
    if (activeSensorRef.current && selectedData) {
      await fetchSensorData(activeSensorRef.current, selectedData, zoom);
    }
  };

  const selectArea = (id, recenter = false) => {
    setSensorSeries(null);
    if (recenter) setShouldRecenter(true);
    setActiveAreaId(id);
  };

  const clearArea = () => {
    setSensorSeries(null);
    setActiveAreaId(null);
    setSelectedData(null);
    setShouldRecenter(true);
  };

  const selectData = key => {
    setSensorSeries(null);
    setSelectedData(key);
  };

  useEffect(() => {
    fetch(`/api/public/areas?website=${WEBSITE_SLUG}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setAreas(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeAreaId) return;
    const firstKey = viewMode === 'experimental'
      ? dataOptions[0].key
      : modelOptions[0].key;
    setSelectedData(firstKey);
  }, [viewMode, activeAreaId]);

  // Prevent section swapping when scrolling inside Leaflet popups
  useEffect(() => {
    const handleGlobalWheel = (event) => {
      // Check if the event target is inside a Leaflet popup
      if (event.target.closest('.leaflet-popup')) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    // Add event listener with capture=true to intercept before other handlers
    document.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false });
    document.addEventListener('touchmove', handleGlobalWheel, { capture: true, passive: false });

    return () => {
      document.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      document.removeEventListener('touchmove', handleGlobalWheel, { capture: true });
    };
  }, []);

  return (
    <div className="App">
      <SideBar
        sectionsRef={sectionsRef}
        areas={areas}
        activeAreaId={activeAreaId}
        selectedData={selectedData}
        viewMode={viewMode}
        selectArea={selectArea}
        clearArea={clearArea}
        selectData={selectData}
        setViewMode={setViewMode}
      />

      <main className="sections">
        <Cover sectionsRef={sectionsRef}/>
        <Catchment
          areas={areas}
          activeAreaId={activeAreaId}
          selectedData={selectedData}
          viewMode={viewMode}
          selectArea={selectArea}
          handleSensorClick={handleSensorClick}
          sensorSeries={sensorSeries}
          setSensorSeries={setSensorSeries}
          setShouldRecenter={setShouldRecenter}
          shouldRecenter={shouldRecenter}
          sectionsRef={sectionsRef}
          bounds={BOUNDS_BALMOOS}
          centroid={CENTROID_BALMOOS}
          defaultColour={DEFAULT_COLOUR}
          onZoom={handleZoom}
          sensorLoading={sensorLoading}
        />
        <About sectionsRef={sectionsRef} />
      </main>
    </div>
  );
}
