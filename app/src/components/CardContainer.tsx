import React from 'react'
import { DS } from '@/design-system/tokens'
import { CARD_SIZES } from '@/design-system/card-sizes'

export type CardSize = keyof typeof CARD_SIZES

interface CardContainerProps {
  size?: CardSize
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  ariaLabel?: string
  role?: string
}

/**
 * Standardized card container with consistent sizing
 */
export default function CardContainer({
  size = 'MEDIUM',
  selected = false,
  disabled = false,
  onClick,
  children,
  style,
  className,
  ariaLabel,
  role = onClick ? 'button' : 'div',
}: CardContainerProps) {
  const sizeConfig = CARD_SIZES[size]

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: sizeConfig.width,
    height: sizeConfig.height as any,
    minHeight: 'minHeight' in sizeConfig ? (sizeConfig.minHeight as number) : undefined,
    maxHeight: 'maxHeight' in sizeConfig ? (sizeConfig.maxHeight as number) : undefined,
    padding: sizeConfig.padding,
    background: selected ? DS.color.bgHover : DS.color.surface,
    border: `1px solid ${selected ? DS.color.border : DS.color.borderSubtle}`,
    borderRadius: DS.radius.md,
    cursor: onClick && !disabled ? 'pointer' : 'default',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    outlineOffset: 2,
    marginBottom: size === 'SMALL' ? DS.spacing(2) : undefined,
    ...style,
  }

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      aria-selected={onClick ? selected : undefined}
      onClick={!disabled ? onClick : undefined}
      className={`${className || ''} ${onClick && !disabled ? 'hover-lift' : ''}`}
      style={baseStyle}
    >
      {children}
    </div>
  )
}
