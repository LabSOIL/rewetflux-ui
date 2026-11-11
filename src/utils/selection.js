// What the side panel offers: six variables, each with the option that qualifies it
// (a depth in cm, or the chamber setting for a flux).

export const VARIABLES = [
  { key: 'co2', label: 'CO₂ flux', kind: 'setting' },
  { key: 'ch4', label: 'CH₄ flux', kind: 'setting' },
  { key: 'h2o', label: 'H₂O flux', kind: 'setting' },
  { key: 'redox', label: 'Redox', kind: 'depth' },
  { key: 'temperature', label: 'Temperature', kind: 'depth' },
  { key: 'moisture', label: 'Moisture', kind: 'depth' },
];

export const REDOX_DEPTHS = [5, 15, 25, 35];
export const FLUX_SETTINGS = ['uncovered', 'covered'];

// Logger depths in cm present on any position, shallowest first.
function loggerDepths(sensors) {
  const depths = new Set();
  for (const sensor of sensors) {
    for (const profile of sensor.tms_profiles ?? []) {
      for (const parameter of profile?.parameters ?? []) depths.add(parameter.depth_cm);
    }
  }
  return [...depths].sort((a, b) => a - b);
}

/** The options a variable offers: { kind: 'depth' | 'setting', values }. */
export function optionsFor(variable, sensors) {
  const kind = VARIABLES.find(v => v.key === variable)?.kind ?? 'depth';
  if (variable == null) return { kind, values: [] };
  if (kind === 'setting') return { kind, values: FLUX_SETTINGS };
  if (variable === 'redox') return { kind, values: REDOX_DEPTHS };
  return { kind, values: loggerDepths(sensors) };
}

/** Switches variable; the option stays when the new variable offers it, else it resets to the first. */
export function selectVariable(selection, variable, sensors) {
  const { values } = optionsFor(variable, sensors);
  const option = values.includes(selection.option) ? selection.option : (values[0] ?? null);
  return { variable, option };
}

/** The label of an option: a depth in cm, or the chamber setting capitalised. */
export function optionLabel(kind, value) {
  return kind === 'setting' ? value.charAt(0).toUpperCase() + value.slice(1) : `${value} cm`;
}
