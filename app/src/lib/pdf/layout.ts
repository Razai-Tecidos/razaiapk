// Centralized layout constants & helpers for catalog PDF generation
import type jsPDFType from 'jspdf'

export interface LayoutConfig {
  margin: { top: number; right: number; bottom: number; left: number }
  baseline: number
  footerHeight: number
  gap: { x: number; y: number }
  minThumb: number
  maxThumb: number
}

export const LAYOUT: LayoutConfig = {
  margin: { top: 60, right: 50, bottom: 70, left: 50 },
  baseline: 4,
  footerHeight: 50,
  gap: { x: 24, y: 32 },
  minThumb: 130,
  maxThumb: 180,
}

export function line(mult: number): number { return mult * LAYOUT.baseline }
export const LH_BODY = line(3) // 12pt-ish
export const LH_SMALL = line(2.5) // 10pt-ish
export const LH_LABEL = line(2.75)

export interface MeasuredText {
  lines: string[]
  height: number
}

export function measureText(doc: jsPDFType, text: string, maxWidth: number, lineHeight: number = LH_BODY): MeasuredText {
  if (!text) return { lines: [], height: 0 }
  // jsPDF splitTextToSize returns array of lines already wrapped
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  return { lines, height: lines.length * lineHeight }
}

export function ensureSpace(doc: jsPDFType, currentY: number, neededHeight: number, pageH: number): number {
  const allowance = LAYOUT.footerHeight + line(2) // small safety padding
  if (currentY + neededHeight + allowance > pageH) {
    doc.addPage()
    return LAYOUT.margin.top
  }
  return currentY
}

export interface GridMetrics {
  cols: number
  cellWidth: number
  thumbSize: number
  usableWidth: number
  offsetX: number
}

export function computeGrid(pageW: number, configCols?: number): GridMetrics {
  const avail = pageW - LAYOUT.margin.left - LAYOUT.margin.right
  let cols = configCols && configCols > 0 ? configCols : 3
  // auto-fit columns if not forced, ensuring minimal thumbnail width
  if (!configCols) {
    for (let testCols = 5; testCols >= 2; testCols--) {
      const gapTotal = (testCols - 1) * LAYOUT.gap.x
      const candidateWidth = (avail - gapTotal) / testCols
      if (candidateWidth >= LAYOUT.minThumb) { cols = testCols; break }
    }
  }
  const gapTotal = (cols - 1) * LAYOUT.gap.x
  let cellWidth = (avail - gapTotal) / cols
  if (cellWidth > LAYOUT.maxThumb) cellWidth = LAYOUT.maxThumb
  // thumb uses square inside cell width
  const thumbSize = cellWidth
  const usableWidth = cellWidth * cols + gapTotal
  const offsetX = LAYOUT.margin.left + (avail - usableWidth) / 2
  return { cols, cellWidth, thumbSize, usableWidth, offsetX }
}

export function footerY(pageH: number): number { return pageH - LAYOUT.footerHeight / 2 }
