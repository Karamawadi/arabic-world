// ضجيج Simplex ثنائي وثلاثي الأبعاد + دوال تجزئة حتمية (تُستخدم في الخادم والعميل معاً)

export function hash2(x: number, z: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
export function hash3(x: number, y: number, z: number, s: number): number {
  return hash2(x + Math.imul(y | 0, 7919), z + Math.imul(y | 0, 104729), s);
}
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

const G2 = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
const G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
const F2 = 0.5 * (Math.sqrt(3) - 1), K2 = (3 - Math.sqrt(3)) / 6;

export class Noise {
  p = new Uint8Array(512);
  constructor(seed: number) {
    const r = rng(seed);
    const t = new Uint8Array(256);
    for (let i = 0; i < 256; i++) t[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const v = t[i]; t[i] = t[j]; t[j] = v; }
    for (let i = 0; i < 512; i++) this.p[i] = t[i & 255];
  }
  n2(x: number, y: number): number {
    const p = this.p;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * K2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + K2, y1 = y0 - j1 + K2, x2 = x0 - 1 + 2 * K2, y2 = y0 - 1 + 2 * K2;
    const ii = i & 255, jj = j & 255;
    let n = 0, a = 0.5 - x0 * x0 - y0 * y0;
    if (a > 0) { const g = (p[ii + p[jj]] & 7) * 2; a *= a; n += a * a * (G2[g] * x0 + G2[g + 1] * y0); }
    a = 0.5 - x1 * x1 - y1 * y1;
    if (a > 0) { const g = (p[ii + i1 + p[jj + j1]] & 7) * 2; a *= a; n += a * a * (G2[g] * x1 + G2[g + 1] * y1); }
    a = 0.5 - x2 * x2 - y2 * y2;
    if (a > 0) { const g = (p[ii + 1 + p[jj + 1]] & 7) * 2; a *= a; n += a * a * (G2[g] * x2 + G2[g + 1] * y2); }
    return 70 * n;
  }
  n3(x: number, y: number, z: number): number {
    const p = this.p;
    const s = (x + y + z) / 3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) / 6;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + 1 / 6, y1 = y0 - j1 + 1 / 6, z1 = z0 - k1 + 1 / 6;
    const x2 = x0 - i2 + 1 / 3, y2 = y0 - j2 + 1 / 3, z2 = z0 - k2 + 1 / 3;
    const x3 = x0 - 0.5, y3 = y0 - 0.5, z3 = z0 - 0.5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, a = 0.6 - x0 * x0 - y0 * y0 - z0 * z0, g;
    if (a > 0) { g = (p[ii + p[jj + p[kk]]] % 12) * 3; a *= a; n += a * a * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    a = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (a > 0) { g = (p[ii + i1 + p[jj + j1 + p[kk + k1]]] % 12) * 3; a *= a; n += a * a * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    a = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (a > 0) { g = (p[ii + i2 + p[jj + j2 + p[kk + k2]]] % 12) * 3; a *= a; n += a * a * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    a = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (a > 0) { g = (p[ii + 1 + p[jj + 1 + p[kk + 1]]] % 12) * 3; a *= a; n += a * a * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * n;
  }
  fbm(x: number, y: number, oct: number): number {
    let v = 0, a = 1, f = 1, m = 0;
    for (let o = 0; o < oct; o++) { v += a * this.n2(x * f + o * 17.3, y * f - o * 9.1); m += a; a *= 0.5; f *= 2.03; }
    return v / m;
  }
  ridged(x: number, y: number, oct: number): number {
    let v = 0, a = 1, f = 1, m = 0;
    for (let o = 0; o < oct; o++) { const n = 1 - Math.abs(this.n2(x * f + o * 31.7, y * f + o * 5.3)); v += a * n * n; m += a; a *= 0.5; f *= 2.1; }
    return v / m;
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
