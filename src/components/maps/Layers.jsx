import { LayersControl, TileLayer } from 'react-leaflet';


export const BaseLayers = () => {
    const { BaseLayer, Overlay } = LayersControl;
    return (
        <LayersControl collapsed={false}>
            <BaseLayer checked name="Topo">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="Aerial">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <Overlay name="LiDAR / Relief">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo swissALTI3D</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
                    opacity={0.5}
                />
            </Overlay>
        </LayersControl>
    );
};
