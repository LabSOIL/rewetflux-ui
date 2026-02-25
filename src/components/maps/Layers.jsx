import { LayersControl, TileLayer } from 'react-leaflet';


export const BaseLayers = () => {
    const { BaseLayer, Overlay } = LayersControl;
    return (
        <LayersControl collapsed={false}>
            <BaseLayer checked name="SwissTopo">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo Aerial">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo swissALTI3D">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo swissALTI3D</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
                    opacity={0.5}
                />
            </BaseLayer>
            <BaseLayer name="SwissTopo Lithology GeoCover">
                <TileLayer
                    attribution='&copy; <a href="https://www.swisstopo.admin.ch/">SwissTopo GeoCover</a>'
                    url="https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.geologie-geocover/default/current/3857/{z}/{x}/{y}.png"
                    opacity={0.5}
                    maxNativeZoom={16}
                />
            </BaseLayer>
            <BaseLayer name="OpenStreetMap">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    opacity={0.5}
                />
            </BaseLayer>
        </LayersControl >)
};
