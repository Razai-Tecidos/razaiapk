export const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
out vec2 v_uv;
void main(){
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// sRGB -> linear
const srgbToLinear = `
vec3 toLinear(vec3 srgb){
  vec3 b = step(vec3(0.04045), srgb);
  vec3 low = srgb / 12.92;
  vec3 high = pow((srgb + 0.055) / 1.055, vec3(2.4));
  return mix(low, high, b);
}
`;

// linear -> sRGB
const linearToSrgb = `
vec3 toSrgb(vec3 linear){
  vec3 b = step(vec3(0.0031308), linear);
  vec3 low = 12.92 * linear;
  vec3 high = 1.055 * pow(linear, vec3(1.0/2.4)) - 0.055;
  return mix(low, high, b);
}
`;

// RGB (sRGB) -> XYZ (D65)
const rgbToXyz = `
mat3 M = mat3(
  0.4124564, 0.3575761, 0.1804375,
  0.2126729, 0.7151522, 0.0721750,
  0.0193339, 0.1191920, 0.9503041
);
vec3 rgb2xyz(vec3 srgb){
  vec3 lin = toLinear(srgb);
  return M * lin;
}
`;

// XYZ -> LAB (D65)
const xyzToLab = `
const vec3 whiteRef = vec3(0.95047, 1.0, 1.08883); // D65
float f(float t){
  float d = 6.0/29.0;
  if (t > d*d*d) return pow(t, 1.0/3.0);
  return t/(3.0*d*d) + 4.0/29.0;
}
vec3 xyz2lab(vec3 xyz){
  vec3 v = vec3(
    f(xyz.x/whiteRef.x),
    f(xyz.y/whiteRef.y),
    f(xyz.z/whiteRef.z)
  );
  float L = 116.0 * v.y - 16.0;
  float a = 500.0 * (v.x - v.y);
  float b = 200.0 * (v.y - v.z);
  return vec3(L, a, b);
}
`;

// LAB -> XYZ -> sRGB
const labToRgb = `
const mat3 Minv = mat3(
  3.2404542, -1.5371385, -0.4985314,
 -0.9692660,  1.8760108,  0.0415560,
  0.0556434, -0.2040259,  1.0572252
);
float finv(float t){
  float d = 6.0/29.0;
  if (t > d) return t*t*t;
  return 3.0*d*d*(t - 4.0/29.0);
}
vec3 lab2rgb(vec3 lab){
  float fy = (lab.x + 16.0)/116.0;
  float fx = fy + lab.y/500.0;
  float fz = fy - lab.z/200.0;
  vec3 xyz = vec3(
    whiteRef.x * finv(fx),
    whiteRef.y * finv(fy),
    whiteRef.z * finv(fz)
  );
  vec3 lin = Minv * xyz;
  return toSrgb(lin);
}
`;

export const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_texSize;
uniform vec3 u_deltaLab; // adjustments
uniform float u_pretreat; // 1 => apply global pretreatment (neutral gray + L* normalize)
uniform float u_LGain;    // gain for L* normalization
uniform float u_LOffset;  // offset for L* normalization
uniform float u_forceGray; // debug/override: force lab a,b to zero before deltas
uniform float u_LShift;    // additional shift after base normalization
uniform float u_LCenter;   // center lightness for contrast scaling
uniform float u_LContrast; // contrast gain around center
in vec2 v_uv;
out vec4 outColor;

${srgbToLinear}
${linearToSrgb}
${rgbToXyz}
${xyzToLab}
${labToRgb}

void main(){
  vec3 srgb = texture(u_image, v_uv).rgb;
  vec3 lab = xyz2lab(rgb2xyz(srgb));

  // Early debug force-gray path: output pure grayscale from L* only
  if (u_forceGray > 0.5) {
    float Lnorm = clamp(lab.x / 100.0, 0.0, 1.0);
    outColor = vec4(vec3(Lnorm), 1.0);
    return;
  }

  // Global pretreatment: neutralize to gray (if not already) and normalize L*
  if (u_pretreat > 0.5) {
    // zero chroma when pretreat is enabled
    lab.y = 0.0;
    lab.z = 0.0;
    // normalize lightness
    float Lnorm = lab.x * u_LGain + u_LOffset + u_LShift;
    // contrast scaling around center
    Lnorm = (Lnorm - u_LCenter) * u_LContrast + u_LCenter;
    lab.x = clamp(Lnorm, 0.0, 100.0);
  }

  // Apply deltas
  vec3 labOut = lab + u_deltaLab;
  vec3 outRgb = clamp(lab2rgb(labOut), 0.0, 1.0);
  outColor = vec4(outRgb, 1.0);
}`;
