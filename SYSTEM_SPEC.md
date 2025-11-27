# Especificação do Sistema Razai Tools

Este documento serve como um guia completo para a reconstrução ou compreensão profunda do sistema **Razai Tools**. Ele descreve a arquitetura, tecnologias, modelos de dados e fluxos de trabalho como se o sistema fosse ser desenvolvido do zero.

## 1. Visão Geral do Projeto

**Razai Tools** é uma suíte de aplicativos híbrida (Desktop, Web e Mobile) desenvolvida para a **Razai Tecidos**. O objetivo principal é o gerenciamento de inventário, catálogo de tecidos e manipulação avançada de cores (color science) para visualização de produtos.

### Componentes Principais
1.  **Razai Tools (Desktop/Web):** Aplicação principal para gestão e operação diária. Funciona offline-first.
2.  **RazaiToolsMobile:** Aplicativo móvel para consulta rápida e operações em chão de fábrica (React Native/Expo).
3.  **Backend (BaaS):** Supabase (PostgreSQL + Storage + Auth).

---

## 2. Stack Tecnológico

### Frontend (Web & Desktop)
*   **Framework:** React 18 + TypeScript
*   **Build Tool:** Vite 5
*   **UI Library:** Mantine v7 (Core, Hooks, Notifications)
*   **Routing:** React Router DOM v6
*   **State Management:** React Context API + Hooks customizados
*   **Manipulação de Imagem/PDF:** `html-to-image`, `jspdf`, `gifshot`, `canvas`

### Desktop Engine
*   **Framework:** Tauri v2 (Rust)
*   **Plugins:** `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-sql`

### Dados & Backend
*   **Banco de Dados Nuvem:** Supabase (PostgreSQL)
*   **Banco de Dados Local (Offline):** IndexedDB (via biblioteca `idb`)
*   **Sincronização:** Lógica customizada de sync bidirecional (Cloud <-> Local)

### Testes
*   **Unitários/Integração:** Vitest
*   **Ambiente:** JSDOM

---

## 3. Arquitetura do Sistema

O sistema segue uma arquitetura **Offline-First** com uma camada de abstração de plataforma rigorosa.

### 3.1. Estrutura de Diretórios Crítica
```
/
├── app/                    # Frontend React (Web + UI do Desktop)
│   ├── src/
│   │   ├── lib/            # Lógica de Negócios (Core)
│   │   │   ├── platform/   # ABSTRAÇÃO CRÍTICA (Web vs Tauri)
│   │   │   ├── db/         # Camada de dados (IndexedDB + Supabase)
│   │   │   ├── recolor/    # Algoritmos de processamento de imagem/cor
│   │   │   └── workers/    # Web Workers para processamento pesado
│   │   ├── components/     # Componentes UI (Mantine)
│   │   ├── context/        # Estado global (Auth, Theme)
│   │   └── design-system/  # Tokens de design e estilos globais
├── src-tauri/              # Backend Rust (Tauri)
└── supabase/               # Migrations e Schemas SQL
```

### 3.2. O Padrão "Platform Agnostic"
Todo acesso a recursos nativos (Sistema de Arquivos, Diálogos, Clipboard) **DEVE** passar por `app/src/lib/platform`.
*   **Interface:** Define métodos genéricos (ex: `fs.readTextFile`).
*   **Implementação Web:** Usa APIs do navegador ou mocks.
*   **Implementação Desktop:** Usa APIs do Tauri (`@tauri-apps/api`).
*   **Objetivo:** O mesmo código React roda no navegador e no executável Windows sem alterações condicionais nos componentes.

---

## 4. Modelo de Dados (Schema)

O banco de dados é relacional e normalizado. As tabelas principais no Supabase (e espelhadas no IndexedDB) são:

