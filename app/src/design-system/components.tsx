import React, { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DS, elevations } from './tokens'

// Layout primitives
export const Container: React.FC<React.PropsWithChildren<{ padY?: number }>> = ({ children, padY = 12 }) => (
  <div className="ds-container" style={{ paddingTop: DS.spacing(padY), paddingBottom: DS.spacing(padY) }}>{children}</div>
)

// Section wrapper: provides vertical rhythm and optional divider + heading
export const Section: React.FC<React.PropsWithChildren<{ title?: string; subtitle?: string; mb?: number; padTop?: number }>> = ({ title, subtitle, children, mb = 12, padTop = 0 }) => (
  <section style={{ marginBottom: DS.spacing(mb), paddingTop: DS.spacing(padTop) }}>
    {(title || subtitle) && (
      <div style={{ marginBottom: DS.spacing(6) }}>
        {title && <Title level={2} mb={0} style={{ fontWeight: DS.font.weightLight }}>{title}</Title>}
        {subtitle && <Text dimmed size="md" style={{ maxWidth: 760, marginTop: DS.spacing(2), lineHeight: DS.font.lineHeight.relaxed }}>{subtitle}</Text>}
      </div>
    )}
    {children}
  </section>
)

// Panel surface for grouping related controls / content
export const Panel: React.FC<React.PropsWithChildren<{ title?: string; actions?: React.ReactNode; padding?: number; gap?: number; subtle?: boolean }>> = ({ title, actions, children, padding = 8, gap = 6, subtle }) => (
  <div style={{
    background: subtle ? DS.color.surfaceAlt : DS.color.surface,
    border: `1px solid ${subtle ? DS.color.borderSubtle : DS.color.border}`,
    borderRadius: DS.radius.lg,
    padding: DS.spacing(padding),
    boxShadow: elevations.card,
    display: 'flex',
    flexDirection: 'column',
    gap: DS.spacing(gap)
  }}>
    {(title || actions) && (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: DS.spacing(2) }}>
        {title && <Title level={3} mb={0} style={{ fontWeight: DS.font.weightMedium }}>{title}</Title>}
        {actions && <div>{actions}</div>}
      </div>
    )}
    {children}
  </div>
)

// Toolbar horizontal grouping
export const Toolbar: React.FC<React.PropsWithChildren<{ gap?: number; wrap?: boolean }>> = ({ children, gap = 4, wrap }) => (
  <div style={{
    display:'flex',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: DS.spacing(gap),
    padding: `${DS.spacing(4)} ${DS.spacing(6)}`,
    background: DS.color.surfaceAlt,
    border: `1px solid ${DS.color.borderSubtle}`,
    borderRadius: DS.radius.md
  }}>{children}</div>
)

export const Stack: React.FC<React.PropsWithChildren<{ gap?: number; align?: React.CSSProperties['alignItems']; style?: React.CSSProperties }>> = ({ children, gap = 6, align, style }) => (
  <div style={{ display:'flex', flexDirection:'column', gap: DS.spacing(gap), alignItems: align, ...style }}>{children}</div>
)

type RowProps = React.HTMLAttributes<HTMLDivElement> & { gap?: number; wrap?: boolean; justify?: React.CSSProperties['justifyContent']; align?: React.CSSProperties['alignItems'] }
export const Row: React.FC<RowProps> = ({ children, gap = 6, wrap=false, justify, align, style, ...rest }) => (
  <div {...rest} style={{ display:'flex', flexWrap: wrap? 'wrap':'nowrap', gap: DS.spacing(gap), justifyContent: justify, alignItems: align, ...style }}>{children}</div>
)

export const GridAuto: React.FC<React.PropsWithChildren<{ min?: number; gap?: number }>> = ({ children, min=224, gap=6 }) => (
  <div style={{ display:'grid', gap: DS.spacing(gap), gridTemplateColumns:`repeat(auto-fit, minmax(${min}px, 1fr))` }}>{children}</div>
)

