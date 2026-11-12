// The one place the e2e specs name the page's parts.

export const PANELS = {
    rail: '.side-panel',
    popup: '.popup',
    zoom: '.leaflet-control-zoom',
    layers: '.leaflet-control-layers',
    card: '.map-card',
    logos: '.map-logos',
    legend: '.legend-container',
    bottomBar: '.bottom-bar',
    scale: '.leaflet-control-scale',
    attribution: '.leaflet-control-attribution',
};

// Panels a position marker must not open under.
export const MARKER_COVERS = ['rail', 'bottomBar', 'card', 'zoom'];

export const MARKERS = 'path.leaflet-interactive, .leaflet-marker-icon';
export const RAIL_BUTTONS = '.side-panel button';
export const RAIL_POPUPS = ['Variable', 'Info'];
export const DEPTH_GAUGE = '.depth-gauge';
export const LOGO_IMAGES = '.map-logos img';
export const MAP_CONTAINER = '.leaflet-container';
export const SITE_3D = {
    root: '.site3d',
    canvas: '.site3d-canvas canvas',
    card: '.site3d-card',
    hint: '.site3d-hint',
    profile: '.site3d-profile',
    nav: '.site3d-nav',
};
export const TILE_URL = /wmts20\.geo\.admin\.ch/;

export const WINDOW_SIZES = [
    { width: 1430, height: 830 },
    { width: 1024, height: 700 },
    { width: 800, height: 600 },
];