1.  **tissues (Tecidos):** Tabela base de artigos (SKU, Nome, Largura, Composição).
2.  **colors (Cores):** Catálogo de cores (SKU, Nome, Hex, LAB).
    *   *Nota:* Armazena valores LAB para cálculos precisos de distância de cor (DeltaE).
3.  **patterns (Estampas):** Catálogo de estampas/desenhos.
4.  **links (Vínculos Tecido-Cor):** Tabela pivô principal. Relaciona um Tecido a uma Cor, gerando um produto vendável (SKU Filho). Contém o caminho da imagem.
5.  **pattern_links (Vínculos Tecido-Estampa):** Similar a `links`, mas para estampas.
6.  **stock_items (Estoque):** Quantidade atual (rolos/metros) vinculada a um `link_id`.
7.  **stock_movements (Movimentações):** Histórico de entradas/saídas (Log de auditoria).

---

## 5. Funcionalidades Chave

### 5.1. Gestão de Catálogo
*   CRUD completo de Tecidos e Cores.
*   Upload de imagens com processamento local (resize/compressão).
*   Geração automática de SKUs.

### 5.2. Color Science (Módulo `recolor`)
*   **Recolorização:** Capacidade de aplicar uma cor (Hex/LAB) sobre uma textura de tecido em escala de cinza (greyscale base).
*   **Busca por Similaridade:** Encontrar cores próximas no catálogo usando distância Euclidiana no espaço de cor LAB (DeltaE).
*   **Classificação:** Agrupamento automático de cores em "Famílias" (ex: Azuis, Vermelhos) baseado no Hue (Matiz).

### 5.3. Estoque
*   Rastreamento de rolos e metragens.
*   Operações de Entrada, Saída e Ajuste.
*   Sincronização robusta para garantir que dados offline subam para a nuvem quando houver conexão.

---

## 6. Guia de Desenvolvimento (Passo a Passo)

### Pré-requisitos
*   Node.js 20+
*   Rust (para desenvolvimento Desktop)
*   Conta Supabase

### Configuração Inicial
1.  **Instalar Dependências:**
    *   Raiz: `npm install`
    *   App: `cd app && npm install`
2.  **Variáveis de Ambiente:**
    *   Criar `.env` em `app/` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

### Comandos de Execução
*   **Web (Dev):** `npm run dev` (Roda Vite na porta 5173/5174).
*   **Desktop (Dev):** `npm run dev:tauri` (Inicia Rust + Janela Webview).

### Fluxo de Build
1.  **Web:** `npm run build` -> Gera estáticos em `app/dist`.
2.  **Desktop:** `npm run build:tauri` -> Compila Rust e empacota os estáticos do passo 1 em um instalador `.msi` ou executável `.exe`.

---

## 7. Instruções para Recriação (Se for começar do zero)

1.  **Setup do Monorepo:** Inicie com uma estrutura que separe claramente o frontend (`app`) do backend nativo (`src-tauri`).
2.  **Design System First:** Defina os tokens de cor e tipografia no Mantine antes de criar componentes.
3.  **Camada de Dados:**
    *   Crie os tipos TypeScript espelhando o Schema SQL.
    *   Implemente o `db/index.ts` usando `idb` para garantir que o app funcione sem internet desde o dia 1.
4.  **Abstração de Plataforma:** Não importe Tauri diretamente nos componentes. Crie o hook/módulo `usePlatform` ou `lib/platform`.
5.  **Sync Engine:** Implemente uma fila de sincronização. Quando o usuário salvar algo offline, adicione a uma fila `sync_queue` no IndexedDB e processe-a quando a rede voltar.

---

## 8. Manutenção e Extensão

*   **Adicionar Nova Tabela:**
    1.  Crie a migration SQL em `supabase/migrations`.
    2.  Adicione a tipagem em `app/src/types/database.types.ts`.
    3.  Atualize a lógica de Sync em `app/src/lib/db`.
*   **Atualizar Tauri:** Edite `src-tauri/tauri.conf.json` para permissões e configurações de janela.
