import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import BottomBar from './BottomBar';
import { SelectionProvider } from '../contexts/SelectionContext';
import { RAIL_WIDTH } from '../theme';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flux = dates => dates.map(d => ({ measured_on: `${d}T09:00:00Z`, setting: 'uncovered' }));
const logger = (start, n) => ({
  start: `${start}T00:00:00Z`,
  resolution: 'daily',
  parameters: [
    { name: 'soil_temperature', depth_cm: 5, values: Array.from({ length: n }, (_, i) => i) },
    { name: 'vwc', depth_cm: 5, values: Array.from({ length: n }, () => 0.2) },
  ],
});

const TEAL = 'rgb(0, 157, 169)';
const LIGHT_TEAL = 'rgb(179, 243, 248)';

describe('BottomBar', () => {
  let container;
  let root;

  const render = async (sensors, initial) => {
    await act(async () => {
      root.render(
        <SelectionProvider sensors={sensors} initial={initial}>
          <BottomBar />
        </SelectionProvider>,
      );
    });
  };
  const labels = () => [...container.querySelectorAll('.MuiSlider-markLabel')].map(l => l.textContent);
  const marks = () => container.querySelectorAll('.MuiSlider-mark');

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('hides the track and colours the thumb teal, as the framework does', async () => {
    await render([{ id: 'a', flux_data: flux(['2030-03-02', '2030-05-20']) }], { variable: 'co2', option: 'uncovered' });
    const track = container.querySelector('.MuiSlider-track');
    const thumb = container.querySelector('.MuiSlider-thumb');
    expect(getComputedStyle(track).display).toBe('none');
    expect(getComputedStyle(thumb).backgroundColor).toBe(TEAL);
  });

  it('starts ten pixels past the rail', async () => {
    await render([{ id: 'a', flux_data: flux(['2030-03-02', '2030-05-20']) }], { variable: 'co2', option: 'uncovered' });
    expect(getComputedStyle(container.querySelector('.bottom-bar')).left).toBe(`${RAIL_WIDTH + 10}px`);
  });

  it('labels each flux campaign with its short date', async () => {
    await render([{ id: 'a', flux_data: flux(['2030-03-02', '2030-03-03', '2030-05-20']) }], {
      variable: 'co2',
      option: 'uncovered',
    });
    expect(labels()).toEqual(['2 Mar', '20 May']);
  });

  it('gives every stop of a daily layer a mark and labels only the first of each month', async () => {
    await render([{ id: 'a', tms_profiles: [logger('2030-07-28', 45)] }], {
      variable: 'temperature',
      option: 5,
      date: '2030-08-15',
    });
    expect(marks()).toHaveLength(45);
    expect(labels()).toEqual(['Aug', 'Sep']);
  });

  it('shows the selected label light teal and bold', async () => {
    await render([{ id: 'a', tms_profiles: [logger('2030-07-28', 45)] }], {
      variable: 'temperature',
      option: 5,
      date: '2030-09-01',
    });
    const selected = [...container.querySelectorAll('.MuiSlider-markLabel')].find(l => l.textContent === 'Sep');
    expect(getComputedStyle(selected).color).toBe(LIGHT_TEAL);
    expect(getComputedStyle(selected).fontWeight).toBe('700');
  });

  it('draws the bar opaque', async () => {
    await render([{ id: 'a', tms_profiles: [logger('2030-07-28', 45)] }], {
      variable: 'temperature',
      option: 5,
      date: '2030-09-01',
    });
    const opacity = getComputedStyle(container.querySelector('.bottom-bar')).opacity;
    expect(opacity === '' || opacity === '1').toBe(true);
  });

  it('writes the selected date beside a daily layer\'s bar', async () => {
    await render([{ id: 'a', tms_profiles: [logger('2030-07-28', 45)] }], {
      variable: 'temperature',
      option: 5,
      date: '2030-08-15',
    });
    expect(container.querySelector('.bottom-bar').textContent).toContain('15 Aug 2030');
  });
});
