// Mensagens padronizadas (pt-BR)
// Centraliza textos de toasts e confirmações para manter consistência

export const messages = {
  confirm: {
    discard: 'Descartar alterações?',
    deleteColorOne: (name: string) => `Tem certeza que deseja excluir a cor "${name}"?`,
    deleteColorMany: (n: number) => `Tem certeza que deseja excluir ${n} cores selecionadas?`,
    deleteTissueOne: (name: string) => `Tem certeza que deseja excluir o tecido "${name}"?`,
    deleteTissueMany: (n: number) => `Tem certeza que deseja excluir ${n} tecidos selecionados?`,
  },
  toast: {
    color: {
      created: 'Cor adicionada',
      createdMany: (n: number) => `${n} cores adicionadas`,
      updated: 'Cor atualizada',
      deletedOne: 'Cor excluída',
      deletedMany: 'Cores excluídas',
    },
    tissue: {
      created: 'Tecido adicionado',
      updated: 'Tecido atualizado',
      deletedOne: 'Tecido excluído',
      deletedMany: 'Tecidos excluídos',
    },
    genericError: 'Ocorreu um erro. Tente novamente.'
  },
  validation: {
    required: 'Obrigatório',
    min2: 'Mínimo 2 caracteres',
    max120: 'Máximo 120 caracteres',
    duplicateName: 'Nome já cadastrado',
    hexOrLabRequired: 'Preencha HEX ou LAB completo (L, a, b)',
    invalidHex: 'HEX inválido (use #RRGGBB)',
    labIncomplete: 'Informe L, a e b',
  }
}

export type Messages = typeof messages
