import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import App from './App';
import SidePanel from './components/SidePanel';
import { getArea } from './data';
import { SelectionProvider } from './contexts/SelectionContext';
import { RAIL_WIDTH } from './theme';
import measurements from './data/measurements.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App', () => {
  let container;
  let root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders a map beside a side panel and no scroll sections', () => {
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelector('.side-panel')).not.toBeNull();
    expect(container.querySelector('.cover')).toBeNull();
    expect(container.querySelector('.about-section')).toBeNull();
    expect(container.querySelector('[data-section]')).toBeNull();
  });

  it('renders a Variable button, a 3D layers button and a depth gauge above an Info button', () => {
    const rail = container.querySelector('.side-panel');
    const top = [...rail.querySelectorAll('.button-group.top button')];
    expect(top.map(b => b.querySelector('.current-selection').textContent)).toEqual(['Redox', 'Off']);
    expect(top[1].textContent).toContain('3D layers');
    expect(top[1].getAttribute('aria-pressed')).toBe('false');
    expect(rail.querySelector('[aria-label="Depth below surface"]')).not.toBeNull();
    const bottom = [...rail.querySelectorAll('.button-group.bottom button')];
    expect(bottom.map(b => b.textContent)).toEqual(['Info']);
  });

  it('draws each redox position as a marker coloured by its latest reading', async () => {
    const redoxPositions = measurements.areas[0].sensors.filter(s => s.redox_data.length > 0).length;
    const markers = () => [...container.querySelectorAll('.leaflet-overlay-pane path[fill-opacity="1"]')];
    await vi.waitFor(() => expect(markers()).toHaveLength(redoxPositions));
    const valued = markers().filter(p => p.getAttribute('fill') !== '#000000');
    expect(valued).toHaveLength(redoxPositions);
  });

  const railButton = label =>
    [...container.querySelectorAll('.side-panel .button-group button')].find(b => b.textContent.startsWith(label));
  const chips = () => [...container.querySelectorAll('.popup .MuiChip-root')].map(c => c.textContent);
  const pickChip = label => [...container.querySelectorAll('.popup .MuiChip-root')].find(c => c.textContent === label).click();

  it('opens a popup with a chip per variable, and a pick changes the selection and closes the popup', async () => {
    expect(container.querySelector('.popup')).toBeNull();
    await act(async () => railButton('Variable').click());
    expect(chips()).toEqual(['CO\u2082 flux', 'CH\u2084 flux', 'H\u2082O flux', 'Redox', 'Temperature', 'Moisture']);
    await act(async () => pickChip('Moisture'));
    expect(container.querySelector('.popup')).toBeNull();
    expect(railButton('Variable').querySelector('.current-selection').textContent).toBe('Moisture');
    const stops = () => [...container.querySelectorAll('[aria-label="Depth below surface"] [role="radio"]')];
    expect(stops().map(stop => stop.getAttribute('aria-label'))).toEqual(['15 cm', '60 cm']);
    await act(async () => stops()[1].click());
    expect(stops().map(stop => stop.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('offers the chamber settings as rail buttons for a flux', async () => {
    await act(async () => railButton('Variable').click());
    await act(async () => pickChip('CO\u2082 flux'));
    expect([...container.querySelectorAll('.setting-buttons button')].map(b => b.textContent)).toEqual([
      'Uncovered',
      'Covered',
    ]);
  });

  it('shows the bottom bar on the selected layer\'s latest date and moves it when the layer changes', async () => {
    const thumb = () => container.querySelector('.bottom-bar input[type="range"]');
    const at = () => new Date(Number(thumb().value)).toISOString().slice(0, 10);
    expect(at()).toBe('2025-12-18');
    await act(async () => railButton('Variable').click());
    await act(async () => pickChip('Temperature'));
    expect(at()).toBe('2025-09-25');
  });

  it('floats the bottom bar inset from the rail and the right edge', () => {
    const bar = container.querySelector('.bottom-bar');
    expect(bar.style.bottom).toBe('30px');
    expect(bar.style.left).toBe(`${RAIL_WIDTH + 10}px`);
    expect(bar.style.right).toBe('50px');
  });

  it('opens the info panel from the side panel, which holds no logos; the map carries them', async () => {
    expect(container.querySelector('.popup')).toBeNull();
    await act(async () => railButton('Info').click());
    const info = container.querySelector('.popup');
    expect(info).not.toBeNull();
    expect(info.querySelectorAll('img')).toHaveLength(0);
    expect([...container.querySelectorAll('.map-logos img')].map(i => i.alt)).toHaveLength(3);
    await act(async () => railButton('Info').click());
    expect(container.querySelector('.popup')).toBeNull();
  });

  it('sets the info text with no type style of its own, so it takes the panel scale', async () => {
    await act(async () => railButton('Info').click());
    const body = container.querySelector('.popup .about-body');
    expect(body.querySelectorAll('p').length).toBeGreaterThan(0);
    expect(body.querySelectorAll('[style*="font-size"]')).toHaveLength(0);
    expect(body.querySelectorAll('[class*="MuiTypography-body"]')).toHaveLength(0);
    await act(async () => railButton('Info').click());
  });
});

describe('SidePanel with nothing chosen', () => {
  it('points at the variable until one is picked', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const note = () => container.querySelector('.arrow-note')?.textContent;
    await act(async () => {
      root.render(
        <SelectionProvider sensors={[]} initial={{ variable: null, option: null }}>
          <SidePanel />
        </SelectionProvider>,
      );
    });
    expect(note()).toBe('Select a variable');
    await act(async () => container.querySelector('.button-group.top button').click());
    await act(async () => [...container.querySelectorAll('.popup .MuiChip-root')].find(c => c.textContent === 'Redox').click());
    expect(note()).toBeUndefined();
    act(() => root.unmount());
    container.remove();
  });
});

describe('SidePanel info popup position', () => {
  let container;
  let root;

  const openInfo = async (initial, sensors) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <SelectionProvider sensors={sensors} initial={initial}>
          <SidePanel />
        </SelectionProvider>,
      );
    });
    await act(async () => container.querySelector('.button-group.bottom button').click());
    return container.querySelector('.popup');
  };

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('sits above the date bar while the bar shows', async () => {
    const popup = await openInfo({ variable: 'redox', option: 5 }, getArea().sensors);
    expect(popup.classList.contains('popup-bottom')).toBe(true);
    expect(popup.classList.contains('popup-bottom-no-timeline')).toBe(false);
  });

  it('sits above the scale bar when no date bar shows', async () => {
    const popup = await openInfo({ variable: null, option: null }, []);
    expect(popup.classList.contains('popup-bottom-no-timeline')).toBe(true);
    expect(popup.classList.contains('popup-bottom')).toBe(false);
  });
});

