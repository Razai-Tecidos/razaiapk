# Razai Tools

Razai Tools é o painel central de ferramentas internas da RAZAI. Este repositório contém:
- `app/`: frontend React + Vite + TypeScript com PWA (roda no navegador e como frontend do app desktop)
- `src-tauri/`: wrapper Desktop com Tauri v2 + SQLite (via plugin SQL)

## Objetivo e Fluxo

Gerenciamento interno de dados (Tecidos, Cores, Estampas, Vínculos) com importação/exportação e app desktop via Tauri.

Nota: O antigo módulo de “Correção de Cor (LAB)” foi removido.

Página: Cor Seletiva (LAB/OKLab)
- Removida.

Detalhes do pipeline de recolor – removidos.

### Recolor utilitário (LAB) para textura de tecido

Foi adicionado um pipeline simples e modular para recolorizar tecidos (assumindo que a foto enviada ocupa 100% da imagem):

- `extractNeutralTexture(imageData, { targetLightness=65, marginPercent≈0.03 })`
  - Converte a imagem para LAB (D65), neutraliza cromaticidade (a=b≈0) e normaliza a luminosidade média para o alvo, preservando textura e sombras; retorna novo `ImageData`.
- `recolorTextureWithRazaiColor(textureData, { lab, hex }, { lightnessFactor=1 })`
  - Aplica a cor alvo mantendo desvios relativos de L (textura): `Lnew = Ltarget + factor*(L - meanL)`, `a/b` do alvo; clamp sRGB e preserva alfa.
- `FabricColorPreview` (componente React)
  - Input de arquivo → `ImageData` → `extractNeutralTexture` (uma vez) → `recolorTextureWithRazaiColor` a cada seleção de cor; renderiza em `<canvas>`.

Uso básico (trecho):

```ts
import { extractNeutralTexture } from '@/lib/recolor/textureExtractionNeutral'
import { recolorTextureWithRazaiColor } from '@/lib/recolor/recolorEngine'

// 1) Converta File -> HTMLImageElement -> ImageData usando canvas
// 2) Gere a textura neutra uma única vez
const neutral = extractNeutralTexture(imageData, { targetLightness: 65 })

// 3) Aplique diferentes cores rapidamente sem reprocesar a base
const result = recolorTextureWithRazaiColor(neutral, { hex: '#CC3227', lab: /* hexToLab(...) */ lab }, { lightnessFactor: 1 })
```

Observações:
- Exposto na Home como "Recolor (Preview)" (rota `/recolor`) para testes rápidos na UI; também pode ser usado de forma programática.
- Compatível com testes em Node (fallback de ImageData quando não houver `ImageData` global).

Pré‑requisitos na UI:
- Para listar cores na página de Recolor, selecione um tecido cadastrado. Somente as cores vinculadas (status Ativo) ao tecido escolhido aparecerão.
- Se a lista de tecidos estiver vazia, você pode:
  - Cadastrar um tecido em Tecidos e depois criar vínculos em Tecido‑Cor; ou
  - Importar um backup completo (JSON) em Exportações. A página de Recolor também oferece um importador rápido quando detecta zero tecidos.

Testes visuais automatizados:
- `app/src/tests/fabric-recolor-light.test.ts`
- `app/src/tests/fabric-recolor-dark.test.ts`
- Cores alvo por famílias cobrindo variados cenários (dois substratos: claro/escuro)

## Design System

O frontend usa Mantine (core/hooks/notifications) com Emotion para estilização. A árvore da aplicação é envolvida por `MantineProvider` e o sistema de notificações (`<Notifications />`). Nos testes, o ambiente jsdom é preparado em `app/src/tests/setup.ts` com polyfills de `window.matchMedia` e `ResizeObserver`, necessários para os hooks/temas do Mantine.

## Requisitos

