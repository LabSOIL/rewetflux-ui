import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDataSource } from './index';
import measurements from './measurements.json';

const fixture = {
  areas: [
    {
      id: 'area-1',
      name: 'Fen',
      geom: { coordinates: [[[8, 46], [8.1, 46], [8.1, 46.1], [8, 46]]] },
      sensors: [
        {
          id: 'p1',
          name: 'Position 1',
          geom: { 4326: { srid: 4326, x: 8.01, y: 46.01, z: 1 } },
          flux_data: [
            {
              measured_on: '2025-07-10T10:00:00Z',
              replicate: 'REP_1',
              setting: 'covered',
              flux_co2_umol_m2_s: 1.5,
              flux_ch4_nmol_m2_s: 0.2,
              flux_h2o_umol_m2_s: 3,
              r2_co2: 0.99,
              r2_ch4: 0.9,
              r2_h2o: 0.95,
              swc: 0.4,
            },
          ],
          redox_data: [
            {
              measured_on: '2025-09-10T08:00:00Z',
              ch1_5cm_mv: 100,
              ch2_15cm_mv: 200,
              ch3_25cm_mv: 300,
              ch4_35cm_mv: 400,
              temp_c: 11,
            },
          ],
          tms_profiles: [
            {
              sensor: { id: 'tms-p1-15', name: 'TMS 15 cm' },
              start: '2025-07-16T00:00:00Z',
              end: '2025-07-16T00:00:00Z',
              resolution: 'daily',
              times: ['2025-07-16T00:00:00Z'],
              parameters: [
                { name: 'soil_temperature', depth_cm: 15, units: '°C', values: [12] },
                { name: 'vwc', depth_cm: 15, units: 'm3/m3', values: [0.3] },
              ],
            },
          ],
        },
        {
          id: 'p2',
          name: 'Position 2',
          geom: { 4326: { srid: 4326, x: 8.02, y: 46.02, z: 1 } },
          flux_data: [],
          redox_data: [],
        },
      ],
    },
  ],
};

describe('data source', () => {
  const source = createDataSource(fixture);

  it('getRedox returns redox_data in the public redox shape', () => {
    const redox = source.getRedox('p1');
    expect(redox.id).toBe('p1');
    expect(redox.name).toBe('Position 1');
    expect(Object.keys(redox.redox_data[0]).sort()).toEqual(
      ['ch1_5cm_mv', 'ch2_15cm_mv', 'ch3_25cm_mv', 'ch4_35cm_mv', 'measured_on', 'temp_c'],
    );
  });

  it('getFlux returns flux_data in the public flux shape', () => {
    const flux = source.getFlux('p1');
    expect(Object.keys(flux.flux_data[0]).sort()).toEqual(
      [
        'flux_ch4_nmol_m2_s', 'flux_co2_umol_m2_s', 'flux_h2o_umol_m2_s',
        'measured_on', 'r2_ch4', 'r2_co2', 'r2_h2o', 'replicate', 'setting', 'swc',
      ],
    );
  });

  it('getTemperature and getMoisture return the logger profile of a position', () => {
    const temperature = source.getTemperature('p1');
    expect(temperature.times).toEqual(['2025-07-16T00:00:00Z']);
    expect(temperature.parameters.find(p => p.name === 'soil_temperature').values).toEqual([12]);
    expect(source.getMoisture('p1').parameters.find(p => p.name === 'vwc').values).toEqual([0.3]);
  });

  it('returns null for an unknown sensor and empty history for a sensor without data', () => {
    expect(source.getRedox('nope')).toBeNull();
    expect(source.getTemperature('p2')).toBeNull();
    expect(source.getFlux('p2').flux_data).toEqual([]);
  });

  it('getArea lists a position under each profile_type it has data for', () => {
    const area = source.getArea();
    expect(area.id).toBe('area-1');
    expect(area.geom.coordinates).toBeDefined();
    const names = type => area.sensors.filter(s => s.profile_type === type).map(s => s.id);
    expect(names('chamber')).toEqual(['p1']);
    expect(names('redox')).toEqual(['p1']);
    expect(names('tms')).toEqual(['p1']);
  });
});

