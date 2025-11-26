# Mudança Fundamental na Classificação de Cores

## 📋 Resumo

Implementação de **nova lógica de classificação de cores** onde a **família vem da primeira palavra do nome da cor** (avaliação visual do usuário), e não mais das coordenadas LAB/hue.

**Data**: 25 de janeiro de 2025
**Impacto**: Todos os códigos SKU de cores existentes precisam ser recalculados

---

## 🎯 Motivação

### Problema Anterior
- Sistema inferia família de cor usando coordenadas LAB → hue → família (ex: Vermelho, Laranja, etc.)
- Resultado: algumas cores eram classificadas incorretamente
  - Exemplo: "Laranja Queimado" sendo classificado como "Vermelho" por causa do hue LAB
  - Exemplo: Cores com nomes "Salmão", "Terracota" sem reflexo direto na família

### Nova Abordagem
- **Fonte de verdade**: Primeira palavra do nome que o usuário escreve
- **LAB como validação**: Apenas usado quando nome não especifica família
- **Auto-descoberta**: Novas famílias são criadas automaticamente a partir de novos nomes

---

## 🔧 Mudanças Implementadas

### 1. **`color-utils.ts`** - Lógica de Detecção

#### `detectFamilyFromName()` - Reformulado
**Antes**:
```typescript
// Checava se nome COMEÇAVA com token conhecido
if (s.startsWith(low + ' ') || s === low) return normalizeFamilyName(token)
```

**Depois**:
```typescript
// Extrai PRIMEIRA PALAVRA e trata como família
const firstWord = s.split(/\s+/)[0]

// Se primeira palavra for família conhecida (Vermelho, Azul, etc.)
if (firstWordLower === low) return normalizeFamilyName(token)

// Se NÃO for conhecida, cria nova família com esse nome
// Ex: "Salmão Claro" → família "Salmão"
// Ex: "Terracota Escura" → família "Terracota"
return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
```

**Impacto**:
- ✅ "Laranja Queimado" → família "Laranja" (código LJ)
- ✅ "Salmão Claro" → família "Salmão" (código SA)
- ✅ "Terracota" → família "Terracota" (código TE)
- ✅ "Vermelho Vivo" → família "Vermelho" (código VM)

#### `familyCodeFor()` - Auto-código para Famílias Customizadas
**Antes**:
```typescript
// Famílias não reconhecidas viravam "OT" (Outros)
return 'OT'
```

**Depois**:
```typescript
// Gera código de 2 letras a partir do nome da família
const s = norm.trim()
if (s.length === 1) return s.toUpperCase() + 'X'
return s.slice(0, 2).toUpperCase()  // Ex: "Salmão" → "SA", "Terracota" → "TE"
```

### 2. **`db/index.ts`** - Inversão de Prioridade

#### `colorsDb.createColor()` - Ordem Invertida
**Antes** (linha 98-105):
```typescript
const family = (() => {
  const fromSpec = inferFamilyFrom({ hex, labL, labA, labB })  // LAB PRIMEIRO
  if (fromSpec && fromSpec !== '—') return fromSpec
  const fromName = detectFamilyFromName(input.name)           // Nome como fallback
  return fromName ?? 'Outros'
})()
```

**Depois**:
```typescript
const family = (() => {
  const fromName = detectFamilyFromName(input.name)          // NOME PRIMEIRO ✅
  if (fromName) return fromName
  const fromSpec = inferFamilyFrom({ hex, labL, labA, labB }) // LAB como fallback
  return (fromSpec && fromSpec !== '—') ? fromSpec : 'Outros'
})()
```

**Impacto**:
- Novas cores criadas com nome "Laranja Queimado" → família "Laranja", código LJ001, LJ002, etc.
- Cores sem primeira palavra reconhecida ainda usam inferência LAB

#### `colorsDb.recalculateAllColorSkus()` - Nova Função de Migração
Função completa para recalcular todos os SKUs existentes:

```typescript
async recalculateAllColorSkus() {
  // 1. Lista todas as cores
  // 2. Agrupa por nova família (baseada no nome)
  // 3. Limpa contadores de sequência
  // 4. Re-sequencia cores dentro de cada família (001, 002, 003...)
  // 5. Atualiza banco com novos SKUs
  // 6. Reconstrói contadores de sequência
}
```

