import { useNavigate } from 'react-router-dom'
import { DS } from '@/design-system/tokens'
import { APP_VERSION } from '@/version'
import { DEFAULT_DE_THRESHOLD } from '@/lib/settings'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Button, Modal, Table, Text, Group, Badge, ActionIcon, Loader } from '@mantine/core'
import { settingsDb, colorsDb, syncDb, familyStatsDb } from '@/lib/db'
import { Container } from '@/design-system/components'
import { useDebounce } from '@/lib/hooks/useDebounce'
import ThresholdInput from '@/components/settings/ThresholdInput'
import HueWheelPanel from '@/components/settings/HueWheelPanel'
import { DEFAULT_HUE_BOUNDS } from '@/lib/color-utils'
import { getConfig as getCloudConfig, saveConfig as saveCloudConfig, uploadNewBackup, manualRestoreLatest, autoImportIfNeeded, fetchManifest, getLastUploadRecord, listBackups, restoreBackup } from '@/lib/cloud-sync'

// React Router throws if useNavigate runs outside a router; expose a safe fallback.
function useOptionalNavigate(): ReturnType<typeof useNavigate> | null {
  try {
    return useNavigate()
  } catch (error) {
    return null
  }
}

// Componente de configuração da nuvem (interno para simplificação)
interface CloudConfigProps {
  cloudUrl: string; setCloudUrl: (v: string)=>void;
  cloudAnon: string; setCloudAnon: (v: string)=>void;
  cloudBucket: string; setCloudBucket: (v: string)=>void;
  cloudAuto: boolean; setCloudAuto: (v: boolean)=>void;
  cloudUploadToken: string; setCloudUploadToken: (v: string)=>void;
  cloudSaving: boolean; setCloudSaving: (v: boolean)=>void;
  cloudStatus: string; setCloudStatus: (v: string)=>void;
  cloudWorking: boolean; setCloudWorking: (v: boolean)=>void;
}

