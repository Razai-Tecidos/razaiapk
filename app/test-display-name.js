// Test displayName logic
const FAMILY_TOKENS = [
  'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa', 'Marrom', 'Bege', 'Cinza', 'Preto', 'Branco',
  'Ciano', 'Magenta'
];

function testDisplayName() {
  const inferredFamily = 'Amarelo'; // #FFCC00 infere Amarelo (hue 87.53°)
  const savedName = 'Verde Teste';
  
  const trimmed = savedName.trim();
  const anyFamRegex = new RegExp('^(' + FAMILY_TOKENS.join('|') + ')(?:\\s+|$)', 'i');
  console.log('Regex:', anyFamRegex);
  console.log('Trimmed:', trimmed);
  console.log('Match:', trimmed.match(anyFamRegex));
  
  const rest = trimmed.replace(anyFamRegex, '').trim();
  console.log('Rest after removing prefix:', rest);
  
  const displayName = rest ? `${inferredFamily} ${rest}` : inferredFamily;
  console.log('Display name:', displayName);
  console.log('Expected: Amarelo Teste');
}

testDisplayName();
