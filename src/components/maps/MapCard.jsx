import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseChooser, BaseLayers, DEFAULT_BASEMAP_ID } from './Layers';
import Legend from './Legend';
import './MapView.css';

/**
 * One card at the top right of the map: the basemap chooser, a separator and,
 * when a variable is selected, its legend. The card sets the width of both.
 */
export default function MapCard({ legend }) {
  const map = useMap();
  const [container, setContainer] = useState(null);
  const [baseId, setBaseId] = useState(DEFAULT_BASEMAP_ID);
  const [overlayIds, setOverlayIds] = useState([]);

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

  const toggleOverlay = (id, on) => setOverlayIds(
    ids => (on ? [...ids.filter(other => other !== id), id] : ids.filter(other => other !== id)),
  );

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
