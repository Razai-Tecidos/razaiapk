import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { db, patternsDb } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import { messages } from '@/lib/messages'
import type { Pattern, PatternInput } from '@/types/pattern'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'

type Mode = 'idle' | 'create' | 'edit'

const label = {
  title: 'Cadastro de Estampas',
  new: 'nova estampa',
  edit: 'editar',
  delete: 'excluir',
  add: 'adicionar estampa',
  save: 'salvar',
  cancel: 'cancelar',
}

export default function Patterns() {
  const [items, setItems] = useState<Pattern[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [form, setForm] = useState<PatternInput>({ family: '', name: '' })
  // Raw input for full name (supports comma-separated multi-add). Keeps UI and validation in sync.
  const [full, setFull] = useState<string>('')
  const [errors, setErrors] = useState<{ family?: string; name?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null)
  const [query, setQuery] = useState('')
  type SortKey = 'createdAt' | 'family' | 'name' | 'sku'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const nameRef = useRef<HTMLInputElement>(null)
  const initialFormRef = useRef<PatternInput | null>(null)

  const selected = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const id = Array.from(selectedIds)[0]
    return items.find(i => i.id === id) || null
  }, [items, selectedIds])
  const anySelected = selectedIds.size > 0
  const exactlyOneSelected = selectedIds.size === 1

  const filteredSorted = useMemo(() => {
    const q = normalizeForSearch(query)
    let arr = items
    if (q) {
      arr = arr.filter(it =>
        normalizeForSearch(it.family || '').includes(q) ||
        normalizeForSearch(it.name || '').includes(q) ||
        normalizeForSearch(it.sku || '').includes(q)
      )
    }
    const s = [...arr]
    const dirMul = sort.dir === 'asc' ? 1 : -1
    s.sort((a, b) => {
      const k = sort.key
      let va: any, vb: any
      if (k === 'createdAt') { va = a.createdAt; vb = b.createdAt }
      else if (k === 'family') { va = (a.family || '').toLowerCase(); vb = (b.family || '').toLowerCase() }
      else if (k === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase() }
      else { va = (a.sku || '').toLowerCase(); vb = (b.sku || '').toLowerCase() }
      if (va < vb) return -1 * dirMul
      if (va > vb) return 1 * dirMul
      return 0
    })
    return s
  }, [items, query, sort])

  function toggleSort(k: SortKey) {
    setSort(prev => prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' })
  }

  useEffect(() => {
    db.init().then(load).catch(console.error)
  }, [])

  async function load() {
    const list = await patternsDb.listPatterns()
    setItems(list)
  }

  function openCreate() {
    setMode('create')
    const base = { family: '', name: '' }
    setForm(base)
    setFull('')
    setErrors(computeErrors(base))
    setDrawerOpen(true)
    initialFormRef.current = base
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function openEdit() {
    if (!selected) return
    setMode('edit')
    setForm({ family: selected.family, name: selected.name })
    setFull(joinFullName({ family: selected.family, name: selected.name }))
    setErrors({})
    setDrawerOpen(true)
    initialFormRef.current = { family: selected.family, name: selected.name }
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function norm(s: string) { return (s || '').trim().replace(/\s+/g, ' ').toLowerCase() }

  function splitFullName(full: string): { family: string; name: string } {
    const t = (full || '').trim().replace(/\s+/g, ' ')
    if (!t) return { family: '', name: '' }
    const i = t.indexOf(' ')
    if (i === -1) return { family: t, name: '' }
    const fam = t.slice(0, i)
    const nm = t.slice(i + 1).trim()
    return { family: fam, name: nm }
  }

  function joinFullName(p: { family: string; name: string }): string {
    return [p.family, p.name].filter(Boolean).join(' ').trim()
  }

  function computeErrors(input: PatternInput, opts?: { forEditId?: string | null }) {
    const e: { family?: string; name?: string } = {}
    // Always derive from the combined full name to support auto-detect even before state fully updates
    const derived = splitFullName(joinFullName(input))
    const fam = (derived.family || '').trim()
    const nm = (derived.name || '').trim()
    if (!fam) e.family = 'Obrigatório'
    if (!nm) e.name = 'Obrigatório'
    // Duplicado: mesma família + nome (case-insensitive)
    const me = opts?.forEditId ?? null
    const dup = items.some(it => (me ? it.id !== me : true) && norm(it.family) === norm(fam) && norm(it.name) === norm(nm))
    if (!e.name && dup) e.name = 'Estampa já cadastrada nesta família'
    return e
  }

  function isValidFullInput(fullText: string, opts?: { forEditId?: string | null }) {
    const parts = (fullText || '').split(',').map(s=>s.trim()).filter(Boolean)
    if (parts.length === 0) return false
    for (const p of parts) {
      const { family, name } = splitFullName(p)
      const fam = (family||'').trim()
      const nm = (name||'').trim()
      if (!fam || !nm) return false
      // duplicate check against existing items
      const me = opts?.forEditId ?? null
      const dup = items.some(it => (me ? it.id !== me : true) && norm(it.family) === norm(fam) && norm(it.name) === norm(nm))
      if (dup) return false
    }
    return true
  }

  function validate(input: PatternInput, opts?: { forEditId?: string | null; focus?: boolean }) {
    // For create mode with comma-separated entries, validate against the raw full input
    if (mode === 'create' && (full.includes(','))) {
      const ok = isValidFullInput(full, { forEditId: opts?.forEditId ?? null })
      setErrors(ok ? {} : { name: 'Entrada inválida' })
      if (!ok && opts?.focus) nameRef.current?.focus()
      return ok
    }
    const e = computeErrors(input, { forEditId: opts?.forEditId ?? null })
    // eslint-disable-next-line no-console
    console.log('[Patterns] validate', { input, e, mode })
    setErrors(e)
    if (opts?.focus) {
      if (e.name || e.family) nameRef.current?.focus()
    }
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (submitting) return
    // eslint-disable-next-line no-console
    console.log('[Patterns] submit clicked', { mode, form })
    const ok = validate(form, { forEditId: mode==='edit' ? selected?.id ?? null : null, focus: true })
    if (!ok) return
    setSubmitting(true)
    try {
      if (mode === 'create') {
  const fullNames = ((full || joinFullName(form)) || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  console.log('[Patterns] submit create fullNames:', fullNames)
        if (fullNames.length > 1) {
          for (const fn of fullNames) {
            const { family, name } = splitFullName(fn)
            console.log('[Patterns] creating', { family, name })
            const payload: PatternInput = { family: family.trim(), name: name.trim() }
            await patternsDb.createPattern(payload)
          }
          toastMsg('success', `Criadas ${fullNames.length} estampas`)
        } else {
          const { family, name } = splitFullName(full || joinFullName(form))
          console.log('[Patterns] creating single', { family, name })
          await patternsDb.createPattern({ family: family.trim(), name: name.trim() })
          toastMsg('success', 'Estampa criada')
        }
      } else if (mode === 'edit' && selected) {
        const { family, name } = splitFullName(full || joinFullName(form))
        await patternsDb.updatePattern({ id: selected.id, family: family.trim(), name: name.trim() })
        toastMsg('success', 'Estampa atualizada')
      }
      setDrawerOpen(false)
      setMode('idle')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!anySelected) return
    const ids = Array.from(selectedIds)
    const msg = ids.length === 1 && selected
      ? `Excluir estampa ${selected.family} ${selected.name}?`
      : `Excluir ${ids.length} estampas selecionadas?`
    setConfirm({
      msg,
      onYes: async () => {
        for (const id of ids) await patternsDb.deletePattern(id)
        setSelectedIds(new Set())
        await load()
        toastMsg('success', ids.length === 1 ? 'Estampa excluída' : 'Estampas excluídas')
      }
    })
  }

  function closeDrawer() {
  const i = initialFormRef.current
  const dirty = i && (norm(i.family) !== norm(form.family) || norm(i.name) !== norm(form.name))
    if (dirty) {
      setConfirm({
        msg: messages.confirm.discard,
        onYes: () => { setDrawerOpen(false); setMode('idle') }
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

  return (
    <Container padY={12}>
      <section style={{display:'grid', gap:DS.spacing(6)}}>
      <div data-testid="actions-bar-top" style={{display:'flex', alignItems:'center', justifyContent:'space-between', position: 'sticky', top: 0, zIndex: 20, background: DS.color.bg, paddingTop: DS.spacing(2), paddingBottom: DS.spacing(4)}}>
        <h1 style={{color:DS.color.textPrimary, margin: 0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight}}>{label.title}</h1>
        <div style={{display:'flex', gap: DS.spacing(3), alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <input
              aria-label="Pesquisar"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar por família, nome, SKU..."
              style={{height:40, padding:`0 ${DS.spacing(3)}`, fontSize:DS.font.size.sm, fontFamily:DS.font.familySans, color:DS.color.textPrimary, background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, outline:'none', width: 280, transition:'all 0.2s'}}
            />
          </div>
          <div style={{height: 24, width: 1, background: DS.color.border}} />
          <Button color="cyan" onClick={openCreate} size="sm" h={40}>{label.new}</Button>
          <Button variant="default" onClick={openEdit} disabled={!exactlyOneSelected} size="sm" h={40}>{label.edit}</Button>
          <Button color="red" onClick={confirmDelete} disabled={!anySelected} variant="filled" size="sm" h={40}>{label.delete}</Button>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:DS.font.size.sm, color:DS.color.textSecondary, background: DS.color.surface, padding: `${DS.spacing(2)} ${DS.spacing(4)}`, borderRadius: DS.radius.md, border: `1px solid ${DS.color.borderSubtle}`}}>
        <span>Selecionados: <strong style={{color: DS.color.textPrimary}}>{selectedIds.size}</strong></span>
        {selected && <span>Editando alvo: <strong style={{color: DS.color.textPrimary}}>{selected.family} {selected.name}</strong></span>}
      </div>

      <div style={{overflow:'auto', border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, maxHeight:'calc(100vh - 240px)', boxShadow: DS.shadow.sm}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{position:'sticky', top:0, zIndex:10, background:DS.color.surfaceAlt, color:DS.color.textSecondary, textAlign:'left'}}>
            <tr>
              <th style={{...th(), width: 48, textAlign:'center'}}>
                <HeaderSelectAll
                  allIds={filteredSorted.map(i=>i.id!)}
                  selectedIds={selectedIds}
                  onChange={(next: string[]) => setSelectedIds(new Set(next))}
                />
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('family')} style={thBtn(sort.key==='family')}>Família {arrow('family', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('name')} style={thBtn(sort.key==='name')}>Nome {arrow('name', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('sku')} style={thBtn(sort.key==='sku')}>SKU_Estampa {arrow('sku', sort)}</button>
              </th>
            </tr>
          </thead>
          <tbody style={{background: DS.color.bg}}>
            {filteredSorted.map((it) => {
              const isChecked = selectedIds.has(it.id!)
              return (
                <tr key={it.id}
                  onClick={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (next.has(it.id!)) next.delete(it.id!)
                      else next.add(it.id!)
                      return next
                    })
                  }}
                  style={{ background: isChecked? `${DS.color.accent}10` : 'transparent', cursor:'pointer', transition: 'background-color .12s ease-out' }}>
                  <td style={{...td(), width:48, textAlign:'center'}}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${it.family} ${it.name}`}
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (checked) next.add(it.id!)
                          else next.delete(it.id!)
                          return next
                        })
                      }}
                      onClick={(e)=>e.stopPropagation()}
                      style={{cursor:'pointer', width:16, height:16, accentColor:DS.color.accent}}
                    />
                  </td>
                  <td style={td()}>{it.family}</td>
                  <td style={td()}>{[it.family, it.name].filter(Boolean).join(' ')}</td>
                  <td style={td()}>{it.sku}</td>
                </tr>
              )})}
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={4} style={{...td(), color:DS.color.textSecondary, textAlign:'center', padding: DS.spacing(8)}}>Nenhuma estampa cadastrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <div style={drawerOverlay()} role="dialog" aria-modal="true" onClick={closeDrawer}>
          <div style={drawerPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'grid', gap:DS.spacing(4)}}>
              <h2 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.xl, fontWeight:DS.font.weightSemibold}}>{mode==='create'? 'Nova estampa' : 'Editar estampa'}</h2>
              {Object.keys(errors).length>0 && (
                <div style={{background:`${DS.color.danger}15`, color:DS.color.danger, padding:DS.spacing(3), borderRadius:DS.radius.md, fontSize:DS.font.size.sm, border:`1px solid ${DS.color.danger}30`}} aria-live="polite">
                  Verifique os campos destacados
                </div>
              )}

              <Field label="Nome da estampa" error={errors.name || errors.family}>
                <input
                  ref={nameRef}
                  value={full}
                  onChange={e=>{
                    const v = e.target.value
                    setFull(v)
                    const { family, name } = splitFullName(v)
                    const next = { family, name }
                    setForm(next)
                    if (mode==='edit') setErrors(computeErrors(next, { forEditId: selected?.id ?? null }))
                  }}
                  onBlur={()=>{
                    if (mode==='edit') setErrors(computeErrors(form, { forEditId: selected?.id ?? null }))
                  }}
                  style={input()}
                  placeholder="Jardim Pink"
                  aria-invalid={!!(errors.name || errors.family)}
                />
                {(full||'').includes(',') && (
                  <small style={{ color:DS.color.textSecondary, fontSize:DS.font.size.xs }}>
                    Vários nomes detectados. Serão criadas {(full||'').split(',').map((s: string)=>s.trim()).filter(Boolean).length} estampas. A família será a primeira palavra de cada nome.
                  </small>
                )}
              </Field>

              <div data-testid="drawer-actions" style={{display:'flex', gap:DS.spacing(3), marginTop:DS.spacing(4), position:'sticky', bottom:0, background:DS.color.bg, paddingTop:DS.spacing(4), paddingBottom:DS.spacing(4), borderTop:`1px solid ${DS.color.border}`}}>
                <Button variant="default" onClick={closeDrawer} size="md" fullWidth>{label.cancel}</Button>
                {(() => { 
                  const invalid = mode==='create' && (full.includes(','))
                    ? !isValidFullInput(full, { forEditId: null })
                    : Object.keys(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null })).length>0;
                  return (
                  <Button color="cyan" onClick={submit} disabled={submitting || invalid} aria-disabled={submitting || invalid} size="md" fullWidth>
                    {submitting ? 'salvando...' : (mode==='create'? label.add : label.save)}
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
    if (ref.current) { ref.current.indeterminate = someChecked }
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
    />
  )
}

