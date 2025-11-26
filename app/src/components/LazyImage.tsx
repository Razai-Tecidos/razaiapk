import React, { useState } from 'react'
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver'

interface LazyImageProps {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
  placeholderBg?: string
}

/**
 * Lazy loading image component with placeholder
 * Only loads image when scrolled into view
 */
export default function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  style,
  placeholderBg = '#f3f4f6',
}: LazyImageProps) {
  const [ref, isVisible] = useIntersectionObserver()
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
        background: !isLoaded ? placeholderBg : 'transparent',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      className={className}
    >
      {isVisible && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 200ms ease-in-out',
          }}
        />
      )}
    </div>
  )
}
