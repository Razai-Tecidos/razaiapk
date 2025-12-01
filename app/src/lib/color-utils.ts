// Conversões e inferências de cor (HEX/RGB/HSL/LAB) e deltaE CIE76

export type RGB = { r: number; g: number; b: number }
export type HSL = { h: number; s: number; l: number }
export type LAB = { L: number; a: number; b: number }

export function hexToRgb(hex: string): RGB | undefined {
  if (!hex) return undefined
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  return { r, g, b }
}

// HSL conversion not used; removed to reduce dead code.

// sRGB -> XYZ -> LAB (D65)
function srgbToLinear(u: number) { return (u <= 0.04045 ? u/12.92 : Math.pow((u+0.055)/1.055, 2.4)) }

export function rgbToXyz({ r, g, b }: RGB) {
  const R = srgbToLinear(r/255)
  const G = srgbToLinear(g/255)
  const B = srgbToLinear(b/255)
  // sRGB D65
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041
  return { X, Y, Z }
}

export function xyzToLab({ X, Y, Z }: { X: number; Y: number; Z: number }): LAB {
  // Reference white D65
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
  const fx = f(X / Xn)
  const fy = f(Y / Yn)
  const fz = f(Z / Zn)
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)
  return { L, a, b }
}

function f(t: number) { return t > Math.pow(6/29, 3) ? Math.cbrt(t) : (t/(3*Math.pow(6/29, 2)) + 4/29) }

// Inverso: LAB -> XYZ (D65)
function finv(u: number) { const t0 = Math.pow(6/29, 3); const t1 = Math.pow(6/29, 2)*3; return (u*u*u > t0) ? (u*u*u) : (t1*(u - 4/29)); }
export function labToXyz({ L, a, b }: LAB) {
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const X = Xn * finv(fx)
  const Y = Yn * finv(fy)
  const Z = Zn * finv(fz)
  return { X, Y, Z }
}