function CloudConfig(props: CloudConfigProps) {
  const { cloudUrl, setCloudUrl, cloudAnon, setCloudAnon, cloudBucket, setCloudBucket, cloudAuto, setCloudAuto, cloudUploadToken, setCloudUploadToken, cloudSaving, setCloudSaving, cloudStatus, setCloudStatus, cloudWorking, setCloudWorking } = props
  const [historyOpen, setHistoryOpen] = useState(false)
  const [backups, setBackups] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function saveCfg() {
    setCloudSaving(true)
    try {
      await saveCloudConfig({ url: cloudUrl.trim(), anonKey: cloudAnon.trim(), bucket: cloudBucket.trim(), auto: cloudAuto, uploadToken: cloudUploadToken.trim() })
      setCloudStatus('✅ Configuração salva.')
      setTimeout(()=> setCloudStatus(''), 4000)
    } catch (e: any) {
      alert('Falha ao salvar configuração: ' + (e?.message || e))
    } finally {
      setCloudSaving(false)
    }
  }

  async function doBackup() {
    setCloudWorking(true)
    setCloudStatus('⏳ Iniciando backup...')
    try {
      // Pequeno delay para garantir que a UI atualize
      await new Promise(r => setTimeout(r, 100))
      
      const rec = await uploadNewBackup()
      if (!rec.ok) throw new Error(rec.reason || 'Erro desconhecido')
      
      if (rec.reason) {
        setCloudStatus(`⚠️ Backup criado (Alerta: ${rec.reason})`)
      } else {
        setCloudStatus(`✅ Backup criado: ${new Date().toLocaleString()}`)
      }
      setTimeout(()=> setCloudStatus(''), 6000)
    } catch (e: any) {
      console.error(e)
      setCloudStatus(`❌ Erro: ${e?.message || e}`)
      alert('Falha ao fazer backup: ' + (e?.message || e))
    } finally {
      setCloudWorking(false)
    }
  }

  async function doRestore() {
    setCloudWorking(true)
    try {
      const r = await manualRestoreLatest()
      setCloudStatus(`✅ Restauração concluída: ${r?.colorsImported || 0} itens`) // simples resumo
      setTimeout(()=> setCloudStatus(''), 6000)
    } catch (e: any) {
      alert('Falha ao restaurar: ' + (e?.message || e))
    } finally {
      setCloudWorking(false)
    }
  }

  async function openHistory() {
    setHistoryOpen(true)
    setLoadingHistory(true)
    try {
      const list = await listBackups()
      setBackups(list)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao listar backups: ' + (e.message || e))
    } finally {
      setLoadingHistory(false)
    }
  }

  async function restoreSpecific(filename: string) {
    if (!confirm(`Restaurar backup de ${filename}? Isso mesclará os dados atuais.`)) return
    setCloudWorking(true)
    setHistoryOpen(false)
    try {
      const r = await restoreBackup(filename)
      if (!r.ok) throw new Error(r.reason)
      setCloudStatus(`✅ Restaurado ${filename}: ${r.colorsImported || 0} itens`)
    } catch (e: any) {
      alert('Falha ao restaurar: ' + e.message)
    } finally {
      setCloudWorking(false)
    }
  }

  async function checkManifest() {
    setCloudWorking(true)
    try {
      const manifest = await fetchManifest()
      const last = getLastUploadRecord()
      const manifestInfo = manifest ? `${new Date(manifest.updated_at).toLocaleString()} | hash ${manifest.hash.slice(0,6)}…` : 'sem manifesto'
      setCloudStatus(last ? `Último backup local: ${new Date(last.ts).toLocaleString()} | Manifesto: ${manifestInfo}` : 'Manifesto carregado.')
      setTimeout(()=> setCloudStatus(''), 6000)
    } catch (e: any) {
      alert('Falha ao obter manifesto: ' + (e?.message || e))
    } finally {
      setCloudWorking(false)
    }
  }

  async function runAutoImport() {
    setCloudWorking(true)
    try {
      const r = await autoImportIfNeeded()
      setCloudStatus(r?.imported ? `✅ Importado automaticamente (${r.imported} registros).` : 'Nenhuma importação necessária.')
      setTimeout(()=> setCloudStatus(''), 5000)
    } catch (e: any) {
      alert('Falha na importação automática: ' + (e?.message || e))
    } finally {
      setCloudWorking(false)
    }
  }

  async function testConnection() {
    setCloudWorking(true)
    try {
      // Save temp config to ensure we test what is in the inputs? 
      // No, let's test what is SAVED to be consistent with other actions.
      // But warn if dirty? No, keep it simple.
      const manifest = await fetchManifest()
      if (manifest) {
        setCloudStatus(`✅ Conexão OK! Manifesto v${manifest.version} (${new Date(manifest.updated_at).toLocaleString()})`)
      } else {
        // Fallback check
        const base = cloudUrl.trim() || (import.meta.env.VITE_SUPABASE_URL as string)
        const key = cloudAnon.trim() || (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
        if (!base || !key) throw new Error('URL ou Key não configurados.')
        
        const url = `${base}/rest/v1/backups_manifest?select=count`
        const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
        if (res.ok) {
           setCloudStatus('✅ Conexão OK (Tabela acessível).')
        } else {
           const text = await res.text().catch(()=>'')
           throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0,100)}`)
        }
      }
      setTimeout(()=> setCloudStatus(''), 5000)
    } catch (e: any) {
      console.error(e)
      alert('Falha no teste de conexão:\n' + (e?.message || e))
      setCloudStatus('❌ Falha na conexão.')
    } finally {
      setCloudWorking(false)
    }
  }

  function getTissueCount(name: string) {
    const m = name.match(/-qty(\d+)\.json$/)
    return m ? m[1] : '-'
  }

  async function loadFromEnv() {
    const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const envBucket = import.meta.env.VITE_SUPABASE_BUCKET || 'backups'
    const envToken = import.meta.env.VITE_SUPABASE_UPLOAD_TOKEN || ''
    
    setCloudUrl(envUrl)
    setCloudAnon(envAnon)
    setCloudBucket(envBucket)
    setCloudUploadToken(envToken)
    
    if (!envUrl) alert('Aviso: VITE_SUPABASE_URL não encontrado nas variáveis de ambiente.')
    else setCloudStatus('Configuração carregada do .env (não salva ainda).')
  }

  return (
    <div style={{display:'grid', gap:DS.spacing(4)}}>
      <div style={{display:'grid', gap:DS.spacing(3)}}>
        <label style={{display:'grid', gap:DS.spacing(2)}}>
          <span style={{fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium, color:DS.color.textSecondary}}>URL do Serviço</span>
          <input value={cloudUrl} onChange={e=>setCloudUrl(e.target.value)} placeholder="https://xxx.supabase.co" style={{height:40, padding:`0 ${DS.spacing(3)}`, background:DS.color.bg, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, color:DS.color.textPrimary, outline:'none', transition:'all 0.2s'}} />
        </label>
        <label style={{display:'grid', gap:DS.spacing(2)}}>
          <span style={{fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium, color:DS.color.textSecondary}}>Anon Key</span>
          <input value={cloudAnon} onChange={e=>setCloudAnon(e.target.value)} placeholder="chave pública" style={{height:40, padding:`0 ${DS.spacing(3)}`, background:DS.color.bg, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, color:DS.color.textPrimary, outline:'none', transition:'all 0.2s'}} />
        </label>
        <label style={{display:'grid', gap:DS.spacing(2)}}>
          <span style={{fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium, color:DS.color.textSecondary}}>Bucket</span>
          <input value={cloudBucket} onChange={e=>setCloudBucket(e.target.value)} placeholder="nome do bucket" style={{height:40, padding:`0 ${DS.spacing(3)}`, background:DS.color.bg, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, color:DS.color.textPrimary, outline:'none', transition:'all 0.2s'}} />
        </label>
        <label style={{display:'grid', gap:DS.spacing(2)}}>
          <span style={{fontSize:DS.font.size.sm, fontWeight:DS.font.weightMedium, color:DS.color.textSecondary}}>Token de Upload (opcional)</span>
          <input value={cloudUploadToken} onChange={e=>setCloudUploadToken(e.target.value)} placeholder="token de upload" style={{height:40, padding:`0 ${DS.spacing(3)}`, background:DS.color.bg, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.md, color:DS.color.textPrimary, outline:'none', transition:'all 0.2s'}} />
        </label>
        <label style={{display:'flex', alignItems:'center', gap:DS.spacing(2), fontSize:DS.font.size.sm, color:DS.color.textSecondary, cursor:'pointer'}}>
          <input type="checkbox" checked={cloudAuto} onChange={e=>setCloudAuto(e.target.checked)} style={{width:16, height:16, accentColor:DS.color.accent}} /> Ativar importação automática na inicialização
        </label>
      </div>
      <div style={{display:'flex', flexWrap:'wrap', gap:DS.spacing(2)}}>
        <Button size="xs" variant="filled" color="dark" onClick={saveCfg} disabled={cloudSaving} h={32}>💾 Salvar</Button>
        <Button size="xs" variant="outline" onClick={loadFromEnv} disabled={cloudSaving} h={32}>🔄 Carregar .env</Button>
        <Button size="xs" variant="default" onClick={testConnection} disabled={cloudWorking} h={32}>📡 Testar Conexão</Button>
        <Button size="xs" variant="default" onClick={doBackup} disabled={cloudWorking} h={32}>☁️ Backup</Button>
        <Button size="xs" variant="default" onClick={doRestore} disabled={cloudWorking} h={32}>📥 Restaurar Último</Button>
        <Button size="xs" variant="default" onClick={openHistory} disabled={cloudWorking} h={32}>📜 Histórico</Button>
        <Button size="xs" variant="default" onClick={checkManifest} disabled={cloudWorking} h={32}>📄 Manifesto</Button>
        <Button size="xs" variant="default" onClick={runAutoImport} disabled={cloudWorking || !cloudAuto} h={32}>⚙️ Importar Agora</Button>
      </div>
      {cloudStatus && (
        <div style={{padding:DS.spacing(3), background:DS.color.bg, border:`1px solid ${DS.color.borderSubtle}`, borderRadius:DS.radius.md, fontSize:DS.font.size.sm, color:DS.color.textSecondary}}>{cloudStatus}</div>
      )}

      <Modal opened={historyOpen} onClose={() => setHistoryOpen(false)} title="Histórico de Backups" size="lg">
        {loadingHistory ? (
          <div style={{display:'flex', justifyContent:'center', padding:20}}><Loader /></div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data</Table.Th>
                <Table.Th>Arquivo</Table.Th>
                <Table.Th>Tecidos</Table.Th>
                <Table.Th>Tamanho</Table.Th>
                <Table.Th>Ação</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {backups.map((b) => (
                <Table.Tr key={b.name}>
                  <Table.Td>{new Date(b.created_at || b.updated_at).toLocaleString()}</Table.Td>
                  <Table.Td>{b.name}</Table.Td>
                  <Table.Td>{getTissueCount(b.name)}</Table.Td>
                  <Table.Td>{b.metadata?.size ? (b.metadata.size / 1024 / 1024).toFixed(2) + ' MB' : '-'}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => restoreSpecific(b.name)}>Restaurar</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {backups.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} align="center" style={{padding: DS.spacing(4), color: DS.color.textSecondary}}>
                    <div>Nenhum backup encontrado no bucket <strong>{cloudBucket || 'backups'}</strong>.</div>
                    <div style={{fontSize: '0.85em', marginTop: 8, maxWidth: 400, marginInline: 'auto'}}>
                      Se você tem certeza que existem arquivos, verifique as <strong>Políticas (RLS)</strong> no Supabase. 
                      A role <code>anon</code> precisa de permissão <code>SELECT</code> na tabela <code>storage.objects</code> para listar arquivos.
                    </div>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Modal>
    </div>
  )
}

export default function Settings() {
  const navigate = useOptionalNavigate()
  const handleOpenMigration = useCallback(() => {
    if (!navigate) return
    navigate('/migration')
  }, [navigate])
  const [delta, setDelta] = useState<number>(DEFAULT_DE_THRESHOLD)
  const [compression, setCompression] = useState<number>(0.8)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  // Cloud Sync state
  const [cloudUrl, setCloudUrl] = useState<string>('')
  const [cloudAnon, setCloudAnon] = useState<string>('')
  const [cloudAuto, setCloudAuto] = useState<boolean>(false)
  const [cloudBucket, setCloudBucket] = useState<string>('')
  const [cloudSaving, setCloudSaving] = useState<boolean>(false)
  const [cloudStatus, setCloudStatus] = useState<string>('')
  const [cloudWorking, setCloudWorking] = useState<boolean>(false)
  const [cloudUploadToken, setCloudUploadToken] = useState<string>('')
  // Legacy hue wheel rotation (mantido para testes visuais)
  const [wheelRotation, setWheelRotation] = useState<number>(0)
  const [visualRotation, setVisualRotation] = useState<number>(0)
  const cloudUrlRef = useRef<HTMLInputElement | null>(null)
  const cloudAnonRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const d = await settingsDb.getDeltaThreshold()
        setDelta(d)
        const c = await settingsDb.getCompressionQuality()
        setCompression(c)
      } catch {}
      // Load cloud sync config (localStorage based) or fall back to ENV
      try {
        const cfg = getCloudConfig()
        setCloudUrl(cfg.url || import.meta.env.VITE_SUPABASE_URL || '')
        setCloudAnon(cfg.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '')
        setCloudBucket(cfg.bucket || import.meta.env.VITE_SUPABASE_BUCKET || 'backups')
        setCloudUploadToken(cfg.uploadToken || import.meta.env.VITE_SUPABASE_UPLOAD_TOKEN || '')
        
        if (typeof cfg.auto === 'boolean') setCloudAuto(cfg.auto)
      } catch {}
    })()
  }, [])

  async function saveDelta() {
    setSaving(true)
    try {
      await settingsDb.setDeltaThreshold(delta)
      setSaved('Limiar salvo.')
      setTimeout(() => setSaved(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function saveCompression() {
    setSaving(true)
    try {
      await settingsDb.setCompressionQuality(compression)
      setSaved('Compressão salva.')
      setTimeout(() => setSaved(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function exportData() {
    setExporting(true)
    try {
      const data = await syncDb.exportAll()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `razai-backup-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSaved('Dados exportados com sucesso.')
      setTimeout(() => setSaved(null), 2000)
    } catch (e: any) {
      alert('Erro ao exportar: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  async function importData() {
    const input = importInputRef.current
    if (!input || !input.files || !input.files[0]) return
    setImporting(true)
    try {
      const file = input.files[0]
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await syncDb.importAll(data, 'merge')
      const msgLines = [
        `Tecidos: +${result.tissuesInserted} / ~${result.tissuesUpdated} atualizados`,
        `Cores: +${result.colorsInserted} / ~${result.colorsUpdated} atualizadas`,
        `Estampas: +${result.patternsInserted} / ~${result.patternsUpdated} atualizadas`,
        `Vínculos Cor: +${result.tecidoCorInserted} / ~${result.tecidoCorUpdated} atualizados`,
        `Vínculos Estampa: +${result.tecidoEstampaInserted} / ~${result.tecidoEstampaUpdated} atualizados`
      ]
      setImportResult(['Importação concluída:', ...msgLines].join('\n'))
      setTimeout(() => setImportResult(null), 8000)
      input.value = ''
    } catch (e: any) {
      alert('Erro ao importar: ' + (e?.message || e))
    } finally {
      setImporting(false)
    }
  }

  async function restoreDefaults() {
    setSaving(true)
    try {
      const nextDelta = DEFAULT_DE_THRESHOLD
      setDelta(nextDelta)
      await settingsDb.setDeltaThreshold(nextDelta)
      setSaved('Padrão restaurado (ΔE).')
      setTimeout(() => setSaved(null), 1500)
    } finally {
      setSaving(false)
    }
  }

  // Check if cloud config is ready (for rendering CloudConfig component)
  const cloudConfigReady = true

  return (
    <Container padY={12}>
      <section style={{display:'grid', gap:DS.spacing(6)}}>
      <h1 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight, display:'flex', alignItems:'center', gap:12}}>
        <span>Configurações</span>
        <span style={{
          fontSize: 12,
          padding: '3px 8px',
          background: DS.color.surface,
          border: `1px solid ${DS.color.borderSubtle}`,
          borderRadius: 8,
          color: DS.color.textSecondary,
          fontWeight: DS.font.weightRegular
        }}>Versão: v{APP_VERSION}</span>
      </h1>
      <div style={{ padding:'12px 0' }}><div style={{ height:1, background:DS.color.border }} /></div>

      {/* Seção ΔE Threshold */}
      <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm}}>
        <h2 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold, display:'flex', alignItems:'center', gap:8}}>
          <span>🎨</span>
          <span>Classificação de Cores</span>
        </h2>
        <div style={{display:'flex', alignItems:'flex-end', gap: DS.spacing(3)}}>
          <div style={{flex:1}}>
            <ThresholdInput value={delta} onChange={setDelta} />
          </div>
          <Button onClick={saveDelta} disabled={saving} style={{marginBottom: 2}}>Salvar</Button>
        </div>
        <div style={{marginTop: DS.spacing(4), padding: DS.spacing(3), background: DS.color.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`}}>
          <div style={{color: DS.color.textSecondary, fontSize: DS.font.size.sm, lineHeight: 1.6}}>
            <strong style={{color: DS.color.textPrimary}}>ℹ️ Sistema Adaptativo:</strong> As famílias de cores são determinadas automaticamente pelo nome que você cadastra. 
            O threshold ΔE é usado apenas para comparação de similaridade entre cores.
          </div>
        </div>

        <div style={{marginTop: DS.spacing(6), paddingTop: DS.spacing(6), borderTop: `1px solid ${DS.color.border}`}}>
          <h3 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(3)}`, fontSize: DS.font.size.base, fontWeight: DS.font.weightSemibold}}>
            Compressão de Imagens (Migração)
          </h3>
          <div style={{display:'flex', alignItems:'center', gap: DS.spacing(3)}}>
            <div style={{flex:1}}>
              <label style={{display:'block', marginBottom:8, fontSize:12, color:DS.color.textSecondary}}>Qualidade ({Math.round(compression * 100)}%)</label>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05" 
                value={compression} 
                onChange={e => setCompression(parseFloat(e.target.value))}
                style={{width:'100%', accentColor: DS.color.accent}} 
              />
            </div>
            <Button onClick={saveCompression} disabled={saving}>Salvar</Button>
          </div>
          <div style={{marginTop: 8, fontSize: 12, color: DS.color.textSecondary}}>
            Define a qualidade das imagens enviadas para a nuvem. Menor qualidade = menor custo de armazenamento.
          </div>
        </div>

        {/* Legacy Hue Wheel (somente visual) */}
        <div style={{marginTop: DS.spacing(6)}}>
          <HueWheelPanel
            bounds={DEFAULT_HUE_BOUNDS}
            wheelRotation={wheelRotation}
            onWheelRotationChange={setWheelRotation}
            visualRotation={visualRotation}
            onVisualRotationChange={setVisualRotation}
          />
        </div>
      </div>

      {/* Seção de Ações de Manutenção */}
      <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm}}>
        <h2 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold, display:'flex', alignItems:'center', gap:8}}>
          <span>🔧</span>
          <span>Ações de Manutenção</span>
        </h2>
        <div style={{display:'grid', gap:DS.spacing(3)}}>
          <div style={{padding: DS.spacing(4), background: DS.color.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`, transition: 'all 0.2s ease', cursor: 'default'}} className="hover-lift">
            <div style={{display:'flex', alignItems:'flex-start', gap: DS.spacing(3)}}>
              <span style={{fontSize: 24}}>📊</span>
              <div style={{flex: 1}}>
                <h3 style={{margin: 0, color: DS.color.textPrimary, fontSize: DS.font.size.base, fontWeight: DS.font.weightSemibold, marginBottom: 4}}>
                  Recalcular Estatísticas de Famílias
                </h3>
                <p style={{margin: `${DS.spacing(2)} 0`, color: DS.color.textSecondary, fontSize: DS.font.size.sm, lineHeight: 1.5}}>
                  Processa todas as cores existentes e calcula faixas de matiz (hue) por família. Esta operação é segura e não modifica nenhum dado de cores.
                </p>
                <Button 
                  variant="default"
                  size="sm"
                  onClick={async ()=>{
                    const sure = window.confirm('Recalcular estatísticas de famílias?\n\nIsto irá:\n• Processar todas as cores existentes\n• Calcular faixas de matiz (hue) por família\n• Atualizar contadores de cores por família\n\nEsta operação é segura e não modifica nenhum dado de cores.')
                    if (!sure) return
                    setSaving(true)
                    try {
                      const result = await familyStatsDb.recalculateAll()
                      setSaved(`✅ ${result.totalFamilies} famílias processadas de ${result.totalColors} cores.`)
                      setTimeout(()=>setSaved(null), 3500)
                    } catch (e: any) {
                      alert('Falha ao recalcular estatísticas: ' + (e?.message || e))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  🔄 Recalcular Estatísticas
                </Button>
              </div>
            </div>
          </div>

          <div style={{padding: DS.spacing(4), background: DS.color.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`, transition: 'all 0.2s ease'}} className="hover-lift">
            <div style={{display:'flex', alignItems:'flex-start', gap: DS.spacing(3)}}>
              <span style={{fontSize: 24}}>🏷️</span>
              <div style={{flex: 1}}>
                <h3 style={{margin: 0, color: DS.color.textPrimary, fontSize: DS.font.size.base, fontWeight: DS.font.weightSemibold, marginBottom: 4}}>
                  Recalcular SKUs de Cores
                </h3>
                <p style={{margin: `${DS.spacing(2)} 0`, color: DS.color.textSecondary, fontSize: DS.font.size.sm, lineHeight: 1.5}}>
                  Extrai a família da primeira palavra do nome de cada cor e regenera todos os códigos SKU. Os vínculos Tecido-Cor serão mantidos.
                </p>
                <Button 
                  variant="default"
                  size="sm"
                  onClick={async ()=>{
                    const sure = window.confirm('Recalcular SKUs de todas as cores?\n\nIsto irá:\n• Extrair a família da PRIMEIRA PALAVRA do nome de cada cor\n• Regenerar todos os códigos SKU (ex: VM001, LJ002, etc.)\n• Re-sequenciar cores dentro de cada família\n\nATENÇÃO: Esta ação modificará os códigos SKU, mas os vínculos Tecido-Cor serão mantidos.')
                    if (!sure) return
                    setSaving(true)
                    try {
                      const result = await colorsDb.recalculateAllColorSkus()
                      setSaved(`✅ Recalculados ${result.totalUpdated} SKUs em ${result.familiesProcessed} famílias.`)
                      setTimeout(()=>setSaved(null), 3500)
                    } catch (e: any) {
                      alert('Falha ao recalcular SKUs: ' + (e?.message || e))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  🔄 Recalcular SKUs
                </Button>
              </div>
            </div>
          </div>

          <div style={{padding: DS.spacing(4), background: '#FEF2F2', borderRadius: DS.radius.md, border: `1px solid #FECACA`, transition: 'all 0.2s ease'}} className="hover-lift">
            <div style={{display:'flex', alignItems:'flex-start', gap: DS.spacing(3)}}>
              <span style={{fontSize: 24}}>⚠️</span>
              <div style={{flex: 1}}>
                <h3 style={{margin: 0, color: '#991B1B', fontSize: DS.font.size.base, fontWeight: DS.font.weightSemibold, marginBottom: 4}}>
                  Zerar Cores
                </h3>
                <p style={{margin: `${DS.spacing(2)} 0`, color: '#7F1D1D', fontSize: DS.font.size.sm, lineHeight: 1.5}}>
                  Remove TODAS as cores e vínculos Tecido-Cor. Mantém Tecidos, Estampas e Configurações. Os SKUs serão reiniciados.
                </p>
                <Button 
                  color="red" 
                  variant="filled"
                  size="sm"
                  onClick={async ()=>{
                    const sure = window.confirm('Você tem certeza que deseja ZERAR todas as CORES e vínculos Tecido-Cor?\nIsto manterá Tecidos, Estampas e Configurações.\nOs SKUs de cores por família serão reiniciados em 001.')
                    if (!sure) return
                    setSaving(true)
                    try {
                      const { colors, links, sequences } = await colorsDb.clearAllColors()
                      setSaved(`Cores zeradas: ${colors} cores, ${links} vínculos, ${sequences} sequências.`)
                      setTimeout(()=>setSaved(null), 2500)
                    } catch (e: any) {
                      alert('Falha ao zerar cores: ' + (e?.message || e))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  🗑️ Zerar Cores
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Exportação/Importação */}
      <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm, transition: 'all 0.2s ease'}} className="hover-lift" data-testid="sync-section">
        <h2 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold, display:'flex', alignItems:'center', gap:8}}>
          <span>🔄</span>
          <span>Sincronização de Dados</span>
        </h2>
        <div style={{display:'grid', gap:DS.spacing(3)}}>
          <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm, lineHeight: 1.6}}>
            Exporte todos os dados (tecidos, cores, estampas, vínculos e estatísticas) incluindo imagens em formato JSON.
            Use este arquivo para sincronizar dados entre diferentes instalações do sistema.
          </div>
          <div style={{display:'flex', gap:DS.spacing(2), flexWrap:'wrap', alignItems:'center'}}>
            <Button variant="filled" color="dark" onClick={exportData} disabled={exporting}>
              {exporting ? 'Exportando...' : '📦 Exportar Dados'}
            </Button>
            <label style={{display:'inline-block'}}>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                style={{display:'none'}}
                onChange={importData}
              />
              <Button component="span" variant="default" disabled={importing}>
                {importing ? 'Importando...' : '📥 Importar Dados'}
              </Button>
            </label>
          </div>
          {importResult && (
            <div style={{padding:DS.spacing(3), background:DS.color.success, border:`1px solid ${DS.color.success}`, borderRadius:DS.radius.md, color:DS.color.textPrimary, fontSize:DS.font.size.sm, whiteSpace:'pre-line'}}>
              {importResult}
            </div>
          )}
        </div>
        <div style={{padding:DS.spacing(4), background:DS.color.bg, borderRadius:DS.radius.md, fontSize:DS.font.size.sm, color:DS.color.textSecondary, marginTop: DS.spacing(4), border: `1px solid ${DS.color.border}`}}>
          <div style={{marginBottom:DS.spacing(2), fontWeight: DS.font.weightSemibold, color:DS.color.textPrimary}}>ℹ️ Como funciona:</div>
          <ul style={{margin:0, paddingLeft:20, lineHeight: 1.6}}>
            <li style={{marginBottom:4}}><strong>Exportar:</strong> Gera um arquivo JSON com todos os dados e imagens (base64)</li>
            <li style={{marginBottom:4}}><strong>Importar:</strong> Carrega dados do JSON. Registros existentes (mesmo SKU) são atualizados, novos são inseridos</li>
            <li style={{marginBottom:4}}><strong>Imagens:</strong> Preservadas em formato base64, restauradas automaticamente</li>
            <li><strong>Segurança:</strong> Faça backup antes de importar. A importação não apaga dados existentes</li>
          </ul>
        </div>

      {/* Fim da seção de sincronização de dados */}
      </div>

      {/* Seção Nuvem */}
      {cloudConfigReady && (
        <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm, transition: 'all 0.2s ease'}} className="hover-lift" data-testid="cloud-section">
          <h2 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold, display:'flex', alignItems:'center', gap:8}}>
            <span>☁️</span>
            <span>Sincronização na Nuvem</span>
          </h2>
          <div style={{display:'grid', gap:DS.spacing(3)}}>
            <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm, lineHeight: 1.6}}>
              Conecte-se ao serviço de sincronização para fazer backup automático e sincronizar entre dispositivos.
            </div>
            <CloudConfig
              cloudUrl={cloudUrl} setCloudUrl={setCloudUrl}
              cloudAnon={cloudAnon} setCloudAnon={setCloudAnon}
              cloudBucket={cloudBucket} setCloudBucket={setCloudBucket}
              cloudAuto={cloudAuto} setCloudAuto={setCloudAuto}
              cloudUploadToken={cloudUploadToken} setCloudUploadToken={setCloudUploadToken}
              cloudSaving={cloudSaving} setCloudSaving={setCloudSaving}
              cloudStatus={cloudStatus} setCloudStatus={setCloudStatus}
              cloudWorking={cloudWorking} setCloudWorking={setCloudWorking}
            />
          </div>
        </div>
      )}

      {/* Seção Migração */}
      <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm}}>
        <h2 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold, display:'flex', alignItems:'center', gap:8}}>
          <span>🚀</span>
          <span>Migração para Nuvem</span>
        </h2>
        <div style={{color:DS.color.textSecondary, fontSize:DS.font.size.sm, lineHeight: 1.6, marginBottom: DS.spacing(3)}}>
          Ferramenta administrativa para enviar todos os dados locais para o banco de dados Supabase. Use apenas na configuração inicial.
        </div>
        <Button variant="outline" color="blue" disabled={!navigate} onClick={handleOpenMigration}>
          Abrir Ferramenta de Migração
        </Button>
      </div>

      {/* Ações de Reset */}
      <div style={{display:'flex', flexWrap:'wrap', gap:DS.spacing(2), marginTop:DS.spacing(6), paddingTop:DS.spacing(4), borderTop:`1px solid ${DS.color.border}`}}>
        <Button color="gray" onClick={restoreDefaults}>
          ♻️ Restaurar Padrão (ΔE)
        </Button>
        {saved && <span style={{color:DS.color.success}}>{saved}</span>}
        <span style={{marginLeft:'auto', fontSize:11, color:DS.color.textSecondary}}>v{APP_VERSION}</span>
      </div>
    </section>
    </Container>
  )
}