// Typographic elements
export const Title: React.FC<React.PropsWithChildren<{ level?: 1|2|3; mb?: number; style?: React.CSSProperties }>> = ({ children, level=1, mb=4, style }) => {
  const sizes: Record<number,string> = { 1: DS.font.size.display, 2: DS.font.size.xl, 3: DS.font.size.lg }
  const weights: Record<number,number> = { 1: DS.font.weightLight, 2: DS.font.weightRegular, 3: DS.font.weightMedium }
  const letterSpacings: Record<number,string> = {
    1: DS.font.letterSpacing.tight,
    2: DS.font.letterSpacing.tight,
    3: DS.font.letterSpacing.normal
  }
  const Tag: any = `h${level}`
  return <Tag style={{ fontSize: sizes[level], margin:0, fontWeight: weights[level], letterSpacing: letterSpacings[level], lineHeight: DS.font.lineHeight.tight, marginBottom: DS.spacing(mb), color: DS.color.textPrimary, ...style }}>{children}</Tag>
}

export const Text: React.FC<React.PropsWithChildren<{ dimmed?: boolean; size?: keyof typeof DS.font.size; weight?: number; align?: React.CSSProperties['textAlign']; clamp?: number; style?: React.CSSProperties }>> = ({ children, dimmed=false, size='base', weight, align, clamp, style }) => (
  <p style={{
    margin:0,
    fontSize: DS.font.size[size],
    color: dimmed? DS.color.textSecondary : DS.color.textPrimary,
    fontWeight: weight || DS.font.weightRegular,
    lineHeight: DS.font.lineHeight.normal,
    textAlign: align,
    display: clamp? '-webkit-box': undefined,
    WebkitLineClamp: clamp as any,
    WebkitBoxOrient: clamp? 'vertical': undefined,
    overflow: clamp? 'hidden': undefined,
    ...style
  }}>{children}</p>
)

// Interactive
type ButtonTone = 'default' | 'accent' | 'danger' | 'success'

type VariantToken = {
  background: string
  border: string
  color: string
  hoverBackground: string
  hoverBorder: string
  hoverColor?: string
}

type ToneDefinition = {
  focusColor: string
  solid: VariantToken
  outline: VariantToken
  ghost: VariantToken
}

