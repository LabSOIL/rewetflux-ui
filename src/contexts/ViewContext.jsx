import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { DEFAULT_BASEMAP_ID } from '../components/maps/basemap';

const ViewContext = createContext(null);

/** The map zoom whose ground scale the 3D view shows flat when tilting as you zoom; closer in, it tilts. */
export const FLAT_ZOOM = 17;

/** Whether the site opens in 3D: only when the link asks for it with `?view=3d` and the browser draws WebGL. */
export function opensIn3D() {
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('view') !== '3d') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
const EQUATOR_METRES_PER_PIXEL = 156543.03392;

/** The ground metres one pixel spans at a web map zoom and latitude. */
export const metresPerPixel = (zoom, lat) => (EQUATOR_METRES_PER_PIXEL * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

/** The web map zoom at which one pixel spans `metres` of ground at a latitude. */
export const zoomFor = (metres, lat) => Math.log2((EQUATOR_METRES_PER_PIXEL * Math.cos((lat * Math.PI) / 180)) / metres);

/** The 2D map's view as the 3D scene opens from it: its centre and its north and south edges. */
export const mapViewOf = map => {
  const bounds = map.getBounds();
  const centre = map.getCenter();
  return { centre: [centre.lat, centre.lng], north: bounds.getNorth(), south: bounds.getSouth() };
};

/**
 * Holds whether the site shows as the 2D map or the 3D scene, and the basemap both draw.
 * `mode` is '2d', '3d' while the scene is open, or 'leaving' while it goes back to the map;
 * `shown` is true while the scene covers the map; `from` is the map's view when 3D opened;
 * `returnTo` is where the scene looked as it handed back, `{ lon, lat, metresPerPixel }`;
 * `autoTilt` is whether the 3D view tilts as it zooms in.
 */
export function ViewProvider({ children, start3D = opensIn3D }) {
  const [initially3D] = useState(start3D);
  const [mode, setMode] = useState(initially3D ? '3d' : '2d');
  const [from, setFrom] = useState(null);
  const [shown, setShown] = useState(initially3D);
  const [baseId, setBaseId] = useState(DEFAULT_BASEMAP_ID);
  const [overlayIds, setOverlayIds] = useState([]);
  const [returnTo, setReturnTo] = useState(null);
  const [autoTilt, setAutoTilt] = useState(true);

  const toggleOverlay = useCallback(
    (id, on) => setOverlayIds(ids => (on ? [...ids.filter(other => other !== id), id] : ids.filter(other => other !== id))),
    [],
  );
  const open3D = useCallback(view => {
    setFrom(view);
    setMode('3d');
  }, []);
  const leave3D = useCallback(() => setMode(current => (current === '3d' ? 'leaving' : current)), []);
  // The map registers how to read its view, so the 3D layers can open from where it is.
  const mapView = useRef(null);
  const registerMap = useCallback(readView => {
    mapView.current = readView;
  }, []);
  const toggle3D = useCallback(() => {
    if (mode === '2d') open3D(mapView.current?.() ?? null);
    else leave3D();
  }, [mode, open3D, leave3D]);
  const closed = useCallback(() => {
    setShown(false);
    setMode('2d');
  }, []);

  const value = useMemo(
    () => ({
      mode,
      from,
      shown,
      baseId,
      overlayIds,
      returnTo,
      autoTilt,
      setBaseId,
      setShown,
      setReturnTo,
      setAutoTilt,
      toggleOverlay,
      open3D,
      leave3D,
      toggle3D,
      registerMap,
      closed,
    }),
    [mode, from, shown, baseId, overlayIds, returnTo, autoTilt, toggleOverlay, open3D, leave3D, toggle3D, registerMap, closed],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/** The view state, or null outside a ViewProvider, where the map offers no 3D. */
export const useView = () => useContext(ViewContext);
