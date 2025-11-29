import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { extractNeutralTexture } from '@/lib/recolor/textureExtractionNeutral'
import { recolorTextureWithRazaiColor, type RazaiColor } from '@/lib/recolor/recolorEngine'
import { linksDb } from '@/lib/db'
import { adjustBrightness, adjustHue, adjustSaturation } from '@/lib/recolor/postAdjustments'
import { hexToLab, labToHex, compensateLab } from '@/lib/color-utils'
import { DS } from '@/design-system/tokens'
import { DSButton, Panel, Stack, Row, Label, Title } from '@/design-system/components'
import { saveFile } from '@/lib/platform'

function controlInputStyle(): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: DS.radius.md,
    border: `1px solid ${DS.color.border}`,
    background: DS.color.surface,
    color: DS.color.textPrimary,
    fontSize: 14,
    fontFamily: DS.font.familySans,
    boxSizing: 'border-box',
    transition: 'border-color .2s ease, box-shadow .2s ease'
  }
}

function sliderRow(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: '130px 1fr 56px', gap: 8, alignItems: 'center', color: DS.color.textPrimary }
}

function sliderValue(): React.CSSProperties {
  return { textAlign: 'right', color: DS.color.textSecondary }
}

function subLabelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: 12,
    color: DS.color.textMuted,
    marginBottom: 6,
    fontWeight: DS.font.weightMedium
  }
}

export type FabricColorPreviewProps = {
  colors: RazaiColor[]
  linksForColors?: Array<{ skuFilho: string; id: string }>
  tissueName?: string
  targetLightness?: number
  lightnessFactor?: number
  style?: React.CSSProperties
}

function imageToImageData(img: HTMLImageElement): ImageData {
  const cnv = document.createElement('canvas')
  cnv.width = img.naturalWidth || img.width
  cnv.height = img.naturalHeight || img.height
  const ctx = cnv.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, cnv.width, cnv.height)
}

