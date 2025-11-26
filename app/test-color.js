// Test color #FFCC00
function hexToRgb(hex) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  return { r, g, b }
}

function srgbToLinear(u) { 
  return (u <= 0.04045 ? u/12.92 : Math.pow((u+0.055)/1.055, 2.4)) 
}

function rgbToXyz({ r, g, b }) {
  const R = srgbToLinear(r/255)
  const G = srgbToLinear(g/255)
  const B = srgbToLinear(b/255)
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041
  return { X, Y, Z }
}

function f(t) { 
  return t > Math.pow(6/29, 3) ? Math.cbrt(t) : (t/(3*Math.pow(6/29, 2)) + 4/29) 
}

function xyzToLab({ X, Y, Z }) {
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
  const fx = f(X / Xn)
  const fy = f(Y / Yn)
  const fz = f(Z / Zn)
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)
  return { L, a, b }
}

function labHueAngle(lab) {
  let angle = Math.atan2(lab.b, lab.a) * (180/Math.PI)
  if (angle < 0) angle += 360
  return angle
}

// Get hex from command line or use default
const hex = process.argv[2] ? '#' + process.argv[2].replace('#', '') : '#AF1E4A'
const rgb = hexToRgb(hex)
const xyz = rgbToXyz(rgb)
const lab = xyzToLab(xyz)
const hue = labHueAngle(lab)
const chroma = Math.hypot(lab.a, lab.b)

console.log('Hex:', hex)
console.log('RGB:', rgb)
console.log('LAB: L=' + lab.L.toFixed(2), 'a=' + lab.a.toFixed(2), 'b=' + lab.b.toFixed(2))
console.log('Hue:', hue.toFixed(2), '°')
console.log('Chroma:', chroma.toFixed(2))
console.log('')

// All boundaries
const bounds = {
  vermelho: [345, 20],     // wraps around 0°
  laranja: [20, 55],
  amarelo: [55, 95],
  verde: [95, 170],
  ciano: [170, 210],
  azul: [210, 270],
  roxo: [270, 310],
  magenta: [310, 345]
}

console.log('Classificação por hue:')
let classification = 'indefinido'
if ((hue >= 345 || hue < 20) && chroma > 10) {
  classification = 'VERMELHO'
} else if (hue >= 20 && hue < 55 && chroma > 10) {
  classification = 'LARANJA'
} else if (hue >= 55 && hue < 95 && chroma > 10) {
  classification = 'AMARELO'
} else if (hue >= 95 && hue < 170 && chroma > 10) {
  classification = 'VERDE'
} else if (hue >= 170 && hue < 210 && chroma > 10) {
  classification = 'CIANO'
} else if (hue >= 210 && hue < 270 && chroma > 10) {
  classification = 'AZUL'
} else if (hue >= 270 && hue < 310 && chroma > 10) {
  classification = 'ROXO'
} else if (hue >= 310 && hue < 345 && chroma > 10) {
  classification = 'MAGENTA/ROSA'
} else if (chroma <= 10) {
  classification = 'CINZA/NEUTRO (baixa saturação)'
}

console.log('→', classification)
console.log('')
console.log('Boundaries:')
Object.entries(bounds).forEach(([name, [start, end]]) => {
  console.log(`  ${name}: ${start}° - ${end}°`)
})
