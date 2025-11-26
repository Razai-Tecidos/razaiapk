import React from 'react'
import { Link } from 'react-router-dom'
import { CARD_SIZES } from '@/design-system/card-sizes'

type Props = {
  title: string
  description: string
  to: string
  color?: string
  disabled?: boolean
  height?: number
  clampLines?: number
}

export default function Card({ title, description, to, color = '#334155', disabled, height = CARD_SIZES.MEDIUM.height as number, clampLines = 2 }: Props) {
  const content = (
    <div
      style={{
        background: disabled ? '#111827' : '#111827',
        color: disabled ? '#6b7280' : '#e5e7eb',
        padding: CARD_SIZES.MEDIUM.padding,
        borderRadius: 12,
        border: `1px solid ${disabled ? '#1f2937' : '#1f2937'}`,
        boxShadow: `0 0 0 1px ${disabled ? '#000' : color}40 inset`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        height,
        minHeight: height,
        width: CARD_SIZES.MEDIUM.width,
        display:'grid',
        alignContent:'start',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{display:'grid', gap: 8}}>
        <strong style={{fontSize: 18}}>{title}</strong>
        <span
          style={{
            fontSize: 14,
            color:'#9ca3af',
            display:'-webkit-box',
            WebkitLineClamp: clampLines as any,
            WebkitBoxOrient:'vertical' as any,
            overflow:'hidden'
          }}
        >{description}</span>
      </div>
    </div>
  )

  if (disabled || to === '#') return content

  return (
    <Link to={to} style={{ textDecoration: 'none', display:'block', height:'100%' }}>
      {content}
    </Link>
  )
}
