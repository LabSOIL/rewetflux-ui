import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_BASEMAP_ID } from '../components/maps/basemap';

const ViewContext = createContext(null);

/**
 * Holds whether the site shows as the 2D map or the 3D scene, and the basemap both draw.
 * `mode` is '2d', '3d' while the scene is open, or 'leaving' while it flies back to the map;
 * `shown` is true while the scene covers the map; `from` is the map's view when 3D opened.
 */
export function ViewProvider({ children }) {
  const [mode, setMode] = useState('2d');
  const [from, setFrom] = useState(null);
  const [shown, setShown] = useState(false);
  const [baseId, setBaseId] = useState(DEFAULT_BASEMAP_ID);
  const [overlayIds, setOverlayIds] = useState([]);

  const value = useMemo(
    () => ({
      mode,
      from,
      shown,
      baseId,
      overlayIds,
      setBaseId,
      setShown,
      toggleOverlay: (id, on) =>
        setOverlayIds(ids => (on ? [...ids.filter(other => other !== id), id] : ids.filter(other => other !== id))),
      open3D: view => {
        setFrom(view);
        setMode('3d');
      },
      leave3D: () => setMode(current => (current === '3d' ? 'leaving' : current)),
      closed: () => {
        setShown(false);
        setMode('2d');
      },
    }),
    [mode, from, shown, baseId, overlayIds],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/** The view state, or null outside a ViewProvider, where the map offers no 3D. */
export const useView = () => useContext(ViewContext);
