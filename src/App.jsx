import { useState, useEffect, useMemo } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import SidePanel from './components/SidePanel';
import MapView from './components/maps/MapView';
import BottomBar from './components/BottomBar';
import { getArea, getLatestAt } from './data';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { ViewProvider } from './contexts/ViewContext';
import { siteView } from './utils/siteView';

// The map layer a selectable variable draws; the fluxes have no marker layer yet.
const LAYER_FOR_VARIABLE = { redox: 'Redox', temperature: 'Temperature', moisture: 'Moisture' };

const DEFAULT_COLOUR = '#000000';
const SITE = siteView(getArea().geom);

export default function App() {
  const sensors = useMemo(() => getArea()?.sensors ?? [], []);
  return (
    <SelectionProvider sensors={sensors}>
      <ViewProvider>
        <SiteMap />
      </ViewProvider>
    </SelectionProvider>
  );
}

function SiteMap() {
  const { variable, option } = useSelection();
  const selectedData = LAYER_FOR_VARIABLE[variable] ?? null;
  const depth = selectedData ? option : null;
  const [areas, setAreas] = useState([]);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [shouldRecenter, setShouldRecenter] = useState(false);

  const redoxRange = useMemo(() => {
    if (!activeAreaId || selectedData !== 'Redox') return { min: 0, max: 1 };
    
    const activeArea = areas.find(a => a.id === activeAreaId);
    if (!activeArea) return { min: 0, max: 1 };
    
    const redoxSensors = activeArea.sensors.filter(s => s.profile_type === 'redox');
    const allValues = redoxSensors
      .map(s => getLatestAt(s.id, 'redox', depth))
      .filter(v => v != null);
    
    if (allValues.length === 0) return { min: 0, max: 1 };
    
    return {
      min: Math.min(...allValues),
      max: Math.max(...allValues),
    };
  }, [areas, activeAreaId, selectedData, depth]);

  const selectArea = (id, recenter = false) => {
    if (recenter) setShouldRecenter(true);
    setActiveAreaId(id);
  };

  useEffect(() => {
    const area = getArea();
    const data = area ? [area] : [];
    setAreas(data);
    if (data.length === 1) selectArea(data[0].id, true);
  }, []);

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
      <SidePanel />
      <MapView
        areas={areas}
        activeAreaId={activeAreaId}
        selectedData={selectedData}
        selectArea={selectArea}
        setShouldRecenter={setShouldRecenter}
        shouldRecenter={shouldRecenter}
        extent={SITE.extent}
        centroid={SITE.centroid}
        defaultColour={DEFAULT_COLOUR}
        depth={depth}
        redoxMin={redoxRange.min}
        redoxMax={redoxRange.max}
      />
      <BottomBar />
    </div>
  );
}
