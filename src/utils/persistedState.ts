import { useState } from 'react';

/** useState pentru valori string, persistat în localStorage (cu prefix `dataread.`). Tolerant la private-mode
 *  (citire/scriere în try/catch). Folosit pentru filtre/căutări de operator care altfel se resetează la refresh. */
export function usePersistedState<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const full = key.startsWith('dataread.') ? key : `dataread.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(full);
      return v != null ? (v as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(full, next);
    } catch {
      /* private mode */
    }
  };
  return [value, set];
}
