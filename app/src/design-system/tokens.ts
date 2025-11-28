// Design System - Razai Identity (v4)
// Sophisticated, Industrial, Texture-focused

export const DS = {
  color: {
    // Backgrounds
    bg: '#F8FAFC', // Slate 50
    surface: '#FFFFFF', 
    surfaceAlt: '#F1F5F9', // Slate 100
    bgHover: '#E2E8F0', // Slate 200
    
    // Borders
    border: '#E2E8F0', // Slate 200
    borderStrong: '#CBD5E1', // Slate 300
    borderSubtle: '#F1F5F9',
    hover: '#F8FAFC',
    
    // Text
    textPrimary: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8', // Slate 400
    textSubtle: '#CBD5E1', // Slate 300
    textInvert: '#FFFFFF',
    
    // Brand / Interactive
    brand: '#0F172A', // Slate 900 (Primary Brand)
    accent: '#6366F1', // Indigo 500 (Interactive)
    accentHover: '#4F46E5', // Indigo 600
    accentSubtle: '#EEF2FF', // Indigo 50
    
    // Semantic colors
    warning: '#F59E0B', // Amber 500
    danger: '#EF4444', // Red 500
    success: '#10B981', // Emerald 500
    info: '#3B82F6', // Blue 500
    focus: '#6366F1', // Indigo 500
    
    // Special
    gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    overlay: 'rgba(15, 23, 42, 0.6)'
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
    xs: '0 1px 2px rgba(15, 23, 42, 0.05)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06)',
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
    xl: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
    inset: 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)'
  },
  spacing: (n: number) => `${n * 4}px`,
  font: {
    familySans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    familyMono: '"JetBrains Mono", "Fira Code", monospace',
    
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
