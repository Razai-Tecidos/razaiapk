# Correção de Erro de Renderização (removeChild)

**Data:** 26/11/2025
**Erro:** `NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
**Contexto:** O erro ocorria em produção (`razai-colaborador.vercel.app`), causando o crash da aplicação com a tela de "Algo deu errado".

## Causa Provável
Este erro é extremamente comum em aplicações React e geralmente é causado por:
1.  **Google Translate:** O usuário traduz a página, o Google insere tags `<font>` no DOM. O React tenta atualizar o DOM e falha porque a estrutura mudou.
2.  **Extensões de Browser:** Extensões que modificam o DOM (adblockers, grammarly, etc).
3.  **Hidratação:** Diferenças entre o HTML inicial e o que o React espera (menos provável aqui pois é SPA, mas possível se houver injeção de scripts).

## Solução Aplicada
Foi aplicado um "Monkey Patch" no arquivo `app/src/main.tsx` para interceptar as chamadas `removeChild` e `insertBefore` do DOM.

```typescript
// MONKEY PATCH: Fix for "Failed to execute 'removeChild' on 'Node'"
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function(child) {
    if (child.parentNode !== this) {
      if (console) console.error('Cannot remove a child from a different parent', child, this)
      return child
    }
    return originalRemoveChild.apply(this, arguments) as any
  }
  // ... (mesma lógica para insertBefore)
}
```

## Como Funciona
O patch verifica se o nó que está sendo removido (`child`) é realmente filho do nó pai (`this`).
- Se **SIM**: Executa a remoção normal.
- Se **NÃO**: Loga um erro no console (para debug) mas **não lança a exceção**, retornando o nó como se tivesse sido removido.

Isso impede que o React "quebre" (crash) a aplicação inteira quando encontra uma inconsistência no DOM causada por fatores externos. O React pode continuar funcionando, talvez com algum glitch visual menor, mas sem a tela branca de erro.
