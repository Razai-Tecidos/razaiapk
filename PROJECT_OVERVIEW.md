# Razai Tools & Mobile - Visão Geral do Projeto

## 1. Introdução
Este workspace contém o ecossistema de aplicações da **Razai Tecidos**, focado em gestão de inventário e ferramentas de cores. O projeto é dividido em duas partes principais: uma aplicação híbrida (Web/Desktop) e um aplicativo móvel.

## 2. Estrutura do Projeto

### 2.1 Razai Tools (Web & Desktop)
Esta é a aplicação principal, localizada na pasta `app/` e na raiz do workspace.
- **Framework:** React + Vite + TypeScript.
- **UI Library:** Mantine UI + Design System customizado (`DS`).
- **Desktop Engine:** Tauri v2 (Rust) para criar executáveis nativos.
- **Backend/Dados:** Supabase (PostgreSQL) e IndexedDB (Local).
- **Deploy Web:** Vercel (Diretório raiz configurado como `app`).

**Estrutura de Pastas Chave:**
- `app/src/`: Código fonte do frontend.
- `app/src/lib/`: Lógica de negócios e abstrações de plataforma.
- `app/src/design-system/`: Tokens, componentes base e animações.
- `src-tauri/`: Configurações e código Rust do Tauri.

### 2.2 RazaiToolsMobile (Mobile)
Localizado na pasta `RazaiToolsMobile/`.
- **Framework:** React Native com Expo.
- **Build System:** EAS (Expo Application Services).
- **Estado:** Context API e React Query com persistência.
- **Navegação:** Bottom Tabs + Native Stack Navigator.

## 3. Guia de Comandos

### Aplicação Web/Desktop (Terminal na raiz `Razai Tools`)
| Ação | Comando | Descrição |
|------|---------|-----------|
| **Dev Web** | `npm run dev --prefix app` | Roda o servidor Vite localmente. |
| **Dev Desktop** | `npm run dev:tauri --prefix app` | Roda a aplicação em janela nativa Tauri. |
| **Build Web** | `npm run build --prefix app` | Gera arquivos estáticos para deploy. |
| **Build Desktop** | `npm run build:tauri --prefix app` | Gera instalador (.msi/.exe). |

### Aplicação Mobile (Terminal em `RazaiToolsMobile`)
| Ação | Comando | Descrição |
|------|---------|-----------|
| **Iniciar** | `npx expo start` | Inicia o servidor de desenvolvimento Metro. |
| **Gerar APK** | `eas build -p android --profile preview` | Gera arquivo instalável direto (APK). |
| **Gerar AAB** | `eas build -p android --profile production` | Gera arquivo para Google Play Store. |

## 4. Implementações Chave

### 4.1 Design System (Web) - `app/src/design-system/`

**Tokens (`tokens.ts`):**
- Paleta de cores: backgrounds, bordas, textos, estados semânticos
- Sistema de espaçamento: função `DS.spacing(n)` retorna `n * 4px`
- Tipografia: Inter font, pesos 300-700, tamanhos xs-display
- Sombras: xs, sm, md, lg, xl, inset
- Border radius: xs (4px) até pill (999px)

**Componentes Base (`components.tsx`):**
- Layout: `Container`, `Section`, `Panel`, `Stack`, `Row`, `GridAuto`
- Tipografia: `Title`, `Text`, `Label`
- Formulários: `Input`, `TextArea`, `Select`, `Checkbox`
- Botões: `DSButton` com variantes (solid/outline/ghost) e tons (default/accent/danger/success)
- Cards: `DSCard` com suporte a links
- Tabelas: `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`
- Feedback: `Modal`, `Spinner`, `Skeleton`, `EmptyState`

### 4.2 Navegação Responsiva (Web) - `app/src/App.tsx`
- Header fixo com logo e versão
- Menu desktop: links horizontais visíveis em telas `lg+`
- Menu mobile: `Burger` + `Drawer` (Mantine) em telas menores
- 13 rotas: Início, Tecidos, Cores, Famílias, Estampas, Tecido-Cor, Tecido-Estampa, Recolorir, Catálogo, Estoque, Exportações, Config, Vitrine

### 4.3 Modo Cortador (Web & Mobile)
Funcionalidade para operadores registrarem saída de estoque rapidamente:
- **Web (`Home.tsx`):** Modal fullscreen com busca por SKU, contador de quantidade, botões "Confirmar Saída" e "ACABOU TUDO (0)"
- **Mobile (`HomeScreen.tsx`):** Mesmo fluxo com Modal nativo, mudança visual de fundo para vermelho claro

### 4.4 Navegação (Mobile) - `App.tsx`
- Bottom Tabs: Início, Tecidos, Catálogo (Ionicons)
- Stack Navigator: Login → MainTabs → Detalhes
- Auth guard: redireciona para Login se não autenticado
- Persistência de queries com `@tanstack/react-query-persist-client`

