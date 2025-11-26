#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const targetDir = path.join(root, 'app', 'src');

const mappings = new Map([
  ['Ã¡','á'],['Ã¢','â'],['Ã£','ã'],['Ãª','ê'],['Ã©','é'],['Ãº','ú'],['Ã³','ó'],['Ã´','ô'],['Ã­','í'],['Ã§','ç'],['Ã“','Ó'],['Ã‰','É'],['Ã€','À'],['Ãº','ú'],['Ãµ','õ'],['Ã‘','Ñ'],
  ['Ã','Á'],['Ã“','Ó'],['Ã”','Ô'],['Ãš','Ú'],['Ãœ','Ü'],['Ã²','ò'],['Ã¨','è'],['Ã¬','ì'],['Ã¼','ü'],['Ã ','à'],
  // Common Portuguese words broken
  ['vÃ­nculo','vínculo'],['VÃ­nculos','Vínculos'],['ConfiguraÃ§Ãµes','Configurações'],['instalaÃ§Ãµes','instalações'],['aplicaÃ§Ã£o','aplicação'],['ImportaÃ§Ã£o','Importação'],['ExportaÃ§Ã£o','Exportação'],['classificaÃ§Ã£o','classificação'],['geraÃ§Ã£o','geração'],['prÃ©via','prévia'],['PrÃ©via','Prévia'],['semelhante','semelhante'],['nÃ£o','não'],
  // Punctuation / symbols
  ['Â°','°'],['â€“','–'],['â€”','—'],['â€¢','•'],['â€¦','…'],['â€œ','“'],['â€','”'],['â€˜','‘'],['â€™','’'],['â€º','›'],['â€¹','‹'],['â„¹ï¸','ℹ️'],['âœ¨','✨'],['âš«','⚪'],['â‰¤','≤'],['â‰¥','≥'],['â†’','→'],
  // Misencoded emojis sequences
  ['ðŸ’¡','💡'],['ðŸ“Š','📚'],['ðŸŽ¨','🎨'],['ðŸ“¥','📦'],['ðŸ“¤','📥'],['ðŸ”„','🔄'],['ðŸ‘‰','👎'],['ðŸ‘','👍'],
]);

function fixContent(content){
  let out = content;
  for (const [bad, good] of mappings.entries()) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  return out;
}

function walk(dir){
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full); else if (/\.(ts|tsx|js|jsx|md|json)$/i.test(entry)) processFile(full);
  }
}

const changes = [];
function processFile(file){
  const orig = fs.readFileSync(file, 'utf8');
  const fixed = fixContent(orig);
  if (orig !== fixed) {
    changes.push(file);
    if (write) fs.writeFileSync(file, fixed, 'utf8');
  }
}

const write = process.argv.includes('--write');
walk(targetDir);

if (changes.length === 0) {
  console.log('[fix-encoding] Nenhuma ocorrência encontrada.');
} else {
  console.log(`[fix-encoding] Arquivos modificados (${changes.length}):`);
  for (const f of changes) console.log(' -', path.relative(root, f));
  if (!write) console.log('Rodar novamente com --write para aplicar alterações.');
}
