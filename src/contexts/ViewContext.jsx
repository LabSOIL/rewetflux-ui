import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_BASEMAP_ID } from '../components/maps/basemap';

const ViewContext = createContext(null);

/** The map zoom from which scrolling in on the site, tilting as you zoom, carries on in the 3D scene. */
export const HANDOVER_ZOOM = 17;

/** Whether the site opens in 3D: where the browser draws WebGL, unless the link asks for the map with `?view=2d`. */
export function opensIn3D() {
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('view') === '2d') return false;
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

/**
 * The 2D map's view as the 3D scene opens from it: its centre, its north and south edges, and
 * `via`, 'tilt' when a tilt gesture on the map opened it or 'zoom' when scrolling in did; the
 * site opening in 3D has `{ via: 'start' }`.
 */
export const mapViewOf = (map, via = 'switch') => {
  const bounds = map.getBounds();
  const centre = map.getCenter();
  return { centre: [centre.lat, centre.lng], north: bounds.getNorth(), south: bounds.getSouth(), via };
};

/**
 * Holds whether the site shows as the 2D map or the 3D scene, and the basemap both draw.
 * `mode` is '2d', '3d' while the scene is open, or 'leaving' while it goes back to the map;
 * `shown` is true while the scene covers the map; `from` is the map's view when 3D opened;
 * `returnTo` is where the scene looked as it handed back, `{ lon, lat, metresPerPixel }`;
 * `autoTilt` is whether zooming in on the site tilts the view, into 3D.
 */
export function ViewProvider({ children, start3D = opensIn3D }) {
  const [initially3D] = useState(start3D);
  const [mode, setMode] = useState(initially3D ? '3d' : '2d');
  const [from, setFrom] = useState(initially3D ? { via: 'start' } : null);
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
      closed,
    }),
    [mode, from, shown, baseId, overlayIds, returnTo, autoTilt, toggleOverlay, open3D, leave3D, closed],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/** The view state, or null outside a ViewProvider, where the map offers no 3D. */
export const useView = () => useContext(ViewContext);
