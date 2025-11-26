import { useEffect, useRef, useCallback } from 'react'

/**
 * Debounce hook: delays callback execution while values keep changing
 * @param callback Function to debounce
 * @param delay Debounce delay in milliseconds (default: 1000ms)
 * @returns Function to call when value changes
 */
export function useDebounce<T extends any[]>(
  callback: (...args: T) => void | Promise<void>,
  delay: number = 1000
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedFn = useCallback(
    (...args: T) => {
      // Clear any pending execution
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Schedule new execution
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedFn
}
