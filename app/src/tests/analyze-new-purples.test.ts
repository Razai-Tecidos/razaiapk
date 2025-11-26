import { describe, it } from 'vitest';
import { inferFamilyFrom } from '../lib/color-utils';

describe('Diagnóstico de novas cores reportadas', () => {
  it('imprime métricas LAB e família atual', () => {
    const colors = [
      { hex: '#57385C', expected: 'Roxo (visualmente roxo escuro)' },
      { hex: '#80355D', expected: 'Roxo (visualmente roxo médio)' },
      { hex: '#372643', expected: 'Roxo (visualmente roxo muito escuro/azulado)' },
      { hex: '#9D4283', expected: 'Roxo ou Rosa (magenta vibrante)' },
      { hex: '#97376B', expected: 'Roxo (magenta escuro)' },
    ];

    console.log('\n═══════════════════════════════════════');
    console.log('  MÉTRICAS: NOVAS CORES REPORTADAS');
    console.log('═══════════════════════════════════════');

    colors.forEach(({ hex, expected }) => {
      const family = inferFamilyFrom({ hex });
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;

      // Convert to LAB
      let rNorm = r / 255;
      let gNorm = g / 255;
      let bNorm = b / 255;

      // sRGB to linear RGB
      rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
      gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
      bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

      // RGB to XYZ (D65)
      const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
      const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175;
      const z = rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041;

      // XYZ to LAB
      const xn = 0.95047;
      const yn = 1.0;
      const zn = 1.08883;

      const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : 7.787 * (x / xn) + 16 / 116;
      const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : 7.787 * (y / yn) + 16 / 116;
      const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : 7.787 * (z / zn) + 16 / 116;

      const L = 116 * fy - 16;
      const a = 500 * (fx - fy);
      const bStar = 200 * (fy - fz);

      const chroma = Math.sqrt(a * a + bStar * bStar);
      const hue = (Math.atan2(bStar, a) * 180) / Math.PI;
      const hueNorm = hue < 0 ? hue + 360 : hue;
      const light = L / 100;
      const ratio = a !== 0 ? bStar / a : 0;

      console.log(
        `${hex} -> fam=${family} L=${L.toFixed(2)} a=${a.toFixed(2)} b=${bStar.toFixed(2)} hue=${hueNorm.toFixed(2)}° chroma=${chroma.toFixed(2)} light=${(light * 100).toFixed(1)}% b/a=${ratio.toFixed(2)}`
      );
      console.log(`  Esperado: ${expected}`);
    });

    console.log('═══════════════════════════════════════\n');
  });
});
