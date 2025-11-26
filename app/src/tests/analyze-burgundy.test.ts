import { describe, it } from 'vitest';
import { inferFamilyFrom, hexToLab } from '../lib/color-utils';

describe('Análise detalhada #762F55 (Burgundy)', () => {
  it('mostra métricas LAB completas', () => {
    const hex = '#762F55';
    const family = inferFamilyFrom({ hex });
    const lab = hexToLab(hex);

    if (!lab) {
      console.log('Erro ao converter para LAB');
      return;
    }

    const { L, a, b } = lab;
    const chroma = Math.sqrt(a*a + b*b);
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    const hueNorm = hue < 0 ? hue + 360 : hue;
    const light = L / 100;
    const ratio = b / a;

    console.log('\n═══════════════════════════════════════');
    console.log('  ANÁLISE: #762F55 (BURGUNDY)');
    console.log('═══════════════════════════════════════');
    console.log(`HEX: ${hex}`);
    console.log(`RGB: R=${parseInt('76', 16)}, G=${parseInt('2F', 16)}, B=${parseInt('55', 16)}`);
    console.log(`LAB: L=${L.toFixed(2)}, a=${a.toFixed(2)}, b=${b.toFixed(2)}`);
    console.log(`Hue: ${hueNorm.toFixed(2)}°`);
    console.log(`Chroma: ${chroma.toFixed(2)}`);
    console.log(`Lightness: ${(light * 100).toFixed(1)}%`);
    console.log(`b/a ratio: ${ratio.toFixed(2)}`);
    console.log(`\nFamília atual: ${family}`);
    console.log('\n🎨 ANÁLISE VISUAL:');
    console.log('RGB(118, 47, 85) = Vinho escuro/Burgundy');
    console.log('- Tom predominante: Vinho/Bordô com leve tendência roxa');
    console.log('- b* negativo (-7.56) indica componente azul (roxo)');
    console.log('- Mas visualmente é mais vinho/bordô que roxo puro');
    console.log('\n💡 DECISÃO:');
    console.log('Burgundy é um tom de vinho que fica entre Bordô e Roxo.');
    console.log('Com b* negativo e hue 348°, tecnicamente tem componente roxo.');
    console.log('Opções:');
    console.log('  A) Manter como Roxo (pela presença de b* negativo)');
    console.log('  B) Voltar para Vermelho/Bordô (pela percepção visual de vinho)');
    console.log('  C) Criar exceção específica para burgundy');
    console.log('═══════════════════════════════════════\n');
  });
});
