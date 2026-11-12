import measurements from './measurements.json';

const hasRows = rows => Array.isArray(rows) && rows.length > 0;
const hasProfile = profile =>
  profile != null && typeof profile === 'object' && Array.isArray(profile.parameters);

// The TMS profile a position reports: the one at its shallowest logger depth.
// A position with loggers at several depths reports the shallowest.
function loggerProfile(sensor) {
  const profiles = (sensor.tms_profiles ?? []).filter(hasProfile);
  const depth = profile => Math.min(...profile.parameters.map(p => p.depth_cm));
  return profiles.reduce(
    (shallowest, profile) => (!shallowest || depth(profile) < depth(shallowest) ? profile : shallowest),
    null,
  );
}

const REDOX_TOP_CHANNEL = 'ch1_5cm_mv';
const REDOX_BOTTOM_CHANNEL = 'ch4_35cm_mv';

// The top (5 cm) and bottom (35 cm) channels of the latest redox reading.
function latestRedox(sensor) {
  if (!hasRows(sensor.redox_data)) return null;
  const latest = sensor.redox_data.reduce((a, r) =>
    Date.parse(r.measured_on) > Date.parse(a.measured_on) ? r : a,
  );
  return { top: latest[REDOX_TOP_CHANNEL] ?? null, bottom: latest[REDOX_BOTTOM_CHANNEL] ?? null };
}

// The last value present in a logger parameter of the position's shallowest profile.
function latestLoggerValue(sensor, parameterName) {
  const parameter = loggerProfile(sensor)?.parameters.find(p => p.name === parameterName);
  return parameter?.values.findLast(v => typeof v === 'number') ?? null;
}

const REDOX_CHANNELS = {
  5: 'ch1_5cm_mv',
  15: 'ch2_15cm_mv',
  25: 'ch3_25cm_mv',
  35: 'ch4_35cm_mv',
};
const LOGGER_PARAMETERS = { temperature: 'soil_temperature', moisture: 'vwc' };

// The latest value of a variable ('redox', 'temperature' or 'moisture') at one depth in cm, or null.
function latestAtDepth(sensor, variable, depth) {
  if (variable === 'redox') {
    const channel = REDOX_CHANNELS[depth];
    if (!channel || !hasRows(sensor.redox_data)) return null;
    const latest = sensor.redox_data.reduce((a, r) =>
      Date.parse(r.measured_on) > Date.parse(a.measured_on) ? r : a,
    );
    return latest[channel] ?? null;
  }
  const profile = (sensor.tms_profiles ?? [])
    .filter(hasProfile)
    .find(p => p.parameters.some(q => q.depth_cm === depth));
  const parameter = profile?.parameters.find(p => p.name === LOGGER_PARAMETERS[variable]);
  return parameter?.values.findLast(v => typeof v === 'number') ?? null;
}

const LATEST = {
  redox: latestRedox,
  temperature: sensor => latestLoggerValue(sensor, 'soil_temperature'),
  moisture: sensor => latestLoggerValue(sensor, 'vwc'),
};

// profile_type values a position is listed under, from the data it carries.
// A position that already names its profile_type is listed as given.
function profileTypes(sensor) {
  if (sensor.profile_type) return [sensor.profile_type];
  const types = [];
  if (hasRows(sensor.flux_data)) types.push('chamber');
  if (hasRows(sensor.redox_data)) types.push('redox');
  if (loggerProfile(sensor)) types.push('tms');
  return types;
}

/**
 * Reads the site's data from one built-in JSON document and returns it in the
 * shapes soil-api's public routes serve. This is the only code that knows where
 * the data comes from.
 */
export function createDataSource(document) {
  const area = document.areas[0] ?? null;
  const sensors = area ? area.sensors : [];
  const find = id => sensors.find(s => s.id === id) ?? null;

  const history = (id, field, empty) => {
    const sensor = find(id);
    if (!sensor) return null;
    return {
      id: sensor.id,
      name: sensor.name,
      geom: sensor.geom,
      [field]: sensor[field] ?? empty,
    };
  };

  const tmsProfile = id => {
    const sensor = find(id);
    return sensor ? loggerProfile(sensor) : null;
  };

  // The latest value of a variable ('redox', 'temperature' or 'moisture') at a position, or null.
  const latest = (id, variable) => {
    const sensor = find(id);
    return sensor ? LATEST[variable](sensor) : null;
  };

  const latestAt = (id, variable, depth) => {
    const sensor = find(id);
    return sensor ? latestAtDepth(sensor, variable, depth) : null;
  };

  // Each position's latest redox reading taken from one day to another (inclusive), as mV by depth in cm.
  const redoxProfiles = (from, to) =>
    sensors.flatMap(sensor => {
      const rows = (sensor.redox_data ?? []).filter(r => {
        const day = r.measured_on.slice(0, 10);
        return day >= from && day <= to;
      });
      if (!rows.length) return [];
      const reading = rows.reduce((a, r) => (Date.parse(r.measured_on) > Date.parse(a.measured_on) ? r : a));
      const values = Object.fromEntries(
        Object.entries(REDOX_CHANNELS).map(([depth, channel]) => [depth, reading[channel] ?? null]),
      );
      return [{ id: sensor.id, name: sensor.name, geom: sensor.geom, measured_on: reading.measured_on, values }];
    });

  return {
    getArea() {
      if (!area) return null;
      return {
        ...area,
        sensors: sensors.flatMap(sensor =>
          profileTypes(sensor).map(profile_type => ({ ...sensor, profile_type })),
        ),
      };
    },
    getFlux: id => history(id, 'flux_data', []),
    getRedox: id => history(id, 'redox_data', []),
    getTemperature: tmsProfile,
    getMoisture: tmsProfile,
    getLatest: latest,
    getLatestAt: latestAt,
    getRedoxProfiles: redoxProfiles,
  };
}

const source = createDataSource(measurements);

export const getArea = source.getArea;
export const getFlux = source.getFlux;
export const getRedox = source.getRedox;
export const getTemperature = source.getTemperature;
export const getMoisture = source.getMoisture;
export const getLatest = source.getLatest;
export const getLatestAt = source.getLatestAt;
export const getRedoxProfiles = source.getRedoxProfiles;
