import { describe, it } from 'vitest';
import { inferFamilyFrom } from '../lib/color-utils';

describe('Verificação de mudanças na classificação', () => {
  it('verifica cores que podem ter mudado de família', () => {
    const testCases = [
      // Amethyst - era Rosa, agora pode ser Roxo
      { hex: '#9B59B6', name: 'Amethyst', oldFamily: 'Rosa' },
      { hex: '#8E44AD', name: 'Wisteria', oldFamily: 'Rosa' },
      { hex: '#6A1B9A', name: 'Deep Purple', oldFamily: 'Rosa' },
      
      // Purple A700 - era Rosa
      { hex: '#8E24AA', name: 'Purple A700', oldFamily: 'Rosa' },
      { hex: '#9C27B0', name: 'Material Purple', oldFamily: 'Rosa' },
      
      // Burgundy - era Vermelho, pode virar Roxo
      { hex: '#762F55', name: 'Dark Burgundy', oldFamily: 'Vermelho' },
      
      // Pink controls - devem permanecer Rosa
      { hex: '#EC407A', name: 'Pink', oldFamily: 'Rosa' },
      { hex: '#DC8592', name: 'Light Pink', oldFamily: 'Rosa' },
      { hex: '#E97989', name: 'Coral Pink', oldFamily: 'Rosa' },
      { hex: '#F2CCCE', name: 'Pastel Pink', oldFamily: 'Rosa' },
      { hex: '#C7999E', name: 'Dusty Rose', oldFamily: 'Rosa' },
      { hex: '#DC9F9F', name: 'Light Pink Salmon', oldFamily: 'Rosa' },
      { hex: '#E9A79E', name: 'Light Coral Pink', oldFamily: 'Rosa' },
      { hex: '#C29188', name: 'Vintage Rose', oldFamily: 'Rosa' },
    ];

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║        VERIFICAÇÃO DE MUDANÇAS NA CLASSIFICAÇÃO               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    let changed = 0;
    let unchanged = 0;

    testCases.forEach(({ hex, name, oldFamily }) => {
      const newFamily = inferFamilyFrom({ hex });
      const status = newFamily === oldFamily ? '✓' : '⚠️ MUDOU';
      
      if (newFamily !== oldFamily) {
        console.log(`${status} ${hex}  ${name.padEnd(25)} ${oldFamily} → ${newFamily}`);
        changed++;
      } else {
        console.log(`${status} ${hex}  ${name.padEnd(25)} ${oldFamily}`);
        unchanged++;
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total: ${testCases.length} cores | Mudanças: ${changed} | Inalteradas: ${unchanged}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
});
