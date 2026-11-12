import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseChooser, BaseLayers, DEFAULT_BASEMAP_ID } from './Layers';
import Legend from './Legend';
import { useView } from '../../contexts/ViewContext';
import './MapView.css';

/**
 * One card at the top right of the map: the basemap chooser, a separator and, when a variable is
 * selected, its legend. The card sets the width of both. The basemap choice is the view's, shared
 * with the 3D scene, when there is one.
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