describe('SidePanel.css', () => {
  const css = readFileSync('src/components/SidePanel.css', 'utf8');
  const rule = selector =>
    [...css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'g'))]
      .map(m => m[1])
      .join('\n');

  it('sizes the rail from the rail width with 70px buttons', () => {
    expect(rule('.side-panel')).toMatch(/width:\s*var\(--rail-width\)/);
    expect(rule('.button-group button')).toMatch(/height:\s*70px/);
  });

  it('sizes the depth gauge and the chamber buttons to their content, leaving the rail empty below them', () => {
    expect(rule('.depth-slot')).not.toMatch(/flex:\s*1\b/);
    expect(rule('.depth-gauge')).not.toMatch(/flex:\s*1\b/);
    expect(rule('.depth-stop')).not.toMatch(/flex:\s*1\b/);
    expect(rule('.setting-buttons')).not.toMatch(/flex:\s*1\b/);
  });

  it('spaces the depth stops at a fixed 28px pitch', () => {
    expect(rule('.depth-stop')).toMatch(/height:\s*28px/);
  });

  it('sets the gauge and chamber labels at the rail button 12px size', () => {
    expect(rule('.slot-label')).toMatch(/font-size:\s*12px/);
  });

  it('anchors the popup 115px above the bottom when the date bar shows, and 45px when it does not', () => {
    expect(rule('.popup.popup-bottom')).toMatch(/bottom:\s*115px/);
    expect(rule('.popup.popup-bottom-no-timeline')).toMatch(/bottom:\s*45px/);
  });

  it('caps the info popup to the space above its anchor and scrolls the content inside it', () => {
    expect(rule('.popup.info-popup')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.popup.info-popup.popup-bottom')).toMatch(/max-height:\s*calc\(100vh - 125px\)/);
    expect(rule('.popup.info-popup.popup-bottom-no-timeline')).toMatch(/max-height:\s*calc\(100vh - 55px\)/);
  });

  it('sets the info popup text left-aligned', () => {
    expect(rule('.popup.info-popup')).toMatch(/text-align:\s*left/);
  });

  it('sets the info popup text at the panels 12px scale with a 1.5 line height', () => {
    expect(rule('.popup.info-popup')).toMatch(/font-size:\s*12px/);
    expect(rule('.popup.info-popup')).toMatch(/line-height:\s*1\.5/);
  });

  it('sets the info headings at 12px, weight 600, in the muted colour', () => {
    expect(rule('.popup.info-popup .info-heading')).toMatch(/font-size:\s*12px/);
    expect(rule('.popup.info-popup .info-heading')).toMatch(/font-weight:\s*600/);
    expect(rule('.popup.info-popup .info-heading')).toMatch(/color:\s*var\(--muted\)/);
  });

  it('colours the info links with the theme link colour', () => {
    expect(rule('.popup.info-popup a')).toMatch(/color:\s*var\(--link\)/);
  });

  it('holds no funder strip in the popup', () => {
    expect(css).not.toMatch(/\.funders/);
  });
});

describe('index.css', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const selectors = [...css.matchAll(/([^{}@]+)\{/g)].map(m => m[1].trim());

  it('styles no button, link or heading globally, so the side panel styles its own buttons', () => {
    expect(selectors.filter(s => /\b(button|a|h1)\b/.test(s))).toEqual([]);
  });

  it('sets no border radius, colour scheme or root colour', () => {
    expect(css).not.toMatch(/border-radius|color-scheme|prefers-color-scheme/);
    expect(selectors).not.toContain(':root');
  });
});
