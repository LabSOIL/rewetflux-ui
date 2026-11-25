import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SidePanel from './SidePanel';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import { ViewProvider, useView } from '../contexts/ViewContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Probe = () => {
  const { option } = useSelection();
  return <output data-testid="option">{String(option)}</output>;
};

describe('SidePanel depth layers', () => {
  let container;
  let root;

  const render = async initial => {
    await act(async () => {
      root.render(
        <SelectionProvider sensors={[]} initial={initial}>
          <SidePanel />
          <Probe />
        </SelectionProvider>,
      );
    });
  };
  const selected = () => container.querySelector('[data-testid="option"]').textContent;
  const gauge = () => container.querySelector('[aria-label="Depth below surface"]');
  const stops = () => [...container.querySelectorAll('[aria-label="Depth below surface"] [role="radio"]')];
  const click = async el => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const key = async (el, name) =>
    act(async () => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows redox depths as a gauge, shallow at the top, without a popup', async () => {
    await render({ variable: 'redox', option: 5 });
    expect(gauge().getAttribute('role')).toBe('radiogroup');
    expect(stops().map(s => s.textContent)).toEqual(['5 cm', '15 cm', '25 cm', '35 cm']);
    const surface = gauge().querySelector('.depth-surface');
    expect(surface.textContent).toBe('Surface');
    expect(surface.compareDocumentPosition(stops()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stops().map(s => s.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    const slot = container.querySelector('.depth-slot');
    expect(slot.classList.contains('depth-section')).toBe(true);
    expect(slot.previousElementSibling.classList.contains('top')).toBe(true);
    expect(slot.querySelector('.slot-label').textContent).toBe('Depth');
    expect(slot.querySelector('.slot-label').nextElementSibling).toBe(gauge());
    expect(container.querySelector('.popup')).toBeNull();
  });

  it('selects a depth by click and by arrow keys', async () => {
    await render({ variable: 'redox', option: 5 });
    await click(stops()[2]);
    expect(selected()).toBe('25');
    await key(gauge(), 'ArrowUp');
    expect(selected()).toBe('15');
    await key(gauge(), 'ArrowDown');
    await key(gauge(), 'ArrowDown');
    expect(selected()).toBe('35');
    await key(gauge(), 'ArrowDown');
    expect(selected()).toBe('35');
  });

  it('shows Uncovered and Covered buttons for a flux layer', async () => {
    await render({ variable: 'co2', option: 'uncovered' });
    expect(gauge()).toBeNull();
    const buttons = [...container.querySelectorAll('.setting-buttons button')];
    expect(buttons.map(b => b.textContent)).toEqual(['Uncovered', 'Covered']);
    expect(buttons[0].classList.contains('active')).toBe(true);
    const label = container.querySelector('.depth-slot .slot-label');
    expect(label.textContent).toBe('Chamber');
    expect(label.nextElementSibling).toBe(container.querySelector('.setting-buttons'));
    await click(buttons[1]);
    expect(selected()).toBe('covered');
    expect(container.querySelector('.popup')).toBeNull();
  });
});

describe('SidePanel cross-section', () => {
  let container;
  let root;

  const CrossSection = () => (
    <>
      <output data-testid="cross-section">{String(useView().crossSection)}</output>
      <output data-testid="spacing">{String(useView().layerSpacing)}</output>
    </>
  );
  const render = async start3D => {
    await act(async () => {
      root.render(
        <ViewProvider start3D={() => start3D}>
          <SelectionProvider sensors={[]} initial={{ variable: 'redox', option: 5 }}>
            <SidePanel />
            <CrossSection />
          </SelectionProvider>
        </ViewProvider>,
      );
    });
  };
  const toggle = () => [...container.querySelectorAll('button')].find(b => b.textContent.includes('Cross-section'));
  const shown = () => container.querySelector('[data-testid="cross-section"]').textContent;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers no cross-section on the 2D map', async () => {
    await render(false);
    expect(toggle()).toBeUndefined();
  });

  it('opens under the 3D layers button in 3D, off until pressed', async () => {
    await render(true);
    const layers = [...container.querySelectorAll('button')].find(b => b.textContent.includes('3D layers'));
    expect(layers.nextElementSibling).toBe(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().textContent).toContain('Off');
    expect(shown()).toBe('false');

    await act(async () => toggle().dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().textContent).toContain('On');
    expect(shown()).toBe('true');
  });

  it('offers the layer spacing as a vertical slider under the cross-section in 3D, and only there', async () => {
    await render(false);
    expect(container.querySelector('input[aria-label="Layer spacing"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    await render(true);
    const slider = container.querySelector('input[aria-label="Layer spacing"]');
    const section = slider.closest('.spacing-section');
    expect(toggle().nextElementSibling).toBe(section);
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');
    expect(section.textContent).toContain('×300');

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setValue.call(slider, '12');
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="spacing"]').textContent).toBe('12');
    expect(section.textContent).toContain('×120');
  });
});