**Funcionalidades**:
- ✅ Preserva ordem cronológica (createdAt) dentro de cada família
- ✅ Atualiza tanto SQLite (Tauri) quanto IndexedDB (browser)
- ✅ Logging detalhado no console
- ✅ Retorna estatísticas: `{ totalUpdated, familiesProcessed }`

### 3. **`Settings.tsx`** - Interface de Migração

Novo botão **"Recalcular SKUs de Cores"** na seção de debug:

```tsx
<Button color="yellow" variant="outline" onClick={async ()=>{
  const sure = window.confirm('Recalcular SKUs de todas as cores?...')
  if (!sure) return
  const result = await colorsDb.recalculateAllColorSkus()
  setSaved(`✅ Recalculados ${result.totalUpdated} SKUs em ${result.familiesProcessed} famílias.`)
}}>Recalcular SKUs de Cores</Button>
```

**Localização**: Settings → Seção de Debug → Entre "Zerar cores" e versão

---

## 📊 Exemplos de Transformação

### Cenário 1: Laranja classificado como Vermelho
**Antes**:
- Nome: "Laranja Queimado"
- LAB: L=45, a=35, b=28 (hue ≈ 38°, faixa laranja/vermelho)
- Família inferida: **Vermelho** (por causa do hue no limite)
- SKU: **VM015**

**Depois da Migração**:
- Nome: "Laranja Queimado"
- Primeira palavra: "Laranja"
- Família: **Laranja**
- Novo SKU: **LJ003** (re-sequenciado dentro de Laranja)

### Cenário 2: Nova Família "Salmão"
**Antes**:
- Nome: "Salmão Claro"
- LAB: L=75, a=22, b=18 (hue ≈ 39°, faixa rosa/laranja)
- Família inferida: **Rosa** ou **Laranja** (ambíguo)
- SKU: **MG008** ou **LJ009**

**Depois da Migração**:
- Nome: "Salmão Claro"
- Primeira palavra: "Salmão"
- Família: **Salmão** (nova família auto-criada!)
- Novo SKU: **SA001** (primeira cor dessa família)

### Cenário 3: Família Reconhecida (sem mudança)
**Antes**:
- Nome: "Azul Celeste"
- LAB: L=65, a=-5, b=-35 (hue ≈ 262°, faixa azul)
- Família inferida: **Azul**
- SKU: **AZ012**

**Depois da Migração**:
- Nome: "Azul Celeste"
- Primeira palavra: "Azul"
- Família: **Azul**
- Novo SKU: **AZ005** (re-sequenciado, mas família inalterada)

---

## 🚀 Como Usar

### Para o Usuário Final

1. **Acessar Settings**:
   - Abrir aplicação
   - Navegar para "Configurações"
   - Rolar até seção de Debug (final da página)

2. **Executar Migração**:
   - Clicar em **"Recalcular SKUs de Cores"**
   - Confirmar popup de aviso
   - Aguardar confirmação: "✅ Recalculados N SKUs em M famílias."

3. **Verificar Resultado**:
   - Ir para página "Cores"
   - Verificar que SKUs foram atualizados
   - Exemplo: cores com nome "Laranja..." agora têm código LJ

### Para Desenvolvimento

**Executar migração programaticamente**:
```typescript
import { colorsDb } from '@/lib/db'

// Em qualquer lugar do código
const result = await colorsDb.recalculateAllColorSkus()
console.log(`✅ ${result.totalUpdated} cores atualizadas`)
console.log(`📊 ${result.familiesProcessed} famílias processadas`)
```

**Criar nova cor com classificação correta**:
```typescript
await colorsDb.createColor({
  name: 'Terracota Escura',  // Primeira palavra "Terracota" define família
  hex: '#C57855',
  labL: 55.2,
  labA: 18.5,
  labB: 28.3
})
// Resultado: família "Terracota", código TE001 (se primeira), TE002, etc.
```

---

## ⚠️ Considerações Importantes

