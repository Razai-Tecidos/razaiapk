# Razai Tools - Manual de Reconstrução

> **Objetivo:** Este documento permite que qualquer pessoa recrie o projeto do zero, chegando ao estado atual. Siga cada passo na ordem.

---

## PARTE 1: PREPARAÇÃO DO AMBIENTE

### 1.1 Softwares Necessários

Instale estes programas (na ordem):

1. **Node.js** (versão 20+)
   - Baixe em: https://nodejs.org/
   - Escolha "LTS" (versão estável)
   - Instale com todas as opções padrão

2. **Git**
   - Baixe em: https://git-scm.com/
   - Instale com opções padrão

3. **VS Code**
   - Baixe em: https://code.visualstudio.com/
   - Instale as extensões:
     - ESLint
     - Prettier
     - Tauri (se for usar desktop)

4. **Expo CLI** (para mobile)
   ```powershell
   npm install -g expo-cli eas-cli
   ```

### 1.2 Contas Necessárias

Crie contas gratuitas em:

| Serviço | URL | Para que serve |
|---------|-----|----------------|
| GitHub | github.com | Guardar o código |
| Supabase | supabase.com | Banco de dados e autenticação |
| Vercel | vercel.com | Hospedar o site |
| Expo | expo.dev | Compilar o app mobile |

---

## PARTE 2: ESTRUTURA DE PASTAS

Crie esta estrutura exata:

```
Razai Tools/
├── app/                    # Aplicação Web/Desktop
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   │   ├── StatCard.tsx
│   │   │   ├── ActivityCard.tsx
│   │   │   ├── Card.tsx
│   │   │   └── ...
│   │   ├── design-system/  # Tokens de design (cores, fontes)
│   │   │   ├── tokens.ts
│   │   │   └── components.tsx
│   │   ├── lib/            # Lógica de negócio
│   │   │   ├── db/
│   │   │   ├── supabase.ts
│   │   │   └── stock-api.ts
│   │   ├── modules/        # Módulos grandes isolados
│   │   │   └── cutter-mode/
│   │   │       ├── CutterMode.tsx
│   │   │       └── index.ts
│   │   ├── pages/          # Páginas/Telas
│   │   │   ├── Home.tsx
│   │   │   ├── Tissues.tsx
│   │   │   ├── Colors.tsx
│   │   │   ├── Stock.tsx
│   │   │   ├── Catalog.tsx
│   │   │   └── ...
│   │   └── types/          # Tipos TypeScript
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/              # Código Rust (desktop) - opcional
├── .github/
│   └── workflows/
│       └── ci.yml          # Testes automáticos
├── .vercelignore           # Arquivos ignorados no deploy
└── package.json

RazaiToolsMobile/           # App Mobile (pasta separada)
├── components/
│   ├── LinkCard.tsx        # Card de produto
│   ├── ShareSheet.tsx      # Modal de compartilhamento
│   └── Skeleton.tsx        # Loading placeholder
├── context/
│   └── AuthContext.tsx     # Autenticação
├── hooks/
│   ├── index.ts
│   ├── useColors.ts
│   ├── useLinks.ts
│   ├── useStock.ts
│   └── useTissues.ts
├── lib/
│   ├── services/           # Chamadas ao banco
│   │   ├── index.ts
│   │   ├── tissueService.ts
│   │   ├── colorService.ts
│   │   ├── linkService.ts
│   │   └── stockService.ts
│   ├── supabase.ts
│   ├── queryClient.ts
│   └── theme.ts            # Cores e estilos
├── screens/
│   ├── HomeScreen.tsx
│   ├── LoginScreen.tsx
│   ├── TissuesScreen.tsx
│   ├── CatalogScreen.tsx
│   ├── LinkDetailsScreen.tsx
│   └── TissueDetailsScreen.tsx
├── types/
│   └── index.ts            # Interfaces TypeScript
├── App.tsx
├── app.json
├── eas.json
└── package.json
```

---

## PARTE 3: BANCO DE DADOS (SUPABASE)

### 3.1 Criar Projeto

1. Acesse supabase.com e faça login
2. Clique "New Project"
3. Escolha um nome (ex: "razai-tools")
4. Anote a **URL** e a **anon key** (vai precisar depois)

### 3.2 Criar Tabelas

Vá em "SQL Editor" e execute este código:

