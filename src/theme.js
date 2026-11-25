/**
 * The side panel rail's width in px. JavaScript reads it here; `applyTheme` sets it as
 * `--rail-width` for the CSS, where the rail and its popups are placed from it.
 */
export const RAIL_WIDTH = 100;

/** The one typeface of the interface; `applyTheme` sets it as `--font`, and the MUI components take it too. */
export const FONT = "'Barlow', sans-serif";

/**
 * The colours and shadows of the interface, the only place any is written. Components read
 * them from here: JavaScript styles import `theme`, and CSS reads the custom properties that
 * `applyTheme` sets on the document root (`--panel`, `--text`, `--shadow-panel`, ...). A shade
 * of one of them in CSS is a `color-mix` of its property, never a new literal.
 */
export const theme = {
  page: '#2a2a2a',
  rail: '#282c34',
  panel: '#333333',
  panelBorder: '#444444',
  button: '#4a4a4a',
  active: '#616161',
  variable: '#555555',
  variableActive: '#666666',
  disabled: '#808080',
  text: '#d3d3d3',
  textStrong: '#e6e6e6',
  muted: '#b0b0b0',
  white: '#ffffff',
  accent: '#009da9',
  // The accent lightened for text and links: the accent itself falls short of
  // 4.5:1 on the panel and button greys.
  accentText: '#b3f3f8',
  link: '#90caf9',
  mutedOnLight: '#555555',
  shadow: 'rgba(0, 0, 0, 0.5)',
  // The wash under a name set on a picture, so white text reads over any imagery.
  scrim: 'rgba(0, 0, 0, 0.75)',
  // The darkening laid over the landing footage and behind the project overlay.
  veil: 'rgba(0, 0, 0, 0.55)',
  // The thin light edge round a landing card, at rest and under the pointer.
  cardEdge: 'rgba(172, 216, 216, 0.18)',
  cardEdgeHover: 'rgba(172, 216, 216, 0.55)',
  // The shadows, from the floating panels of the map up to the project overlay.
  shadowPanel: '2px 2px 10px rgba(0, 0, 0, 0.5)',
  shadowCard: '0 10px 30px rgba(0, 0, 0, 0.35)',
  shadowCardHover: '0 18px 44px rgba(0, 0, 0, 0.55)',
  shadowOverlay: '0 24px 64px rgba(0, 0, 0, 0.6)',
  // Under white text set straight on footage or imagery.
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
  // An area on the map with no value to colour it by.
  noData: '#000000',
  chart: {
    series: [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    ],
    co2: '#d62728',
    ch4: '#2ca02c',
    axis: '#333333',
    grid: 'rgba(0,0,0,0.1)',
    loadingText: '#595959',
    loadingVeil: 'rgba(255,255,255,0.6)',
    tooltipBackground: 'rgba(0,0,0,0.85)',
    tooltipText: '#ffffff',
    tooltipShadow: '0 2px 8px rgba(0,0,0,0.3)',
    pointFill: '#ffffff',
  },
  // The colour scales of the measured variables, low to high.
  scales: {
    redox: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
    temperature: ['#ffffcc', '#c2e699', '#31a354', '#006837'],
    moisture: ['#ffffcc', '#c2e699', '#31a354', '#006837'],
  },
  selectedArea: '#2b8cbe',
  // The depth gauge's soil column: lighter at the surface, darker at depth, each 3:1 or more against the rail.
  soilSurface: '#b8966f',
  soilDepth: '#a8855f',
  // The background of the rail's depth section: an earthy dark tone apart from the rail and the buttons.
  depthSection: '#45362a',
  // The 3D scene: the backdrop the map fades out to, and the soil of a cut face, near the surface and deeper.
  backdrop: '#3b414c',
  backdropEdge: '#1c1f25',
  soilCut: '#5d4636',
  soilCutDeep: '#3b2c22',
  // The ground before its basemap loads, the probes, the tower, and the light from below.
  sceneBlank: '#cfcfcf',
  probe: '#eeeeee',
  tower: '#22262d',
  groundLight: '#6b5a4a',
};

/** Every text colour with the background it is drawn on; `large` marks text of 18.66px bold or 24px and up. */
export const TEXT_PAIRS = [
  { text: 'text', background: 'panel' },
  { text: 'muted', background: 'panel' },
  { text: 'white', background: 'panel' },
  { text: 'accentText', background: 'panel' },
  { text: 'text', background: 'rail' },
  { text: 'text', background: 'button' },
  { text: 'accentText', background: 'button' },
  { text: 'textStrong', background: 'active' },
  { text: 'accentText', background: 'active' },
  { text: 'text', background: 'variable' },
  { text: 'accentText', background: 'variable' },
  { text: 'textStrong', background: 'variableActive' },
  { text: 'accentText', background: 'variableActive' },
  { text: 'muted', background: 'rail' },
  { text: 'textStrong', background: 'rail' },
  { text: 'accentText', background: 'rail' },
  { text: 'text', background: 'depthSection' },
  { text: 'muted', background: 'depthSection' },
  { text: 'textStrong', background: 'depthSection' },
  { text: 'accentText', background: 'depthSection' },
  { text: 'chart.loadingText', background: 'chart.loadingVeil' },
];

const kebab = name => name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

/** The flat colours as CSS custom properties: `{ '--accent-text': '#a3f0f6', ... }`. */
export const cssVariables = () => Object.fromEntries(
  Object.entries(theme)
    .filter(([, value]) => typeof value === 'string')
    .map(([name, value]) => [`--${kebab(name)}`, value]),
);

export const applyTheme = (root = document.documentElement) => {
  Object.entries(cssVariables()).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty('--rail-width', `${RAIL_WIDTH}px`);
  root.style.setProperty('--font', FONT);
};
