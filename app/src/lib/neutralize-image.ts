// LAB-based image neutralization utility
// Converts any image to a neutral mid-gray (L* target, a=b=0) for recoloring
// Usage: await neutralizeImageToGray(fileOrImage, lTarget = 58)

export async function neutralizeImageToGray(
  input: File | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  lTarget: number = 58
): Promise<HTMLCanvasElement> {
  let img: HTMLImageElement | HTMLCanvasElement | ImageBitmap
  if (input instanceof File) {
    img = await loadImageFromFile(input)
  } else {
    img = input
  }
  // Downscale to max 500px for normalization
  const maxDim = 500
  const scale = Math.min(1, maxDim / Math.max((img as any).naturalWidth || (img as any).width, (img as any).naturalHeight || (img as any).height))
  const w = Math.max(1, Math.round(((img as any).naturalWidth || (img as any).width) * scale))
  const h = Math.max(1, Math.round(((img as any).naturalHeight || (img as any).height) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img as any, 0, 0, w, h)
  // Get pixel data
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  // Compute mean L* of near-gray pixels
  let sumL = 0, count = 0
  const chromaMax = 10
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const [L, a, b_] = rgbToLabFast(r, g, b)
    const C = Math.hypot(a, b_)
    if (C < chromaMax) { sumL += L; count++ }
  }
  const lMean = count > 0 ? (sumL / count) : lTarget
  const lGain = lMean > 0 ? (lTarget / lMean) : 1
  // Neutralize all pixels to (L*,0,0) and convert back to RGB
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const [L] = rgbToLabFast(r, g, b)
    const Ln = Math.min(100, Math.max(0, L * lGain))
    const fy = (Ln + 16) / 116
    const fx = fy, fz = fy
    const whiteX = 0.95047, whiteY = 1.0, whiteZ = 1.08883
    const xr = finv(fx), yr = finv(fy), zr = finv(fz)
    const X = whiteX * xr, Y = whiteY * yr, Z = whiteZ * zr
    const rl =  3.2404542*X + -1.5371385*Y + -0.4985314*Z
    const gl = -0.9692660*X +  1.8760108*Y +  0.0415560*Z
    const bl =  0.0556434*X + -0.2040259*Y +  1.0572252*Z
    const toSrgb = (c: number) => c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(c, 1/2.4)-0.055
    const R = Math.min(255, Math.max(0, Math.round(toSrgb(rl)*255)))
    const G = Math.min(255, Math.max(0, Math.round(toSrgb(gl)*255)))
    const B = Math.min(255, Math.max(0, Math.round(toSrgb(bl)*255)))
    data[i] = R; data[i+1] = G; data[i+2] = B
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

function rgbToLabFast(r: number, g: number, b: number): [number, number, number] {
  const sr = r/255, sg = g/255, sb = b/255
  const rl = sr <= 0.04045 ? sr/12.92 : Math.pow((sr+0.055)/1.055, 2.4)
  const gl = sg <= 0.04045 ? sg/12.92 : Math.pow((sg+0.055)/1.055, 2.4)
  const bl = sb <= 0.04045 ? sb/12.92 : Math.pow((sb+0.055)/1.055, 2.4)
  const X = 0.4124564*rl + 0.3575761*gl + 0.1804375*bl
  const Y = 0.2126729*rl + 0.7151522*gl + 0.0721750*bl
  const Z = 0.0193339*rl + 0.1191920*gl + 0.9503041*bl
  const xr = X/0.95047, yr = Y/1.0, zr = Z/1.08883
  const d = 6/29
  const f = (t: number) => t > d*d*d ? Math.cbrt(t) : t/(3*d*d) + 4/29
  const fx = f(xr), fy = f(yr), fz = f(zr)
  const L = 116*fy - 16
  const a = 500*(fx - fy)
  const bb = 200*(fy - fz)
  return [L, a, bb]
}

function finv(t: number) {
  const d = 6/29
  return t > d ? t*t*t : 3*d*d*(t - 4/29)
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
