// Design System - Clean Light Theme (v3)
// Ultra-minimal, modern, clean

export const DS = {
  color: {
    // Backgrounds - pure clean whites
    bg: '#FFFFFF',
    surface: '#FFFFFF', 
    surfaceAlt: '#F9FAFB',
    bgHover: '#F3F4F6',
    
    // Borders - subtle grays
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    borderSubtle: '#F3F4F6',
    hover: '#F9FAFB',
    
    // Text - clear contrast
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textSubtle: '#D1D5DB',
    
    // Interactive - minimal black
    accent: '#111827',
    accentHover: '#374151',
    accentSubtle: '#F9FAFB',
    
    // Semantic colors
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#10B981',
    info: '#3B82F6',
    focus: '#3B82F6',
    
    // Special
    gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999
  },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
  },
  spacing: (n: number) => `${n * 4}px`,
  font: {
    familySans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    
    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
    
    size: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      md: '18px',
      lg: '20px',
      xl: '24px',
      display: '32px'
    },
    
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625
    },
    
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em'
    }
  }
}

export type DesignTokens = typeof DS

export function pxGrid(value: number): React.CSSProperties { 
  return { padding: DS.spacing(value) } 
}

export const elevations = {
  card: DS.shadow.sm,
  cardHover: DS.shadow.md,
  popover: DS.shadow.xl
}
