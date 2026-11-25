import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Legend from './Legend';
import './MapView.css';

/** The card at the top right of the map with the selected variable's legend; empty, it hides. */
export default function MapCard({ legend }) {
  const map = useMap();
  const [container, setContainer] = useState(null);

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

  return container && legend ? createPortal(<Legend {...legend} />, container) : null;
}
