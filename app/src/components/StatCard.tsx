import { DS } from '../design-system/tokens'
import { Text } from '../design-system/components'

interface StatCardProps {
  value: number | string
  label: string
  onClick?: () => void
}

/**
 * StatCard - Displays a statistic with a value and label
 * Used in Home dashboard for displaying counts (tissues, colors, patterns)
 */
export function StatCard({ value, label, onClick }: StatCardProps) {
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      style={{
        padding: DS.spacing(6),
        background: DS.color.surface,
        border: `1px solid ${DS.color.border}`,
        borderRadius: DS.radius.lg,
        boxShadow: DS.shadow.sm,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DS.spacing(2),
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        ...(isClickable && {
          ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: DS.shadow.md
          }
        })
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
    >
      <Text
        size="xl"
        weight={DS.font.weightLight}
        style={{
          color: DS.color.textPrimary,
          lineHeight: 1,
          fontSize: DS.font.size.display
        }}
      >
        {value}
      </Text>
      <Text
        size="sm"
        weight={DS.font.weightMedium}
        style={{
          color: DS.color.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: DS.font.letterSpacing.wide
        }}
      >
        {label}
      </Text>
    </div>
  )
}

export default StatCard
