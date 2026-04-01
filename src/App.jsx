import { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css';
import About from './components/sections/About';
import Catchment from './components/sections/Catchment';
import Cover from './components/sections/Cover';
import SideBar from './components/sections/SideBar';
import measurementsData from './data/measurements.json';

const dataOptions = [
  { key: 'Redox', color: '#2ca02c', label: 'Redox' },
  { key: 'Temperature', color: '#ff7f00', label: 'Temperature' },
  { key: 'Moisture', color: '#1f77b4', label: 'Moisture' },
];
const modelOptions = [];

const DEFAULT_COLOUR = '#000000';
const BOUNDS_BALMOOS = [[46.93, 8.03], [46.995, 8.09]];
const CENTROID_BALMOOS = [46.964, 8.060];

export default function App() {
  const [areas, setAreas] = useState([]);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [viewMode, setViewMode] = useState('experimental');
  const [redoxDepth, setRedoxDepth] = useState('top');
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const sectionsRef = useRef([]);

  const redoxRange = useMemo(() => {
    if (!activeAreaId || selectedData !== 'Redox') return { min: 0, max: 1 };
    
    const activeArea = areas.find(a => a.id === activeAreaId);
    if (!activeArea) return { min: 0, max: 1 };
    
    const redoxSensors = activeArea.sensors.filter(s => s.profile_type === 'redox' && s.redox);
    const allValues = redoxSensors.flatMap(s => [s.redox.top, s.redox.bottom]).filter(v => v != null);
    
    if (allValues.length === 0) return { min: 0, max: 1 };
    
    return {
      min: Math.min(...allValues),
      max: Math.max(...allValues),
    };
  }, [areas, activeAreaId, selectedData]);

  const selectArea = (id, recenter = false) => {
    if (recenter) setShouldRecenter(true);
    setActiveAreaId(id);
  };

  const clearArea = () => {
    setActiveAreaId(null);
    setSelectedData(null);
    setShouldRecenter(true);
  };

  const selectData = key => {
    setSelectedData(key);
  };

  useEffect(() => {
    const data = measurementsData.areas;
    setAreas(data);
    if (data.length === 1) selectArea(data[0].id, true);
  }, []);

  useEffect(() => {
    if (!activeAreaId) return;
    const firstKey = viewMode === 'experimental'
      ? dataOptions[0].key
      : modelOptions[0]?.key;
    if (firstKey) setSelectedData(firstKey);
  }, [viewMode, activeAreaId]);

  useEffect(() => {
    const handleGlobalWheel = (event) => {
      if (event.target.closest('.leaflet-popup')) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
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
        redoxDepth={redoxDepth}
        setRedoxDepth={setRedoxDepth}
      />

      <main className="sections">
        <Cover sectionsRef={sectionsRef}/>
        <Catchment
          areas={areas}
          activeAreaId={activeAreaId}
          selectedData={selectedData}
          viewMode={viewMode}
          selectArea={selectArea}
          setShouldRecenter={setShouldRecenter}
          shouldRecenter={shouldRecenter}
          sectionsRef={sectionsRef}
          bounds={BOUNDS_BALMOOS}
          centroid={CENTROID_BALMOOS}
          defaultColour={DEFAULT_COLOUR}
          redoxDepth={redoxDepth}
          redoxMin={redoxRange.min}
          redoxMax={redoxRange.max}
        />
        <About sectionsRef={sectionsRef} />
      </main>
    </div>
  );
}
