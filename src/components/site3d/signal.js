import { useSyncExternalStore } from 'react';

/** A value that components watch on their own, so setting it re-renders only them. */
export function signal(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set: next => {
      if (next === value) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The current value of a signal, re-rendering the component when it changes. */
export const useSignal = s => useSyncExternalStore(s.subscribe, s.get);