### 4.5 Telas Mobile Implementadas
| Tela | Arquivo | Funcionalidade |
|------|---------|----------------|
| Login | `LoginScreen.tsx` | Email/senha com Supabase Auth |
| Home | `HomeScreen.tsx` | Stats, busca, modo cortador |
| Tecidos | `TissuesScreen.tsx` | Lista de tecidos |
| Catálogo | `CatalogScreen.tsx` | Seleção múltipla + export PDF |
| Detalhes Link | `LinkDetailsScreen.tsx` | Info do SKU filho |
| Detalhes Tecido | `TissueDetailsScreen.tsx` | Info do tecido |

### 4.6 Geração de PDF (Mobile) - `CatalogScreen.tsx`
- Seleção múltipla de tecidos
- Geração de HTML com grid de 3 colunas
- Conversão para PDF via `expo-print`
- Compartilhamento via `expo-sharing`

### 4.7 Integração Supabase
- **Auth:** Login/Logout com email/senha
- **Database:** Tabelas `tissues`, `colors`, `links`, `stock_items`
- **Storage:** Bucket `tissue-images` para fotos dos produtos
- **RPC:** `register_stock_movement` para movimentações de estoque

### 4.8 Componentes Reutilizáveis (Mobile)
- `LinkCard.tsx`: Card de produto com thumbnail, nome, cor e SKU
- `ShareSheet.tsx`: Modal de opções de compartilhamento

### 4.9 Design System (Mobile) - `lib/theme.ts`
Sistema de tokens centralizado para o app mobile:
- **Cores:** primary, danger, success, warning + variantes light
- **Espaçamentos:** xs (4) até xxxl (32)
- **Bordas:** sm (8) até pill (999)
- **Tipografia:** tamanhos xs-display, pesos regular-bold
- **Sombras:** sm, md, lg com elevation para Android

### 4.10 Responsividade (Web)
Todas as páginas principais são responsivas:
- **Header:** Menu hamburger em telas < lg
- **Tissues.tsx:** Toolbar com flex-wrap, input expansível
- **Stock.tsx:** Toolbar responsiva, tabela com scroll horizontal
- **Home.tsx:** Grid de stats com auto-fit (1-3 colunas)
- **Catalog.tsx:** Botões com flex-wrap

---

## 5. Guia Simplificado: Deploy e Git

### 5.1 Vercel (Deploy Web) - JÁ CONFIGURADO ✅

**O que é:** Hospeda seu site automaticamente quando você faz push no GitHub.

**Como funciona agora:**
1. Você faz alterações no código
2. Salva no GitHub (git push)
3. Vercel detecta automaticamente e faz deploy

**Se precisar reconectar:**
1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Importe o repositório `razaiapk`
3. Configure:
   - **Root Directory:** `app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

**Arquivos importantes:**
- `.vercelignore` - Ignora pastas pesadas (Tauri, mobile)
- `app/vercel.json` - Redireciona todas as rotas para index.html

---

### 5.2 Git Básico - Comandos Essenciais

**O que é:** Salva versões do seu código e sincroniza com a nuvem (GitHub).

| Situação | Comando | Explicação |
|----------|---------|------------|
| Ver o que mudou | `git status` | Mostra arquivos modificados |
| Preparar tudo | `git add .` | Marca TUDO para ser salvo |
| Salvar localmente | `git commit -m "sua mensagem"` | Cria um "checkpoint" |
| Enviar pro GitHub | `git push` | Sincroniza com a nuvem |
| Baixar atualizações | `git pull` | Traz mudanças do GitHub |

**Fluxo completo (copie e cole no terminal):**
```powershell
git add .
git commit -m "Atualização do projeto"
git push
```

**Se der erro de "não configurado":**
```powershell
git config --global user.email "seu@email.com"
git config --global user.name "Seu Nome"
```

---

### 5.3 EAS Build (Mobile) - JÁ CONFIGURADO ✅

**O que é:** Serviço da Expo que compila o app Android/iOS na nuvem.

**Como gerar APK (instalar direto no celular):**
```powershell
cd C:\Users\Rafael\Desktop\RazaiToolsMobile
eas build -p android --profile preview
```
Após ~10 minutos, baixe o APK pelo link gerado.

**Como gerar AAB (para Play Store):**
```powershell
eas build -p android --profile production
```

---

### 5.4 CI/CD (GitHub Actions) - JÁ CONFIGURADO ✅

**O que é:** Roda testes automaticamente quando você faz push.

**Arquivo:** `.github/workflows/ci.yml`

**O que faz:**
1. Instala dependências
2. Verifica cores do design system
3. Roda testes Vitest

**Você não precisa fazer nada!** Só fazer `git push` e ele roda sozinho.

---

## 6. Checklist de Deploy

### Web (Vercel)
- [x] `.vercelignore` configurado
- [x] `vercel.json` com rewrites para SPA
- [x] Root Directory: `app`
- [x] Auto-deploy no push

### Mobile (EAS)
- [x] `eas.json` com profile `preview` gerando APK
- [x] Profile `production` para Play Store
- [x] Dependências React Query configuradas

### CI/CD (GitHub Actions)
- [x] Workflow `ci.yml` ativo
- [x] Testes rodando automaticamente

---

*Documentação atualizada em 27/11/2025*
