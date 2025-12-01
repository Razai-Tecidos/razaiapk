import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@mantine/core'
import { db, patternsDb, patternLinksDb } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import type { Pattern } from '@/types/pattern'
import type { Tissue } from '@/types/tissue'
import type { TecidoEstampaView } from '@/types/tecidoEstampa'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'

export default function TecidoEstampaPage() {
  const [tissues, setTissues] = useState<Tissue[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [links, setLinks] = useState<TecidoEstampaView[]>([])
  const [tissueId, setTissueId] = useState<string>('')
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [filterTissue, setFilterTissue] = useState<string>('')
  const [filterFamily, setFilterFamily] = useState<string>('')
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set())
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    db.init().then(async () => {
      const [ts, ps, ls] = await Promise.all([db.listTissues(), patternsDb.listPatterns(), patternLinksDb.list()])
      setTissues(ts)
      setPatterns(ps)
      setLinks(ls)
      if (ts.length && !tissueId) setTissueId(ts[0].id)
    })
  }, [])

  const filteredPatterns = useMemo(() => {
    const q = normalizeForSearch(query)
    if (!q) return patterns
    return patterns.filter(p => normalizeForSearch(p.family + ' ' + p.name).includes(q) || normalizeForSearch(p.sku || '').includes(q))
  }, [patterns, query])

  const families = useMemo(() => {
    const set = new Set<string>()
    for (const p of patterns) {
      if (p.family) set.add(p.family)
    }
    return Array.from(set).sort()
  }, [patterns])

  const filteredLinks = useMemo(() => {
    return links.filter(l => (
      (!filterTissue || l.tissueId === filterTissue) &&
      (!filterFamily || l.patternFamily === filterFamily)
    ))
  }, [links, filterTissue, filterFamily])

  async function refreshLinks() {
    setLinks(await patternLinksDb.list())
  }

  async function createLinks() {
    if (!tissueId || selectedPatternIds.size === 0) return
    setBusy(true)
    try {
      const { created, duplicates } = await patternLinksDb.createMany(tissueId, Array.from(selectedPatternIds))
      setToast(`Criados: ${created}. Duplicados: ${duplicates}.`)
      setTimeout(()=>setToast(null), 1800)
      setSelectedPatternIds(new Set())
      await refreshLinks()
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(link: TecidoEstampaView) {
    setStatusUpdating(s => new Set(s).add(link.id))
    try {
      await patternLinksDb.updateStatus(link.id, link.status === 'Ativo' ? 'Inativo' : 'Ativo')
      await refreshLinks()
    } finally {
      setStatusUpdating(s => { const n = new Set(s); n.delete(link.id); return n })
    }
  }

  async function deleteLink(id: string) {
    setDeletingIds(s => new Set(s).add(id))
    try {
      await patternLinksDb.delete(id)
      await refreshLinks()
    } finally {
      setDeletingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function deleteSelectedLinks() {
    if (selectedLinkIds.size === 0) return
    const sure = window.confirm(`Deseja excluir ${selectedLinkIds.size} vínculo(s) selecionado(s)?`)
    if (!sure) return
    const ids = Array.from(selectedLinkIds)
    for (const id of ids) {
      setDeletingIds(s => new Set(s).add(id))
    }
    try {
      await Promise.all(ids.map(id => patternLinksDb.delete(id)))
      setToast(`${ids.length} vínculo(s) excluído(s).`)
      setTimeout(() => setToast(null), 1800)
      setSelectedLinkIds(new Set())
      await refreshLinks()
    } finally {
      for (const id of ids) {
        setDeletingIds(s => { const n = new Set(s); n.delete(id); return n })
      }
    }
  }

  return (
    <Container padY={12}>
      <section style={{display:'grid', gap:DS.spacing(6)}}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position: 'sticky', top: 64, zIndex: 20, background: DS.color.bg,
        paddingTop: DS.spacing(2), paddingBottom: DS.spacing(4)
      }}>
        <h1 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight}}>Tecido-Estampa</h1>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <select value={tissueId} onChange={e=>setTissueId(e.target.value)} style={select()} aria-label="Selecionar tecido">
            {tissues.map(t => <option key={t.id} value={t.id}>{t.name} ({t.sku})</option>)}
          </select>
          <input aria-label="Pesquisar estampas" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar família/nome/SKU" style={{height:48, padding:`0 ${DS.spacing(4)}`, fontSize:DS.font.size.base, fontFamily:DS.font.familySans, color:DS.color.textPrimary, background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, outline:'none', width:260}} />
          <Button color="cyan" onClick={createLinks} disabled={!tissueId || selectedPatternIds.size===0 || busy}>
            Vincular {selectedPatternIds.size>0 ? `(${selectedPatternIds.size})` : ''}
          </Button>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'DS.color.textSecondary'}}>
        <span>Selecionados: {selectedPatternIds.size}</span>
        {tissueId && (
          <span style={{color:'DS.color.textPrimary'}}>Alvo: {tissues.find(t=>t.id===tissueId)?.name} ({tissues.find(t=>t.id===tissueId)?.sku})</span>
        )}
      </div>

      {/* Lista de estampas - largura completa */}
      <div>
        <h2 style={{color:'DS.color.textSecondary', margin:'8px 0'}}>Estampas</h2>
        <div style={{overflow:'auto', border:'1px solid DS.color.border', borderRadius:8, maxHeight:360}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead style={{position:'sticky', top:0, background:'DS.color.surface', color:'DS.color.textSecondary'}}>
              <tr>
                <th style={{...th(), width:40}}>
                  <input
                    type="checkbox"
                    checked={filteredPatterns.length > 0 && filteredPatterns.every(p => selectedPatternIds.has(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPatternIds(new Set(filteredPatterns.map(p => p.id)))
                      } else {
                        setSelectedPatternIds(new Set())
                      }
                    }}
                    aria-label="Selecionar todas as estampas"
                  />
                </th>
                <th style={th()}>Família</th>
                <th style={th()}>Nome</th>
                <th style={th()}>SKU</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatterns.map(p => {
                const checked = selectedPatternIds.has(p.id)
                return (
                  <tr key={p.id} style={{ background: checked? DS.color.bgHover : 'transparent', transition:'background-color .12s ease-out, box-shadow .12s ease' }}>
                    <td style={{...td(), width:40}}>
                      <input aria-label={`Selecionar ${p.family} ${p.name}`} type="checkbox" checked={checked} onChange={(e)=>{
                        const on = e.target.checked
                        setSelectedPatternIds(prev => { const next = new Set(prev); if (on) next.add(p.id); else next.delete(p.id); return next })
                      }} />
                    </td>
                    <td style={td()}>{p.family}</td>
                    <td style={td()}>{p.name}</td>
                    <td style={td()}>{p.sku}</td>
                  </tr>
                )
              })}
              {filteredPatterns.length===0 && (
                <tr><td colSpan={4} style={{...td(), color:'DS.color.textSecondary'}}>Nenhuma estampa</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ padding:'12px 0' }}>
        <div style={{ width:'100%', height:1, background:'DS.color.border' }} />
      </div>

      {/* Filtros de vínculos */}
      <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end'}}>
        <label style={{display:'grid', gap:4}}>
          <span style={{color:'DS.color.textPrimary'}}>Filtro Tecido</span>
          <select value={filterTissue} onChange={e=>setFilterTissue(e.target.value)} style={select()}>
            <option value="">Todos</option>
            {tissues.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label style={{display:'grid', gap:4}}>
          <span style={{color:'DS.color.textPrimary'}}>Filtro Família</span>
          <select value={filterFamily} onChange={e=>setFilterFamily(e.target.value)} style={select()}>
            <option value="">Todas</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <Button variant="default" onClick={()=>{ setFilterTissue(''); setFilterFamily('') }}>Limpar filtros</Button>
      </div>

      {selectedLinkIds.size > 0 && (
        <div style={{display:'flex', gap:8, alignItems:'center', padding:'12px 16px', background:DS.color.surfaceAlt, border:'1px solid #2563eb', borderRadius:8}}>
          <span style={{color:'DS.color.textPrimary', fontSize:14}}>{selectedLinkIds.size} vínculo(s) selecionado(s)</span>
          <Button color="red" size="sm" onClick={deleteSelectedLinks}>Excluir selecionados</Button>
          <Button variant="default" size="sm" onClick={()=>setSelectedLinkIds(new Set())}>Limpar seleção</Button>
        </div>
      )}

      {/* Vínculos - largura completa com colunas ricas */}
      <div>
        <h2 style={{color:'DS.color.textSecondary', margin:'8px 0'}}>Vínculos</h2>
        <div style={{overflow:'auto', border:'1px solid DS.color.border', borderRadius:8}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead style={{position:'sticky', top:0, zIndex:1, background:'DS.color.surface', color:'DS.color.textSecondary', textAlign:'left'}}>
              <tr>
                <th style={{...th(), width:40}}>
                  <input
                    type="checkbox"
                    checked={filteredLinks.length > 0 && filteredLinks.every(l => selectedLinkIds.has(l.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLinkIds(new Set(filteredLinks.map(l => l.id)))
                      } else {
                        setSelectedLinkIds(new Set())
                      }
                    }}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th style={th()}>SKU Filho</th>
                <th style={th()}>Nome Completo</th>
                <th style={th()}>Tecido</th>
                <th style={th()}>Estampa</th>
                <th style={th()}>Imagem</th>
                <th style={th()}>Largura</th>
                <th style={th()}>Composição</th>
                <th style={th()}>Status</th>
                <th style={th()}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map(l => (
                <tr key={l.id} style={{background: selectedLinkIds.has(l.id) ? DS.color.bgHover : 'transparent'}}>
                  <td style={{...td(), width:40}}>
                    <input
                      type="checkbox"
                      checked={selectedLinkIds.has(l.id)}
                      onChange={(e) => {
                        setSelectedLinkIds(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) {
                            next.add(l.id)
                          } else {
                            next.delete(l.id)
                          }
                          return next
                        })
                      }}
                      aria-label={`Selecionar ${l.skuFilho}`}
                    />
                  </td>
                  <td style={td()}>{l.skuFilho}</td>
                  <td style={td()}>{l.nomeCompleto}</td>
                  <td style={td()}>{l.tissueName} ({l.tissueSku})</td>
                  <td style={td()}>{l.patternFamily} {l.patternName} ({l.patternSku})</td>
                  <td style={td()}>
                    {l.imageThumb || l.image ? (
                      <img
                        src={l.imageThumb || l.image}
                        alt={`Imagem do vínculo ${l.skuFilho}`}
                        style={{ width:48, height:48, objectFit:'cover', borderRadius:6, border:'1px solid DS.color.border', cursor:'zoom-in' }}
                        onClick={()=> setPreviewSrc(l.imageThumb || l.image!)}
                      />
                    ) : (
                      <span style={{ color:'DS.color.textSecondary' }}>—</span>
                    )}
                  </td>
                  <td style={td()}>{l.width} cm</td>
                  <td style={td()}>{l.composition}</td>
                  <td style={td()}>{l.status}</td>
                  <td style={td()}>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      <input
                        type="file"
                        accept="image/*"
                        id={`file-${l.id}`}
                        style={{ display:'none' }}
                        onChange={async (e) => {
                            const inputEl = e.currentTarget
                            const file = e.target.files && e.target.files[0]
                            if (!file) return
                            
                            // Store original image directly
                            await patternLinksDb.setImageFull(l.id, file)
                            
                            await refreshLinks()
                            try { if (inputEl) inputEl.value = '' } catch {}
                          }}
                      />
                      <button 
                        type="button" 
                        style={miniBtn()} 
                        title="Enviar imagem"
                        onClick={() => document.getElementById(`file-${l.id}`)?.click()}
                      >
                        Imagem
                      </button>
                      <button type="button" disabled={statusUpdating.has(l.id)} onClick={()=>toggleStatus(l)} style={miniBtn()}>{l.status==='Ativo'?'Inativar':'Ativar'}</button>
                      <button type="button" disabled={deletingIds.has(l.id)} onClick={()=>deleteLink(l.id)} style={miniBtn('danger')}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLinks.length === 0 && (
                <tr><td colSpan={10} style={{...td(), color:'DS.color.textSecondary'}}>Nenhum vínculo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', right:16, bottom:16, background:'DS.color.success', color:'#081016', padding:'10px 12px', borderRadius:8 }} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {previewSrc && (
        <div
          role="dialog"
          aria-label="Pré-visualização da imagem"
          onClick={()=>setPreviewSrc(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
        >
          <img src={previewSrc} alt="Pré-visualização" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:8, border:'1px solid DS.color.border' }} />
        </div>
      )}
    </section>
    </Container>
  )
}

