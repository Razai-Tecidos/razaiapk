import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { db, colorsDb, settingsDb } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import { messages } from '@/lib/messages'
import { ciede2000, inferFamilyFrom, detectFamilyFromName, labFromPartial, labToHex, hexToLab, FAMILY_NAMES, FAMILY_TOKENS, setHueBoundaries } from '@/lib/color-utils'
import type { Color, ColorInput } from '@/types/color'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'

type Mode = 'idle' | 'create' | 'edit'

const label = {
  title: 'Cadastro de Cor',
  new: 'novo cor',
  edit: 'editar',
  delete: 'excluir',
  add: 'adicionar cor',
  save: 'salvar',
  cancel: 'cancelar',
}

export default function Colors() {
  const [items, setItems] = useState<Color[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [form, setForm] = useState<ColorInput>({ name: '', hex: '', labL: undefined, labA: undefined, labB: undefined })
  const [errors, setErrors] = useState<{ name?: string; colorSpec?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null)
  const [query, setQuery] = useState('')
  const [deltaThreshold, setDeltaThreshold] = useState<number>(2.0)
  type SortKey = 'createdAt' | 'name' | 'sku' | 'hex' | 'labL' | 'labA' | 'labB'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const nameRef = useRef<HTMLInputElement>(null)
  const hexRef = useRef<HTMLInputElement>(null)
  const labLRef = useRef<HTMLInputElement>(null)
  const labARef = useRef<HTMLInputElement>(null)
  const labBRef = useRef<HTMLInputElement>(null)
  const initialFormRef = useRef<ColorInput | null>(null)

  // Teste de cores (colorímetro): entrada de HEX/LAB e pré-visualização/semelhança
  const [testHex, setTestHex] = useState<string>('')
  const [testLabL, setTestLabL] = useState<string>('')
  const [testLabA, setTestLabA] = useState<string>('')
  const [testLabB, setTestLabB] = useState<string>('')

  const anySelected = selectedIds.size > 0
  const exactlyOneSelected = selectedIds.size === 1
  const selected = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const id = Array.from(selectedIds)[0]
    return items.find(i => i.id === id) || null
  }, [items, selectedIds])

  const filteredSorted = useMemo(() => {
    const q = normalizeForSearch(query)
    let arr = items
    if (q) {
      arr = arr.filter(it =>
        normalizeForSearch(it.name || '').includes(q) ||
        normalizeForSearch(it.sku || '').includes(q) ||
        normalizeForSearch(it.hex || '').includes(q)
      )
    }
    const s = [...arr]
    const dirMul = sort.dir === 'asc' ? 1 : -1
    s.sort((a, b) => {
      const k = sort.key
      const va = (a as any)[k]
      const vb = (b as any)[k]
      if (va == null && vb != null) return -1 * dirMul
      if (va != null && vb == null) return 1 * dirMul
      if (va < vb) return -1 * dirMul
      if (va > vb) return 1 * dirMul
      return 0
    })
    return s
  }, [items, query, sort])

  // Multi-seleção com Ctrl/Shift
  const anchorIndexRef = useRef<number | null>(null)

  function selectRange(start: number, end: number, additive = false) {
    const a = Math.min(start, end)
    const b = Math.max(start, end)
    const rangeIds = filteredSorted.slice(a, b + 1).map(r => r.id!)
    setSelectedIds(prev => {
      if (additive) {
        const next = new Set(prev)
        for (const id of rangeIds) next.add(id)
        return next
      }
      return new Set(rangeIds)
    })
  }

  async function reclassifyAndSave() {
    // Calcula quais nomes mudariam com a família inferida atual e persiste apenas os diferentes
    const candidates = items.map((c) => {
      const current = (c.name || '').trim()
      const desired = displayName(c).trim()
      return { c, current, desired }
    })
    const toChange = candidates.filter(x => x.desired && x.desired !== x.current)
    if (toChange.length === 0) {
      toastMsg('success', 'Nenhuma alteração necessária')
      return
    }
    setSubmitting(true)
    try {
      for (const { c, desired } of toChange) {
        await colorsDb.updateColor({ id: c.id!, name: desired, hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
      }
      await load()
      toastMsg('success', `${toChange.length} ${toChange.length===1? 'cor atualizada' : 'cores atualizadas'}`)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function singleSelect(id: string) {
    setSelectedIds(new Set([id]))
  }

  function toggleSort(k: SortKey) {
    setSort(prev => prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' })
  }

  useEffect(() => {
    db.init()
      .then(async () => {
        try {
          const thr = await settingsDb.getDeltaThreshold()
          setDeltaThreshold(Number.isFinite(thr) && thr > 0 ? thr : 2.0)
          const hb = await settingsDb.getHueBoundaries()
          if (hb) setHueBoundaries(hb)
        } catch {}
        await load()
      })
      .catch(console.error)
  }, [])

  async function load() {
    const list = await colorsDb.listColors()
    setItems(list)
  }

  function openCreate() {
    setMode('create')
    const base: ColorInput = { name: '', hex: '', labL: undefined, labA: undefined, labB: undefined }
    setForm(base)
    setErrors({})
    setDrawerOpen(true)
    initialFormRef.current = base
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function openCreateWith(prefill: Partial<ColorInput>) {
    setMode('create')
    const base: ColorInput = {
      name: '',
      hex: prefill.hex ?? '',
      labL: prefill.labL,
      labA: prefill.labA,
      labB: prefill.labB,
    }
    setForm(base)
    setErrors(computeErrors(base))
    setDrawerOpen(true)
    initialFormRef.current = base
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function openEdit() {
    if (!selected) return
    const base: ColorInput = { name: selected.name, hex: selected.hex, labL: selected.labL, labA: selected.labA, labB: selected.labB }
    setMode('edit')
    setForm(base)
    setErrors({})
    setDrawerOpen(true)
    initialFormRef.current = base
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function normName(s: string) {
    return s.trim().replace(/\s+/g, ' ').toLowerCase()
  }

  // Index for navigation
  const selectedIndex = useMemo(() => {
    if (!selected) return -1
    return filteredSorted.findIndex(i => i.id === selected.id)
  }, [filteredSorted, selected])

  const navigate = React.useCallback(async (direction: -1 | 1) => {
    // Check dirty
    const i = initialFormRef.current
    const dirty = i && (
      normName(i.name) !== normName(form.name || '') ||
      (i.hex || '') !== (form.hex || '') ||
      i.labL !== form.labL || i.labA !== form.labA || i.labB !== form.labB
    )

    const doNav = () => {
      if (selectedIndex === -1) return
      const nextIndex = selectedIndex + direction
      if (nextIndex < 0 || nextIndex >= filteredSorted.length) return
      
      const nextItem = filteredSorted[nextIndex]
      if (!nextItem?.id) return

      setSelectedIds(new Set([nextItem.id]))
      
      const base: ColorInput = { 
        name: nextItem.name, 
        hex: nextItem.hex, 
        labL: nextItem.labL, 
        labA: nextItem.labA, 
        labB: nextItem.labB 
      }
      setForm(base)
      setErrors({})
      initialFormRef.current = base
    }

    if (dirty) {
      const saved = await saveColor({ close: false, silent: true })
      if (saved) {
        toastMsg('success', 'Salvo automaticamente')
        doNav()
      }
    } else {
      doNav()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, filteredSorted, form, mode, submitting])

  // Keyboard navigation
  useEffect(() => {
    if (!drawerOpen || mode !== 'edit') return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input (unless it's a modifier combo that doesn't produce text)
      // But Ctrl+Arrow is usually safe.
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        navigate(-1)
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        navigate(1)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen, mode, navigate]) // navigate is stable? No, it depends on state.
  // navigate depends on selectedIndex, form, etc.
  // We should wrap navigate in useCallback or just let the effect re-run.
  // Since navigate changes on every render (due to closure over form/selectedIndex), this effect will re-attach often.
  // That's fine for now.

  function computeErrors(input: ColorInput, opts?: { forEditId?: string | null }) {
    const e: { name?: string; colorSpec?: string } = {}
    const nameTrim = input.name?.trim() || ''
    if (!nameTrim) e.name = messages.validation.required
    if (nameTrim.length < 2) e.name = e.name || messages.validation.min2
  // Sem limite máximo de caracteres no nome da cor
    // Regras de cor:
    // - Criação/edição permite nome sem HEX/LAB
    // - Se informar HEX, validar formato
    // - Se informar qualquer LAB, exigir os três
    const hasAnyLab = input.labL != null || input.labA != null || input.labB != null
    const hasAllLab = [input.labL, input.labA, input.labB].every(v => typeof v === 'number' && Number.isFinite(v as number))
    const hasHex = !!(input.hex && /^#?[0-9a-fA-F]{6}$/.test(input.hex))
    if (input.hex && !hasHex) e.colorSpec = messages.validation.invalidHex
    if (hasAnyLab && !hasAllLab) e.colorSpec = messages.validation.labIncomplete

    // duplicate name
    const me = opts?.forEditId ?? null
    const target = normName(input.name || '')
    // Fix: ensure we correctly exclude the current item being edited
    const dup = items.some(it => {
      if (me && it.id === me) return false
      return normName(it.name) === target
    })
    if (!e.name && dup) e.name = messages.validation.duplicateName
    return e
  }

  function validate(input: ColorInput, opts?: { forEditId?: string | null; focus?: boolean }) {
    const e = computeErrors(input, { forEditId: opts?.forEditId ?? null })
    setErrors(e)
    if (opts?.focus) {
      if (e.name) nameRef.current?.focus()
      else if (e.colorSpec) (hexRef.current || labLRef.current)?.focus()
    }
    return Object.keys(e).length === 0
  }

  function conflictMessage(input: ColorInput, opts?: { forEditId?: string | null }) {
    const lab = labFromPartial({ hex: input.hex, labL: input.labL, labA: input.labA, labB: input.labB })
    if (!lab) return null
    const me = opts?.forEditId ?? null
    let best = Infinity
    let hit: Color | null = null
    for (const x of items) {
      if (me && x.id === me) continue
      const xl = labFromPartial({ hex: x.hex, labL: x.labL, labA: x.labA, labB: x.labB })
      if (!xl) continue
      const dE = ciede2000(lab, xl)
      if (dE < best) { best = dE; hit = x }
    }
    if (Number.isFinite(best) && best < deltaThreshold && hit) {
      return `Conflito: ΔE00 ${best.toFixed(2)} < limiar ${deltaThreshold.toFixed(2)} (com ${hit.name})`
    }
    return null
  }

  async function saveColor(opts: { close?: boolean; silent?: boolean } = {}) {
    if (submitting) return false
    const ok = validate(form, { forEditId: mode==='edit' ? (selected?.id ?? null) : null, focus: true })
    if (!ok) return false
    setSubmitting(true)
    try {
      if (mode === 'create') {
        const names = (form.name || '').split(',').map(s=>s.trim()).filter(Boolean)
        if (names.length > 1) {
          for (const n of names) {
            const payload: ColorInput = normalizeFormForSave({ name: n })
            await colorsDb.createColor(payload)
          }
          if (!opts.silent) toastMsg('success', messages.toast.color.createdMany(names.length))
        } else {
          const payload: ColorInput = normalizeFormForSave(form)
          await colorsDb.createColor(payload)
          if (!opts.silent) toastMsg('success', messages.toast.color.created)
        }
        if (opts.close !== false) {
            setDrawerOpen(false)
            setMode('idle')
        }
      } else if (mode === 'edit' && selected) {
        const payload: ColorInput = normalizeFormForSave(form)
        await colorsDb.updateColor({ id: selected.id, ...payload })
        if (!opts.silent) toastMsg('success', messages.toast.color.updated)
        
        initialFormRef.current = form
        
        if (opts.close) {
            setDrawerOpen(false)
            setMode('idle')
        }
      }
      await load()
      return true
    } finally {
      setSubmitting(false)
    }
  }

  async function submit() {
    await saveColor({ close: mode === 'create' })
  }

  function normalizeFormForSave(f: ColorInput): ColorInput {
    const hex = (f.hex || '').trim()
    const normHex = hex ? (hex.startsWith('#') ? hex : `#${hex}`) : undefined
    
    // Se HEX foi fornecido mas LAB não, converter automaticamente
    let labL = f.labL
    let labA = f.labA
    let labB = f.labB
    
    const hasAnyLab = labL != null || labA != null || labB != null
    if (normHex && !hasAnyLab) {
      const lab = hexToLab(normHex)
      if (lab) {
        labL = lab.L
        labA = lab.a
        labB = lab.b
      }
    }
    
    return { name: f.name.trim(), hex: normHex, labL, labA, labB }
  }

  async function confirmDelete() {
    if (!anySelected) return
    const ids = Array.from(selectedIds)
    const msg = ids.length === 1 && selected
      ? messages.confirm.deleteColorOne(selected.name)
      : messages.confirm.deleteColorMany(ids.length)
    setConfirm({
      msg,
      onYes: async () => {
        for (const id of ids) {
          await colorsDb.deleteColor(id)
        }
        setSelectedIds(new Set())
        await load()
        toastMsg('success', ids.length === 1 ? messages.toast.color.deletedOne : messages.toast.color.deletedMany)
      }
    })
  }

  function closeDrawer() {
    const i = initialFormRef.current
    const dirty = i && (
      normName(i.name) !== normName(form.name || '') ||
      (i.hex || '') !== (form.hex || '') ||
      i.labL !== form.labL || i.labA !== form.labA || i.labB !== form.labB
    )
    if (dirty) {
      setConfirm({
        msg: messages.confirm.discard + '\n',
        onYes: () => {
          setDrawerOpen(false)
          setMode('idle')
        }
      })
    } else {
      setDrawerOpen(false)
      setMode('idle')
    }
  }

  function toastMsg(type: 'success'|'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 1800)
  }

  const labsById = useMemo(() => {
    const map = new Map<string, { L: number; a: number; b: number }>()
    for (const it of items) {
      const lab = labFromPartial({ hex: it.hex, labL: it.labL, labA: it.labA, labB: it.labB })
      if (lab && it.id) map.set(it.id, lab)
    }
    return map
  }, [items])

  // Cálculo de LAB a partir das entradas de teste (HEX tem precedência)
  const testLab = useMemo(() => {
    const hex = (testHex || '').trim()
    const hasHex = hex && /^#?[0-9a-fA-F]{6}$/.test(hex)
    if (hasHex) {
      const hx = hex.startsWith('#') ? hex : `#${hex}`
      return hexToLab(hx) || undefined
    }
    const L = testLabL.trim() === '' ? undefined : Number(testLabL)
    const A = testLabA.trim() === '' ? undefined : Number(testLabA)
    const B = testLabB.trim() === '' ? undefined : Number(testLabB)
    if ([L, A, B].every(v => typeof v === 'number' && Number.isFinite(v as number))) {
      return { L: L as number, a: A as number, b: B as number }
    }
    return undefined
  }, [testHex, testLabL, testLabA, testLabB])

  // Vizinha mais próxima por ΔE00 para a cor em teste
  const testNearest = useMemo(() => {
    if (!testLab) return null as null | { hit: Color; dE: number }
    let best = Infinity
    let hitId: string | null = null
    for (const [id, otherLab] of labsById.entries()) {
      const d = ciede2000(testLab, otherLab)
      if (d < best) { best = d; hitId = id }
    }
    if (!Number.isFinite(best) || !hitId) return null
    const hit = items.find(x => x.id === hitId) || null
    if (!hit) return null
    return { hit, dE: best }
  }, [testLab, labsById, items])

  function familyOf(c: Color): string {
    return detectFamilyFromName(c.name) || 'Outros'
  }

  function displayName(c: Color): string {
    const fam = familyOf(c) // família 100% pela inferência LAB (sem interferência do nome)
    if (fam === '—') return (c.name || '').trim()
    const trimmed = (c.name || '').trim()
    // Remover qualquer família reconhecida no início do nome já digitado
    // IMPORTANTE: usar \\s no literal de string para virar \s no RegExp
  const anyFamRegex = new RegExp('^(' + FAMILY_TOKENS.join('|') + ')(?:\\s+|$)', 'i')
    const rest = trimmed.replace(anyFamRegex, '').trim()
    return rest ? `${fam} ${rest}` : fam
  }

  function deNearest(c: Color): string {
    if (!c.id) return '—'
    const me = labsById.get(c.id)
    if (!me) return '—'
    let best = Infinity
    let hitId: string | null = null
    for (const [id, otherLab] of labsById.entries()) {
      if (id === c.id) continue
      const d = ciede2000(me, otherLab)
      if (d < best) { best = d; hitId = id }
    }
    if (!Number.isFinite(best) || best === Infinity) return '—'
    const val = best.toFixed(1)
    if (best < deltaThreshold && hitId) {
      const other = items.find(x => x.id === hitId)
      if (other) return `${val} (Conflito: ${other.name})`
    }
    return val
  }

  function hasConflict(c: Color): boolean {
    if (!c.id) return false
    const me = labsById.get(c.id)
    if (!me) return false
    let best = Infinity
    for (const [id, otherLab] of labsById.entries()) {
      if (id === c.id) continue
      const d = ciede2000(me, otherLab)
      if (d < best) best = d
    }
    return Number.isFinite(best) && best < deltaThreshold
  }

  return (
    <Container padY={12}>
      <section style={{display:'grid', gap:DS.spacing(6)}}>
      {/* Painel: Teste de cores (colorímetro) */}
      <div style={{display:'grid', gap:DS.spacing(4), padding:DS.spacing(6), border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, background:DS.color.surface, boxShadow: DS.shadow.sm}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h2 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.lg, fontWeight:DS.font.weightSemibold}}>Teste de cores</h2>
          <div style={{display:'flex', alignItems:'center', gap:8, color:DS.color.textSecondary, fontSize:DS.font.size.sm}}>
            <span>Limiar ΔE atual:</span>
            <span style={{color:DS.color.textPrimary, fontWeight:DS.font.weightMedium}}>{deltaThreshold.toFixed(2)}</span>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:DS.spacing(6)}}>
          <div style={{display:'grid', gap:DS.spacing(4)}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:DS.spacing(3)}}>
              <label style={{display:'grid', gap:6}}>
                <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium}}>HEX (prioritário)</span>
                <input
                  value={testHex}
                  onChange={(e)=>setTestHex(e.target.value)}
                  placeholder="#E15B55"
                  style={input()}
                  aria-label="HEX para testar"
                />
              </label>
              <label style={{display:'grid', gap:6}}>
                <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium}}>LAB L</span>
                <input
                  value={testLabL}
                  onChange={(e)=>setTestLabL(e.target.value)}
                  placeholder="55"
                  style={input()}
                  aria-label="LAB L para testar"
                />
              </label>
              <label style={{display:'grid', gap:6}}>
                <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium}}>LAB a</span>
                <input
                  value={testLabA}
                  onChange={(e)=>setTestLabA(e.target.value)}
                  placeholder="40"
                  style={input()}
                  aria-label="LAB a para testar"
                />
              </label>
              <label style={{display:'grid', gap:6}}>
                <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium}}>LAB b</span>
                <input
                  value={testLabB}
                  onChange={(e)=>setTestLabB(e.target.value)}
                  placeholder="20"
                  style={input()}
                  aria-label="LAB b para testar"
                />
              </label>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12, padding:DS.spacing(3), background:DS.color.surfaceAlt, borderRadius:DS.radius.md, border:`1px solid ${DS.color.borderSubtle}`}}>
              {(() => {
                const lab = testLab
                const hex = lab ? labToHex(lab) : (testHex && /^#?[0-9a-fA-F]{6}$/.test(testHex) ? (testHex.startsWith('#')? testHex : `#${testHex}`) : null)
                return (
                  <span
                    title={hex || 'Sem especificação'}
                    aria-label={hex ? `Prévia ${hex}` : 'Prévia indisponível'}
                    role="img"
                    style={{ display:'inline-block', width:32, height:32, borderRadius:DS.radius.md, background: hex || 'transparent', border: `1px solid ${DS.color.border}`, boxShadow: DS.shadow.sm }}
                  />
                )
              })()}
              <div style={{display:'grid', gap:2, color:DS.color.textSecondary, fontSize:DS.font.size.sm}}>
                <span>
                  {testLab ? (
                    <>Família inferida: <strong style={{color:DS.color.textPrimary}}>{inferFamilyFrom({ labL: testLab.L, labA: testLab.a, labB: testLab.b })}</strong></>
                  ) : (
                    <>Informe HEX ou LAB completo para testar.</>
                  )}
                </span>
                {testLab && (
                  <span style={{fontSize:DS.font.size.xs}}>HEX: <span style={{color:DS.color.textPrimary, fontFamily:'monospace'}}>{labToHex(testLab)}</span> • L={testLab.L.toFixed(1)} a={testLab.a.toFixed(1)} b={testLab.b.toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{display:'grid', gap:6, alignContent:'start'}}>
            <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium}}>Resultado da Análise</div>
            {!testLab && (
              <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm, fontStyle:'italic'}}>Aguardando dados...</div>
            )}
            {testLab && (
              <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, padding:DS.spacing(3)}}>
                {testNearest ? (
                  <div style={{display:'grid', gap:DS.spacing(2)}}>
                    <div style={{color:DS.color.textPrimary, fontSize:DS.font.size.sm}}>Mais próxima: <strong style={{fontWeight:DS.font.weightSemibold}}>{testNearest.hit.name}</strong> {testNearest.hit.sku ? <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs}}>({testNearest.hit.sku})</span> : ''}</div>
                    <div style={{
                      fontSize:DS.font.size.xs,
                      padding:`${DS.spacing(1)} ${DS.spacing(2)}`,
                      borderRadius:DS.radius.sm,
                      background: testNearest.dE <= deltaThreshold ? `${DS.color.warning}15` : DS.color.surfaceAlt,
                      color: testNearest.dE <= deltaThreshold ? '#B45309' : DS.color.textSecondary,
                      border: `1px solid ${testNearest.dE <= deltaThreshold ? '#FCD34D' : DS.color.border}`,
                      display: 'inline-block',
                      width: 'fit-content'
                    }}>
                      ΔE00 = <strong>{testNearest.dE.toFixed(2)}</strong> {testNearest.dE <= deltaThreshold ? `(Semelhante ≤ ${deltaThreshold})` : `(Distante > ${deltaThreshold})`}
                    </div>
                    <div style={{display:'flex', gap:8, marginTop:DS.spacing(2)}}>
                      {testNearest.dE <= deltaThreshold ? (
                        <>
                          <button
                            style={btn('primary')}
                            onClick={() => {
                              setSelectedIds(new Set([testNearest.hit.id!]))
                              openEdit()
                            }}
                          >Selecionar e editar</button>
                        </>
                      ) : (
                        <>
                          <button
                            style={btn('primary')}
                            onClick={() => {
                              const hex = (testHex && /^#?[0-9a-fA-F]{6}$/.test(testHex)) ? (testHex.startsWith('#') ? testHex : `#${testHex}`) : undefined
                              const pre: Partial<ColorInput> = hex ? { hex } : { labL: testLab.L, labA: testLab.a, labB: testLab.b }
                              openCreateWith(pre)
                            }}
                          >Cadastrar Nova</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm}}>Nenhuma cor cadastrada para comparar.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  <div data-testid="actions-bar-top" style={{display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20, background:DS.color.bg, paddingTop:DS.spacing(4), paddingBottom:DS.spacing(4), borderBottom:`1px solid ${DS.color.bg}`}}>
        <h1 style={{color:DS.color.textPrimary, margin: 0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight}}>{label.title}</h1>
        <div style={{display:'flex', gap: DS.spacing(2), alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <input
              aria-label="Pesquisar"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar..."
              style={{height:40, padding:`0 ${DS.spacing(3)}`, fontSize:DS.font.size.sm, fontFamily:DS.font.familySans, color:DS.color.textPrimary, background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, outline:'none', width: 240, transition:'all 0.2s'}}
              onFocus={e => e.target.style.borderColor = DS.color.focus}
              onBlur={e => e.target.style.borderColor = DS.color.border}
            />
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:`0 ${DS.spacing(3)}`, height:40, background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md}}>
            <label htmlFor="delta-th" style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs, fontWeight:DS.font.weightMedium, whiteSpace:'nowrap'}}>ΔE Limite</label>
            <input
              id="delta-th"
              aria-label="Limiar Delta E"
              type="number" step={0.1} min={0.1}
              value={deltaThreshold}
              onChange={async (e)=>{
                const val = Number(e.target.value)
                const v = Number.isFinite(val) && val > 0 ? val : 2.0
                setDeltaThreshold(v)
                try { await settingsDb.setDeltaThreshold(v) } catch {}
              }}
              style={{border:'none', background:'transparent', width: 40, fontSize:DS.font.size.sm, color:DS.color.textPrimary, fontWeight:DS.font.weightSemibold, outline:'none', textAlign:'right'}}
            />
          </div>
          <div style={{width:1, height:24, background:DS.color.border, margin:`0 ${DS.spacing(1)}`}} />
          <Button color="cyan" onClick={openCreate} variant="filled" size="xs" h={40}>+ {label.new}</Button>
          <Button variant="default" onClick={openEdit} disabled={!exactlyOneSelected} size="xs" h={40}>{label.edit}</Button>
          <Button color="red" onClick={confirmDelete} disabled={!anySelected} variant="filled" size="xs" h={40}>{label.delete}</Button>
          <Button
            variant="default"
            size="xs" h={40}
            onClick={() => {
              // Prévia para confirmar quantidade afetada
              const candidates = items.map((c) => {
                const current = (c.name || '').trim()
                const desired = displayName(c).trim()
                return { current, desired }
              })
              const toChange = candidates.filter(x => x.desired && x.desired !== x.current)
              const n = toChange.length
              setConfirm({
                msg: n === 0
                  ? 'Nenhuma cor precisa ser renomeada com base na família do HueWheel.'
                  : `Aplicar família do HueWheel nos nomes? Isso renomeará ${n} ${n===1? 'cor' : 'cores'}. Continuar?`,
                onYes: async () => { setConfirm(null); await reclassifyAndSave() }
              })
            }}
            aria-label="Reclassificar nomes"
            disabled={submitting}
          >
            Reclassificar
          </Button>

        </div>
      </div>

      {/* Barra de resumo de seleção */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:DS.font.size.sm, color:DS.color.textSecondary, paddingBottom:DS.spacing(2)}}>
        <span>Selecionados: <strong style={{color:DS.color.textPrimary}}>{selectedIds.size}</strong></span>
        {selected && <span style={{color:DS.color.textPrimary}}>Editando alvo: <strong>{displayName(selected)}</strong></span>}
      </div>
      <div style={{overflow:'hidden', border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, boxShadow:DS.shadow.sm}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{background:DS.color.surfaceAlt, borderBottom:`1px solid ${DS.color.border}`}}>
            <tr>
              <th style={{...th(), width: 48, textAlign:'center'}}>
                <HeaderSelectAll
                  allIds={filteredSorted.map(i=>i.id!)}
                  selectedIds={selectedIds}
                  onChange={(next: string[]) => setSelectedIds(new Set(next))}
                />
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('name')} style={thBtn(sort.key==='name')}>Nome da cor {arrow('name', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('hex')} style={thBtn(sort.key==='hex')}>Hex {arrow('hex', sort)}</button>
              </th>
              <th style={th()}>
                Família
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('sku')} style={thBtn(sort.key==='sku')}>SKU {arrow('sku', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('labL')} style={thBtn(sort.key==='labL')}>L {arrow('labL', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('labA')} style={thBtn(sort.key==='labA')}>a {arrow('labA', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('labB')} style={thBtn(sort.key==='labB')}>b {arrow('labB', sort)}</button>
              </th>
              <th style={th()}>
                dE00 (prox)
              </th>
            </tr>
          </thead>
          <tbody style={{background:DS.color.surface}}>
            {filteredSorted.map((it, rowIndex) => {
              const isChecked = selectedIds.has(it.id!)
              return (
                <tr key={it.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.tagName.toLowerCase() === 'input') return
                    const add = (e.ctrlKey || (e as any).metaKey) as boolean
                    const range = e.shiftKey
                    if (range) {
                      const anchor = anchorIndexRef.current ?? rowIndex
                      selectRange(anchor, rowIndex, add)
                    } else if (add) {
                      toggleOne(it.id!)
                    } else {
                      singleSelect(it.id!)
                    }
                    anchorIndexRef.current = rowIndex
                  }}
                  style={{ 
                    background: isChecked? DS.color.bgHover : 'transparent', 
                    cursor:'pointer', 
                    transition: 'all .1s ease',
                    borderBottom: `1px solid ${DS.color.borderSubtle}`
                  }}
                  onMouseEnter={e => { if(!isChecked) e.currentTarget.style.background = DS.color.surfaceAlt }}
                  onMouseLeave={e => { if(!isChecked) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{...td(), width:48, textAlign:'center'}}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${it.name}`}
                      checked={isChecked}
                      onClick={(e) => {
                        e.stopPropagation()
                        const me = e as unknown as MouseEvent
                        const add = me.ctrlKey || (me as any).metaKey
                        const range = me.shiftKey
                        if (range) {
                          const anchor = anchorIndexRef.current ?? rowIndex
                          selectRange(anchor, rowIndex, add)
                        } else if (add) {
                          toggleOne(it.id!)
                        } else {
                          // clicar no checkbox sem modificadores mantém o comportamento de toggle
                          toggleOne(it.id!)
                        }
                        anchorIndexRef.current = rowIndex
                      }}
                      onChange={() => { /* handled in onClick to read modifiers */ }}
                      style={{cursor:'pointer', width:16, height:16, accentColor:DS.color.accent}}
                    />
                  </td>
                  <td style={td()}>
                    {(() => {
                      const l = labsById.get(it.id!)
                      const hx = it.hex ? it.hex : (l ? labToHex(l) : null)
                      const conflict = hasConflict(it)
                      return (
                        <span
                          title={hx || 'Sem especificação'}
                          aria-label={hx ? `Prévia da cor ${hx}` : 'Prévia da cor indisponível'}
                          role="img"
                          style={{
                            display:'inline-block',
                            width:16, height:16,
                            borderRadius:4,
                            background: hx || 'transparent',
                            border: `1px solid ${DS.color.border}`,
                            boxShadow: conflict ? `0 0 0 2px ${DS.color.warning}, 0 0 0 4px ${DS.color.bg}` : undefined,
                            verticalAlign:'text-bottom',
                            marginRight:10
                          }}
                        />
                      )
                    })()}
                    <span style={{fontWeight:DS.font.weightMedium}}>{displayName(it)}</span>
                  </td>
                  <td style={{...td(), fontFamily:'monospace', fontSize:DS.font.size.sm, color:DS.color.textSecondary}}>{(() => {
                    if (it.hex) return it.hex
                    const l = labsById.get(it.id!)
                    return l ? labToHex(l) : '—'
                  })()}</td>
                  <td style={td()}>{familyOf(it)}</td>
                  <td style={{...td(), fontFamily:'monospace', fontSize:DS.font.size.sm}}>{it.sku}</td>
                  <td style={{...td(), fontFamily:'monospace', fontSize:DS.font.size.sm, color:DS.color.textSecondary}}>{(() => { const l = labsById.get(it.id!); return l ? l.L.toFixed(1) : (it.labL ?? '—') })()}</td>
                  <td style={{...td(), fontFamily:'monospace', fontSize:DS.font.size.sm, color:DS.color.textSecondary}}>{(() => { const l = labsById.get(it.id!); return l ? l.a.toFixed(1) : (it.labA ?? '—') })()}</td>
                  <td style={{...td(), fontFamily:'monospace', fontSize:DS.font.size.sm, color:DS.color.textSecondary}}>{(() => { const l = labsById.get(it.id!); return l ? l.b.toFixed(1) : (it.labB ?? '—') })()}</td>
                  <td style={{...td(), fontSize:DS.font.size.sm}}>{deNearest(it)}</td>
                </tr>
              )})}
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{...td(), color:DS.color.textSecondary, textAlign:'center', padding:DS.spacing(8)}}>Nenhuma cor cadastrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <div style={drawerOverlay()} role="dialog" aria-modal="true" onClick={closeDrawer}>
          <div style={drawerPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'grid', gap:DS.spacing(4)}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <h2 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.xl, fontWeight:DS.font.weightSemibold}}>{mode==='create'? 'Nova cor' : 'Editar cor'}</h2>
                {mode === 'edit' && (
                  <div style={{display:'flex', gap:DS.spacing(1)}}>
                    <Button 
                      variant="default" 
                      size="xs" 
                      disabled={selectedIndex <= 0}
                      onClick={() => navigate(-1)}
                      title="Anterior (Ctrl+Left)"
                    >
                      ◀
                    </Button>
                    <Button 
                      variant="default" 
                      size="xs" 
                      disabled={selectedIndex < 0 || selectedIndex >= filteredSorted.length - 1}
                      onClick={() => navigate(1)}
                      title="Próxima (Ctrl+Right)"
                    >
                      ▶
                    </Button>
                  </div>
                )}
              </div>
              {Object.keys(errors).length>0 && (
                <div style={{background:`${DS.color.danger}15`, color:DS.color.danger, padding:DS.spacing(3), borderRadius:DS.radius.md, fontSize:DS.font.size.sm, border:`1px solid ${DS.color.danger}30`}} aria-live="polite">
                  Verifique os campos destacados
                </div>
              )}

              {(() => { const msg = conflictMessage(form, { forEditId: mode==='edit'? selected?.id ?? null : null }); return msg ? (
                <div style={{background:`${DS.color.warning}15`, color:DS.color.warning, padding:DS.spacing(3), borderRadius:DS.radius.md, fontSize:DS.font.size.sm, border:`1px solid ${DS.color.warning}30`}} aria-live="polite">
                  {msg}
                </div>
              ) : null })()}

              <Field label="Nome da cor" error={errors.name}>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e=>{ const next = { ...form, name: e.target.value }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                  onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                  style={input()}
                  placeholder="Vermelho Razai"
                  aria-invalid={!!errors.name}
                />
                {form.name.includes(',') && (
                  <small style={{ color:DS.color.textSecondary, fontSize:DS.font.size.xs }}>
                    Vários nomes detectados. Serão criadas {form.name.split(',').map(s=>s.trim()).filter(Boolean).length} cores sem especificação de HEX/LAB. Você poderá informar pelo botão Editar depois.
                  </small>
                )}
              </Field>

              <div style={{display:'grid', gridTemplateColumns:'1fr', gap: DS.spacing(4)}}>
                <Field label="HEX" error={errors.colorSpec}>
                  <input
                    ref={hexRef}
                    value={form.hex || ''}
                    onChange={e=>{ const next = { ...form, hex: e.target.value }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                    onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                    style={input()}
                    placeholder="#FF0000"
                    aria-invalid={!!errors.colorSpec}
                  />
                </Field>

                <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: DS.spacing(3)}}>
                  <Field label="LAB L" error={errors.colorSpec}>
                    <input
                      ref={labLRef}
                      value={form.labL ?? ''}
                      onChange={e=>{ const next = { ...form, labL: e.target.value ? Number(e.target.value) : undefined }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                      onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                      type="number"
                      style={input()}
                      placeholder="50"
                      aria-invalid={!!errors.colorSpec}
                    />
                  </Field>
                  <Field label="LAB a" error={errors.colorSpec}>
                    <input
                      ref={labARef}
                      value={form.labA ?? ''}
                      onChange={e=>{ const next = { ...form, labA: e.target.value ? Number(e.target.value) : undefined }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                      onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                      type="number"
                      style={input()}
                      placeholder="20"
                      aria-invalid={!!errors.colorSpec}
                    />
                  </Field>
                  <Field label="LAB b" error={errors.colorSpec}>
                    <input
                      ref={labBRef}
                      value={form.labB ?? ''}
                      onChange={e=>{ const next = { ...form, labB: e.target.value ? Number(e.target.value) : undefined }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                      onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                      type="number"
                      style={input()}
                      placeholder="-10"
                      aria-invalid={!!errors.colorSpec}
                    />
                  </Field>
                </div>
              </div>

              <div data-testid="drawer-actions" style={{display:'flex', gap:DS.spacing(3), marginTop:DS.spacing(4), position:'sticky', bottom:0, background:DS.color.bg, paddingTop:DS.spacing(4), paddingBottom:DS.spacing(4), borderTop:`1px solid ${DS.color.border}`}}>
                <Button variant="default" onClick={closeDrawer} size="md" fullWidth>{label.cancel}</Button>
                {(() => { const invalid = Object.keys(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null })).length>0; return (
                  <Button color="cyan" onClick={submit} disabled={submitting || invalid} aria-disabled={submitting || invalid} size="md" fullWidth>
                    {mode==='create'? label.add : label.save}
                  </Button>
                )})()}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div style={drawerOverlay()} role="dialog" aria-modal="true" onClick={()=>setConfirm(null)}>
          <div style={{...drawerPanel(), width:'min(92vw, 400px)', height:'auto', borderRadius:DS.radius.lg}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'grid', gap:DS.spacing(6)}}>
              <p style={{color:DS.color.textPrimary, fontSize:DS.font.size.base, lineHeight:DS.font.lineHeight.relaxed, margin:0}}>{confirm.msg}</p>
              <div style={{display:'flex', gap:DS.spacing(3), justifyContent:'flex-end'}}>
                <button onClick={()=>setConfirm(null)} style={btn('ghost')}>Não</button>
                <button onClick={()=>{ const y = confirm.onYes; setConfirm(null); y(); }} style={btn('danger')}>Sim</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', right:24, bottom:24, background: toast.type==='success'? DS.color.success : DS.color.danger, color:'#fff', padding:`${DS.spacing(3)} ${DS.spacing(4)}`, borderRadius:DS.radius.md, boxShadow:DS.shadow.lg, zIndex:100, fontWeight:DS.font.weightMedium }} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </section>
    </Container>
  )
}

function th(): React.CSSProperties { return { padding:`${DS.spacing(3)} ${DS.spacing(4)}`, borderBottom:`2px solid ${DS.color.border}`, fontWeight:DS.font.weightMedium, fontSize:DS.font.size.xs, color:DS.color.textSecondary, textTransform:'uppercase', letterSpacing:DS.font.letterSpacing.wide, textAlign:'left' } }
function td(): React.CSSProperties { return { padding:`${DS.spacing(3)} ${DS.spacing(4)}`, borderBottom:`1px solid ${DS.color.borderSubtle}`, color:DS.color.textPrimary, fontSize:DS.font.size.sm } }
function input(): React.CSSProperties { return { width:'100%', padding:`0 ${DS.spacing(3)}`, borderRadius:DS.radius.md, border:`1px solid ${DS.color.border}`, background:DS.color.surface, color:DS.color.textPrimary, fontSize:DS.font.size.base, height:40, outline:'none', transition:'all 0.2s' } }
function btn(kind: 'primary'|'ghost'|'danger' = 'ghost', disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = { padding:`${DS.spacing(2)} ${DS.spacing(4)}`, borderRadius:DS.radius.md, border:`1px solid ${DS.color.border}`, background:DS.color.surface, color:DS.color.textPrimary, cursor: disabled? 'not-allowed':'pointer', fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium, transition:'all 0.2s' }
  if (kind==='primary') return { ...base, background:DS.color.accent, border:`1px solid ${DS.color.accent}`, color:'#fff' }
  if (kind==='danger') return { ...base, background:DS.color.danger, border:`1px solid ${DS.color.danger}`, color:'#fff' }
  return base
}
function drawerOverlay(): React.CSSProperties { return { position:'fixed', inset:0, background:DS.color.overlay, display:'flex', justifyContent:'flex-end', zIndex:200, backdropFilter:'blur(2px)' } }
function drawerPanel(): React.CSSProperties { return { width:'min(92vw, 480px)', height:'100%', background:DS.color.bg, borderLeft:`1px solid ${DS.color.border}`, padding:DS.spacing(6), boxShadow:DS.shadow.xl, overflowY:'auto' } }

function thBtn(active?: boolean): React.CSSProperties {
  return { background:'transparent', color: active? DS.color.textPrimary : DS.color.textSecondary, border:'none', padding:0, cursor:'pointer', fontWeight:DS.font.weightMedium, fontSize:'inherit', textTransform:'inherit', letterSpacing:'inherit' }
}

function arrow(key: any, sort: { key: any; dir: 'asc'|'desc' }) {
  if (sort.key !== key) return ''
  return sort.dir === 'asc' ? '▲' : '▼'
}

function Field(props: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{display:'grid', gap:DS.spacing(2)}}>
      <span style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium}}>{props.label}</span>
      {props.children}
      {props.error && <span style={{color:DS.color.danger, fontSize:DS.font.size.xs}}>{props.error}</span>}
    </label>
  )
}

function HeaderSelectAll(props: { allIds: string[]; selectedIds: Set<string>; onChange: (ids: string[]) => void }) {
  const { allIds, selectedIds, onChange } = props
  const ref = useRef<HTMLInputElement>(null)
  const total = allIds.length
  const selectedCount = allIds.filter(id => selectedIds.has(id)).length
  const allChecked = total > 0 && selectedCount === total
  const someChecked = selectedCount > 0 && selectedCount < total

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someChecked
    }
  }, [someChecked])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Selecionar todos"
      checked={allChecked}
      disabled={total === 0}
      onChange={(e) => {
        const checked = e.target.checked
        if (checked) onChange(allIds)
        else onChange([])
      }}
      style={{cursor:'pointer', width:16, height:16, accentColor:DS.color.accent}}
    />
  )
}

