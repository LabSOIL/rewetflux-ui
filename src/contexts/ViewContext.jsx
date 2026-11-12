import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_BASEMAP_ID } from '../components/maps/basemap';

const ViewContext = createContext(null);

/**
 * The 2D map's view as the 3D scene opens from it: its centre, its north and south edges, and
 * `via`, 'zoom' when scrolling in opened it.
 */
export const mapViewOf = (map, via = 'switch') => {
  const bounds = map.getBounds();
  const centre = map.getCenter();
  return { centre: [centre.lat, centre.lng], north: bounds.getNorth(), south: bounds.getSouth(), via };
};

/**
 * Holds whether the site shows as the 2D map or the 3D scene, and the basemap both draw.
 * `mode` is '2d', '3d' while the scene is open, or 'leaving' while it goes back to the map;
 * `shown` is true while the scene covers the map; `from` is the map's view when 3D opened.
 */
export function ViewProvider({ children }) {
  const [mode, setMode] = useState('2d');
  const [from, setFrom] = useState(null);
  const [shown, setShown] = useState(false);
  const [baseId, setBaseId] = useState(DEFAULT_BASEMAP_ID);
  const [overlayIds, setOverlayIds] = useState([]);

  const toggleOverlay = useCallback(
    (id, on) => setOverlayIds(ids => (on ? [...ids.filter(other => other !== id), id] : ids.filter(other => other !== id))),
    [],
  );
  const open3D = useCallback(view => {
    setFrom(view);
    setMode('3d');
  }, []);
  const leave3D = useCallback(() => setMode(current => (current === '3d' ? 'leaving' : current)), []);
  const closed = useCallback(() => {
    setShown(false);
    setMode('2d');
  }, []);

  const value = useMemo(
    () => ({ mode, from, shown, baseId, overlayIds, setBaseId, setShown, toggleOverlay, open3D, leave3D, closed }),
    [mode, from, shown, baseId, overlayIds, toggleOverlay, open3D, leave3D, closed],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/** The view state, or null outside a ViewProvider, where the map offers no 3D. */
export const useView = () => useContext(ViewContext);
