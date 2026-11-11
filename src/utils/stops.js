// The dates a layer can be shown at, from the data the layer carries.
// Fluxes and redox are campaigns; temperature and moisture are daily logger series.

const DAY_MS = 24 * 60 * 60 * 1000;
export const CAMPAIGN_GAP_DAYS = 7;

const FLUX_KEYS = ['co2', 'ch4', 'h2o'];
/** Whether a layer is a daily logger series rather than a set of campaigns. */
export const isLogger = layer => layer === 'temperature' || layer === 'moisture';

const dayOf = iso => iso.slice(0, 10);
const dayNumber = day => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
const dayFromNumber = n => new Date(n * DAY_MS).toISOString().slice(0, 10);

// Readings closer than the gap to the previous one share a campaign.
function campaigns(days) {
  const sorted = [...new Set(days)].sort();
  const result = [];
  for (const day of sorted) {
    const last = result[result.length - 1];
    if (last && dayNumber(day) - dayNumber(last.until) <= CAMPAIGN_GAP_DAYS) last.until = day;
    else result.push({ date: day, until: day });
  }
  return result;
}

function loggerDays(sensors, parameterName) {
  const days = new Set();
  for (const sensor of sensors) {
    for (const profile of sensor.tms_profiles ?? []) {
      if (!profile?.start) continue;
      const first = dayNumber(dayOf(profile.start));
      for (const parameter of profile.parameters ?? []) {
        if (parameter.name !== parameterName) continue;
        parameter.values.forEach((value, i) => {
          if (typeof value === 'number') days.add(dayFromNumber(first + i));
        });
      }
    }
  }
  return [...days];
}

/** The stops of a layer ('co2', 'ch4', 'h2o', 'redox', 'temperature', 'moisture'): [{ date, until }], oldest first. */
export function stops(layer, area) {
  const sensors = area?.sensors ?? [];
  if (FLUX_KEYS.includes(layer)) {
    return campaigns(sensors.flatMap(s => (s.flux_data ?? []).map(r => dayOf(r.measured_on))));
  }
  if (layer === 'redox') {
    return campaigns(sensors.flatMap(s => (s.redox_data ?? []).map(r => dayOf(r.measured_on))));
  }
  if (isLogger(layer)) {
    const name = layer === 'temperature' ? 'soil_temperature' : 'vwc';
    return loggerDays(sensors, name)
      .sort()
      .map(date => ({ date, until: date }));
  }
  return [];
}

/** Whether the date bar shows for a layer's stops: it shows when there is at least one stop. */
export const hasDateBar = layerStops => layerStops.length > 0;

/** The date a layer opens on: its latest stop, or null. */
export function defaultStop(layer, area) {
  const all = stops(layer, area);
  return all.length ? all[all.length - 1].date : null;
}

/** The date after a layer change: kept when the new layer has it as a stop, else the new layer's latest stop. */
export function stopOnChange(date, fromLayer, toLayer, area) {
  if (stops(toLayer, area).some(s => s.date === date)) return date;
  return defaultStop(toLayer, area);
}

/** The stops that carry a label on the bar: every campaign, and the first of each month of a daily series. */
export function labelStops(layer, layerStops) {
  return isLogger(layer) ? layerStops.filter(s => s.date.endsWith('-01')) : layerStops;
}