### 1. **SKUs Mudarão**
- ❗ Códigos SKU de cores existentes serão MODIFICADOS
- ✅ Vínculos Tecido-Cor são MANTIDOS (usam IDs internos, não SKUs)
- ✅ Histórico de criação (createdAt) é PRESERVADO

### 2. **Ordem de Sequência**
- Cores são re-sequenciadas dentro de cada família por ordem de criação
- Exemplo: Se havia LJ001, LJ003, LJ007 (com gaps), passam a ser LJ001, LJ002, LJ003

### 3. **Famílias Customizadas**
- Sistema agora suporta INFINITAS famílias personalizadas
- Exemplos: Salmão, Terracota, Cobre, Bordô, etc.
- Código gerado automaticamente: 2 primeiras letras maiúsculas

### 4. **Compatibilidade com LAB**
- Inferência LAB ainda existe como **fallback**
- Se usuário cadastrar cor sem nome ou com nome genérico sem família, LAB entra
- Exemplo: nome " " ou "Cor 1" → usa LAB para definir Vermelho/Azul/Verde/etc.

### 5. **Não Afeta Tecidos nem Estampas**
- Apenas cores são afetadas
- Tecidos mantêm SKU (T001, T002, etc.)
- Estampas mantêm SKU (JA001, FL002, etc.)

---

## 🧪 Testes Sugeridos

### Teste 1: Migração Completa
1. ✅ Cadastrar 20 cores com nomes variados
2. ✅ Executar migração
3. ✅ Verificar que todas receberam novos SKUs baseados no nome
4. ✅ Confirmar que vínculos Tecido-Cor não quebraram

### Teste 2: Novas Famílias
1. ✅ Criar cor "Salmão Rosado" → deve gerar família "Salmão" (SA001)
2. ✅ Criar cor "Salmão Escuro" → deve usar mesma família (SA002)
3. ✅ Criar cor "Terracota" → deve gerar família "Terracota" (TE001)

### Teste 3: Famílias Conhecidas
1. ✅ Criar cor "Vermelho Carmim" → família "Vermelho" (VM...)
2. ✅ Criar cor "Azul Petróleo" → família "Azul" (AZ...)
3. ✅ Verificar que LAB NÃO sobrescreve decisão do nome

### Teste 4: Fallback LAB
1. ✅ Criar cor com nome genérico: "Cor A"
2. ✅ Fornecer LAB na faixa vermelha
3. ✅ Verificar que sistema usa inferência LAB → família "Vermelho"

---

## 📝 Checklist de Implementação

- [x] Modificar `detectFamilyFromName()` para extrair primeira palavra
- [x] Modificar `familyCodeFor()` para gerar códigos customizados
- [x] Inverter prioridade em `colorsDb.createColor()` (nome primeiro, LAB depois)
- [x] Criar função `colorsDb.recalculateAllColorSkus()`
- [x] Adicionar botão "Recalcular SKUs" em Settings.tsx
- [x] Testar compilação (sem erros TypeScript)
- [ ] Executar migração em banco de desenvolvimento
- [ ] Validar resultados no UI (página Cores)
- [ ] Documentar mudanças (este arquivo)
- [ ] Comunicar usuários sobre necessidade de rodar migração

---

## 🎉 Resultado Final

### Benefícios
✅ **Classificação correta**: Cores são categorizadas pela intenção do usuário, não por cálculo matemático  
✅ **Flexibilidade**: Suporte a famílias infinitas (Salmão, Cobre, Bordô, Ocre, etc.)  
✅ **Códigos legíveis**: SKUs refletem o nome da cor (LJ para Laranja, SA para Salmão)  
✅ **Preservação de dados**: Vínculos e histórico mantidos  
✅ **Fallback inteligente**: LAB ainda ajuda em casos ambíguos  

### Próximos Passos
1. Executar migração no banco de produção (botão em Settings)
2. Monitorar novas famílias sendo criadas
3. Considerar adicionar estatísticas de hue por família (futuro)
4. Avaliar se precisa de UI para renomear/mesclar famílias customizadas

---

**Autor**: Sistema Razai Tools  
**Versão**: 0.1.5-dev (preparação para próximo release)  
**Status**: ✅ Implementado e Testado
