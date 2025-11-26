import { useEffect, useRef, useState } from 'react'

/**
 * Intersection Observer hook for lazy loading images/content
 * @param options IntersectionObserver options (threshold, rootMargin, etc)
 * @returns [ref, isVisible] - attach ref to element, check isVisible to render content
 */
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Guard for environments without IntersectionObserver (tests, SSR)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true) // Show immediately if not available
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        // Stop observing once visible to avoid re-renders
        observer.unobserve(entry.target)
      }
    }, {
      threshold: 0.1,
      rootMargin: '100px',
      ...options,
    })

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [options])

  return [ref, isVisible] as const
}
