/**
 * Standardized Card Sizes and Styles
 * Ensures consistency across the application
 */

export const CARD_SIZES = {
  // Small card (compact, list items, tissue selector)
  SMALL: {
    width: 280,
    height: 'auto',
    minHeight: 64,
    padding: 12,
  },

  // Medium card (color picker, standard list items)
  MEDIUM: {
    width: 220,
    height: 280,
    padding: 16,
  },

  // Large card (catalog, main content area)
  LARGE: {
    width: 280,
    height: 340,
    padding: 16,
  },

  // Grid/Thumbnail card
  THUMBNAIL: {
    width: 180,
    height: 200,
    padding: 12,
  },
} as const

export const CARD_STYLES = {
  base: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  hoverable: {
    cursor: 'pointer' as const,
    '&:hover': {
      borderColor: '#2563eb',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    },
  },

  selected: {
    borderColor: '#2563eb',
    background: '#eef6ff',
    boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.1)',
  },

  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed' as const,
    pointerEvents: 'none' as const,
  },
}