// XYZ -> RGB (sRGB D65)
function clamp01(x: number) { return Math.min(1, Math.max(0, x)) }
function linearToSrgb(u: number) { return u <= 0.0031308 ? 12.92*u : 1.055*Math.pow(u, 1/2.4) - 0.055 }
export function xyzToRgb({ X, Y, Z }: { X: number; Y: number; Z: number }): RGB {
  // Inverse matrix of sRGB D65
  const rLin = 3.2404542*X + (-1.5371385)*Y + (-0.4985314)*Z
  const gLin = (-0.9692660)*X + 1.8760108*Y + 0.0415560*Z
  const bLin = 0.0556434*X + (-0.2040259)*Y + 1.0572252*Z
  const r = Math.round(clamp01(linearToSrgb(rLin)) * 255)
  const g = Math.round(clamp01(linearToSrgb(gLin)) * 255)
  const b = Math.round(clamp01(linearToSrgb(bLin)) * 255)
  return { r, g, b }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to2(clamp01(r/255)*255|0)}${to2(clamp01(g/255)*255|0)}${to2(clamp01(b/255)*255|0)}`.toUpperCase()
}

export function labToHex(lab: LAB): string {
  const xyz = labToXyz(lab)
  const rgb = xyzToRgb(xyz)
  return rgbToHex(rgb)
}

export function hexToLab(hex: string): LAB | undefined {
  const rgb = hexToRgb(hex)
  if (!rgb) return undefined
  const xyz = rgbToXyz(rgb)
  return xyzToLab(xyz)
}

export function labFromPartial(params: { hex?: string; labL?: number; labA?: number; labB?: number }): LAB | undefined {
  if (typeof params.labL === 'number' && typeof params.labA === 'number' && typeof params.labB === 'number') {
    return { L: params.labL, a: params.labA, b: params.labB }
  }
  if (params.hex) return hexToLab(params.hex)
  return undefined
}

export function labHueAngle(LAB: LAB): number {
  let angle = Math.atan2(LAB.b, LAB.a) * (180/Math.PI)
  if (angle < 0) angle += 360
  return angle
}

// Calibração do Dispositivo (White Balance)
// Valores lidos da tampa de calibração do dispositivo do usuário
const DEVICE_WHITE_POINT = {
  L: 96.78,
  a: -0.48,
  b: -0.09
};

// O alvo ideal (Referência Neutra)
// Assumimos que a tampa de calibração é neutra (a=0, b=0).
// Mantemos o L original do sensor para não distorcer a luminância (não forçar L=100).
const TARGET_WHITE = {
  L: 96.78,
  a: 0,
  b: 0
};

/**
 * Aplica compensação de ponto branco (White Balance) em uma leitura LAB bruta.
 * Ajusta os valores baseados na diferença entre o branco do dispositivo e o branco ideal.
 */
export function compensateLab(raw: LAB): LAB {
  const deltaL = TARGET_WHITE.L - DEVICE_WHITE_POINT.L;
  const deltaA = TARGET_WHITE.a - DEVICE_WHITE_POINT.a;
  const deltaB = TARGET_WHITE.b - DEVICE_WHITE_POINT.b;

  return {
    L: Number(Math.min(100, Math.max(0, raw.L + deltaL)).toFixed(2)),
    a: Number((raw.a + deltaA).toFixed(2)),
    b: Number((raw.b + deltaB).toFixed(2))
  };
}

// CIE76 metric not used; keeping only CIEDE2000 implementation.

// Funções auxiliares para CIEDE2000
function degrees(n: number) { return n * 180 / Math.PI }
function radians(n: number) { return n * Math.PI / 180 }

function atan2deg(y: number, x: number) { const ang = degrees(Math.atan2(y, x)); return ang < 0 ? ang + 360 : ang }

export function ciede2000(lab1: LAB, lab2: LAB): number {
  // Implementação baseada na publicação original e dados de Bruce Lindbloom
  const { L: L1, a: a1, b: b1 } = lab1
  const { L: L2, a: a2, b: b2 } = lab2
  const avgLp = (L1 + L2) / 2
  const C1 = Math.sqrt(a1*a1 + b1*b1)
  const C2 = Math.sqrt(a2*a2 + b2*b2)
  const avgC = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.sqrt(a1p*a1p + b1*b1)
  const C2p = Math.sqrt(a2p*a2p + b2*b2)
  const avgCp = (C1p + C2p) / 2
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360
  let dhp = h2p - h1p
  if (dhp > 180) dhp -= 360
  if (dhp < -180) dhp += 360
  const dHp = 2 * Math.sqrt(C1p*C2p) * Math.sin(radians(dhp) / 2)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let avgHp = h1p + h2p
  if (Math.abs(h1p - h2p) > 180) avgHp += 360
  avgHp /= 2
  const T = 1 - 0.17 * Math.cos(radians(avgHp - 30))
              + 0.24 * Math.cos(radians(2 * avgHp))
              + 0.32 * Math.cos(radians(3 * avgHp + 6))
              - 0.20 * Math.cos(radians(4 * avgHp - 63))
  const Sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2))
  const Sc = 1 + 0.045 * avgCp
  const Sh = 1 + 0.015 * avgCp * T
  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2))
  const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)))
  const Rt = -Rc * Math.sin(radians(2 * dTheta))
  const kl = 1, kc = 1, kh = 1
  return Math.sqrt(
    Math.pow(dLp / (kl * Sl), 2) +
    Math.pow(dCp / (kc * Sc), 2) +
    Math.pow(dHp / (kh * Sh), 2) +
    Rt * (dCp / (kc * Sc)) * (dHp / (kh * Sh))
  )
}

// Diferença de matiz (ΔH°) em graus usando ângulo no plano a*b*
// Delta hue helper not used externally; removed.

// Inferência simplificada de família de cor
export interface HueBoundaries {
  vermelhoStart: number; // início do setor Vermelho (wrap 360)
  laranjaStart: number;
  amareloStart: number;
  verdeStart: number;
  verdeEnd: number; // fim do setor Verde (independente do início de Azul)
  azulStart: number;
  roxoStart: number;
  magentaStart: number; // início de Rosa (antes chamado Magenta); depois volta para vermelhoStart
}

export const DEFAULT_HUE_BOUNDS: HueBoundaries = {
  // Padrão de referência (setores contíguos em LAB a*b*):
  // Vermelho: 345–20 | Laranja: 20–65 | Amarelo: 65–95 | Verde: 95–170
  // Azul: 170–270 | Roxo: 270–310 | Rosa: 310–345
  vermelhoStart: 345,
  laranjaStart: 20,
  amareloStart: 65,
  verdeStart: 95,
  verdeEnd: 170,
  azulStart: 170,
  roxoStart: 270,
  magentaStart: 310,
}

let dynamicHueBounds: HueBoundaries = DEFAULT_HUE_BOUNDS
export function setHueBoundaries(b: Partial<HueBoundaries>) {
  dynamicHueBounds = { ...dynamicHueBounds, ...b }
}
export function getHueBoundaries(): HueBoundaries { return dynamicHueBounds }

export function inferFamilyFrom({ hex, labL, labA, labB }: { hex?: string; labL?: number; labA?: number; labB?: number }): string {
  // Inferir SEM usar HSL/RGB; trabalhar somente em espaço LAB
  let L: number | undefined, a: number | undefined, b: number | undefined
  if (typeof labL === 'number' && typeof labA === 'number' && typeof labB === 'number') {
    L = labL; a = labA; b = labB
  } else if (hex) {
    const lab = hexToLab(hex)
    if (lab) { L = lab.L; a = lab.a; b = lab.b }
  }

  if (L === undefined || a === undefined || b === undefined) return '—'

  // Acromáticos por baixo croma no plano a*b* e L
  const light = L / 100
  const chroma = Math.sqrt(a*a + b*b)
  const isLowChroma = chroma < 5
  if (isLowChroma) {
    if (light >= 0.91) return 'Branco' // Ajustado para L >= 91 (inclui 91.80)
    if (light <= 0.1) return 'Preto'
    return 'Cinza'
  }

  // Hue pelo plano a*b*
  const hue = labHueAngle({ L, a, b })

  // Roxo profundo/malva: roxos e magentas com b* negativo (componente azul)
  // Expandido para capturar mais roxos que caem nas zonas Rosa e Vermelho
  // Casos a capturar:
  //  - #9C7894, #6E3866, #873767 (hue 332-344°, zona Rosa)
  //  - #57385C (hue 322°, zona Rosa)
  //  - #80355D, #97376B (hue 348°, zona Vermelho)
  //  - #9D4283 (hue 338°, magenta vibrante)
  // Critérios:
  //  - hue >= 310 && hue < 350 (zona ampla Rosa + início Vermelho)
  //  - b < 0 (componente azul/negativo em LAB, fundamental para roxo)
  //  - chroma >= 15 (exclui tons muito dessaturados)
  //  - Para roxos escuros/médios (L < 55%): sempre roxo se b* negativo e chroma moderado
  //  - Para roxos mais claros/vibrantes (L >= 55%): requer b/a mais negativo (-0.6 ou menor) para diferenciar de rosa
  //  - EXCEÇÃO: vinhos/burgundy escuros com b* MUITO levemente negativo (-8 < b < 0) e hue > 347° e chroma < 40 permanecem Vermelho/Bordô
  {
    const chroma = Math.sqrt(a*a + b*b)
    const ratio = b / a
    const light = L / 100
    
    if (hue >= 310 && hue < 350 && b < 0 && chroma >= 15) {
      // Exceção para burgundy/vinhos: hue muito próximo de vermelho (> 347°) e b* MUITO levemente negativo
      // Ex: #762F55 (hue 348°, b=-7.56, chroma=36.38) deve ficar como Vermelho/Bordô, não Roxo
      // Mas #80355D (hue 348°, b=-7.92, chroma=37.93) e #97376B (hue 348.37°, b=-9.38, chroma=46.52) devem ser Roxo
      // Diferença: burgundy tem b* mais próximo de zero E chroma menor E mais escuro
      if (hue > 347 && b > -8 && chroma < 37) {
        // Este é um vinho/burgundy, não roxo - pula esta regra
      } else {
        // Roxos escuros e médios: se L < 55% e tem b* negativo, é roxo
        if (light < 0.55) {
          return 'Roxo'
        }
        // Roxos mais claros/vibrantes: precisa ter ratio b/a mais negativo para ser roxo
        // (evita capturar rosas vibrantes como #EC407A que têm b/a ~0.11)
        if (ratio < -0.35) {
          return 'Roxo'
        }
      }
    }
  }

  // Rosa vibrante escuro: pink/fúcsia profundo (magenta avermelhado)
  // Captura tons como #AF1E4A que são visualmente "pink escuro" ou "fúcsia profundo"
  // Critérios:
  //  - hue na zona vermelha central (345°-20° wrap, ou seja hue > 345 || hue < 20)
  //  - chroma alto (>= 50) => cor saturada e vibrante
  //  - luminosidade 25-50% (escuro mas não extremo)
  //  - a* dominante (a > 45) com b* relativamente baixo (b/a < 0.35)
  // Isso diferencia de:
  //  - Bordô: vinhos mais apagados, menos saturados
  //  - Vermelho: tons mais alaranjados ou com b* maior
  {
    const chroma = Math.sqrt(a*a + b*b)
    const razaoBsobreA = b / a
    if ((hue > 345 || hue < 20) && chroma >= 50 && light >= 0.25 && light <= 0.50 && a > 45 && razaoBsobreA < 0.35) {
      return 'Rosa'
    }
  }

  // Bordô: vinhos escuros (profundos) entre vermelho e início de laranja com b* baixo relativo
  // Critérios (derivados dos 6 hex fornecidos):
  //  - L < 40% (escuro)
  //  - hue dentro do arco 345°–25° (wrap) => (hue >= 345 || hue < 25)
  //  - a* > 18 (vermelho/magenta dominante)
  //  - b* >= 0 (evita burgundy mais púrpura #762F55 manter em Vermelho)
  //  - |b*| < a* * 0.5 (evita tons mais alaranjados / marrons como #8F1C2C? ainda entra pois ratio ~0.44)
  //  - chroma entre 18 e 60 (evita cinzas e saturações extremas irrelevantes)
  // Isso captura: #612B33 #4A1526 #672637 #812B38 #542C38 #8F1C2C
  if (light < 0.40 && (hue >= 345 || hue < 25) && a > 18 && b >= 0) {
    const chroma = Math.sqrt(a*a + b*b)
    if (chroma >= 18 && chroma <= 60 && Math.abs(b) < a * 0.5) {
      return 'Bordô'
    }
  }
  // Bordô (subfaixa desaturada): vinhos muito escuros e mais apagados
  // Ex.: #483638 (L~24.6, a~8.4, b~1.9, hue~12° c~8.6)
  if (light < 0.35 && (hue >= 350 || hue < 20) && a > 7 && a < 20 && b >= 0 && b <= 10) {
    const chroma = Math.sqrt(a*a + b*b)
    if (chroma >= 6 && chroma <= 20) return 'Bordô'
  }

  

  // Rosa claro/médio: tons rosados claros que caem na faixa 0-40°
  // Captura rosas claros (#DC8592, #E97989, #F2CCCE) que seriam classificados como Vermelho
  // Critério: a* dominante (a > 12), b* pequeno em relação a a* (b < a*0.5), hue 0-40°, luminosidade média-alta
  // Exclui salmões vibrantes que devem ser Laranja (requer b* pequeno absoluto ou chroma baixo)
  if (a > 12 && b >= 0 && (hue < 40 || hue > 340) && light > 0.45) {
    // Caso especial: "rosa envelhecido" perto do limite 35–40°
    // Características: hue 33–40°, b* baixo (~<=12.2), croma moderado 18–26, light entre 0.58–0.71
    // Ex.: #C29188 -> L≈64.6%, a≈17.2, b≈12.0, c≈21.0, hue≈34.9°
    if (hue >= 33 && hue < 40 && b <= 12.2 && chroma > 18 && chroma < 26 && light >= 0.58 && light <= 0.71) {
      return 'Rosa'
    }

    // Rosa: tons com baixo amarelo relativo (b/a < 0.65) e luminosidade média-alta
    // Rosa salmão (#DC9F9F: b/a=0.40, light=71%), rosa coral claro (#E9A79E: b/a=0.62, light=75%)
    // vs terracotta (#C58C89: b/a=0.48 mas light=64%, tons mais escuros ficam como Laranja)
    const razaoBsobreA = b / a
    if (razaoBsobreA < 0.65) {
      // Se hue 20-40° (zona laranja), precisa ser mais claro (light > 0.70) para ser Rosa
      if (hue >= 20 && hue < 40) {
        if (light > 0.70) return 'Rosa'
      } else {
        // Fora da zona laranja (hue 0-20° ou 340-360°), aceita lightness menor
        if (b < 15 || chroma < 30) return 'Rosa'
      }
    }
  }

  // Vermelho (quente) especial: tons muito saturados em 20–40° que visualmente são vermelhos, não marrom/laranja
  // Exemplos: #CC3227, #9A2626, #750919, #D12626, #E15B55, #BA3543
  // Critérios:
  //  - hue entre 20° e 40° (faixa laranja em LAB)
  //  - croma alto (>= 45)
  //  - a* dominante (a >= 40)
  //  - b/a <= 0.80 (não tão amarelado quanto laranja/marrom)
  //  - 0.20 <= light <= 0.65 (evita extremos muito claros/escuros fora de percepção de vermelho vivo)
  {
    const chroma = Math.sqrt(a*a + b*b)
    const ratio = b / a
    const light = L / 100
    if (hue >= 20 && hue < 40 && chroma >= 45 && a >= 40 && ratio <= 0.80 && light >= 0.20 && light <= 0.65) {
      return 'Vermelho'
    }
  }

  // Bege: tons dessaturados de laranja/amarelo com luminosidade alta
  // Critério: croma médio-baixo (não cinza), luz alta, matiz laranja/amarelo
  // Ampliado para chroma < 25 e hue < 105° para capturar amarelos muito claros
  // Restrito para hue >= 30° para excluir tons rosados
  // Mas exclui terracotta/coral com chroma > 18 no range 30-40° que devem ser Laranja
  if (chroma >= 5 && chroma < 25 && light > 0.55 && hue >= 30 && hue < 105) {
    // Não captura terracotta/coral (hue 30-40°, chroma > 18)
    if (!(hue >= 30 && hue < 40 && chroma > 18)) return 'Bege'
  }

  // Marrom: faixa laranja/amarelo escurecida (expandido para incluir cobre/bronze)
  // Primário: L < 50% e hue 20–65° (tons de cobre)
  if (light < 0.50 && hue >= 20 && hue < 65) return 'Marrom'
  // Secundário (tons médios terrosos próximos do limite laranja):
  // L 50–60%, hue 55–65°, chroma moderado (<32) => marrom claro em vez de laranja/amarelo
  if (light >= 0.50 && light < 0.60 && hue >= 55 && hue < 65) {
    const chroma = Math.sqrt(a*a + b*b)
    if (chroma < 32) return 'Marrom'
  }

  // Marrom (subfaixa oliva escuro): tons escuros na faixa 65–100° com croma moderado e a* pequeno
  // Captura marrons oliva escuros que podem cair como Amarelo/Verde em LAB, mas perceptualmente são marrons
  // Exemplos: #605739 (hue~94°, L~37, c~18.8), #75644B (hue~80.5°, L~43, c~17), #5E4D35 (hue~78.7°, L~34, c~17.2)
  // Critérios:
  //  - L < 48%
  //  - hue entre 65° e 100°
  //  - chroma entre 8 e 24 (exclui amarelos vivos)
  //  - |a*| pequeno (<= 6) ou (a* <= 10 e b* >= 12) para aceitar leve tendência amarelada
  if (light < 0.48 && hue >= 65 && hue < 100) {
    const absA = Math.abs(a)
    if (chroma >= 8 && chroma < 24) {
      if (absA <= 6 || (a <= 10 && b >= 12)) {
        return 'Marrom'
      }
    }
  }

  // Azul escuro: cores muito escuras com forte componente azul (b* negativo dominante)
  // Captura azuis muito escuros (#19192C) que teriam ângulo de matiz na região roxa
  // mas perceptualmente são azuis devido ao b* fortemente negativo
  if (light < 0.20 && b < -5 && Math.abs(b) > Math.abs(a)) return 'Azul'

  const bnds = dynamicHueBounds
  // Função auxiliar para verificar setor circular
  function inArc(start: number, end: number, value: number) {
    if (start <= end) return value >= start && value < end
    // wrap
    return value >= start || value < end
  }
  // Sem tolerância e sem "ciano": Verde e Azul têm intervalos independentes.
  if (inArc(bnds.vermelhoStart, bnds.laranjaStart, hue)) return 'Vermelho'
  if (inArc(bnds.laranjaStart, bnds.amareloStart, hue)) return 'Laranja'
  if (inArc(bnds.amareloStart, bnds.verdeStart, hue)) return 'Amarelo'
  if (inArc(bnds.verdeStart, bnds.verdeEnd, hue)) return 'Verde'
  // Azul usa seu próprio início independente
  if (inArc(bnds.azulStart, bnds.roxoStart, hue)) return 'Azul'
  if (inArc(bnds.roxoStart, bnds.magentaStart, hue)) return 'Roxo'
  if (inArc(bnds.magentaStart, bnds.vermelhoStart, hue)) return 'Rosa'
  return '—'
}

// Lista de famílias reconhecidas (pt-BR)
export const FAMILY_NAMES = [
  'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa', 'Bordô', 'Marrom', 'Bege', 'Cinza', 'Preto', 'Branco'
]

// Tokens aceitos no início do nome (inclui sinônimos como Ciano/Magenta)
export const FAMILY_TOKENS = [
  ...FAMILY_NAMES,
  'Ciano', // sinônimo que cai em Azul
  'Magenta', // sinônimo que cai em Rosa
]

// Mapeamento fixo e único de códigos de 2 letras por família (iniciais baseadas no início do nome)
const FAMILY_CODES: Record<string, string> = {
  Vermelho: 'VM',
  Laranja: 'LJ',
  Amarelo: 'AM',
  Verde: 'VD', // evitar conflito com Vermelho
  Azul: 'AZ',
  Roxo: 'RX',
  Rosa: 'MG', // manter código para compatibilidade com nomes antigos (Magenta)
  Bordô: 'BO',
  Marrom: 'MR',
  Bege: 'BG',
  Cinza: 'CZ',
  Preto: 'PT',
  Branco: 'BR',
}

export function familyCodeFor(familyName: string): string {
  // Normalizar sinônimos: Ciano -> Azul, Magenta -> Rosa
  const norm = normalizeFamilyName(familyName)
  const key = FAMILY_NAMES.find(f => f.toLowerCase() === norm.toLowerCase())
  if (key) return FAMILY_CODES[key]
  
  // For custom families (not in FAMILY_NAMES), generate code from first 2 letters
  const s = norm.trim()
  if (s.length === 0) return 'OT'
  if (s.length === 1) return s.toUpperCase() + 'X'
  return s.slice(0, 2).toUpperCase()
}

export function detectFamilyFromName(name: string): string | null {
  const s = (name || '').trim()
  if (!s) return null
  
  // Extract the FIRST WORD from the name (user's visual assessment)
  const firstWord = s.split(/\s+/)[0]
  if (!firstWord) return null
  
  // If first word is purely numeric, return null (no family)
  if (/^\d+$/.test(firstWord)) return null
  
  const firstWordLower = firstWord.toLowerCase()
  
  // Check if first word matches a known family token (including synonyms)
  for (const token of FAMILY_TOKENS) {
    const low = token.toLowerCase()
    if (firstWordLower === low) return normalizeFamilyName(token)
  }
  
  // If first word is NOT a recognized family token, treat it AS a new family
  // Capitalize first letter for display (e.g., "Salmão" → "Salmão", "terracota" → "Terracota")
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
}

function normalizeFamilyName(n: string): string {
  const s = (n || '').trim().toLowerCase()
  if (s === 'ciano') return 'Azul'
  if (s === 'magenta') return 'Rosa'
  if (s === 'rosa') return 'Rosa'
  return n
}
