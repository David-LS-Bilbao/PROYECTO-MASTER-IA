/**
 * useDebounce Hook
 *
 * Delays updating a value until after a specified delay has elapsed since the last change.
 * Useful for search inputs to avoid excessive API calls on every keystroke.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 500);
 *
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     // Perform search with debounced query
 *     fetchResults(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * ```
 */

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay elapses
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