```sql
-- Tabela de Tecidos
CREATE TABLE tissues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  width INTEGER,
  composition TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Cores
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  hex TEXT,
  family TEXT,
  lab_l REAL,
  lab_a REAL,
  lab_b REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Links (Tecido + Cor = SKU Filho)
CREATE TABLE links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tissue_id UUID REFERENCES tissues(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE CASCADE,
  sku_filho TEXT UNIQUE,
  image_path TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tissue_id, color_id)
);

-- Tabela de Estoque
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE UNIQUE,
  quantity_rolls INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Movimentações de Estoque
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('IN', 'OUT', 'ADJUST')),
  quantity INTEGER NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função para registrar movimentação
CREATE OR REPLACE FUNCTION register_stock_movement(
  p_link_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Inserir movimentação
  INSERT INTO stock_movements (link_id, type, quantity, user_id)
  VALUES (p_link_id, p_type, p_quantity, p_user_id);
  
  -- Atualizar estoque
  INSERT INTO stock_items (link_id, quantity_rolls)
  VALUES (p_link_id, CASE WHEN p_type = 'IN' THEN p_quantity ELSE -p_quantity END)
  ON CONFLICT (link_id) DO UPDATE
  SET quantity_rolls = CASE 
    WHEN p_type = 'IN' THEN stock_items.quantity_rolls + p_quantity
    WHEN p_type = 'OUT' THEN GREATEST(0, stock_items.quantity_rolls - p_quantity)
    ELSE p_quantity
  END,
  updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

### 3.3 Criar Bucket de Imagens

1. Vá em "Storage"
2. Clique "New bucket"
3. Nome: `tissue-images`
4. Marque "Public bucket"
5. Clique "Create"

### 3.4 Configurar Autenticação

1. Vá em "Authentication" > "Providers"
2. Habilite "Email"
3. Vá em "Users" e crie um usuário admin

---

## PARTE 4: CONFIGURAR PROJETO WEB

### 4.1 Inicializar

```powershell
cd "C:\Users\SEU_USUARIO\Desktop"
mkdir "Razai Tools"
cd "Razai Tools"
npm create vite@latest app -- --template react-ts
cd app
npm install
```

### 4.2 Instalar Dependências

```powershell
npm install @mantine/core @mantine/hooks @mantine/notifications
npm install @supabase/supabase-js
npm install @tanstack/react-query
npm install react-router-dom
npm install idb
```

### 4.3 Configurar Supabase

Crie o arquivo `app/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'SUA_URL_DO_SUPABASE'
const supabaseKey = 'SUA_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### 4.4 Design System

Crie `app/src/design-system/tokens.ts`:

```typescript
export const DS = {
  color: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F9FAFB',
    bgHover: '#F3F4F6',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    borderSubtle: '#F3F4F6',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    accent: '#111827',
    accentHover: '#374151',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    focus: '#3B82F6',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  },
  spacing: (n: number) => `${n * 4}px`,
  font: {
    familySans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    size: { 
      xs: '12px', sm: '14px', base: '16px', md: '18px', 
      lg: '20px', xl: '24px', display: '32px' 
    },
    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
    lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.625 },
    letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.025em' },
  }
}
```

---

## PARTE 5: CONFIGURAR PROJETO MOBILE

### 5.1 Inicializar

```powershell
cd "C:\Users\SEU_USUARIO\Desktop"
npx create-expo-app RazaiToolsMobile --template blank-typescript
cd RazaiToolsMobile
```

### 5.2 Instalar Dependências

```powershell
npm install @supabase/supabase-js
npm install @tanstack/react-query
npm install @tanstack/query-async-storage-persister
npm install @tanstack/react-query-persist-client
npm install @react-native-async-storage/async-storage
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npm install react-native-safe-area-context react-native-screens
npm install expo-print expo-sharing expo-status-bar
npm install @expo/vector-icons
```

### 5.3 Configurar Supabase