- Node.js 18+ (recomendado LTS)
- Rust (stable) + Cargo
- Windows: Visual Studio Build Tools (C++), e targets do Rust para MSVC
- Tauri CLI via npm (instalado automaticamente como devDependency do `app`)

## Rodando no Navegador (PWA)

```powershell
cd .\app
npm install
npm run dev   # ou: npm run dev:web
```

Acesse http://localhost:5173

### Build web (produção)

```powershell
cd .\app
npm run build   # ou: npm run build:web
npm run preview # opcional para validar build localmente
```

## Rodando como App Desktop (Tauri)

```powershell
cd .\app
npm install
npm run dev:tauri
```

O Tauri irá abrir a janela do aplicativo desktop carregando o frontend servido pelo Vite (http://localhost:5173).

Para gerar build desktop:
```powershell
cd .\app
npm run build:tauri
```
Se aparecer erro sobre `cargo` não encontrado, instale os pré‑requisitos do Tauri (Windows):

```powershell
# instala Rust/Cargo (rustup), VS Build Tools (C++) e WebView2 (pode pedir confirmação)
cd .
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-tauri.ps1

# depois execute novamente
cd .\app
npm run dev:tauri
```

### Sincronização em desenvolvimento (Tauri → Web)

Durante o desenvolvimento, ao fechar a janela do Tauri o app gera um backup completo (tecidos, cores, estampas, vínculos e configurações) e envia para o servidor Vite local em `POST /api/import`. Em seguida, o navegador padrão é aberto apontando para a origem do Vite; a página web faz a importação automaticamente via `GET /api/import` (one‑shot) e confirma a operação.

Observações:
- Esse fluxo funciona apenas em modo dev (quando o frontend está servido pelo Vite).
- A porta do Vite pode variar; o Tauri descobre a origem em tempo de execução, então não é necessário configurar a porta manualmente.
- O endpoint é efêmero: o `GET /api/import` consome e apaga o último backup recebido.

### Exportar backup no Tauri

Na página Exportações, o botão “Baixar backup” no Tauri abre o diálogo nativo de salvar arquivo e grava o JSON no caminho escolhido, com notificações de sucesso/cancelamento/erro. No navegador, o fluxo usa download via Blob como fallback, também com notificação.

## Estrutura

- `app/src/pages/Home.tsx`: grade inicial com cartão para Tecidos
- `app/src/pages/Tissues.tsx`: módulo "Cadastro de Tecidos" com criar/editar/excluir, validações e acessibilidade básica
- `app/src/pages/TecidoCor.tsx`: módulo "Vínculo Tecido-Cor" para gerar vínculos entre tecido e cor, com filtros, status e imagem por vínculo
- `app/src/pages/Patterns.tsx`: módulo "Cadastro de Estampas" com entrada única de nome completo (Família + Nome) e inclusão múltipla separada por vírgulas; a família é autodetectada pela primeira palavra
- `app/src/pages/TecidoEstampa.tsx`: módulo "Vínculo Tecido-Estampa" para gerar vínculos entre tecido e estampa, com filtros e alternância de status
- `app/src/pages/Exportacoes.tsx`: exporta vínculos em JSON ou CSV
- `app/src/lib/db/`: abstrações de dados
  - `sqlite.ts`: usa `@tauri-apps/plugin-sql` (SQLite) quando rodando no Tauri
  - `indexeddb.ts`: fallback no navegador (IndexedDB via `idb`)
  - `index.ts`: seleção automática conforme o ambiente
- `app/src/lib/export.ts`: utilitários de exportação (JSON/CSV)
- `src-tauri/`: configuração Tauri v2 (Rust), com plugin de SQL habilitado

### Notas de testes (Mantine)

- Configuração do Vitest em `app/vitest.config.ts` define `environment: 'jsdom'` e `setupFiles: './src/tests/setup.ts'`.
- `setup.ts` aplica polyfills de `matchMedia` e `ResizeObserver` para compatibilidade com Mantine.
- Os testes renderizam páginas dentro de `MantineProvider` e `<Notifications />`.

## Offline-first e Sincronização

- Os dados são gravados localmente:
  - Desktop: SQLite (`sqlite:app.db` em diretório de dados do app)
  - Navegador: IndexedDB
- Sincronização com Google Drive será adicionada futuramente (placeholder).

## Testes rápidos

Dentro de `app/`:
```powershell
npm run test
```

Os testes cobrem:
- Cadastro de Tecidos: criar/editar/excluir, validações, pesquisa/ordenação e estados de botões
- Cores: exibição, regra de não duplicar prefixo de família no nome, e swatch de cor
- Estampas: entrada por nome completo, autodetecção de família, inclusão múltipla por vírgulas e exibição do nome completo na tabela
- Vínculo Tecido-Cor: criação em lote, prevenção de duplicados, alternância de status, exclusão, filtros e envio de imagem por vínculo (com miniatura)
- Vínculo Tecido-Estampa: criação em lote, prevenção de duplicados, alternância de status e exportação
- Exportações: geração de CSV com cabeçalhos e escaping corretos
- Recolorização de tecido: removida.

Todos os testes estão passando.

## Tarefas do VS Code (Tasks)

Para facilitar o fluxo no VS Code, este workspace inclui tarefas pré‑configuradas em `.vscode/tasks.json`:

- Teste
  - "Test: Vitest (app)": executa a suíte de testes do app
  - "Typecheck: TSC (app)": roda apenas checagem de tipos
- Web
  - "Dev: Vite (app)": inicia o servidor de desenvolvimento (background)
  - "Build: Vite (app)": gera build de produção do frontend
- Desktop
  - "Dev: Tauri (desktop)": inicia o app desktop em modo desenvolvimento (background)
  - "Build: Tauri (desktop)": gera instalador/artefatos de distribuição

Como usar:

1. Abra o palette de comandos e rode: "Tasks: Run Task"
2. Selecione a tarefa desejada da lista

Ou via terminal PowerShell:

```powershell
# Testes e typecheck
npm --prefix app run test
npm --prefix app run typecheck

# Desenvolvimento Web e Desktop
npm --prefix app run dev           # Vite (web)
npm --prefix app run dev:tauri     # Tauri (desktop)

# Builds
npm --prefix app run build         # Vite (web)
npm --prefix app run build:tauri   # Tauri (desktop)
```

## Módulo Vínculo Tecido-Cor (links)

Campos armazenados por vínculo:
- `id`, `tissueId`, `colorId`, `skuFilho`, `status` (Ativo/Inativo), `createdAt`
- Sistema de imagens: `imagePath`, `imageMime`, `imageHash`, `imageThumb` e `image` (legado)

Derivados para UI (View): `tissueSku`, `tissueName`, `width`, `composition`, `colorSku`, `colorName`, `family`, `hex`, `nomeCompleto`.

Regras:
- `skuFilho = SKU_Tecido + '-' + SKU_Cor`
- Unicidade por par (`tissueId`,`colorId`) e por `skuFilho`
- Botões: Inativar/Ativar e Excluir por linha
- Filtros por tecido e família de cor

### Sistema de Imagens por Vínculo

Objetivo: preservar arquivo original (catálogo futuro) e mostrar miniaturas leves na UI.

Armazenamento:
- Desktop (Tauri + SQLite): arquivo original escrito em `appDataDir/images/links/<hash>.<ext>`; metadados em `tecido_cor` (`image_path`,`image_mime`,`image_hash`,`image_thumb`).
- Web (IndexedDB): arquivo original armazenado no store `link_images` por `hash` (SHA-256); o vínculo guarda `imagePath = 'idb:<hash>'`, `imageMime`, `imageHash`, `imageThumb`.

Miniaturas:
- `imageThumb` guarda Data URL pequena para renderização rápida na tabela.

Deduplicação:
- O hash SHA-256 do conteúdo é usado como chave; o mesmo arquivo não é gravado duas vezes.

APIs:
- `linksDb.setImageFull(id, file)`: fluxo completo (escreve original e atualiza metadados + thumb)
- `linksDb.setImage(id, dataUrl)`: compatibilidade legada (atualiza apenas a thumb)
- Pré-visualização: clique na miniatura para abrir modal com a imagem (fecha ao clicar no overlay)

## Estampas (Patterns)

Cadastro simplificado:
- Entrada única "Nome da estampa" no formato "Família Nome" (ex.: "Jardim Pink").
- A família é autodetectada automaticamente como a primeira palavra do nome completo.
- Inclusão múltipla separada por vírgulas é suportada (ex.: "Jardim Pink, Jardim Azul").

Tabela de listagem:
- Coluna "Nome" exibe o nome completo (Família + Nome).
- Ordenação por Família, Nome e SKU da estampa.

Geração de SKU:
- Por família de estampa, com 2 letras + sequência (ex.: JA001). O código é atribuído por família e persistido, evitando colisões.

## Módulo Vínculo Tecido-Estampa

Semelhante ao vínculo Tecido-Cor, mas relacionando tecidos com estampas:
- `skuFilho = SKU_Tecido + '-' + SKU_Estampa`.
- Unicidade por par (`tissueId`,`patternId`).
- Lista enriquecida mostra nome do tecido e nome completo da estampa.

## Exportações

Página `Exportacoes` permite baixar vínculos em:
- JSON: `linksToJsonBlob(links)` gera blob com metadados (`generatedAt`, `count`) e itens
- CSV: `linksToCsvString(links, delimiter)` gera string CSV com cabeçalhos:
  `sku_filho, nome_completo, tecido_nome, tecido_sku, cor_nome, cor_sku, familia, hex, largura, composicao, status, data_criacao, tissue_id, color_id`

Notas CSV:
- Delimitador padrão é vírgula, com suporte a `;`
- Aspas são duplicadas em campos, e textos com `,` ou `;` são delimitados por aspas

### Backup Completo v4 (Round‑Trip Fidelity)

O formato de backup completo foi evoluído para versão `v4` garantindo reprodução idêntica (tissues, cores, estampas, vínculos e imagens) após importação "exata".

Estrutura principal (`schema: 'razai-tools.full-export', version: 4`):
```jsonc
{
  "schema": "razai-tools.full-export",
  "version": 4,
  "generatedAt": "ISO-8601",
  "counts": { "tissues": n, "colors": n, "patterns": n, "links": n, "patternLinks": n, "attachments": n },
  "tissues": [ /* Tissue[] (id, name, width, composition, sku, createdAt, color?) */ ],
  "colors":  [ /* Color[] (id, name, hex?, labL?, labA?, labB?, sku, createdAt) */ ],
  "patterns": [ /* Pattern[] (id, family, name, sku, createdAt) */ ],
  "links": [ /* TecidoCorView[] (inclui campos base + derivados UI + imagem) */ ],
  "patternLinks": [ /* TecidoEstampaView[] */ ],
  "attachments": [
    { "hash": "sha256|path", "mime": "image/png", "size": 12345, "data": "data:image/png;base64,...", "thumb": "data:image/png;base64,..." }
  ],
  "integrity": { "hashAlgorithm": "SHA-256", "hashHex": "64 hex chars" },
  "settings": { "deltaThreshold": 2.0, "hueBoundaries": { /* limites de hue */ } }
}
```

Características:
- `attachments` deduplicados por `hash` (mesmo arquivo aparece uma vez).
- `integrity.hashHex` é o SHA-256 de uma serialização estável do payload sem o bloco `integrity` (verificação futura).
- As imagens dos vínculos são preservadas via `image` (data URL legado) ou reconstruídas a partir de `imagePath`/`hash` (Tauri) no momento da exportação.

Importação:
- Versões `<4` continuam aceitas pelo importador legado (`importFullBackup`) e ignoram vínculos/imagens.
- Versão `4` usa `importFullBackupExact` recriando ou atualizando tecidos/cores/estampas/vínculos e preenchendo imagens (web: embute data URL; Tauri: pode regravar arquivo futuramente).
- Validação rápida: `fullBackupDryRun(text)` retorna lista de issues (schema, versão, arrays, integridade ausente, etc.).

Garantias de Round‑Trip:
- SKUs e IDs preservados (uso de raw import paths).
- `createdAt` mantido – ordenação e histórico sobrevivem.
- Vínculos e miniaturas reconstroem o mesmo estado visual (desde que imagens estejam presentes ou anexadas).
- Faltas (ex.: hash sem attachment) são reportadas em `issues`.

Evoluções futuras previstas:
- Separar anexos grandes em arquivo `.zip` ou diretório ao lado do JSON para reduzir tamanho.
- Verificação assíncrona de hash dentro da UI após upload (exibir badge verde/vermelho).
- Inclusão opcional de manifesto de versão de schema por entidade (`entitySchemas`).

Migração rápida (v3 → v4):
1. Gerar backup v3 antigo (se existir) e importar em ambiente atualizado – ele será aceito com avisos.
2. Fazer nova exportação → produzir v4 com integridade e anexos.

Observação: a recomputação de hash para verificação é assíncrona e pode ser adicionada posteriormente a partir do valor em `integrity.hashHex`.

### Uso – Exemplos Rápidos

Gerar backup completo (Node/Vitest ou Browser/Tauri):
```ts
import { makeFullExport, fullExportToJsonBlob, verifyFullExportIntegrity } from '@/lib/export'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb, settingsDb } from '@/lib/db'

async function gerarBackup() {
  await db.init()
  const [tissues, colors, patterns, links, patternLinks] = await Promise.all([
    db.listTissues(),
    colorsDb.listColors(),
    patternsDb.listPatterns(),
    linksDb.list(),
    patternLinksDb.list(),
  ])
  const delta = await settingsDb.getDeltaThreshold().catch(()=>undefined)
  const hue = await settingsDb.getHueBoundaries().catch(()=>undefined)
  const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, settings: { deltaThreshold: delta, hueBoundaries: hue } })
  const integrity = await verifyFullExportIntegrity(payload)
  console.log('Hash esperado:', integrity.expected, 'válido?', integrity.valid)
  return fullExportToJsonBlob(payload)
}
```

Validação/dry-run antes de importar:
```ts
import { fullBackupDryRun, importFullBackupExact } from '@/lib/import'

async function importarBackupTexto(jsonText: string) {
  const issues = fullBackupDryRun(jsonText)
  if (issues.length) console.warn('Issues:', issues)
  const res = await importFullBackupExact(jsonText)
  console.log('Inseridos', res.inserted, 'Atualizados', res.updated)
}
```

Verificação de integridade em arquivo carregado (por exemplo em input `<file>`):
```ts
async function verificarArquivo(file: File) {
  const text = await file.text()
  const obj = JSON.parse(text)
  const { verifyFullExportIntegrity } = await import('@/lib/export')
  const r = await verifyFullExportIntegrity(obj)
  console.log(r.valid ? 'OK' : 'Falha', r)
}
```

Fluxo resumido: gerar → opcionalmente verificar → armazenar ou baixar → dry-run (issues) → verificar integridade → importação exata.

## Design System (v0)

Princípios:
- Clareza & Hierarquia: tipografia reduzida e pesos consistentes.
- Minimalismo: paleta escura com acento único (cyan) + tons neutros.
- Ritmo: grade de 4px para todo espaçamento, padding e radius.
- Acessibilidade: contraste AA, foco visível, sem dependência de cor para estado.
- Responsividade: grid auto-fit para cartões e container máximo de 1240px.

Tokens principais (`app/src/design-system/tokens.ts`):
- Cores: `bg`, `surface`, `surfaceAlt`, `border`, `hover`, `accent`, `accentAlt`, `textPrimary`, `textSecondary`, `focus`.
- Tipografia: família Inter, tamanhos (`xs, sm, base, md, lg, xl, display`), pesos (400–700).
- Espaçamento: função `spacing(n)` = `n * 4px`.
- Radius: `xs, sm, md, lg, xl, pill`.
- Sombras: `sm, md, lg, inset` + elevações combinadas.

Componentes (`app/src/design-system/components.tsx`):
- Layout: `Container`, `Stack`, `Row`, `GridAuto`.
- Tipografia: `Title`, `Text`.
- Interativos: `DSButton` (variants `solid | outline | ghost`), `DSCard`.
- Estruturais: `Hero`.

Página inicial redesenhada utiliza estes componentes para alinhar conteúdo com espaçamentos precisos e foco de ação rápido (botões de criação + grid de módulos).

Próximos passos sugeridos (v1):
- Adicionar estados de carregamento/unificado (`<Skeleton />`).
- Sistema de ícones consistente (SVG inline com mesma caixa de 20px).
- Tema claro opcional (mesmos tokens com ajuste de contraste).
- Variantes de botão adicionais: `danger`, `warning`, `success`.
- Componente de tabela e formulário padronizados.

## Próximos passos

- Expandir o uso do Mantine para inputs, tabela e tema global minimalista
- Documentar temas/variantes usados e guidelines de UI
- Validar e congelar política de SKU (T001, T002, ... — já implementada e imutável após criação)
- Especificar estratégia de sincronização (Google Drive) e resolução de conflitos

## Catálogo (Módulo Novo)

Objetivo: listar Tecidos agregando suas Cores e Estampas vinculadas, com filtros (busca, tipo de tecido, famílias, ativos) e geração de PDF "lindo" para compartilhamento (WhatsApp, e-mail, etc.).

### Arquitetura Inicial

- Agregador em `app/src/lib/catalog/catalog-service.ts` junta Tecidos + Vínculos + Cores/Estampas.
- Cache em memória com invalidação após mutações (futuro: assinatura/reaction).
- Filtros client-side (fase 1); potencial para FTS5 (SQLite) ou Lunr.js em fase 2.
- Página `Catalog.tsx` com `CatalogFilterBar`, `CatalogGrid` e geração de PDF.

### Stack de PDF (Estratégia em Camadas)

1. Web Básico (MVP): `jsPDF` + layout manual (sem rasterizar cards) → rápido, leve, já implementado como fallback.
2. Opcional Web Canvas: `html2canvas` para capturar seções complexas (somente se precisarmos de renderização idêntica ao DOM; custo em peso e qualidade de texto).
3. Backend Rust (Qualidade): futuro módulo usando crate `printpdf` ou integração com `typst` para tipografia avançada, fontes customizadas, paginação precisa e compressão otimizada.

Estratégia atual: tentar Rust (`tauri-rust`) e fazer fallback automático para `web-basic` enquanto backend não existe.

### Estética do PDF

- Grade de cartões (2–3 colunas adaptável), cores como swatches vetoriais (sem perda).
- Tipografia consistente (Fonte título vs texto; incorporar futura família corporativa).
- Possível capa com imagem hero + data + logotipo.
- Miniaturas: reutilizar `imageThumb` ou gerar versão downscale dedicada (reduz tamanho final do PDF).

### Próximos Incrementos do Catálogo

- Campos extra: `fabricType`, `tags`, `description`, `gsm`, `supplier`, `price`, `season`.
- Geração de "Seções" no PDF (por tipo, por família, por temporada).
- Exportar também JSON leve do catálogo para integração externa.
- Backend Rust: endpoint de geração (`invoke('generate_catalog_pdf', { filters })`).
- Share workflow (Tauri): abrir diálogo de salvar e depois "abrir pasta" ou acionar compartilhamento nativo (mobile futuro).

