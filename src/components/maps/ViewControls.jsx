import CenterFocusStrongOutlinedIcon from '@mui/icons-material/CenterFocusStrongOutlined';
import { useView } from '../../contexts/ViewContext';
import { signal, useSignal } from '../site3d/signal';

const LEVEL = signal(null);

/**
 * The view controls, in one place in 2D and 3D: a reset button above Zoom in and Zoom out. Over
 * the 3D scene they steer its camera, and the reset button is a compass that turns with the
 * scene's heading and tips with its tilt, turning it back north up with the site in frame. On the
 * map, which is always north up, they zoom it and the reset button recentres it on the site.
 */
export default function ViewControls({ map, onReset }) {
  const view = useView();
  const [turn, tilt] = useSignal(view?.compass ?? LEVEL) ?? [0, 0];
  const inScene = Boolean(view?.shown);
  const steer = (inScene, onMap) => () => {
    const scene = view?.shown ? view.camera.current : null;
    if (scene) inScene(scene);
    else onMap();
  };
  return (
    <div className="view-controls">
      <button
        type="button"
        className="view-controls-reset"
        aria-label={inScene ? 'Reset view' : 'Recentre on the site'}
        title={inScene ? 'Reset view: north up, the site in frame' : 'Recentre on the site'}
        onClick={steer(scene => scene.reset(), onReset)}
      >
        {inScene ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotateX(${tilt}rad) rotateZ(${turn}rad)` }}>
            <path className="view-controls-north" d="M12 2 L16 12 L8 12 Z" />
            <path className="view-controls-south" d="M12 22 L16 12 L8 12 Z" />
          </svg>
        ) : (
          <CenterFocusStrongOutlinedIcon aria-hidden="true" />
        )}
      </button>
      <div className="view-controls-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={steer(scene => scene.zoomIn(), () => map?.zoomIn())}>
          +
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={steer(scene => scene.zoomOut(), () => map?.zoomOut())}>
          −
        </button>
      </div>
    </div>
  );
}