Crie `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'SUA_URL_DO_SUPABASE'
const supabaseKey = 'SUA_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### 5.4 Theme

Crie `lib/theme.ts`:

```typescript
export const theme = {
  colors: {
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    primaryLight: '#eff6ff',
    danger: '#dc2626',
    dangerLight: '#fef2f2',
    dangerBorder: '#fecaca',
    success: '#10b981',
    successLight: '#ecfdf5',
    warning: '#f59e0b',
    text: '#333333',
    textSecondary: '#666666',
    textMuted: '#999999',
    textInverse: '#ffffff',
    background: '#f5f5f5',
    surface: '#ffffff',
    surfaceAlt: '#f0f0f0',
    border: '#eeeeee',
    borderStrong: '#dddddd',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
  font: {
    sizes: { xs: 12, sm: 14, base: 16, md: 18, lg: 20, xl: 24, display: 32 },
    weights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  },
}
```

### 5.5 Types

Crie `types/index.ts`:

```typescript
export interface Tissue {
  id: string;
  name: string;
  sku: string;
  width: number;
  composition: string;
  created_at: string;
  updated_at?: string;
}

export interface Color {
  id: string;
  name: string;
  sku: string;
  hex?: string;
  family?: string;
  lab_l?: number;
  lab_a?: number;
  lab_b?: number;
  created_at: string;
}

export interface Link {
  id: string;
  tissue_id: string;
  color_id: string;
  sku_filho: string;
  image_path?: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
  tissues?: Tissue;
  colors?: Color;
}

export interface StockItem {
  id: string;
  link_id: string;
  quantity_rolls: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  link_id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  user_id?: string;
  created_at: string;
}
```

### 5.6 EAS Build

Crie `eas.json`:

```json
{
  "cli": { "version": ">= 16.28.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

---

## PARTE 6: RODAR E TESTAR

### Web (local)
```powershell
cd "C:\...\Razai Tools\app"
npm run dev
# Abre http://localhost:5173
```

### Mobile (no celular)
```powershell
cd "C:\...\RazaiToolsMobile"
npx expo start
# Escaneie o QR code com o app Expo Go no celular
```

### Desktop (Tauri) - Opcional
```powershell
cd "C:\...\Razai Tools\app"
npm run dev:tauri
# Abre janela nativa
```

---

## PARTE 7: DEPLOY

### Web → Vercel

1. Faça push do código pro GitHub:
   ```powershell
   git add .
   git commit -m "deploy inicial"
   git push
   ```

2. Acesse vercel.com

3. Clique "Add New" > "Project"

4. Importe o repositório do GitHub

5. Configure:
   - **Root Directory:** `app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

6. Clique "Deploy"

7. Aguarde ~2 minutos. Seu site estará em: `https://seu-projeto.vercel.app`

### Mobile → APK

```powershell
cd "C:\...\RazaiToolsMobile"
eas login                                    # fazer login na conta Expo
eas build -p android --profile preview       # gerar APK
# Aguarde ~10 min e baixe o APK pelo link
```

---

## PARTE 8: COMANDOS DO DIA A DIA

### Salvar alterações no Git
```powershell
git add .
git commit -m "descrição do que mudou"
git push
```

### Verificar erros de TypeScript
```powershell
# Web
cd "C:\...\Razai Tools\app"
npm run typecheck

# Mobile
cd "C:\...\RazaiToolsMobile"
npx tsc --noEmit
```

### Atualizar dependências
```powershell
npm update
```

### Ver logs do Supabase
1. Acesse supabase.com
2. Vá no seu projeto
3. Clique "Logs" no menu lateral

---

## PARTE 9: FUNCIONALIDADES ATUAIS

### Web (Razai Tools)
| Tela | Funcionalidade |
|------|----------------|
| Home | Dashboard com stats, ações rápidas, atividade recente |
| Tecidos | CRUD de tecidos |
| Cores | CRUD de cores com valores LAB |
| Tecido-Cor | Criar SKUs filhos (tecido + cor) |
| Catálogo | Visualizar e exportar PDF |
| Estoque | Ver níveis, Smart Buy, entrada/saída |
| Modo Cortador | Interface simplificada para reportar falta |

### Mobile (RazaiToolsMobile)
| Tela | Funcionalidade |
|------|----------------|
| Login | Email/senha com Supabase |
| Home | Stats, busca, modo cortador |
| Tecidos | Lista de tecidos |
| Catálogo | Seleção múltipla + export PDF |
| Detalhes | Ver informações do produto |

---

## PARTE 10: SE ALGO DER ERRADO

### "npm não encontrado"
→ Reinstale o Node.js e reinicie o terminal

### "git não encontrado"
→ Reinstale o Git e reinicie o terminal

### "Erro de conexão com Supabase"
→ Verifique se a URL e a key estão corretas em `lib/supabase.ts`

### "Build do mobile falhou"
```powershell
npx expo doctor          # ver o que está errado
npx expo install --fix   # corrigir versões
```

### "Deploy na Vercel falhou"
→ Verifique se o Root Directory está como `app`
→ Veja os logs de erro no dashboard da Vercel

### "Tela branca no navegador"
```powershell
npm run build   # ver erros de compilação
```

### "TypeScript reclamando"
```powershell
npm run typecheck   # ver todos os erros
```

---

## PARTE 11: PRÓXIMAS MELHORIAS PLANEJADAS

- [ ] Histórico de movimentações de estoque
- [ ] Notificações push de estoque crítico
- [ ] Leitor de código de barras (mobile)
- [ ] Dashboard visual de estoque
- [ ] Multi-usuário com permissões
- [ ] Modo offline real

---

*Última atualização: 27/11/2025*
*Commits atuais: Web `707a8a5` | Mobile `d449f0f`*
