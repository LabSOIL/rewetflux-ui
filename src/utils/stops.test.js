import { describe, expect, it } from 'vitest';
import { defaultStop, labelStops, stops, stopOnChange } from './stops';

const flux = dates => dates.map(d => ({ measured_on: `${d}T09:00:00Z`, setting: 'uncovered' }));
const redox = dates => dates.map(d => ({ measured_on: `${d}T12:00:00Z`, ch1_5cm_mv: 1 }));
const logger = (start, n) => ({
  start: `${start}T00:00:00Z`,
  resolution: 'daily',
  parameters: [
    { name: 'soil_temperature', depth_cm: 5, values: Array.from({ length: n }, (_, i) => i) },
    { name: 'vwc', depth_cm: 5, values: Array.from({ length: n }, () => 0.2) },
  ],
});
const area = {
  sensors: [
    { id: 'a', flux_data: flux(['2030-03-02', '2030-03-02', '2030-03-03']), redox_data: redox(['2030-04-01']) },
    { id: 'b', flux_data: flux(['2030-05-20']), redox_data: redox(['2030-04-05', '2030-04-20']) },
    { id: 'c', tms_profiles: [logger('2030-06-29', 4)] },
    { id: 'd', tms_profiles: [logger('2030-06-30', 4)] },
  ],
};
const dates = (layer, a = area) => stops(layer, a).map(s => s.date);

describe('stops', () => {
  it('gives one stop per flux campaign, the same for each flux', () => {
    expect(dates('co2')).toEqual(['2030-03-02', '2030-05-20']);
    expect(dates('ch4')).toEqual(dates('co2'));
    expect(dates('h2o')).toEqual(dates('co2'));
  });

  it('joins redox readings within seven days and splits readings further apart', () => {
    expect(dates('redox')).toEqual(['2030-04-01', '2030-04-20']);
  });

  it('keeps the span of a campaign', () => {
    expect(stops('redox', area)[0]).toEqual({ date: '2030-04-01', until: '2030-04-05' });
  });

  it('gives one stop per day of the logger series, across positions', () => {
    expect(dates('temperature')).toEqual([
      '2030-06-29', '2030-06-30', '2030-07-01', '2030-07-02', '2030-07-03',
    ]);
    expect(dates('moisture')).toEqual(dates('temperature'));
  });

  it('gives no stops when the layer has no data', () => {
    expect(stops('redox', { sensors: [] })).toEqual([]);
    expect(stops('redox', null)).toEqual([]);
  });
});

describe('defaultStop', () => {
  it('is the latest stop', () => {
    expect(defaultStop('redox', area)).toBe('2030-04-20');
    expect(defaultStop('temperature', area)).toBe('2030-07-03');
  });

  it('is null without stops', () => {
    expect(defaultStop('co2', { sensors: [] })).toBeNull();
  });
});

describe('stopOnChange', () => {
  it('moves to the new layer\'s latest stop', () => {
    expect(stopOnChange('2030-04-20', 'redox', 'temperature', area)).toBe('2030-07-03');
  });

  it('keeps the date when the new layer has it as a stop', () => {
    expect(stopOnChange('2030-05-20', 'co2', 'ch4', area)).toBe('2030-05-20');
  });
});

describe('labelStops', () => {
  it('labels the first of each month on a daily series', () => {
    expect(labelStops('temperature', stops('temperature', area)).map(s => s.date)).toEqual(['2030-07-01']);
  });

  it('labels every campaign', () => {
    expect(labelStops('redox', stops('redox', area))).toHaveLength(2);
  });
});
