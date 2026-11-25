import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SidePanel from './SidePanel';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';
import { ViewProvider, useView } from '../contexts/ViewContext';
import { CLOSE_MS, OPEN_MS } from '../utils/hoverPopup';

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

describe('SidePanel variable popup', () => {
  let container;
  let root;

  const VariableProbe = () => <output data-testid="variable">{String(useSelection().variable)}</output>;
  const trigger = () => [...container.querySelectorAll('button')].find(b => b.textContent.includes('Variable'));
  const popup = () => container.querySelector('.popup[aria-label="Variable"]');
  const info = () => container.querySelector('.info-popup');
  const pointer = (el, type, { kind = 'mouse', x = 0, y = 0 } = {}) =>
    act(() => {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: kind, clientX: x, clientY: y }));
    });
  const over = (el, opts) => pointer(el, 'pointerover', opts);
  // React reads pointerleave from pointerout, with the element entered as relatedTarget.
  const out = (el, opts = {}) =>
    act(() => {
      const to = opts.to ?? document.body;
      el.dispatchEvent(new PointerEvent('pointerout', {
        bubbles: true, pointerType: opts.kind ?? 'mouse', clientX: opts.x ?? 0, clientY: opts.y ?? 0, relatedTarget: to,
      }));
    });
  const wait = ms => act(() => vi.advanceTimersByTime(ms));
  const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  beforeEach(async () => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <SelectionProvider sensors={[]} initial={{ variable: 'redox', option: 5 }}>
          <SidePanel />
          <VariableProbe />
        </SelectionProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('opens when the mouse rests on the button, not when it only passes over', async () => {
    await over(trigger());
    await wait(OPEN_MS - 20);
    await out(trigger());
    await wait(OPEN_MS);
    expect(popup()).toBeNull();

    await over(trigger());
    await wait(OPEN_MS);
    expect(popup()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().classList.contains('active')).toBe(true);
  });

  it('stays open while the mouse strays off it for less than the grace period, and closes after', async () => {
    await over(trigger());
    await wait(OPEN_MS);
    await out(trigger(), { x: 20, y: 300 });
    await wait(CLOSE_MS - 50);
    await over(popup());
    await wait(CLOSE_MS * 2);
    expect(popup()).not.toBeNull();

    await out(popup());
    await wait(CLOSE_MS);
    expect(popup()).toBeNull();
  });

  it('keeps waiting while the mouse moves through the safe area towards the popup', async () => {
    await over(trigger());
    await wait(OPEN_MS);
    popup().getBoundingClientRect = () => ({ left: 100, right: 500, top: 10, bottom: 300 });
    await out(trigger(), { x: 40, y: 60 });
    for (let step = 1; step <= 4; step += 1) {
      await wait(CLOSE_MS - 50);
      await pointer(document, 'pointermove', { x: 40 + step * 12, y: 60 + step * 30 });
    }
    expect(popup()).not.toBeNull();
    await pointer(document, 'pointermove', { x: 10, y: 500 });
    await wait(CLOSE_MS);
    expect(popup()).toBeNull();
  });

  it('pins open on a click, even once hovered open, until clicked again', async () => {
    await over(trigger());
    await wait(OPEN_MS);
    await click(trigger());
    await out(trigger());
    await wait(CLOSE_MS * 2);
    expect(popup()).not.toBeNull();
    await click(trigger());
    expect(popup()).toBeNull();
  });

  it('opens on a tap and ignores touch as hover, closing on a press outside or Escape', async () => {
    await over(trigger(), { kind: 'touch' });
    await wait(OPEN_MS);
    expect(popup()).toBeNull();
    await click(trigger());
    expect(popup()).not.toBeNull();
    await out(trigger(), { kind: 'touch' });
    await wait(CLOSE_MS);
    expect(popup()).not.toBeNull();
    await pointer(popup(), 'pointerdown', { kind: 'touch' });
    expect(popup()).not.toBeNull();
    await pointer(document.body, 'pointerdown', { kind: 'touch' });
    expect(popup()).toBeNull();

    await click(trigger());
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(popup()).toBeNull();
  });

  it('selects a variable from the hovered popup and closes it', async () => {
    await over(trigger());
    await wait(OPEN_MS);
    const chip = [...popup().querySelectorAll('.MuiChip-root')].find(c => c.textContent !== 'Redox');
    await click(chip);
    expect(container.querySelector('[data-testid="variable"]').textContent).not.toBe('redox');
    expect(popup()).toBeNull();
  });

  it('shows one popup at a time with Info', async () => {
    const infoButton = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Info'));
    await click(infoButton);
    expect(info()).not.toBeNull();
    await over(trigger());
    await wait(OPEN_MS);
    expect(info()).toBeNull();
    expect(popup()).not.toBeNull();
    await click(infoButton);
    expect(popup()).toBeNull();
    expect(info()).not.toBeNull();
  });
});