export function FabricColorPreview({ colors, linksForColors, tissueName, targetLightness = 65, lightnessFactor = 1, style }: FabricColorPreviewProps) {
  const [baseTexture, setBaseTexture] = useState<ImageData | null>(null)
  const [recoloredBase, setRecoloredBase] = useState<ImageData | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [manualHex, setManualHex] = useState<string>('')
  const [labL, setLabL] = useState<string>('')
  const [labA, setLabA] = useState<string>('')
  const [labB, setLabB] = useState<string>('')
  const [brightness, setBrightness] = useState<number>(0)
  const [saturation, setSaturation] = useState<number>(1)
  const [hueShift, setHueShift] = useState<number>(0)
  const [saving, setSaving] = useState<boolean>(false)

  const handleFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = url
      })
      const id = imageToImageData(img)
      const neutral = extractNeutralTexture(id, { targetLightness, marginPercent: 0.03 })
      setBaseTexture(neutral)
      setRecoloredBase(null)
      setSelectedIndex(-1)
      const cnv = canvasRef.current || document.createElement('canvas')
      canvasRef.current = cnv
      cnv.width = neutral.width
      cnv.height = neutral.height
      const ctx = cnv.getContext('2d')!
      ctx.putImageData(neutral, 0, 0)
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [targetLightness])

  const drawToCanvas = useCallback((img: ImageData) => {
    const cnv = canvasRef.current || document.createElement('canvas')
    canvasRef.current = cnv
    cnv.width = img.width
    cnv.height = img.height
    const ctx = cnv.getContext('2d')!
    ctx.putImageData(img, 0, 0)
  }, [])

  const applyPost = useCallback((img: ImageData): ImageData => {
    let out = img
    if (brightness !== 0) out = adjustBrightness(out, brightness)
    if (saturation !== 1) out = adjustSaturation(out, saturation)
    if (hueShift !== 0) out = adjustHue(out, hueShift)
    return out
  }, [brightness, saturation, hueShift])

  const recolorAndRender = useCallback((idx: number) => {
    if (!baseTexture || idx < 0 || idx >= colors.length) return
    const colored = recolorTextureWithRazaiColor(baseTexture, colors[idx], { lightnessFactor })
    setRecoloredBase(colored)
    const finalImg = applyPost(colored)
    drawToCanvas(finalImg)
  }, [baseTexture, colors, lightnessFactor, applyPost, drawToCanvas])

  const recolorWith = useCallback((rc: RazaiColor) => {
    if (!baseTexture) return
    const colored = recolorTextureWithRazaiColor(baseTexture, rc, { lightnessFactor })
    setRecoloredBase(colored)
    const finalImg = applyPost(colored)
    drawToCanvas(finalImg)
  }, [baseTexture, lightnessFactor, applyPost, drawToCanvas])

  const onApplyHex = useCallback(() => {
    if (!baseTexture) return
    const lab = manualHex ? hexToLab(manualHex.trim()) : undefined
    if (!lab) return
    setSelectedIndex(-1)
    recolorWith({ hex: manualHex.trim(), lab })
  }, [baseTexture, manualHex, recolorWith])

  const onApplyLab = useCallback(() => {
    if (!baseTexture) return
    const L = Math.max(0, Math.min(100, Number(labL)))
    const a = Math.max(-150, Math.min(150, Number(labA)))
    const b = Math.max(-150, Math.min(150, Number(labB)))
    if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return
    setSelectedIndex(-1)
    
    // Apply compensation (White Balance)
    const comp = compensateLab({ L, a, b })
    
    const hex = labToHex(comp)
    recolorWith({ lab: comp, hex })
  }, [baseTexture, labL, labA, labB, recolorWith])

  const onSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number.parseInt(e.target.value, 10)
    setSelectedIndex(idx)
    if (idx >= 0) recolorAndRender(idx)
  }, [recolorAndRender])

  useEffect(() => {
    if (!recoloredBase) return
    const t = setTimeout(() => {
      const finalImg = applyPost(recoloredBase)
      drawToCanvas(finalImg)
    }, 50)
    return () => clearTimeout(t)
  }, [brightness, saturation, hueShift, recoloredBase, applyPost, drawToCanvas])

  const fileInputId = useId()
  const colorSelectId = useId()
  const manualHexId = useId()
  const labLId = useId()
  const labAId = useId()
  const labBId = useId()

  return (
    <section style={style}>
      <Stack gap={6}>
        <Title level={3} mb={0}>Pré-visualização de Recolor</Title>

        <Stack gap={6} style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor={fileInputId}>Imagem do tecido</Label>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
                style={controlInputStyle()}
              />
            </Stack>

            <Panel padding={4} gap={4} subtle>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: 600, width: '100%' }}>
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: 'auto', maxWidth: 600, imageRendering: 'auto', display: 'block', margin: '0 auto', borderRadius: DS.radius.lg }}
                  />
                </div>
              </div>
              <Row gap={3} wrap justify="flex-end" style={{ marginTop: DS.spacing(2) }}>
                <DSButton
                  tone="accent"
                  size="sm"
                  onClick={async () => {
                    if (!canvasRef.current) return
                    const idx = selectedIndex
                    const selectedColor = (idx >= 0 && idx < colors.length) ? colors[idx] : null
                    const linkInfo = (idx >= 0 && linksForColors && idx < linksForColors.length) ? linksForColors[idx] : undefined
                    const colorLabel = selectedColor?.name || (selectedColor?.hex && selectedColor.hex !== '#' ? selectedColor.hex : (selectedColor?.lab ? labToHex(selectedColor.lab) : 'Cor'))
                    const code = linkInfo?.skuFilho || 'vinculo'
                    const tecido = tissueName || 'Tecido'
                    const filename = makeSafeFilename(`${tecido} - ${colorLabel} - ${code}.png`)
                    try {
                      setSaving(true)
                      await saveCanvasImage(canvasRef.current, filename)
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={!canvasRef.current || saving}
                  aria-label="Salvar imagem renderizada"
                  title="Salvar imagem renderizada"
                >{saving ? 'Salvando…' : 'Salvar imagem'}</DSButton>
                <DSButton
                  tone="accent"
                  size="sm"
                  onClick={async () => {
                    if (selectedIndex < 0 || !linksForColors || selectedIndex >= linksForColors.length) { alert('Selecione uma cor vinculada primeiro.'); return }
                    if (!canvasRef.current) { alert('Canvas ainda não inicializado.'); return }
                    const linkInfo = linksForColors[selectedIndex]
                    try {
                      setSaving(true)
                      const blob = await canvasToBlob(canvasRef.current, 'image/png')
                      const file = new File([blob], (linkInfo.skuFilho || 'vinculo') + '.png', { type: 'image/png' })
                      await linksDb.setImageFull(linkInfo.id, file as any)
                      alert('Imagem enviada ao vínculo ' + linkInfo.skuFilho)
                    } catch (e: any) {
                      console.warn('[recolor] falha ao enviar imagem ao vínculo', e)
                      alert('Falha ao enviar imagem: ' + (e?.message || e))
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving || selectedIndex < 0}
                  aria-label="Enviar ao Vínculo"
                  title="Enviar ao Vínculo"
                >{saving ? 'Enviando…' : 'Enviar ao Vínculo'}</DSButton>
              </Row>
            </Panel>
          </Stack>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <Stack gap={6} style={{ flex: '1 1 360px', minWidth: 300, maxWidth: 420 }}>
              <Stack gap={2}>
                <Label htmlFor={colorSelectId}>Selecione uma cor</Label>
                <select
                  id={colorSelectId}
                  disabled={!baseTexture}
                  value={selectedIndex}
                  onChange={onSelect}
                  style={controlInputStyle()}
                >
                  <option value={-1}>—</option>
                  {colors.map((c, i) => {
                    const hexDisplay = c.hex && c.hex !== '#' ? c.hex : labToHex(c.lab)
                    const optionLabel = c.name ? `${c.name} (${hexDisplay})` : hexDisplay
                    return <option key={i} value={i}>{optionLabel}</option>
                  })}
                </select>
              </Stack>

              <Panel title="Cor alvo manual" padding={4} gap={4} subtle>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label htmlFor={manualHexId} style={subLabelStyle()}>HEX (#RRGGBB)</label>
                    <input
                      id={manualHexId}
                      type="text"
                      placeholder="#CC3227"
                      value={manualHex}
                      onChange={e => setManualHex(e.target.value)}
                      disabled={!baseTexture}
                      style={controlInputStyle()}
                    />
                  </div>
                  <DSButton
                    tone="accent"
                    size="sm"
                    onClick={onApplyHex}
                    disabled={!baseTexture || !manualHex.trim()}
                    style={{ minWidth: 120 }}
                  >Aplicar HEX</DSButton>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label htmlFor={labLId} style={subLabelStyle()}>L</label>
                    <input
                      id={labLId}
                      type="number"
                      inputMode="decimal"
                      placeholder="65"
                      value={labL}
                      onChange={e => setLabL(e.target.value)}
                      disabled={!baseTexture}
                      style={controlInputStyle()}
                    />
                  </div>
                  <div>
                    <label htmlFor={labAId} style={subLabelStyle()}>a</label>
                    <input
                      id={labAId}
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={labA}
                      onChange={e => setLabA(e.target.value)}
                      disabled={!baseTexture}
                      style={controlInputStyle()}
                    />
                  </div>
                  <div>
                    <label htmlFor={labBId} style={subLabelStyle()}>b</label>
                    <input
                      id={labBId}
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={labB}
                      onChange={e => setLabB(e.target.value)}
                      disabled={!baseTexture}
                      style={controlInputStyle()}
                    />
                  </div>
                  <Row gap={3} justify="flex-end">
                    <DSButton
                      tone="accent"
                      size="sm"
                      onClick={onApplyLab}
                      disabled={!baseTexture}
                    >Aplicar LAB</DSButton>
                  </Row>
                </div>
              </Panel>

              <Panel title="Ajustes rápidos (pós-processo)" padding={4} gap={4} subtle>
                <Stack gap={4}>
                  <label style={sliderRow()}>
                    <span>Brilho (ΔL)</span>
                    <input type="range" min={-40} max={40} step={1} value={brightness} disabled={!recoloredBase} onChange={e => setBrightness(Number.parseFloat(e.target.value))} />
                    <span style={sliderValue()}>{brightness > 0 ? `+${brightness}` : `${brightness}`}</span>
                  </label>
                  <label style={sliderRow()}>
                    <span>Saturação (×C)</span>
                    <input type="range" min={0.6} max={1.4} step={0.01} value={saturation} disabled={!recoloredBase} onChange={e => setSaturation(Number.parseFloat(e.target.value))} />
                    <span style={sliderValue()}>{saturation.toFixed(2)}</span>
                  </label>
                  <label style={sliderRow()}>
                    <span>Matiz (°)</span>
                    <input type="range" min={-20} max={20} step={0.5} value={hueShift} disabled={!recoloredBase} onChange={e => setHueShift(Number.parseFloat(e.target.value))} />
                    <span style={sliderValue()}>{hueShift.toFixed(1)}°</span>
                  </label>
                </Stack>
              </Panel>
            </Stack>
          </div>
        </Stack>
      </Stack>
    </section>
  )
}

export default FabricColorPreview

// --- util: salvar imagem do canvas ---
function makeSafeFilename(name: string): string {
  // Remove/replace caracteres inválidos no Windows e normaliza espaços
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Falha ao gerar imagem'))
        resolve(blob)
      }, type, quality)
    } catch (e) { reject(e as any) }
  })
}

async function saveCanvasImage(canvas: HTMLCanvasElement, defaultFileName: string) {
  const blob = await canvasToBlob(canvas, 'image/png')
  const result = await saveFile({
    data: blob,
    fileName: defaultFileName,
    mimeType: 'image/png',
    description: 'Imagem PNG',
    defaultPath: defaultFileName,
  })
  if (!result.success && !result.cancelled) {
    console.error('[FabricColorPreview] Falha ao salvar imagem renderizada via plataforma', result)
    try { alert('Falha ao salvar a imagem. Tente novamente.') } catch {}
  }
  return result
}
