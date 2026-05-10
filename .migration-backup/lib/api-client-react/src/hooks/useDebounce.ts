/**
 * useDebounce.ts
 *
 * Debounce generico usato dalla searchbar in TabEsplora.
 * Ritarda l'aggiornamento del valore di `delay` ms dopo l'ultimo cambiamento.
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
