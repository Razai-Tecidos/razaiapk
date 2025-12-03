import { GenerateCatalogPdfParams, CatalogPdfResult } from '@/types/catalog'
import { isTauri, saveFile, showSaveDialog } from '@/lib/platform'
import { LAYOUT, line, computeGrid, footerY, measureText, LH_SMALL, ensureSpace } from './layout'

// Public API
export async function generateCatalogPdf(
  params: GenerateCatalogPdfParams
): Promise<CatalogPdfResult> {
  console.debug('[catalog-pdf] generateCatalogPdf start, isTauri=', isTauri())
  const web = await generateViaWeb(params)
  const saved = await tryTauriSave(web)
  if (saved?.outputPath) console.debug('[catalog-pdf] saved via Tauri at', saved.outputPath)
  else console.debug('[catalog-pdf] native save not performed; returning web blob')
  return saved || web
}

async function generateViaWeb({
  items,
  config,
  filtersApplied,
}: GenerateCatalogPdfParams): Promise<CatalogPdfResult> {
  const [{ jsPDF }] = await Promise.all([import('jspdf') as any])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = LAYOUT.margin
  const margin = M.left // keep existing var name references

  // --- Visual Helpers ---



  function drawPageHeader(title: string, subtitle?: string) {
    // Brand - Small, Uppercase, Spaced, Gold
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 150, 80)
    // Add simple tracking by spacing characters (manual simulation if needed, but standard is ok)
    doc.text('RAZAI TECIDOS', margin, M.top - 30)
    
    // Title - Large, Modern, Dark
    doc.setFontSize(32)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 25)
    doc.text(title, margin, M.top + 5)
    
    // Subtitle (SKU) - Elegant Gray
    if (subtitle) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(140, 140, 150)
      doc.text(subtitle, margin, M.top + 22)
    }
    
    // Minimalist Divider
    const lineY = M.top + 35
    // Small gold accent
    doc.setDrawColor(180, 150, 80)
    doc.setLineWidth(2)
    doc.line(margin, lineY, margin + 40, lineY)
    // Long subtle gray line
    doc.setDrawColor(230, 230, 235)
    doc.setLineWidth(0.5)
    doc.line(margin + 40, lineY, pageW - margin, lineY)
  }

  function footer(pageNum: number) {
    const fy = footerY(pageH)
    
    // Decorative line above footer
    doc.setDrawColor(230)
    doc.line(margin, fy - 25, pageW - margin, fy - 25)

    // Left: Brand
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text('RAZAI TECIDOS', margin, fy - 10)

    // Center: Pix
    doc.setFontSize(8)
    doc.setTextColor(50)
    doc.text('Pix: razai.contato@gmail.com | Rafael Biscardi', pageW / 2, fy - 10, { align: 'center' })

    // Center Bottom: Disclaimer
    doc.setFontSize(6)
    doc.setTextColor(120)
    doc.text('Nota: As cores podem sofrer variação entre a imagem e o produto físico.', pageW / 2, fy + 2, { align: 'center' })

    // Right: Page Number
    if (config?.showFooterPageNumbers !== false) {
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Página ${pageNum}`, pageW - margin, fy - 10, { align: 'right' })
    }
  }

  let pageNum = 1
  // addPage: usado para iniciar um novo tecido (capa já conta como página 1 se presente)
  const addPage = () => {
    if (pageNum > 1) doc.addPage()
    pageNum++
  }
  // startNewPage: continuação do mesmo tecido (overflow de grid de cores/estampas)
  const startNewPage = () => {
    doc.addPage()
    pageNum++
  }

  // Pré-carrega dimensões das thumbnails para preservar aspect ratio.
  // Mapa dataURL -> { w, h, data }.
  const dimCache = new Map<string, { w: number; h: number; data: string; error?: string }>()
  
  async function ensureDims(dataUrl?: string) {
    if (!dataUrl) return null
    if (dimCache.has(dataUrl)) return dimCache.get(dataUrl)!
    
    // await ensureDims(dataUrl) - REMOVED: caused infinite recursion

    try {
      let base64Data: string | null = null;
      const errors: string[] = [];

      // Optimization 1: Direct Data URL usage (no fetch needed)
      if (dataUrl.startsWith('data:')) {
        base64Data = dataUrl;
      } 
      // Optimization 2: Local File Path (Tauri only) - read directly from FS
      else if (isTauri() && !dataUrl.startsWith('http://') && !dataUrl.startsWith('https://')) {
         try {
           const fs = await import('@tauri-apps/plugin-fs');
           const data = await fs.readFile(dataUrl);
           const b64 = uint8ArrayToBase64(data);
           // Guess mime type from extension
           const ext = dataUrl.split('.').pop()?.toLowerCase() || 'png';
           const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
           base64Data = `data:${mime};base64,${b64}`;
         } catch (fsErr: any) {
           const msg = `Failed to read local file via plugin-fs: ${dataUrl} - ${fsErr?.message || fsErr}`
           console.warn(msg);
           errors.push(String(fsErr));
         }
      }

      // Attempt 3: Tauri HTTP plugin (only if not already resolved)
      if (!base64Data) {
         try {
           const { fetch } = await import('@tauri-apps/plugin-http');
           const response = await fetch(dataUrl, { method: 'GET' });
           if (!response.ok) throw new Error(`Status ${response.status}`);
           const blob = await response.blob();
           base64Data = await new Promise<string>((resolve, reject) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.onerror = reject;
             reader.readAsDataURL(blob);
           });
         } catch (tauriErr) {
           errors.push(String(tauriErr));
         }
      }

      // Attempt 4: Fallback to native window.fetch (Web mode or if Tauri plugin failed)
      if (!base64Data) {
         try {
           const response = await window.fetch(dataUrl);
           if (!response.ok) throw new Error(`Status ${response.status}`);
           const blob = await response.blob();
           base64Data = await new Promise<string>((resolve, reject) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.onerror = reject;
             reader.readAsDataURL(blob);
           });
         } catch (webErr) {
           console.warn('Native fetch failed:', webErr);
           errors.push(String(webErr));
         }
      }

      if (!base64Data) {
        console.warn('Failed to load image via all strategies:', dataUrl, errors);
        const errResult = { w: 100, h: 100, data: null as any, error: errors.join(' | ') }
        dimCache.set(dataUrl, errResult)
        return errResult
      }

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => reject(new Error('img load fail'))
        im.src = base64Data!
      })
      const dims = { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, data: base64Data }
      dimCache.set(dataUrl, dims)
      return dims
    } catch (e) {
      console.warn('Failed to load image for PDF:', dataUrl, e)
      const errResult = { w: 100, h: 100, data: null as any, error: String(e) }
      dimCache.set(dataUrl, errResult)
      return errResult
    }
  }

  // Coleta única de todos os thumbs (cores + estampas) para paralelizar carregamento de dimensões.
  const allThumbs: string[] = []
  for (const it of items) {
    for (const c of it.colors)
      if (c.imageThumb && !dimCache.has(c.imageThumb)) allThumbs.push(c.imageThumb)
    for (const p of it.patterns)
      if (p.imageThumb && !dimCache.has(p.imageThumb)) allThumbs.push(p.imageThumb)
  }
  await Promise.all(allThumbs.map(t => ensureDims(t)))

  // Fabric pages
  let firstFabric = true
  for (const item of items) {
    if (!firstFabric) addPage()
    else firstFabric = false
    
    drawPageHeader(item.tissueName, item.tissueSku)

    let y = margin + 80 // Increased spacing below header (was 60)
    doc.setFontSize(10)
    doc.setTextColor(50)
    const infoEntries: string[] = []
    if (item.composition) infoEntries.push(`Composição: ${item.composition}`)
    if (item.width) infoEntries.push(`Largura: ${item.width}cm`)
    if (item.gsm) infoEntries.push(`GSM: ${item.gsm}`)
    if (item.fabricType) infoEntries.push(`Tipo: ${item.fabricType}`)
    if (item.season) infoEntries.push(`Estação: ${item.season}`)
    if (item.supplier) infoEntries.push(`Fornecedor: ${item.supplier}`)
    if (item.tags?.length) infoEntries.push(`Tags: ${item.tags.join(', ')}`)
    if (item.description) infoEntries.push(item.description)
    const infoLineHeight = line(3.5) // ~14pt
    for (const entry of infoEntries) {
      // Medir quebra real para evitar sobreposição com grid
      const measured = measureText(doc, entry, pageW - margin * 2, infoLineHeight)
      let offset = 0
      for (const ln of measured.lines) {
        doc.text(ln, margin, y + offset, { maxWidth: pageW - margin * 2 })
        offset += infoLineHeight
      }
      y += measured.height
    }

    // Separator line below metadata
    doc.setDrawColor(230) // Lighter separator
    doc.line(margin, y + 8, pageW - margin, y + 8)
    y += 35 // Much more space before grid starts

    // Color thumbnails grid (FIXED 3 columns as per design requirement)
    const grid = computeGrid(pageW, 3) // Force 3 columns
    const thumbSize = grid.thumbSize
    // dynamic label height (max of one line baseline or measured height)
    const baseLabelLineHeight = LH_SMALL
    // We'll compute per-cell label height; keep a nominal for initial cellHeight
    const nominalLabelHeight = baseLabelLineHeight + line(2) + line(1.5) // include SKU + Status
    let cellHeight = thumbSize + nominalLabelHeight + line(3)
    const gapX = LAYOUT.gap.x
    const gapY = LAYOUT.gap.y
    const cols = grid.cols
    const offsetX = grid.offsetX
    let col = 0
    let row = 0
    // Ensure we have space for at least one row of the color grid before starting
    y = ensureSpace(doc, y, cellHeight, pageH)
    doc.setFontSize(9)
    doc.setTextColor(40)
    for (let i = 0; i < item.colors.length; i++) {
      const c = item.colors[i]
      const allowance = LAYOUT.footerHeight + line(2)
      // recompute dynamic label height for this color
      doc.setFontSize(8.5)
      const mName = measureText(doc, c.colorName, thumbSize - 4, baseLabelLineHeight)
      const nameHeight = Math.max(baseLabelLineHeight, mName.height)
      const perCellLabelHeight = nameHeight + line(2) + line(1.5) // SKU + Status line
      cellHeight = thumbSize + perCellLabelHeight + line(3)
      let cellX = offsetX + col * (thumbSize + gapX)
      let cellY = y + row * (cellHeight + gapY)
      // Row-level check: if starting new row and it would overflow, break before drawing any cell in that row
      if (col === 0 && cellY + cellHeight + allowance > pageH) {
        startNewPage()
        // Header removed for continuation pages as per user request
        y = M.top
        row = 0
        col = 0
        cellX = offsetX + col * (thumbSize + gapX)
        cellY = y + row * (cellHeight + gapY)
      } else if (col > 0 && cellY + cellHeight + allowance > pageH) {
        // mid-row overflow: move entire row to next page (cells already drawn this row stay previous page)
        startNewPage()
        // Header removed for continuation pages as per user request
        y = M.top
        row = 0
        col = 0
        cellX = offsetX + col * (thumbSize + gapX)
        cellY = y + row * (cellHeight + gapY)
      }
      // Thumbnail box (Full Width)
      const imgSize = thumbSize // Full width
      const imgX = cellX
      const imgY = cellY
      
      // No border around image itself, the card border handles it.

      const imgData = c.imageThumb
      if (imgData) {
        const dims = dimCache.get(imgData)
        if (dims && dims.data) {
          const maxSide = imgSize
          const scale = Math.min(maxSide / dims.w, maxSide / dims.h) || 1
          const drawW = Math.min(maxSide, dims.w * scale)
          const drawH = Math.min(maxSide, dims.h * scale)
          const offX = imgX + (maxSide - drawW) / 2
          const offY = imgY + (maxSide - drawH) / 2
          try {
            // Detect format from data URL (e.g. data:image/jpeg;base64,...)
            const match = dims.data.match(/^data:image\/(\w+);base64,/)
            const format = match ? match[1].toUpperCase() : 'PNG'
            // Handle JPG/JPEG alias
            const fmt = format === 'JPG' ? 'JPEG' : format
            doc.addImage(dims.data, fmt, offX, offY, drawW, drawH)
          } catch (err) {
            console.error('[catalog-pdf] addImage failed for color:', c.colorSku, err)
            doc.setFillColor(c.hex || '#ccc')
            doc.rect(imgX, imgY, maxSide, maxSide, 'F')
          }
        } else {
          // Falha ao obter dimensões ou dados: desenha fallback com texto de debug
          doc.setFillColor(c.hex || '#ccc')
          doc.rect(imgX, imgY, imgSize, imgSize, 'F')
          
          // DEBUG: Print dataUrl snippet to PDF
          doc.setFontSize(8)
          doc.setTextColor(0, 0, 0) // Black
          const debugText = (imgData || 'null').substring(0, 50)
          const errText = (dims?.error || '').substring(0, 50)
          doc.text(debugText, imgX + 4, imgY + 10, { maxWidth: imgSize - 8 })
          if (errText) {
             doc.setTextColor(255, 0, 0) // Red
             doc.text(errText, imgX + 4, imgY + 20, { maxWidth: imgSize - 8 })
          }
        }
      } else {
        doc.setFillColor(c.hex || '#eee')
        doc.rect(imgX, imgY, imgSize, imgSize, 'F')
      }
      // Label
      const code = `${item.tissueSku}-${c.colorSku}`
      // Draw color name (handle multiple lines)
      doc.setFontSize(9) // Slightly larger
      doc.setTextColor(30)
      doc.setFont('helvetica', 'bold') // Bold name
      const nameYStart = imgY + imgSize + line(3)
      let lineOffset = 0
      for (const ln of mName.lines) {
        doc.text(ln, cellX + thumbSize / 2, nameYStart + lineOffset, {
          align: 'center',
          maxWidth: thumbSize - 10,
        })
        lineOffset += baseLabelLineHeight
      }
      // SKU code below
      const skuY = nameYStart + nameHeight + line(1.5)
      doc.text(code, cellX + thumbSize / 2, skuY, { align: 'center' })

      // Status below SKU
      const statusY = skuY + line(1.2)
      doc.setFontSize(7)
      if (c.status === 'Inativo') {
        doc.setTextColor(224, 49, 49) // Soft Red #E03131
        doc.text('Indisponível', cellX + thumbSize / 2, statusY, { align: 'center' })
      } else {
        doc.setTextColor(47, 158, 68) // Green #2F9E44
        doc.text('Disponível', cellX + thumbSize / 2, statusY, { align: 'center' })
      }

      col++
      if (col >= cols) {
        col = 0
        row++
      }
    }
    // Advance Y below colors grid
    const colorsRows = row + (col > 0 ? 1 : 0)
    const gridBottomY =
      y + (colorsRows > 0 ? (colorsRows - 1) * (cellHeight + gapY) + cellHeight : 0)
    let currentY = gridBottomY + (colorsRows ? 32 : 0)

    // Patterns section (if any)
    if (item.patterns && item.patterns.length) {
      // ensure space for heading + at least one row
      currentY = ensureSpace(doc, currentY, line(4) + cellHeight, pageH)
      doc.setFontSize(13)
      doc.setTextColor(50)
      doc.text('Estampas', margin, currentY)
      currentY += 18
      // reset grid state for patterns
      col = 0
      row = 0
      for (let i = 0; i < item.patterns.length; i++) {
        const p = item.patterns[i]
        const allowance = LAYOUT.footerHeight + line(2)
        let cellX = offsetX + col * (thumbSize + gapX)
        let cellY = currentY + row * (cellHeight + gapY)
        if (col === 0 && cellY + cellHeight + allowance > pageH) {
          startNewPage()
          // Header removed for continuation pages
          currentY = M.top
          col = 0
          row = 0
          cellX = offsetX + col * (thumbSize + gapX)
          cellY = currentY + row * (cellHeight + gapY)
        } else if (col > 0 && cellY + cellHeight + allowance > pageH) {
          startNewPage()
          // Header removed for continuation pages
          currentY = M.top
          col = 0
          row = 0
          cellX = offsetX + col * (thumbSize + gapX)
          cellY = currentY + row * (cellHeight + gapY)
        }
        // Thumbnail box (Full Width)
        const imgSize = thumbSize
        const imgX = cellX
        const imgY = cellY

        const imgData = p.imageThumb
        if (imgData) {
          const dims = dimCache.get(imgData)
          if (dims && dims.data) {
            const maxSide = imgSize
            const scale = Math.min(maxSide / dims.w, maxSide / dims.h) || 1
            const drawW = Math.min(maxSide, dims.w * scale)
            const drawH = Math.min(maxSide, dims.h * scale)
            const offX = imgX + (maxSide - drawW) / 2
            const offY = imgY + (maxSide - drawH) / 2
            try {
              // Detect format from data URL
              const match = dims.data.match(/^data:image\/(\w+);base64,/)
              const format = match ? match[1].toUpperCase() : 'PNG'
              const fmt = format === 'JPG' ? 'JPEG' : format
              doc.addImage(dims.data, fmt, offX, offY, drawW, drawH)
            } catch (err) {
              console.error('[catalog-pdf] addImage failed for pattern:', p.patternSku, err)
              doc.setFillColor('#ddd')
              doc.rect(imgX, imgY, maxSide, maxSide, 'F')
            }
          } else {
            doc.setFillColor('#ddd')
            doc.rect(imgX, imgY, imgSize, imgSize, 'F')
            
            // DEBUG: Print dataUrl snippet to PDF
            doc.setFontSize(8)
            doc.setTextColor(0, 0, 0)
            const debugText = (imgData || 'null').substring(0, 50)
            const errText = (dims?.error || '').substring(0, 50)
            doc.text(debugText, imgX + 4, imgY + 10, { maxWidth: imgSize - 8 })
            if (errText) {
               doc.setTextColor(255, 0, 0)
               doc.text(errText, imgX + 4, imgY + 20, { maxWidth: imgSize - 8 })
            }
          }
        } else {
          doc.setFillColor('#eee')
          doc.rect(imgX, imgY, imgSize, imgSize, 'F')
        }
        // Pattern label
        doc.setFontSize(9)
        doc.setTextColor(30)
        doc.setFont('helvetica', 'bold')
        doc.text(p.patternName, cellX + thumbSize / 2, imgY + imgSize + 12, {
          align: 'center',
          maxWidth: thumbSize - 10,
        })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(
          `${item.tissueSku}-${p.patternSku}`,
          cellX + thumbSize / 2,
          imgY + imgSize + 22,
          { align: 'center' }
        )
        col++
        if (col >= cols) {
          col = 0
          row++
        }
      }
    }
    footer(pageNum)
  }


  const generatedAt = new Date().toISOString()
  const colorsTotal = items.reduce((acc, it) => acc + it.colors.length, 0)
  const patternsTotal = items.reduce((acc, it) => acc + it.patterns.length, 0)

  const blob = doc.output('blob') as Blob
  return {
    blob,
    fileName: (config?.title || 'catalogo') + '.pdf',
    metadata: {
      generatedAt,
      itemCount: items.length,
      colorsTotal,
      patternsTotal,
      filtersApplied,
      version: config?.version,
      author: config?.author,
    },
  }
}



async function tryTauriSave(res: CatalogPdfResult): Promise<CatalogPdfResult | null> {
  if (!res.blob) {
    console.debug('[catalog-pdf] no blob to save')
    return null
  }
  if (!isTauri()) {
    console.debug('[catalog-pdf] skipping native save (not in Tauri environment)')
    return null
  }
  try {
    const defaultName = res.fileName || 'catalogo.pdf'
    let suggested = defaultName
    try {
      const lastDir = localStorage.getItem('catalogLastDir')
      if (lastDir) {
        const sep =
          lastDir.endsWith('\\') || lastDir.endsWith('/') ? '' : lastDir.includes('\\') ? '\\' : '/'
        suggested = lastDir + sep + defaultName
      }
    } catch {}

    const saveResult = await saveFile({
      data: res.blob,
      fileName: defaultName,
      mimeType: 'application/pdf',
      description: 'PDF',
      defaultPath: suggested,
    })

    if (saveResult.cancelled) {
      console.debug('[catalog-pdf] native save cancelled by user')
      return { ...res, outputPath: undefined, nativeSaveAttempted: true }
    }

    if (!saveResult.success) {
      console.warn('[catalog-pdf] native save failed via platform service', saveResult)
      return {
        ...res,
        outputPath: undefined,
        error: 'Falha ao salvar nativamente.',
        nativeSaveAttempted: true,
      }
    }

    if (saveResult.fallbackUsed) {
      console.info('[catalog-pdf] native save used web fallback; blob download already triggered')
      return { ...res, outputPath: undefined, nativeSaveAttempted: true, blob: undefined }
    }

    if (saveResult.location) {
      try {
        const normalized = saveResult.location.replace(/\\/g, '/')
        const dir = normalized.split('/').slice(0, -1).join('/')
        if (dir) {
          const persisted = saveResult.location.includes('\\') ? dir.replace(/\//g, '\\') : dir
          localStorage.setItem('catalogLastDir', persisted)
        }
      } catch {}
      return { ...res, outputPath: saveResult.location, nativeSaveAttempted: true }
    }

    return { ...res, outputPath: undefined, nativeSaveAttempted: true }
  } catch (e: any) {
    console.warn('[catalog-pdf] native save attempt failed', e)
    let msg = 'Falha ao salvar nativamente.'
    const text = String(e?.message || e)
    if (/permission/i.test(text) || /not allowed/i.test(text)) {
      msg = 'Sem permissão para salvar no caminho escolhido. Ajuste capabilities do Tauri.'
    } else if (/fs\.write/i.test(text)) {
      msg = 'WriteFile indisponível no plugin-fs.'
    }
    return { ...res, outputPath: undefined, error: msg, nativeSaveAttempted: true }
  }
}

// Manual test helpers for debugging in Tauri devtools
export async function debugTestDialog(): Promise<string | null> {
  try {
    const res = await showSaveDialog({
      suggestedName: 'teste-dialog.txt',
      filters: [{ name: 'Texto', extensions: ['txt'] }],
      title: 'Salvar arquivo de teste',
    })
    console.debug('[catalog-pdf] debugTestDialog result=', res)
    if (res.cancelled) return null
    return res.path || null
  } catch (e) {
    console.warn('[catalog-pdf] debugTestDialog failed', e)
    return null
  }
}

export async function debugWriteFile(path: string, content: string): Promise<boolean> {
  if (!path) return false
  try {
    if (isTauri()) {
      const fs: any = await import('@tauri-apps/plugin-fs')
      const writeBinary = fs.writeFile || fs.default?.writeFile
      if (typeof writeBinary === 'function') {
        await writeBinary(path, new TextEncoder().encode(content))
        console.debug('[catalog-pdf] debugWriteFile wrote content via writeFile to', path)
        return true
      }
      const writeText = fs.writeTextFile || fs.default?.writeTextFile
      if (typeof writeText === 'function') {
        await writeText(path, content)
        console.debug('[catalog-pdf] debugWriteFile wrote content via writeTextFile to', path)
        return true
      }
      throw new Error('Nenhuma função write disponível no plugin-fs')
    }
  } catch (e) {
    console.warn('[catalog-pdf] debugWriteFile native path failed, attempting fallback', e)
  }

  const fallbackName = path.split(/[\\/]/).pop() || 'debug.txt'
  const res = await saveFile({
    data: content,
    fileName: fallbackName,
    mimeType: 'text/plain',
    description: 'Texto',
    defaultPath: path,
  })
  return !!res.success
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}
