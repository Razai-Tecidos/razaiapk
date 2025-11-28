import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { db, colorsDb, linksDb } from '@/lib/db'
import { Container } from '@/design-system/components'
import CardContainer from '@/components/CardContainer'
import LazyImage from '@/components/LazyImage'
// import { neutralizeImageToGray } from '@/lib/neutralize-image'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { TecidoCorView } from '@/types/tecidoCor'
import { inferFamilyFrom, labFromPartial, labToHex } from '@/lib/color-utils'
import { normalizeForSearch } from '@/lib/text'
import { DS } from '@/design-system/tokens'

export default function TecidoCorPage() {
  // Estado para cor e preview customizado
  // Removido: recurso de aplicar cor sobre imagem na pré-visualização
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [tissues, setTissues] = useState<Tissue[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [links, setLinks] = useState<TecidoCorView[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTissueId, setSelectedTissueId] = useState<string>('')
  const [selectedColorIds, setSelectedColorIds] = useState<Set<string>>(new Set())
  const [colorQuery, setColorQuery] = useState<string>('')
  const [filterTissue, setFilterTissue] = useState<string>('')
  const [filterFamily, setFilterFamily] = useState<string>('')
  const [toast, setToast] = useState<{ type:'success'|'error'; msg: string }|null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set())
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [compact, setCompact] = useState<boolean>(false)
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set())
  // Ref do grid horizontal de cores
  const colorGridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    (async () => {
      try {
        await db.init()
        const [ts, cs, ls] = await Promise.all([
          db.listTissues(),
          colorsDb.listColors(),
          linksDb.list(),
        ])
        setTissues(ts)
        setColors(cs)
        setLinks(ls)
      } finally { setLoading(false) }
    })()
  }, [])

  async function refreshLinks() {
    setLinks(await linksDb.list())
  }

  const families = useMemo(() => {
    const set = new Set<string>()
    for (const c of colors) {
      const fam = inferFamilyFrom({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
      if (fam && fam !== '—') set.add(fam)
    }
    return Array.from(set).sort()
  }, [colors])

  const filtered = useMemo(() => {
    return links.filter(l => (
      (!filterTissue || l.tissueId === filterTissue) &&
      (!filterFamily || l.family === filterFamily)
    ))
  }, [links, filterTissue, filterFamily])

  function hexForColor(c: Color): string | null {
    if (c.hex) return c.hex
    const lab = labFromPartial({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
    return lab ? labToHex(lab) : null
  }

  function hexForLink(l: TecidoCorView): string | null {
    if (l.hex) return l.hex
    const c = colors.find(x => x.id === l.colorId)
    if (!c) return null
    return hexForColor(c)
  }

  async function gerarVinculos() {
    if (!selectedTissueId || selectedColorIds.size === 0) return
    const { created, duplicates } = await linksDb.createMany(selectedTissueId, Array.from(selectedColorIds))
    toastMsg('success', `${created} vínculo(s) criado(s), ${duplicates} duplicado(s) ignorado(s).`)
    setSelectedColorIds(new Set())
    await refreshLinks()
  }

  function toggleColor(id: string) {
    setSelectedColorIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function toggleStatus(link: TecidoCorView) {
    setStatusUpdating(s => new Set(s).add(link.id))
    try {
      await linksDb.updateStatus(link.id, link.status === 'Ativo' ? 'Inativo' : 'Ativo')
      await refreshLinks()
    } finally { setStatusUpdating(s => { const n = new Set(s); n.delete(link.id); return n }) }
  }

  async function deleteLink(id: string) {
    setDeletingIds(s => new Set(s).add(id))
    try { await linksDb.delete(id); await refreshLinks() } finally { setDeletingIds(s => { const n = new Set(s); n.delete(id); return n }) }
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
      await Promise.all(ids.map(id => linksDb.delete(id)))
      toastMsg('success', `${ids.length} vínculo(s) excluído(s).`)
      setSelectedLinkIds(new Set())
      await refreshLinks()
    } finally {
      for (const id of ids) {
        setDeletingIds(s => { const n = new Set(s); n.delete(id); return n })
      }
    }
  }

  function toastMsg(type:'success'|'error', msg: string) {
    setToast({ type, msg }); setTimeout(()=>setToast(null), 2200)
  }

  // Layout constants for card grid (ajustáveis via modo compacto)
  const rows = 3
  const cardPreviewH = compact ? 72 : 96
  const cardRowH = compact ? 110 : 140
  const gap = compact ? 8 : 12
  // Altura base (sem espaço extra inferior) usada para lista de tecidos
  // altura total visível do grid (3 linhas + gaps internos)
  const panelBaseH = rows * cardRowH + (rows - 1) * gap
  // Pequeno espaço extra para evitar que a última linha de nomes de cores fique encoberta pela barra de rolagem
  const bottomAllowance = 40
  const panelColorH = panelBaseH + bottomAllowance
  // gap vertical entre elementos em cada coluna (label -> input/grid)
  const colGap = 6
  // alturas fixas para alinhamento consistente
  const labelH = 24
  const searchH = 40
  const labelPadX = 8

  return (
    <Container padY={12}>
    <section style={{display:'grid', gap:24}}>
      <div style={{
        marginBottom: DS.spacing(8),
        position: 'sticky', top: 0, zIndex: 20, background: DS.color.bg,
        paddingTop: DS.spacing(2), paddingBottom: DS.spacing(4)
      }}>
        <h1 style={{color: DS.color.textPrimary, margin:0, fontSize: DS.font.size.display, fontWeight: DS.font.weightLight, letterSpacing: DS.font.letterSpacing.tight}}>Vínculo Tecido-Cor</h1>
        <p style={{color: DS.color.textSecondary, fontSize: DS.font.size.md, marginTop: DS.spacing(2), marginBottom: 0, lineHeight: DS.font.lineHeight.normal}}>Crie vínculos entre tecidos e cores para gerar SKUs completos</p>
      </div>
  <div style={{display:'flex', gap:24, alignItems:'flex-start', width:'100%', overflow:'hidden'}}>
        {/* Coluna de Tecidos (lista vertical com altura = 3 linhas de cards) */}
        <div style={{display:'flex', flexDirection:'column', width:280}}>
          <span style={{color: DS.color.textSecondary, height:28, lineHeight:'28px', display:'block', paddingLeft: DS.spacing(2), fontSize: DS.font.size.sm, fontWeight: DS.font.weightMedium, marginBottom: DS.spacing(1)}}>Tecidos</span>
          <div role="listbox" aria-label="Lista de Tecidos" style={{ flexGrow:1, height: panelColorH + searchH + colGap, overflowY:'auto', overflowX:'hidden', border:`1px solid ${DS.color.borderSubtle}`, borderRadius: DS.radius.md, padding: DS.spacing(2), background: DS.color.surface, marginTop:colGap }}>
            {tissues.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(t => {
              const selected = selectedTissueId === t.id
              return (
                <CardContainer
                  key={t.id}
                  size="SMALL"
                  selected={selected}
                  onClick={() => setSelectedTissueId(t.id)}
                  ariaLabel={`Tecido ${t.name} - SKU ${t.sku}`}
                  role="option"
                >
                  <div style={{ fontWeight: DS.font.weightMedium, fontSize: DS.font.size.sm }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: DS.font.size.xs, color: DS.color.textSecondary }}>
                    {t.sku} • {t.width} cm
                  </div>
                </CardContainer>
              )
            })}
            {tissues.length===0 && <div style={{color: DS.color.textMuted, fontSize: DS.font.size.sm, padding: DS.spacing(4), textAlign: 'center'}}>Nenhum tecido</div>}
          </div>
        </div>

        {/* Área de Cores: 3 linhas de cards, scroll apenas lateral */}
  <div style={{display:'flex', flexDirection:'column', flex:'1 1 0%', minWidth:0}}>
          <span style={{color:'DS.color.textPrimary', height:29, lineHeight:`29px`, display:'block', paddingLeft:labelPadX}}>Cores</span>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input
              type="text"
              placeholder="Buscar cor por nome ou SKU..."
              value={colorQuery}
              onChange={e=>setColorQuery(e.target.value)}
              style={{...select(), height: searchH, flex:'1 1 0%'}}
            />
            <label title="Modo compacto" style={{display:'inline-flex', alignItems:'center', gap:6, color:'DS.color.textSecondary', fontSize:12}}>
              <input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)} />
              Compacto
            </label>
          </div>
          <div style={{height:colGap}} />
          {(() => {
            const q = normalizeForSearch(colorQuery)
            let filtered = (!q ? colors : colors.filter(c =>
              normalizeForSearch(c.name).includes(q) || normalizeForSearch(c.sku).includes(q)
            ))
            // ordena alfabeticamente sempre atualizada
            filtered = filtered.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
            const total = filtered.length
            const cap = 200
            if (filtered.length > cap) filtered = filtered.slice(0, cap)
            
            return (
              <>
                <div style={{position:'relative', height: panelColorH, width:'100%'}}>
                  <div
                    ref={colorGridRef}
                      style={{
                      position:'absolute', inset:0,
                      overflowX:'auto', overflowY:'hidden',
                      paddingBottom: DS.spacing(2),
                      scrollbarGutter:'stable both-edges',
                      overscrollBehaviorX:'contain',
                      overscrollBehaviorY:'contain',
                      boxSizing:'border-box'
                    }}
                    data-testid="color-grid-scroll"
                    onWheel={(e)=>{
                      const el = e.currentTarget
                      const dominantY = Math.abs(e.deltaY) >= Math.abs(e.deltaX)
                      const delta = dominantY ? e.deltaY : e.deltaX
                      el.scrollLeft += delta
                    }}
                  >
                    <div
                      style={{
                        display:'grid',
                        gridAutoFlow:'column',
                        gridTemplateRows:`repeat(${rows}, ${cardRowH}px)`,
                        gridAutoColumns:'160px',
                        gap:gap,
                        width:'max-content',
                        userSelect:'none'
                      }}
                    >
                    {filtered.map(c => {
                    const checked = selectedColorIds.has(c.id)
                    const hx = hexForColor(c)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={()=>toggleColor(c.id)}
                        title={c.name}
                        style={{
                          display:'grid', gridTemplateRows:`${cardPreviewH}px auto`, alignItems:'stretch',
                          border:`1px solid ${checked ? '#3B82F6' : DS.color.borderSubtle}`, borderRadius: DS.radius.md,
                          background: checked ? '#EFF6FF' : DS.color.surface,
                          color: DS.color.textPrimary, padding:0, cursor:'pointer',
                          boxShadow: checked ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : DS.shadow.xs,
                          transition:'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
                          outlineOffset:2
                        }}
                      >
                        <div style={{ height:cardPreviewH, background: hx || DS.color.surfaceAlt, borderBottom:`1px solid ${DS.color.borderSubtle}`, borderTopLeftRadius: DS.radius.md, borderTopRightRadius: DS.radius.md }} aria-label={hx?`Prévia ${hx}`:'Prévia indisponível'} />
                        <div style={{ padding: DS.spacing(3), fontSize: DS.font.size.sm, textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                      </button>
                    )
                    })}
                    </div>
                  </div>
                </div>
                {total > cap && (
                  <span style={{color: DS.color.textMuted, fontSize: DS.font.size.sm, marginTop: DS.spacing(2)}}>Mostrando {cap} de {total}. Refine a busca para ver mais.</span>
                )}
                {/* Ações e resumo de seleção */}
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap: DS.spacing(3), marginTop: DS.spacing(3), paddingTop: DS.spacing(3), borderTop: `1px solid ${DS.color.borderSubtle}`}}>
                  <span style={{color: DS.color.textSecondary, fontSize: DS.font.size.sm}}>Selecionadas: <strong>{selectedColorIds.size}</strong></span>
                  <div style={{display:'flex', gap: DS.spacing(2)}}>
                    <Button variant="default" disabled={selectedColorIds.size===0} onClick={()=> setSelectedColorIds(new Set())}>Limpar seleção</Button>
                    <Button color="cyan" disabled={!selectedTissueId || selectedColorIds.size===0} onClick={gerarVinculos}>Gerar vínculo</Button>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Divisor após a barra de ações (limpar seleção / gerar vínculo) */}
      <div style={{ padding:'12px 0' }}>
        <div style={{ width:'100%', height:1, background: DS.color.borderSubtle }} />
      </div>

  <div style={{display:'flex', gap: DS.spacing(4), flexWrap:'wrap', alignItems:'flex-end', marginTop: DS.spacing(6), paddingTop: DS.spacing(6)}}>
        <label style={{display:'grid', gap: DS.spacing(2)}}>
          <span style={{color: DS.color.textSecondary, fontSize: DS.font.size.sm, fontWeight: DS.font.weightMedium}}>Filtro Tecido</span>
          <select value={filterTissue} onChange={e=>setFilterTissue(e.target.value)} style={{padding: `${DS.spacing(2)} ${DS.spacing(3)}`, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`, background: DS.color.surface, color: DS.color.textPrimary, fontSize: DS.font.size.base, height: 44, minWidth: 200, cursor: 'pointer'}}>
            <option value="">Todos</option>
            {tissues.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label style={{display:'grid', gap: DS.spacing(2)}}>
          <span style={{color: DS.color.textSecondary, fontSize: DS.font.size.sm, fontWeight: DS.font.weightMedium}}>Filtro Família</span>
            <select value={filterFamily} onChange={e=>setFilterFamily(e.target.value)} style={{padding: `${DS.spacing(2)} ${DS.spacing(3)}`, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`, background: DS.color.surface, color: DS.color.textPrimary, fontSize: DS.font.size.base, height: 44, minWidth: 200, cursor: 'pointer'}}>
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

      <div style={{overflow:'auto', border:'1px solid DS.color.border', borderRadius:8}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{position:'sticky', top:0, zIndex:1, background:'DS.color.surface', color:'DS.color.textSecondary', textAlign:'left'}}>
            <tr>
              <th style={{...th(), width:40}}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(l => selectedLinkIds.has(l.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLinkIds(new Set(filtered.map(l => l.id)))
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
              <th style={th()}>Cor</th>
              <th style={th()}>Imagem</th>
              <th style={th()}>Família</th>
              <th style={th()}>HEX</th>
              <th style={th()}>Largura</th>
              <th style={th()}>Composição</th>
              <th style={th()}>Status</th>
              <th style={th()}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
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
                <td style={td()}>{l.tissueName}</td>
                <td style={td()}>
                  {(() => {
                    const hx = hexForLink(l)
                    return (
                      <span
                        title={hx || 'Sem especificação'}
                        aria-label={hx?`Prévia da cor ${hx}`:'Prévia da cor indisponível'}
                        style={{ display:'inline-block', width:12, height:12, borderRadius:3, background: hx || 'transparent', border:'1px solid DS.color.border', verticalAlign:'-2px', marginRight:8 }}
                      />
                    )
                  })()}
                  {l.colorName}
                </td>
                <td style={td()}>
                  {(() => {
                    const imgSrc = l.imageThumb || l.image
                    if (!imgSrc) {
                      return <span style={{ color:'DS.color.textSecondary' }}>—</span>
                    }
                    return (
                      <div 
                        style={{ position: 'relative', width: 48, height: 48 }}
                        onMouseEnter={(e) => {
                          const btn = e.currentTarget.querySelector('.download-btn') as HTMLElement
                          if (btn) btn.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          const btn = e.currentTarget.querySelector('.download-btn') as HTMLElement
                          if (btn) btn.style.opacity = '0'
                        }}
                      >
                        <div onClick={() => setPreviewSrc(imgSrc)}>
                          <LazyImage
                            src={imgSrc}
                            alt={`Imagem do vínculo ${l.skuFilho}`}
                            width={48}
                            height={48}
                            style={{ borderRadius: 6, border: '1px solid DS.color.border', cursor: 'zoom-in' }}
                            placeholderBg="#e5e5e5"
                          />
                        </div>
                        <button
                          className="download-btn"
                          title="Baixar imagem"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            border: 'none',
                            borderRadius: 6,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                          }}
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const a = document.createElement('a')
                              a.href = imgSrc
                              a.download = `${l.skuFilho}.jpg`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                            } catch (err) {
                              console.error('Erro ao baixar', err)
                              toastMsg('error', 'Erro ao baixar imagem')
                            }
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    )
                  })()}
                </td>
                <td style={td()}>{l.family}</td>
                <td style={td()}>{hexForLink(l) || '—'}</td>
                <td style={td()}>{l.width} cm</td>
                <td style={td()}>{l.composition}</td>
                <td style={td()}>{l.status}</td>
                <td style={td()}>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display:'none' }}
                        onChange={async (e) => {
                          const inputEl = e.currentTarget
                          const file = e.target.files && e.target.files[0]
                          if (!file) return
                          // Salva a imagem original SEM normalização
                          await linksDb.setImageFull(l.id, file)
                          await refreshLinks()
                          try { if (inputEl) inputEl.value = '' } catch {}
                        }}
                      />
                      <button style={miniBtn()} title="Enviar imagem">Imagem</button>
                    </label>
                    <button disabled={statusUpdating.has(l.id)} onClick={()=>toggleStatus(l)} style={miniBtn()}>{l.status==='Ativo'?'Inativar':'Ativar'}</button>
                    <button disabled={deletingIds.has(l.id)} onClick={()=>deleteLink(l.id)} style={miniBtn('danger')}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{...td(), color:'DS.color.textSecondary'}}>Nenhum vínculo</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{ position:'fixed', right:16, bottom:16, background: toast.type==='success'? 'DS.color.success' : 'DS.color.danger', color:'#081016', padding:'10px 12px', borderRadius:8 }} role="status" aria-live="polite">{toast.msg}</div>
      )}

      {previewSrc && (
        <div
          role="dialog"
          aria-label="Pré-visualização da imagem"
          onClick={()=>{ setPreviewSrc(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
        >
          <div style={{background:DS.color.surfaceAlt, padding:24, borderRadius:12, boxShadow:'0 2px 16px #0008', display:'flex', flexDirection:'column', alignItems:'center', gap:16}} onClick={e=>e.stopPropagation()}>
            <img src={previewSrc} alt="Pré-visualização" style={{ maxWidth:'60vw', maxHeight:'60vh', borderRadius:8, border:'1px solid DS.color.border', marginBottom:12 }} />
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <Button color="red" onClick={()=>{ setPreviewSrc(null) }}>Fechar</Button>
            </div>
            <div style={{color:'DS.color.textSecondary', fontSize:12}}>Clique fora para fechar</div>
          </div>
        </div>
      )}
    </section>
    </Container>
  )
}

function th(): React.CSSProperties { return { padding: `${DS.spacing(3)} ${DS.spacing(4)}`, borderBottom: `2px solid ${DS.color.border}`, fontWeight: DS.font.weightMedium, fontSize: DS.font.size.sm, color: DS.color.textSecondary, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wide } }
function td(): React.CSSProperties { return { padding: `${DS.spacing(4)} ${DS.spacing(4)}`, borderBottom: `1px solid ${DS.color.borderSubtle}`, color: DS.color.textPrimary, fontSize: DS.font.size.base, lineHeight: DS.font.lineHeight.snug } }
function select(): React.CSSProperties { return { padding: `${DS.spacing(2)} ${DS.spacing(3)}`, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`, background: DS.color.surface, color: DS.color.textPrimary, fontSize: DS.font.size.base, height: 44, cursor: 'pointer' } }
function miniBtn(kind: 'primary'|'danger' = 'primary'): React.CSSProperties { return { padding: `${DS.spacing(2)} ${DS.spacing(3)}`, fontSize: DS.font.size.sm, fontWeight: DS.font.weightRegular, background: kind==='danger'? DS.color.danger : DS.color.surface, color: kind==='danger'? '#fff' : DS.color.textPrimary, border: `1px solid ${kind==='danger' ? DS.color.danger : DS.color.border}`, borderRadius: DS.radius.sm, cursor: 'pointer', transition: 'all .2s ease', boxShadow: DS.shadow.xs } }

