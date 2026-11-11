import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { optionsFor, selectVariable } from '../utils/selection';
import { defaultStop, stopOnChange, stops } from '../utils/stops';

const SelectionContext = createContext(null);

/** Holds the selected variable and its option (depth in cm, or chamber setting) and the selected date for the panel and the map. */
export function SelectionProvider({ sensors, initial = { variable: 'redox', option: 5 }, children }) {
  const area = useMemo(() => ({ sensors }), [sensors]);
  const [selection, setSelection] = useState(() => ({
    ...initial,
    date: initial.date ?? defaultStop(initial.variable, { sensors }),
  }));

  const selectVariableKey = useCallback(
    variable =>
      setSelection(current => ({
        ...selectVariable(current, variable, sensors),
        date: stopOnChange(current.date, current.variable, variable, area),
      })),
    [sensors, area],
  );
  const selectOption = useCallback(
    option => setSelection(current => ({ ...current, option })),
    [],
  );
  const selectDate = useCallback(date => setSelection(current => ({ ...current, date })), []);
  const layerStops = useMemo(() => stops(selection.variable, area), [selection.variable, area]);
  const options = useMemo(() => optionsFor(selection.variable, sensors), [selection.variable, sensors]);

  const value = useMemo(
    () => ({ ...selection, options, stops: layerStops, selectVariable: selectVariableKey, selectOption, selectDate }),
    [selection, options, layerStops, selectVariableKey, selectOption, selectDate],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection needs a SelectionProvider');
  return value;
}
