import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { db } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import { messages } from '@/lib/messages'
import type { Tissue, TissueInput } from '@/types/tissue'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'

type Mode = 'idle' | 'create' | 'edit'

const label = {
  title: 'Cadastro de Tecidos',
  new: 'novo tecido',
  edit: 'editar',
  delete: 'excluir',
  add: 'adicionar tecido',
  save: 'salvar',
  cancel: 'cancelar',
}

export default function Tissues() {
  const [items, setItems] = useState<Tissue[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [form, setForm] = useState<TissueInput>({ name: '', width: 0, composition: '', color: undefined })
  const [errors, setErrors] = useState<{ name?: string; width?: string; composition?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null)
  const [query, setQuery] = useState('')
  type SortKey = 'createdAt' | 'name' | 'width' | 'composition' | 'sku'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const initialFormRef = useRef<TissueInput | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const widthRef = useRef<HTMLInputElement>(null)
  const compRef = useRef<HTMLInputElement>(null)
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
        normalizeForSearch(it.name || '').includes(q) ||
        normalizeForSearch(it.sku || '').includes(q) ||
        normalizeForSearch(it.composition || '').includes(q)
      )
    }
    const s = [...arr]
    const dirMul = sort.dir === 'asc' ? 1 : -1
    s.sort((a, b) => {
      const k = sort.key
      let va: any, vb: any
      if (k === 'width') { va = a.width; vb = b.width }
      else if (k === 'createdAt') { va = a.createdAt; vb = b.createdAt }
      else if (k === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase() }
  else if (k === 'composition') { va = (a.composition || '').toLowerCase(); vb = (b.composition || '').toLowerCase() }
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
    const list = await db.listTissues()
    setItems(list)
  }

  function openCreate() {
    setMode('create')
    const base = { name: '', width: 0, composition: '', color: undefined }
    setForm(base)
    // Mostrar imediatamente os erros para orientar (largura e composição obrigatórias)
    setErrors(computeErrors(base))
    setDrawerOpen(true)
    initialFormRef.current = base
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function openEdit() {
    if (!selected) return
    setMode('edit')
    setForm({ name: selected.name, width: selected.width, composition: selected.composition, color: selected.color })
    setErrors({})
    setDrawerOpen(true)
    initialFormRef.current = { name: selected.name, width: selected.width, composition: selected.composition, color: selected.color }
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function normName(s: string) {
    return s
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  function computeErrors(input: TissueInput, opts?: { forEditId?: string | null }) {
    const e: { name?: string; width?: string; composition?: string } = {}
    const nameTrim = input.name.trim()
    if (!nameTrim) e.name = 'Obrigatório'
    if (nameTrim.length < 2) e.name = e.name || 'Mínimo 2 caracteres'
    if (nameTrim.length > 120) e.name = e.name || 'Máximo 120 caracteres'
    if (!Number.isFinite(input.width)) e.width = 'Informe um número'
    else if (!Number.isInteger(input.width)) e.width = 'Somente inteiros'
    else if (input.width <= 0) e.width = 'Informe um número > 0'
    else if (input.width < 50 || input.width > 300) e.width = 'Faixa permitida: 50–300 cm'
    if (!input.composition.trim()) e.composition = 'Obrigatório'

    // Duplicidade de nome (case-insensitive, espaços normalizados)
    const me = opts?.forEditId ?? null
    const target = normName(input.name)
    const dup = items.some(it => (me ? it.id !== me : true) && normName(it.name) === target)
    if (!e.name && dup) e.name = 'Nome já cadastrado'
    return e
  }

  function validate(input: TissueInput, opts?: { forEditId?: string | null; focus?: boolean }) {
    const e = computeErrors(input, { forEditId: opts?.forEditId ?? null })
    setErrors(e)
    if (opts?.focus) {
      if (e.name) nameRef.current?.focus()
      else if (e.width) widthRef.current?.focus()
      else if (e.composition) compRef.current?.focus()
    }
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (submitting) return
    const ok = validate(form, { forEditId: mode==='edit' ? selected?.id ?? null : null, focus: true })
    if (!ok) return
    setSubmitting(true)
    const op = mode === 'create' ? 'create' : mode === 'edit' ? 'edit' : 'idle'
    const start = performance.now()
    const TIMEOUT_MS = 5000
    // Executa a operação com timeout; se estourar, liberamos a UI e mostramos erro.
    const opPromise: Promise<'created'|'updated'|'noop'> = (async () => {
      if (op === 'create') {
        await db.createTissue(form)
        return 'created' as const
      } else if (op === 'edit' && selected) {
        await db.updateTissue({ id: selected.id, ...form })
        return 'updated' as const
      }
      return 'noop' as const
    })()

    const res: 'created'|'updated'|'noop'|'TIMEOUT'|'ERROR' = await Promise.race([
      opPromise.catch((e): 'ERROR' => {
        console.error('Falha na operação de tecido', e)
        return 'ERROR'
      }),
      new Promise<'TIMEOUT'>(resolve => setTimeout(() => resolve('TIMEOUT'), TIMEOUT_MS))
    ])

    if (res === 'TIMEOUT') {
      console.warn('Tempo excedido ao salvar tecido (>5s). Liberando interface.')
      toastMsg('error', 'Demora ao salvar. Tente novamente.')
      setSubmitting(false)
      return
    }
    if (res === 'ERROR') {
      toastMsg('error', messages.toast.genericError)
      setSubmitting(false)
      return
    }

    // Sucesso
    if (res === 'created') toastMsg('success', messages.toast.tissue.created)
    if (res === 'updated') toastMsg('success', messages.toast.tissue.updated)
    setDrawerOpen(false)
    setMode('idle')
    try {
      await load()
    } catch (e) {
      console.error('Falha ao recarregar lista de tecidos', e)
    }
    const end = performance.now()
    console.debug(`submit tecido concluído em ${(end-start).toFixed(0)}ms`)
    setSubmitting(false)
  }

  async function confirmDelete() {
    if (!anySelected) return
    const ids = Array.from(selectedIds)
    const msg = ids.length === 1 && selected
      ? messages.confirm.deleteTissueOne(selected.name)
      : messages.confirm.deleteTissueMany(ids.length)
    setConfirm({
      msg,
      onYes: async () => {
        for (const id of ids) {
          await db.deleteTissue(id)
        }
        setSelectedIds(new Set())
        await load()
        toastMsg('success', ids.length === 1 ? messages.toast.tissue.deletedOne : messages.toast.tissue.deletedMany)
      }
    })
  }

  function closeDrawer() {
  const initial = initialFormRef.current
  const dirty = initial && (normName(initial.name) !== normName(form.name) || initial.width !== form.width || (initial.composition || '').trim() !== form.composition.trim())
    if (dirty) {
      setConfirm({
  msg: messages.confirm.discard,
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

  return (
    <Container padY={12}>
    <section style={{display:'grid', gap: DS.spacing(6)}}>
      {/* Seção superior - responsiva */}
      <div style={{
        display:'flex', flexDirection:'column', gap: DS.spacing(4),
        position: 'sticky', top: 0, zIndex: 20, background: DS.color.bg,
        paddingTop: DS.spacing(2), paddingBottom: DS.spacing(4)
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap: DS.spacing(3)}}>
          <h1 style={{color: DS.color.textPrimary, margin: 0, fontSize: DS.font.size.display, fontWeight: DS.font.weightLight, letterSpacing: DS.font.letterSpacing.tight}}>{label.title}</h1>
        </div>
        <div style={{display:'flex', gap: DS.spacing(3), alignItems:'center', flexWrap:'wrap'}}>
          <div style={{position:'relative', flex:'1 1 200px', minWidth: 200, maxWidth: 320}}>
            <input
              aria-label="Pesquisar"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar por nome, SKU..."
              style={{height: 40, padding: `0 ${DS.spacing(3)}`, fontSize: DS.font.size.sm, fontFamily: DS.font.familySans, color: DS.color.textPrimary, background: DS.color.surface, border: `1px solid ${DS.color.border}`, borderRadius: DS.radius.md, outline: 'none', width: '100%', transition:'all 0.2s'}}
            />
          </div>
          <div style={{display:'flex', gap: DS.spacing(2), flexWrap:'wrap'}}>
            <Button color="cyan" onClick={openCreate} size="sm" h={40}>{label.new}</Button>
            <Button variant="default" onClick={openEdit} disabled={!exactlyOneSelected} size="sm" h={40}>{label.edit}</Button>
            <Button color="red" onClick={confirmDelete} disabled={!anySelected} variant="filled" size="sm" h={40}>{label.delete}</Button>
          </div>
        </div>
      </div>

      {/* Barra de resumo de seleção */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize: DS.font.size.sm, color: DS.color.textSecondary, background: DS.color.surface, padding: `${DS.spacing(2)} ${DS.spacing(4)}`, borderRadius: DS.radius.md, border: `1px solid ${DS.color.borderSubtle}`}}>
        <span>Selecionados: <strong style={{color: DS.color.textPrimary}}>{selectedIds.size}</strong></span>
        {selected && <span>Editando alvo: <strong style={{color: DS.color.textPrimary}}>{selected.name}</strong></span>}
      </div>

      {/* Seção da tabela */}
      <div style={{overflow:'auto', border:`1px solid ${DS.color.border}`, borderRadius: DS.radius.lg, maxHeight:'calc(100vh - 240px)', boxShadow: DS.shadow.sm}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{position:'sticky', top:0, zIndex:10, background: DS.color.surfaceAlt, color: DS.color.textSecondary, textAlign:'left'}}>
            <tr>
              <th style={{...th(), width: 48, textAlign:'center'}}>
                <HeaderSelectAll
                  allIds={filteredSorted.map(i=>i.id!)}
                  selectedIds={selectedIds}
                  onChange={(next: string[]) => setSelectedIds(new Set(next))}
                />
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('name')} style={thBtn(sort.key==='name')}>Nome do tecido {arrow('name', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('width')} style={thBtn(sort.key==='width')}>Largura {arrow('width', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('composition')} style={thBtn(sort.key==='composition')}>Composição {arrow('composition', sort)}</button>
              </th>
              <th style={th()}>
                <button onClick={()=>toggleSort('sku')} style={thBtn(sort.key==='sku')}>SKU_Tecido {arrow('sku', sort)}</button>
              </th>
            </tr>
          </thead>
          <tbody style={{background: DS.color.bg}}>
            {filteredSorted.map((it) => {
              const isChecked = selectedIds.has(it.id!)
              return (
        <tr key={it.id}
          onClick={(e) => {
            // avoid toggling twice if clicking checkbox
            const target = e.target as HTMLElement
            if (target.tagName.toLowerCase() === 'input') return
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
                    aria-label={`Selecionar ${it.name}`}
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
                <td style={td()}>{it.name}</td>
                <td style={td()}>{it.width} cm</td>
                <td style={td()}>{it.composition}</td>
                <td style={td()}>{it.sku}</td>
              </tr>
            )})}
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={5} style={{...td(), color:DS.color.textSecondary, textAlign:'center', padding: DS.spacing(8)}}>Nenhum tecido cadastrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de apoio */}
      {drawerOpen && (
        <div style={drawerOverlay()} role="dialog" aria-modal="true" onClick={closeDrawer}>
          <div style={drawerPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'grid', gap:DS.spacing(4)}}>
              <h2 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.xl, fontWeight:DS.font.weightSemibold}}>{mode==='create'? 'Novo tecido' : 'Editar tecido'}</h2>
              {Object.keys(errors).length>0 && (
                <div style={{background:`${DS.color.danger}15`, color:DS.color.danger, padding:DS.spacing(3), borderRadius:DS.radius.md, fontSize:DS.font.size.sm, border:`1px solid ${DS.color.danger}30`}} aria-live="polite">
                  Verifique os campos destacados
                </div>
              )}

              <Field label="Nome do tecido" error={errors.name}>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e=>{ const next = { ...form, name: e.target.value }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                  onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                  style={input()}
                  placeholder="Helanca"
                  aria-invalid={!!errors.name}
                />
              </Field>

              <Field label="Largura (cm)" error={errors.width}>
                <input
                  ref={widthRef}
                  value={String(form.width)}
                  onChange={e=>{ const next = { ...form, width: Number(e.target.value) }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                  onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                  type="number" min={0} step={1} style={input()} placeholder="160" aria-invalid={!!errors.width}
                />
                <small style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs}}>Faixa válida: 50–300. Informe um valor inteiro.</small>
              </Field>

              <Field label="Composição" error={errors.composition}>
                <input
                  ref={compRef}
                  value={form.composition}
                  onChange={e=>{ const next = { ...form, composition: e.target.value }; setForm(next); setErrors(computeErrors(next, { forEditId: mode==='edit'? selected?.id ?? null : null })) }}
                  onBlur={()=>setErrors(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null }))}
                  style={input()}
                  placeholder="96% poliéster 4% elastano"
                  aria-invalid={!!errors.composition}
                />
                <small style={{color:DS.color.textSecondary, fontSize:DS.font.size.xs}}>Campo obrigatório. Ex: 96% poliéster 4% elastano</small>
              </Field>

              {/* Campo "Cor" removido */}

              <div style={{display:'flex', gap:DS.spacing(3), marginTop:DS.spacing(4), position:'sticky', bottom:0, background:DS.color.bg, paddingTop:DS.spacing(4), paddingBottom:DS.spacing(4), borderTop:`1px solid ${DS.color.border}`}}>
                <Button variant="default" onClick={closeDrawer} size="md" fullWidth>{label.cancel}</Button>
                {(() => { const invalid = Object.keys(computeErrors(form, { forEditId: mode==='edit'? selected?.id ?? null : null })).length>0; return (
                  <Button color="cyan" onClick={submit} disabled={submitting || invalid} aria-disabled={submitting || invalid} size="md" fullWidth>
                    {submitting ? 'salvando...' : (mode==='create'? label.add : label.save)}
                  </Button>
                )})()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
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

      {/* Toast */}
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
  return sort.dir === 'asc' ? 'â–²' : 'â–¼'
}

// toggleSort function is defined inside the component to access state

function Field(props: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{display:'grid', gap: DS.spacing(2)}}>
      <span style={{color: DS.color.textSecondary, fontSize: DS.font.size.sm, fontWeight: DS.font.weightMedium}}>{props.label}</span>
      {props.children}
      {props.error && <span style={{color: DS.color.danger, fontSize: DS.font.size.xs}}>{props.error}</span>}
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
    />
  )
}