describe('latest value per position', () => {
  const pointGeom = { 4326: { srid: 4326, x: 8.01, y: 46.01, z: 1 } };
  const profile = (depth, times, soilTemperature, vwc) => ({
    sensor: { id: `tms-${depth}`, name: `TMS ${depth} cm` },
    start: times[0],
    end: times[times.length - 1],
    resolution: 'daily',
    times,
    parameters: [
      { name: 'soil_temperature', depth_cm: depth, units: '°C', values: soilTemperature },
      { name: 'vwc', depth_cm: depth, units: 'm3/m3', values: vwc },
    ],
  });
  const days = ['2025-07-15T00:00:00Z', '2025-07-16T00:00:00Z'];
  const document = {
    areas: [
      {
        id: 'area-2',
        name: 'Bog',
        geom: { coordinates: [[[8, 46], [8.1, 46], [8.1, 46.1], [8, 46]]] },
        sensors: [
          {
            id: 'redox-two',
            name: 'Two readings, later one listed first',
            geom: pointGeom,
            flux_data: [],
            redox_data: [
              { measured_on: '2025-09-20T08:00:00Z', ch1_5cm_mv: 220, ch2_15cm_mv: 0, ch3_25cm_mv: 0, ch4_35cm_mv: 330, temp_c: 11 },
              { measured_on: '2025-09-10T08:00:00Z', ch1_5cm_mv: 100, ch2_15cm_mv: 0, ch3_25cm_mv: 0, ch4_35cm_mv: 110, temp_c: 10 },
            ],
            tms_profiles: [],
          },
          {
            id: 'tms-two-depths',
            name: 'Loggers at 60 and 15 cm',
            geom: pointGeom,
            flux_data: [],
            redox_data: [],
            tms_profiles: [
              profile(60, days, [5, 6], [0.4, 0.41]),
              profile(15, days, [10, 12.5], [0.2, 0.25]),
            ],
          },
          {
            id: 'tms-gap',
            name: 'Last temperature missing',
            geom: pointGeom,
            flux_data: [],
            redox_data: [],
            tms_profiles: [profile(15, days, [9, null], [0.3, null])],
          },
          {
            id: 'no-history',
            name: 'No history',
            geom: pointGeom,
            flux_data: [],
            redox_data: [],
            tms_profiles: [],
          },
        ],
      },
    ],
  };
  const source = createDataSource(document);

  it('getLatest gives the later redox reading top and bottom channels', () => {
    expect(source.getLatest('redox-two', 'redox')).toEqual({ top: 220, bottom: 330 });
  });

  it('getLatest gives the shallowest logger value of the last time step', () => {
    expect(source.getLatest('tms-two-depths', 'temperature')).toBe(12.5);
    expect(source.getLatest('tms-two-depths', 'moisture')).toBe(0.25);
  });

  it('getLatest gives the last value that is present', () => {
    expect(source.getLatest('tms-gap', 'temperature')).toBe(9);
    expect(source.getLatest('tms-gap', 'moisture')).toBe(0.3);
  });

  it('getLatestAt gives the latest value at the requested depth', () => {
    expect(source.getLatestAt('redox-two', 'redox', 5)).toBe(220);
    expect(source.getLatestAt('redox-two', 'redox', 35)).toBe(330);
    expect(source.getLatestAt('tms-two-depths', 'temperature', 60)).toBe(6);
    expect(source.getLatestAt('tms-two-depths', 'moisture', 15)).toBe(0.25);
  });

  it('getLatestAt gives null for a depth the position lacks and for an unknown position', () => {
    expect(source.getLatestAt('tms-gap', 'temperature', 60)).toBeNull();
    expect(source.getLatestAt('redox-two', 'redox', 99)).toBeNull();
    expect(source.getLatestAt('unknown', 'redox', 5)).toBeNull();
  });

  it('getRedoxProfiles gives each position its latest reading in the day range, by depth', () => {
    expect(source.getRedoxProfiles('2025-09-01', '2025-09-15')).toEqual([
      {
        id: 'redox-two',
        name: 'Two readings, later one listed first',
        geom: pointGeom,
        measured_on: '2025-09-10T08:00:00Z',
        values: { 5: 100, 15: 0, 25: 0, 35: 110 },
      },
    ]);
    expect(source.getRedoxProfiles('2025-09-01', '2025-09-30')[0].values[5]).toBe(220);
    expect(source.getRedoxProfiles('2025-10-01', '2025-10-30')).toEqual([]);
  });

  it('getLatest gives null for a position with no history and for an unknown position', () => {
    expect(source.getLatest('no-history', 'redox')).toBeNull();
    expect(source.getLatest('no-history', 'temperature')).toBeNull();
    expect(source.getLatest('no-history', 'moisture')).toBeNull();
    expect(source.getLatest('unknown', 'redox')).toBeNull();
  });

  it('the built-in file has a latest redox value for every position with readings', () => {
    const builtIn = createDataSource(measurements);
    const withReadings = measurements.areas[0].sensors.filter(s => s.redox_data.length > 0);
    expect(withReadings.length).toBeGreaterThan(0);
    for (const sensor of withReadings) {
      const latest = builtIn.getLatest(sensor.id, 'redox');
      expect(typeof latest.top).toBe('number');
      expect(typeof latest.bottom).toBe('number');
    }
  });
});

describe('built-in measurements file', () => {
  const source = createDataSource(measurements);
  const sensors = measurements.areas[0].sensors;

  it('getTemperature and getMoisture return a SensorProfile for a position with TMS loggers', () => {
    const sensor = sensors.find(s => s.tms_profiles?.length > 0);
    expect(sensor).toBeDefined();
    for (const profile of [source.getTemperature(sensor.id), source.getMoisture(sensor.id)]) {
      expect(profile.times.length).toBeGreaterThan(0);
      expect(profile.resolution).toBe('daily');
      for (const parameter of profile.parameters) {
        expect(typeof parameter.depth_cm).toBe('number');
        expect(parameter.values).toHaveLength(profile.times.length);
      }
    }
  });

  it('getFlux returns every run of a position that has repeated runs', () => {
    const sensor = sensors.find(s => s.flux_data.length > 1);
    expect(sensor).toBeDefined();
    expect(source.getFlux(sensor.id).flux_data).toHaveLength(sensor.flux_data.length);
  });

  it('getRedox returns every reading of a position that has repeated readings', () => {
    const sensor = sensors.find(s => s.redox_data.length > 1);
    expect(sensor).toBeDefined();
    expect(source.getRedox(sensor.id).redox_data).toHaveLength(sensor.redox_data.length);
  });

  it('measurements.json stays under 100 KB', () => {
    expect(statSync(join(__dirname, 'measurements.json')).size).toBeLessThan(100_000);
  });
});

describe('component imports', () => {
  it('no file under src/components imports a .json file', () => {
    const files = [];
    const walk = dir => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(jsx?|tsx?)$/.test(name)) files.push(path);
      }
    };
    walk(join(__dirname, '..', 'components'));
    const offenders = files.filter(f =>
      /from\s+['"][^'"]+\.json['"]|import\(\s*['"][^'"]+\.json['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