const BUTTON_TONES: Record<ButtonTone, ToneDefinition> = {
  default: {
    focusColor: DS.color.focus,
    solid: {
      background: DS.color.surface,
      border: DS.color.borderSubtle,
      color: DS.color.textPrimary,
      hoverBackground: DS.color.bgHover,
      hoverBorder: DS.color.border,
      hoverColor: DS.color.textPrimary
    },
    outline: {
      background: 'transparent',
      border: DS.color.border,
      color: DS.color.textPrimary,
      hoverBackground: DS.color.bgHover,
      hoverBorder: DS.color.borderStrong,
      hoverColor: DS.color.textPrimary
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      color: DS.color.textPrimary,
      hoverBackground: DS.color.bgHover,
      hoverBorder: 'transparent',
      hoverColor: DS.color.textPrimary
    }
  },
  accent: {
    focusColor: DS.color.accent,
    solid: {
      background: DS.color.accent,
      border: DS.color.accent,
      color: '#fff',
      hoverBackground: shadeColor(DS.color.accent, 15),
      hoverBorder: shadeColor(DS.color.accent, 15),
      hoverColor: '#fff'
    },
    outline: {
      background: 'transparent',
      border: hexToRgba(DS.color.accent, 0.35),
      color: DS.color.accent,
      hoverBackground: hexToRgba(DS.color.accent, 0.12),
      hoverBorder: DS.color.accent,
      hoverColor: DS.color.accent
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      color: DS.color.accent,
      hoverBackground: hexToRgba(DS.color.accent, 0.12),
      hoverBorder: 'transparent',
      hoverColor: DS.color.accent
    }
  },
  danger: {
    focusColor: DS.color.danger,
    solid: {
      background: DS.color.danger,
      border: DS.color.danger,
      color: '#fff',
      hoverBackground: shadeColor(DS.color.danger, -8),
      hoverBorder: shadeColor(DS.color.danger, -8),
      hoverColor: '#fff'
    },
    outline: {
      background: 'transparent',
      border: hexToRgba(DS.color.danger, 0.4),
      color: DS.color.danger,
      hoverBackground: hexToRgba(DS.color.danger, 0.14),
      hoverBorder: DS.color.danger,
      hoverColor: DS.color.danger
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      color: DS.color.danger,
      hoverBackground: hexToRgba(DS.color.danger, 0.12),
      hoverBorder: 'transparent',
      hoverColor: DS.color.danger
    }
  },
  success: {
    focusColor: DS.color.success,
    solid: {
      background: DS.color.success,
      border: DS.color.success,
      color: '#fff',
      hoverBackground: shadeColor(DS.color.success, -8),
      hoverBorder: shadeColor(DS.color.success, -8),
      hoverColor: '#fff'
    },
    outline: {
      background: 'transparent',
      border: hexToRgba(DS.color.success, 0.35),
      color: DS.color.success,
      hoverBackground: hexToRgba(DS.color.success, 0.14),
      hoverBorder: DS.color.success,
      hoverColor: DS.color.success
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      color: DS.color.success,
      hoverBackground: hexToRgba(DS.color.success, 0.12),
      hoverBorder: 'transparent',
      hoverColor: DS.color.success
    }
  }
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid'|'outline'|'ghost'; size?: 'sm'|'md'|'lg'; tone?: ButtonTone }

export const DSButton: React.FC<ButtonProps> = ({ variant='solid', size='md', tone='default', style: styleProp, children, disabled, ...rest }) => {
  const toneDefinition = BUTTON_TONES[tone] ?? BUTTON_TONES.default
  const variantStyles = getVariantStyles(toneDefinition, variant)
  const h = { sm: 40, md: 48, lg: 56 }[size]
  const padX = { sm: 18, md: 24, lg: 32 }[size]

  const { onMouseEnter, onMouseLeave, onFocus, onBlur, type, ...buttonProps } = rest

  const baseStyle: React.CSSProperties = {
    height: h,
    padding: `0 ${padX}px`,
    fontSize: DS.font.size.base,
    fontWeight: DS.font.weightRegular,
    fontFamily: DS.font.familySans,
    borderRadius: DS.radius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    lineHeight: 1,
    transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: variantStyles.borderColor,
    background: variantStyles.background,
    color: variantStyles.color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: variantStyles.boxShadow,
    transform: variantStyles.baseTransform,
    outline: 'none',
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    touchAction: 'manipulation',
    ...(styleProp ?? {})
  }

  const baseVisual = {
    background: (baseStyle.background as string | undefined) ?? variantStyles.background,
    borderColor: (baseStyle.borderColor as string | undefined) ?? variantStyles.borderColor,
    color: (baseStyle.color as string | undefined) ?? variantStyles.color,
    boxShadow: (baseStyle.boxShadow as string | undefined) ?? variantStyles.boxShadow,
    transform: (baseStyle.transform as string | undefined) ?? variantStyles.baseTransform
  }

  const focusRef = useRef(false)

  const applyStyles = (el: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
    for (const [key, value] of Object.entries(styles)) {
      if (value == null) continue
      ;(el.style as any)[key] = value
    }
  }

  const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    onMouseEnter?.(event)
    if (disabled || event.defaultPrevented) return
    const target = event.currentTarget
    applyStyles(target, {
      background: variantStyles.hoverBackground,
      borderColor: variantStyles.hoverBorderColor,
      color: variantStyles.hoverColor,
      boxShadow: focusRef.current ? variantStyles.focusBoxShadow : variantStyles.hoverBoxShadow,
      transform: variantStyles.hoverTransform
    })
  }

  const handleMouseLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(event)
    if (disabled || event.defaultPrevented) return
    const target = event.currentTarget
    applyStyles(target, {
      background: baseVisual.background,
      borderColor: baseVisual.borderColor,
      color: baseVisual.color,
      boxShadow: focusRef.current ? variantStyles.focusBoxShadow : baseVisual.boxShadow,
      transform: baseVisual.transform
    })
  }

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event)
    if (disabled || event.defaultPrevented) return
    focusRef.current = true
    applyStyles(event.currentTarget, {
      boxShadow: variantStyles.focusBoxShadow
    })
  }

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    onBlur?.(event)
    focusRef.current = false
    if (disabled || event.defaultPrevented) return
    applyStyles(event.currentTarget, {
      boxShadow: baseVisual.boxShadow
    })
  }

  return (
    <button
      {...buttonProps}
      type={type ?? 'button'}
      disabled={disabled}
      style={baseStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
    </button>
  )
}

