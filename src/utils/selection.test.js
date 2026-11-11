import { describe, expect, it } from 'vitest';
import { VARIABLES, optionsFor, selectVariable } from './selection';

const pointGeom = { 4326: { srid: 4326, x: 8, y: 46, z: 0 } };
const logger = depth => ({
  parameters: [
    { name: 'soil_temperature', depth_cm: depth, values: [1] },
    { name: 'vwc', depth_cm: depth, values: [0.1] },
  ],
});
const sensors = [
  { id: 'a', geom: pointGeom, tms_profiles: [logger(60), logger(15)] },
  { id: 'b', geom: pointGeom, tms_profiles: [logger(60)] },
  { id: 'c', geom: pointGeom, tms_profiles: [] },
];

describe('VARIABLES', () => {
  it('lists the three fluxes, redox, temperature and moisture', () => {
    expect(VARIABLES.map(v => v.key)).toEqual(['co2', 'ch4', 'h2o', 'redox', 'temperature', 'moisture']);
  });
});

describe('optionsFor', () => {
  it('offers the four redox depths', () => {
    expect(optionsFor('redox', sensors)).toEqual({ kind: 'depth', values: [5, 15, 25, 35] });
  });

  it('offers covered and uncovered for each flux', () => {
    for (const key of ['co2', 'ch4', 'h2o']) {
      expect(optionsFor(key, sensors)).toEqual({ kind: 'setting', values: ['uncovered', 'covered'] });
    }
  });

  it('offers the logger depths found in the data, shallowest first', () => {
    expect(optionsFor('temperature', sensors)).toEqual({ kind: 'depth', values: [15, 60] });
    expect(optionsFor('moisture', sensors)).toEqual({ kind: 'depth', values: [15, 60] });
  });

  it('offers no logger depth when no position has a logger', () => {
    expect(optionsFor('moisture', [sensors[2]])).toEqual({ kind: 'depth', values: [] });
  });
});

describe('selectVariable', () => {
  it('keeps the option when the new variable offers it', () => {
    const from = { variable: 'temperature', option: 15 };
    expect(selectVariable(from, 'redox', sensors)).toEqual({ variable: 'redox', option: 15 });
  });

  it('resets a depth the new variable lacks to its first option', () => {
    const from = { variable: 'redox', option: 25 };
    expect(selectVariable(from, 'temperature', sensors)).toEqual({ variable: 'temperature', option: 15 });
  });

  it('resets to a setting when moving from a depth to a flux', () => {
    const from = { variable: 'redox', option: 5 };
    expect(selectVariable(from, 'co2', sensors)).toEqual({ variable: 'co2', option: 'uncovered' });
  });

  it('keeps the setting between fluxes', () => {
    const from = { variable: 'co2', option: 'covered' };
    expect(selectVariable(from, 'ch4', sensors)).toEqual({ variable: 'ch4', option: 'covered' });
  });
});