function th(): React.CSSProperties { return { padding:`${DS.spacing(3)} ${DS.spacing(4)}`, borderBottom:`2px solid ${DS.color.border}`, fontWeight:DS.font.weightMedium, fontSize:DS.font.size.sm, color:DS.color.textSecondary, textTransform:'uppercase', letterSpacing:DS.font.letterSpacing.wide, textAlign:'left' } }
function td(): React.CSSProperties { return { padding:`${DS.spacing(4)} ${DS.spacing(4)}`, borderBottom:`1px solid ${DS.color.borderSubtle}`, color:DS.color.textPrimary, fontSize:DS.font.size.base } }
function input(): React.CSSProperties { return { padding:`${DS.spacing(3)} ${DS.spacing(4)}`, borderRadius:DS.radius.md, border:`1px solid ${DS.color.border}`, background:DS.color.surface, color:DS.color.textPrimary, fontSize:DS.font.size.base, height:48 } }
function select(): React.CSSProperties { return { padding:'8px 10px', borderRadius:8, border:'1px solid DS.color.border', background:'DS.color.surface', color:'DS.color.textPrimary' } }
function miniBtn(kind: 'primary'|'danger' = 'primary'): React.CSSProperties { return { padding:'4px 8px', fontSize:12, background: kind==='danger'? '#b91c1c':'#1d4ed8', color:'DS.color.textPrimary', border:'1px solid DS.color.border', borderRadius:6, cursor:'pointer' } }