function getVariantStyles(tone: ToneDefinition, variant: 'solid'|'outline'|'ghost') {
  const token = tone[variant]
  const focusRing = hexToRgba(tone.focusColor, 0.32)
  const baseTransform = variant === 'solid' ? 'translateY(0)' : 'none'
  const hoverTransform = variant === 'solid' ? 'translateY(-2px)' : 'none'
  const baseShadow = variant === 'solid' ? DS.shadow.xs : 'none'
  const hoverShadow = variant === 'solid' ? DS.shadow.md : baseShadow
  const focusShadow = variant === 'solid'
    ? `${DS.shadow.sm}, 0 0 0 3px ${focusRing}`
    : `0 0 0 3px ${focusRing}`

  return {
    background: token.background,
    borderColor: token.border,
    color: token.color,
    hoverBackground: token.hoverBackground,
    hoverBorderColor: token.hoverBorder,
    hoverColor: token.hoverColor ?? token.color,
    boxShadow: baseShadow,
    hoverBoxShadow: hoverShadow,
    focusBoxShadow: focusShadow,
    baseTransform,
    hoverTransform
  }
}

function shadeColor(hex: string, percent: number): string {
  const rgb = parseHexColor(hex)
  if (!rgb) return hex
  const amt = Math.round(2.55 * percent)
  const r = clamp(rgb.r + amt, 0, 255)
  const g = clamp(rgb.g + amt, 0, 255)
  const b = clamp(rgb.b + amt, 0, 255)
  const value = (1 << 24) + (r << 16) + (g << 8) + b
  return `#${value.toString(16).slice(1).toUpperCase()}`
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex)
  const safeAlpha = clamp(alpha, 0, 1)
  if (!rgb) return `rgba(0,0,0,${safeAlpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null
  let normalized = hex.trim()
  if (normalized.startsWith('#')) normalized = normalized.slice(1)
  if (normalized.length === 3) {
    normalized = normalized.split('').map(ch => ch + ch).join('')
  }
  if (normalized.length !== 6) return null
  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) return null
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Card
export const DSCard: React.FC<{ to?: string; title: string; description?: string; icon?: React.ReactNode; disabled?: boolean }>
 = ({ to, title, description, icon, disabled }) => {
  const [isHovered, setIsHovered] = useState(false)
  const inner = (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position:'relative',
        background: DS.color.surface,
        border:`1px solid ${isHovered ? DS.color.border : DS.color.borderSubtle}`,
        borderRadius: DS.radius.lg,
        padding: DS.spacing(8),
        display:'flex',
        flexDirection:'column',
        gap: DS.spacing(4),
        minHeight: 160,
        boxShadow: isHovered ? elevations.cardHover : elevations.card,
        transition:'all .3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
      }}>
      <Row gap={3} align="center">
        {icon && <span style={{ fontSize:24, lineHeight:1, opacity: 0.85 }}>{icon}</span>}
        <Title level={3} mb={0}>{title}</Title>
      </Row>
      {description && <Text dimmed size="sm" clamp={2} style={{ lineHeight: 1.6 }}>{description}</Text>}
    </div>
  )
  if (disabled || !to) return inner
  return <Link to={to} style={{ textDecoration:'none', color:'inherit' }}>{inner}</Link>
}

// Hero section wrapper
export const Hero: React.FC<React.PropsWithChildren<{ subtitle?: string }>> = ({ children, subtitle }) => (
  <Stack gap={6}>
    {children}
    {subtitle && <Text dimmed size="md" style={{ maxWidth: 680, lineHeight: DS.font.lineHeight.relaxed }}>{subtitle}</Text>}
  </Stack>
)

// Form Components
export const Label: React.FC<React.PropsWithChildren<{ htmlFor?: string; required?: boolean }>> = ({ children, htmlFor, required }) => (
  <label htmlFor={htmlFor} style={{ 
    display: 'block',
    fontSize: DS.font.size.sm, 
    fontWeight: DS.font.weightMedium, 
    color: DS.color.textSecondary,
    marginBottom: DS.spacing(2)
  }}>
    {children}
    {required && <span style={{ color: DS.color.danger, marginLeft: 4 }}>*</span>}
  </label>
)

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { error?: string; fullWidth?: boolean }
export const Input: React.FC<InputProps> = ({ error, fullWidth, style, ...rest }) => (
  <div style={{ width: fullWidth ? '100%' : undefined }}>
    <input
      {...rest}
      style={{
        width: fullWidth ? '100%' : undefined,
        height: 48,
        padding: `0 ${DS.spacing(4)}`,
        fontSize: DS.font.size.base,
        fontFamily: DS.font.familySans,
        color: DS.color.textPrimary,
        background: DS.color.surface,
        border: `1px solid ${error ? DS.color.danger : DS.color.border}`,
        borderRadius: DS.radius.md,
        outline: 'none',
        transition: 'border-color .2s ease, box-shadow .2s ease',
        lineHeight: DS.font.lineHeight.snug,
        ...style
      }}
      onFocus={(e) => {
        if (!error) e.currentTarget.style.borderColor = DS.color.focus
        e.currentTarget.style.boxShadow = `0 0 0 4px ${error ? DS.color.danger : DS.color.focus}15`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? DS.color.danger : DS.color.border
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
    {error && <Text size="xs" style={{ color: DS.color.danger, marginTop: DS.spacing(2) }}>{error}</Text>}
  </div>
)

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string; fullWidth?: boolean }
export const TextArea: React.FC<TextAreaProps> = ({ error, fullWidth, style, ...rest }) => (
  <div style={{ width: fullWidth ? '100%' : undefined }}>
    <textarea
      {...rest}
      style={{
        width: fullWidth ? '100%' : undefined,
        minHeight: 120,
        padding: DS.spacing(4),
        fontSize: DS.font.size.base,
        fontFamily: DS.font.familySans,
        color: DS.color.textPrimary,
        background: DS.color.surface,
        border: `1px solid ${error ? DS.color.danger : DS.color.border}`,
        borderRadius: DS.radius.md,
        outline: 'none',
        transition: 'border-color .2s ease, box-shadow .2s ease',
        resize: 'vertical',
        lineHeight: DS.font.lineHeight.normal,
        ...style
      }}
      onFocus={(e) => {
        if (!error) e.currentTarget.style.borderColor = DS.color.focus
        e.currentTarget.style.boxShadow = `0 0 0 4px ${error ? DS.color.danger : DS.color.focus}15`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? DS.color.danger : DS.color.border
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
    {error && <Text size="xs" style={{ color: DS.color.danger, marginTop: DS.spacing(2) }}>{error}</Text>}
  </div>
)

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string; fullWidth?: boolean }
export const Select: React.FC<SelectProps> = ({ error, fullWidth, style, children, ...rest }) => (
  <div style={{ width: fullWidth ? '100%' : undefined, position: 'relative' }}>
    <select
      {...rest}
      style={{
        width: fullWidth ? '100%' : undefined,
        height: 48,
        padding: `0 ${DS.spacing(9)} 0 ${DS.spacing(4)}`,
        fontSize: DS.font.size.base,
        fontFamily: DS.font.familySans,
        color: DS.color.textPrimary,
        background: DS.color.surface,
        border: `1px solid ${error ? DS.color.danger : DS.color.border}`,
        borderRadius: DS.radius.md,
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        transition: 'border-color .2s ease, box-shadow .2s ease',
        ...style
      }}
      onFocus={(e) => {
        if (!error) e.currentTarget.style.borderColor = DS.color.focus
        e.currentTarget.style.boxShadow = `0 0 0 4px ${error ? DS.color.danger : DS.color.focus}15`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? DS.color.danger : DS.color.border
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {children}
    </select>
    <span style={{ 
      position: 'absolute', 
      right: DS.spacing(4), 
      top: '50%', 
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: DS.color.textMuted,
      fontSize: 10
    }}>▼</span>
    {error && <Text size="xs" style={{ color: DS.color.danger, marginTop: DS.spacing(2) }}>{error}</Text>}
  </div>
)

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
export const Checkbox: React.FC<CheckboxProps> = ({ label, style, ...rest }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: DS.spacing(2), cursor: 'pointer', userSelect: 'none' }}>
    <input
      type="checkbox"
      {...rest}
      style={{
        width: 20,
        height: 20,
        cursor: 'pointer',
        accentColor: DS.color.focus,
        ...style
      }}
    />
    {label && <Text size="sm">{label}</Text>}
  </label>
)

// Table Components
export const Table: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ 
    width: '100%', 
    overflowX: 'auto',
    border: `1px solid ${DS.color.borderSubtle}`,
    borderRadius: DS.radius.lg,
    background: DS.color.surface
  }}>
    <table style={{ 
      width: '100%', 
      borderCollapse: 'collapse',
      fontSize: DS.font.size.sm
    }}>{children}</table>
  </div>
)

export const TableHead: React.FC<React.PropsWithChildren> = ({ children }) => (
  <thead style={{ 
    background: DS.color.surfaceAlt,
    borderBottom: `1px solid ${DS.color.border}`
  }}>{children}</thead>
)

export const TableBody: React.FC<React.PropsWithChildren> = ({ children }) => (
  <tbody>{children}</tbody>
)

type TableRowProps = React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }
export const TableRow: React.FC<TableRowProps> = ({ children, clickable, style, ...rest }) => (
  <tr 
    {...rest}
    style={{
      borderBottom: `1px solid ${DS.color.border}`,
      transition: 'background .15s ease',
      cursor: clickable ? 'pointer' : undefined,
      ...style
    }}
    onMouseEnter={(e) => clickable && (e.currentTarget.style.background = DS.color.hover)}
    onMouseLeave={(e) => clickable && (e.currentTarget.style.background = 'transparent')}
  >{children}</tr>
)

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & { header?: boolean; align?: 'left'|'center'|'right' }
export const TableCell: React.FC<TableCellProps> = ({ children, header, align = 'left', style, ...rest }) => {
  const Tag = header ? 'th' : 'td'
  return (
    <Tag 
      {...rest}
      style={{
        padding: `${DS.spacing(4)} ${DS.spacing(4)}`,
        textAlign: align,
        fontWeight: header ? DS.font.weightMedium : DS.font.weightRegular,
        color: header ? DS.color.textSecondary : DS.color.textPrimary,
        fontSize: header ? DS.font.size.sm : DS.font.size.base,
        textTransform: header ? 'uppercase' : undefined,
        letterSpacing: header ? DS.font.letterSpacing.wide : undefined,
        ...style
      }}
    >{children}</Tag>
  )
}

// Modal Component
type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, size = 'md', children }) => {
  const widths = { sm: 400, md: 600, lg: 800 }
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: DS.spacing(4),
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.color.surface,
          borderRadius: DS.radius.lg,
          boxShadow: elevations.popover,
          width: '100%',
          maxWidth: widths[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {title && (
          <div style={{ 
            padding: `${DS.spacing(7)} ${DS.spacing(8)}`,
            borderBottom: `1px solid ${DS.color.borderSubtle}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Title level={2} mb={0}>{title}</Title>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: DS.color.textSecondary,
                padding: DS.spacing(1),
                lineHeight: 1,
                transition: 'color .2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = DS.color.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = DS.color.textSecondary}
            >×</button>
          </div>
        )}
        <div style={{ 
          padding: DS.spacing(8),
          overflowY: 'auto',
          flex: 1
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// Loading Components
export const Spinner: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <div style={{
    width: size,
    height: size,
    border: `3px solid ${DS.color.border}`,
    borderTopColor: DS.color.accent,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }} />
)

export const Skeleton: React.FC<{ width?: number | string; height?: number; style?: React.CSSProperties }> = ({ width = '100%', height = 20, style }) => (
  <div style={{
    width,
    height,
    background: `linear-gradient(90deg, ${DS.color.surfaceAlt} 25%, ${DS.color.hover} 50%, ${DS.color.surfaceAlt} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: DS.radius.sm,
    ...style
  }} />
)

export const EmptyState: React.FC<{ icon?: string; title: string; description?: string; action?: React.ReactNode }> = ({ icon, title, description, action }) => (
  <div style={{
    padding: DS.spacing(16),
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: DS.spacing(5)
  }}>
    {icon && <div style={{ fontSize: 56, opacity: 0.4 }}>{icon}</div>}
    <Stack gap={3} align="center">
      <Title level={3} mb={0}>{title}</Title>
      {description && <Text dimmed size="base" style={{ maxWidth: 480, lineHeight: DS.font.lineHeight.relaxed }}>{description}</Text>}
    </Stack>
    {action && <div style={{ marginTop: DS.spacing(2) }}>{action}</div>}
  </div>
)

// Add keyframes to global styles (these should be added via Global component)
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `
  document.head.appendChild(style)
}
