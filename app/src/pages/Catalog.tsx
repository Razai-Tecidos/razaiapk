import React, { useEffect, useState } from 'react'
import { DS } from '@/design-system/tokens'
import { Container, DSButton } from '@/design-system/components'
import { buildCatalogItems, filterCatalog } from '@/lib/catalog/catalog-service'
import { CatalogFilters } from '@/types/catalog'
import { CatalogGrid } from '@/components/CatalogGrid'
import { CatalogFilterBar } from '@/components/CatalogFilterBar'
import { generateCatalogPdf } from '@/lib/pdf/catalog-pdf'
import { openPath } from '@/lib/platform'

export const CatalogPage: React.FC = () => {
  const [rawItems, setRawItems] = useState([])
  const [filters, setFilters] = useState<CatalogFilters>({})
  const [loading, setLoading] = useState(true)
  const [pdfStatus, setPdfStatus] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      const items = await buildCatalogItems()
      if (mounted) {
        setRawItems(items as any)
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = filterCatalog(rawItems as any, filters)
  const selectedItems = filtered.filter((it:any)=> selected.has(it.tissueId))

  async function handleGeneratePdf() {
    setPdfStatus('Gerando...')
    setSavedPath(null)
    try {
      const baseItems = selectedItems.length > 0 ? selectedItems : filtered
      const res = await generateCatalogPdf({ items: baseItems, config: { title: 'Catálogo de Tecidos', dateLabel: new Date().toLocaleDateString(), brandName: 'RAZAI', includeCover: true, showFooterPageNumbers: true, showFooterBrand: true } })
      if (res.outputPath) {
        setSavedPath(res.outputPath)
      } else if (res.blob && !res.error) {
        const url = URL.createObjectURL(res.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.fileName
        a.click()
        URL.revokeObjectURL(url)
      }
      if (res.error) {
        setPdfStatus(res.error)
      } else {
        setPdfStatus('PDF gerado')
        setTimeout(() => setPdfStatus(null), 3000)
      }
    } catch (e: any) {
      console.error(e)
      setPdfStatus('Falha ao gerar PDF')
      setTimeout(() => setPdfStatus(null), 4000)
    }
  }

  return (
    <Container padY={12}>
      <h1 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight, marginBottom:DS.spacing(6)}}>Catálogo</h1>
      <CatalogFilterBar value={filters} onChange={setFilters} onGeneratePdf={handleGeneratePdf} />
      
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, alignItems:'center'}}>
        <DSButton size="sm" variant="outline" onClick={()=> setSelected(new Set())}>Limpar seleção</DSButton>
        <DSButton size="sm" variant="outline" onClick={()=> setSelected(new Set(filtered.map((it:any)=>it.tissueId)))}>Selecionar todos</DSButton>
        <span style={{fontSize:12, color:DS.color.textSecondary, marginLeft: 8}}>Selecionados: {selected.size}</span>
      </div>

      {pdfStatus && <div style={{ fontSize: 12, color: DS.color.textSecondary, marginBottom: 8 }}>{pdfStatus}</div>}
      {savedPath && (
        <div style={{ fontSize: 12, color: DS.color.success, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Salvo em: {savedPath}</span>
          <OpenFolderButton path={savedPath} />
        </div>
      )}
      {loading ? <div>Carregando...</div> : (
        <CatalogGrid items={filtered as any} selectedIds={selected} onSelect={(it:any)=>{
          setSelected(prev => {
            const next = new Set(prev)
            if (next.has(it.tissueId)) next.delete(it.tissueId); else next.add(it.tissueId)
            return next
          })
        }} />
      )}
    </Container>
  )
}

export default CatalogPage

const OpenFolderButton: React.FC<{ path: string }> = ({ path }) => {
  async function handleOpen() {
    try {
      const ok = await openPath(path)
      if (!ok) console.info('[Catalog] openPath fallback not supported for', path)
    } catch (e) {
      console.warn('Falha ao abrir caminho', e)
    }
  }
  return (
    <DSButton size="xs" variant="ghost" onClick={handleOpen}>Abrir</DSButton>
  )
}

