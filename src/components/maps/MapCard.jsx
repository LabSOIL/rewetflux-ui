import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseChooser, BaseLayers, DEFAULT_BASEMAP_ID } from './Layers';
import Legend from './Legend';
import { useView } from '../../contexts/ViewContext';
import './MapView.css';

/** The checkbox for the redox layers at four depths: they show in 3D, so ticking it opens the 3D view and unticking it leaves. */
export const RedoxLayersToggle = ({ on, onChange }) => (
  <label className="map-card-3d">
    <input type="checkbox" checked={on} onChange={event => onChange(event.target.checked)} />
    <span>Redox layers (3D)</span>
  </label>
);

/**
 * One card at the top right of the map: the toggle for the 3D redox layers where they are offered, the
 * basemap chooser, a separator and, when a variable is selected, its legend. The card sets the
 * width of all of them. The basemap choice is the view's, shared with the 3D scene, when there is one.
 */
export default function MapCard({ legend }) {
  const map = useMap();
  const view = useView();
  const [container, setContainer] = useState(null);
  const [ownBaseId, setOwnBaseId] = useState(DEFAULT_BASEMAP_ID);
  const [ownOverlayIds, setOwnOverlayIds] = useState([]);
  const baseId = view?.baseId ?? ownBaseId;
  const overlayIds = view?.overlayIds ?? ownOverlayIds;
  const setBaseId = view?.setBaseId ?? setOwnBaseId;

  useEffect(() => {
    const control = L.control({ position: 'topright' });
    control.onAdd = () => {
      const card = L.DomUtil.create('div', 'map-card leaflet-control');
      L.DomEvent.disableClickPropagation(card);
      L.DomEvent.disableScrollPropagation(card);
      return card;
    };
    control.addTo(map);
    setContainer(control.getContainer());
    return () => {
      control.remove();
      setContainer(null);
    };
  }, [map]);

  const toggleOverlay = view?.toggleOverlay ?? ((id, on) => setOwnOverlayIds(
    ids => (on ? [...ids.filter(other => other !== id), id] : ids.filter(other => other !== id)),
  ));

  return (
    <>
      <BaseLayers baseId={baseId} overlayIds={overlayIds} />
      {container && createPortal(
        <>
          <BaseChooser baseId={baseId} overlayIds={overlayIds} onBase={setBaseId} onOverlay={toggleOverlay} />
          {view && <RedoxLayersToggle on={view.mode !== '2d'} onChange={view.toggle3D} />}
          {legend && (
            <>
              <hr className="map-card-separator" />
              <Legend {...legend} />
            </>
          )}
        </>,
        container,
      )}
    </>
  );
}
