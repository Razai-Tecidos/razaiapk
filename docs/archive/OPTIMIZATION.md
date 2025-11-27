# Otimizações Propostas – Razai Tools

Este documento consolida oportunidades de melhoria em performance, arquitetura, DX (developer experience), testes e segurança para evolução incremental do projeto.

## 1. Performance de Carregamento
- [Implementado] Lazy loading de páginas menos frequentes (Patterns, Settings, Catalog, Exportações, DebugHueWheel, RecolorPreview, vínculos) usando `React.lazy` + `Suspense`.
- Code splitting adicional: mover utilitários pesados (PDF/catalog, backup export) para imports dinâmicos no ponto de uso.
- Pré-carregamento seletivo: usar `<link rel="prefetch">` para páginas acessadas com frequência logo após interações iniciais.
- Reduzir inline styles críticos: extrair estilos comuns do header para folha de estilo gerada pelo build (melhora diffs e caching de regras).

## 2. Responsividade de UI / Thread Principal
- Mover operações pesadas (`buildFullBackupJson`, hashing de integridade, importFullBackupExact) para Web Worker / Tauri side-channel.
- Introduzir fila de tarefas (ex.: export/import) com indicador de progresso e cancelamento.
- Usar `requestIdleCallback` para tarefas não críticas pós-render (ex.: verificação de versão, self-heal do design system) em ambiente web.

## 3. Cloud Sync (Robustez & Segurança)
- Adicionar verificação de integridade: após `downloadLatestBackup`, calcular SHA-256 e comparar com `manifest.hash`. Em caso de mismatch, abortar import e notificar.
- Implementar Edge Function segura (`upload_backup`) com validação do `uploadToken` e atualização do manifesto em transação única.
- Exponential backoff para `autoImportIfNeeded` quando falha de rede (limitar tentativas a 3). Persistir timestamp da última tentativa para evitar loops.
- Sanitização de payload: validar schema do backup com Zod antes de importar (gera lista clara de erros em UI). Remover chaves desconhecidas (hardening).

## 4. Classificação de Cores (Manutenção)
- Externalizar regras em JSON/YAML data-driven para facilitar ajuste sem editar código (ex.: `classification-rules.json`).
- Cache LAB + família em criação de cor (já parcial com `labL/labA/labB`). Validar que `inferFamilyFrom` não recalcula LAB para cores que já possuem componentes.
- Micro-otimização: substituir múltiplos `Math.sqrt(a*a + b*b)` por variável local reutilizada.

## 5. Testes (Velocidade e Confiabilidade)
- Mock de módulos pesados em testes de unidade (`cloud-sync`, `version-mgmt`, `design-system self-heal`) via setup global para reduzir tempo (~1.8s env overhead).
- Introduzir `vitest --coverage` com limiares (statements/branches/functions/lines) e relatório HTML em CI.
- Paralelizar testes de DOM e lógicos usando duas configs separadas (jsdom para UI, node para lógica) — já validado que node env funciona isoladamente.
- Teste de fumaça para backup round-trip com artefatos grandes executado fora da suíte principal (marcar como `slow` e rodar em nightly).

## 6. Observabilidade
- Módulo leve `instrument.ts` expondo `mark(name)` / `measure(start, end)` e enviando métricas (durations de import/export, tempo de bootstrap) para console ou endpoint interno.
- Log estruturado com categoria (`[perf]`, `[cloud-sync]`) padronizado (útil para parsing futuro).

## 7. Version Management & Cache
- Gating: desativar “nuclear” hard refresh em produção web; aplicar somente em Tauri e com heurística (hash diff real, não todo startup).
- Consolidar funções de cache clear em único módulo `cache-bypass.ts` com estratégia baseada em ambiente (`isDev`, `isTauri`).
- Evitar múltiplos reloads: se self-heal falha uma vez, registrar tentativa e não repetir até próxima versão.

## 8. Banco de Dados & Storage
- IndexedDB: chamar `navigator.storage.persist()` para maior durabilidade em browsers (reduz risco de ejeção automática).
- Compactar anexos maiores (imagens) em export: opcional zip geração (lazy import de `jszip`).
- Introduzir checksum por attachment para validação rápida sem recalcular hash completo do payload.

## 9. PWA & Offline
- Workbox integration para cache inteligente de rotas estáticas, ícones e API fallback (serve último backup local se offline).
- Tela offline amigável (exibir instruções para reconectar antes de enviar novos backups).

## 10. DX / Qualidade de Código
- Adicionar ESLint + Prettier (TypeScript/React) com regras: no implicit `any`, exhaustive dependencies nos hooks, prefer `const`.
- Husky + lint-staged para format/lint antes de commit.
- Script `npm run analyze:bundle` usando `rollup-plugin-visualizer` (ou `vite-bundle-visualizer`) para inspeção de tamanho.

## 11. Segurança
- Auditoria automática de dependências (`npm audit` / GitHub Dependabot) — pipeline CI.
- Checagem que nenhuma `service_role` key é embutida em bundles (`grep` durante build CI).
- Rotacionar `uploadToken` periodicamente (documentar processo).

## 12. Roadmap Prioritário
1. (Rápido) Lazy load (feito) + ESLint config.
2. Verificação de integridade antes de import.
3. Edge Function segura para upload + manifesto atômico.
4. Worker para export/import pesado.
5. Instrumentação de performance.
6. Regras de classificação data-driven.
7. Workbox offline + persist storage.

## 13. Métricas de Sucesso
- TTFB + FCP da Home reduzido (>15%).
- Duração média de export/import fora da thread principal (<500ms UI bloqueio percebido).
- Cobertura de testes > 85% linhas / 80% branches.
- Falhas de auto-sync com retry resolvidas <3 tentativas.
- Bundle inicial < 250KB gzip (após code splitting adicional).

---

Para aplicar incrementalmente, abra issues por seção e vincule commits às tags `[perf]`, `[cloud-sync]`, `[dx]`, `[test]`.