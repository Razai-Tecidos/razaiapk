import { DS } from '../design-system/tokens'
import { Text } from '../design-system/components'

type ActivityType = 'tissue' | 'color' | 'pattern'

interface ActivityCardProps {
  type: ActivityType
  name: string
  detail?: string
  date: Date
  onClick?: () => void
}

const typeConfig: Record<ActivityType, { icon: string; bgColor: string; textColor: string; label: string }> = {
  tissue: {
    icon: '🧵',
    bgColor: '#e0f2fe',
    textColor: '#0369a1',
    label: 'Tecido'
  },
  color: {
    icon: '🎨',
    bgColor: '#fce7f3',
    textColor: '#be185d',
    label: 'Cor'
  },
  pattern: {
    icon: '✨',
    bgColor: '#fef3c7',
    textColor: '#b45309',
    label: 'Estampa'
  }
}

/**
 * ActivityCard - Displays a recent activity item
 * Used in Home dashboard for showing recently created/updated items
 */
export function ActivityCard({ type, name, detail, date, onClick }: ActivityCardProps) {
  const config = typeConfig[type]
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
        background: DS.color.surface,
        borderRadius: DS.radius.md,
        border: `1px solid ${DS.color.borderSubtle}`,
        boxShadow: DS.shadow.xs,
        transition: 'transform 0.2s ease',
        cursor: isClickable ? 'pointer' : 'default'
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
    >
      {/* Icon */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: DS.radius.pill,
        background: DS.color.surfaceAlt,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        marginRight: DS.spacing(4),
        border: `1px solid ${DS.color.borderSubtle}`
      }}>
        {config.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(3), marginBottom: 2 }}>
          <Text
            weight={DS.font.weightMedium}
            style={{ color: DS.color.textPrimary, fontSize: DS.font.size.base }}
          >
            {name}
          </Text>
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: config.bgColor,
            color: config.textColor,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            {config.label}
          </span>
        </div>
        {detail && (
          <Text size="xs" style={{ color: DS.color.textSecondary }}>
            {detail}
          </Text>
        )}
      </div>

      {/* Date */}
      <Text size="xs" style={{ color: DS.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>
        {date.toLocaleDateString()}{' '}
        <span style={{ opacity: 0.5 }}>•</span>{' '}
        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </div>
  )
}

export default ActivityCard
