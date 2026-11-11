import { TileLayer } from 'react-leaflet';
import { BASEMAP_LAYERS, DEFAULT_BASEMAP_ID, tileOptions } from './basemap';

export { DEFAULT_BASEMAP_ID };

const BASES = BASEMAP_LAYERS.filter(layer => layer.kind !== 'overlay');
const OVERLAYS = BASEMAP_LAYERS.filter(layer => layer.kind === 'overlay');

// Overlays draw over whichever base is chosen, whatever order the layers were added in.
const zIndexOf = layer => (layer.kind === 'overlay' ? 2 : 1);

/** The tile layers of the chosen base and of the switched-on overlays. */
export const BaseLayers = ({ baseId, overlayIds }) => (
    <>
        {BASEMAP_LAYERS
            .filter(layer => (layer.kind === 'overlay' ? overlayIds.includes(layer.id) : layer.id === baseId))
            .map(layer => (
                <TileLayer
                    key={layer.id}
                    {...tileOptions(layer)}
                    zIndex={zIndexOf(layer)}
                />
            ))}
    </>
);

/** The radio buttons for the bases and the checkboxes for the overlays. */
export const BaseChooser = ({ baseId, overlayIds, onBase, onOverlay }) => (
    <div className="map-card-layers">
        <div className="map-card-base">
            {BASES.map(layer => (
                <label key={layer.id}>
                    <input
                        type="radio"
                        name="basemap"
                        checked={layer.id === baseId}
                        onChange={() => onBase(layer.id)}
                    />
                    <span>{layer.name}</span>
                </label>
            ))}
        </div>
        {OVERLAYS.length > 0 && (
            <div className="map-card-overlays">
                {OVERLAYS.map(layer => (
                    <label key={layer.id}>
                        <input
                            type="checkbox"
                            checked={overlayIds.includes(layer.id)}
                            onChange={event => onOverlay(layer.id, event.target.checked)}
                        />
                        <span>{layer.name}</span>
                    </label>
                ))}
            </div>
        )}
    </div>
);
