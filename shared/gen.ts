// مولّد العالم الحتمي: نفس البذرة + نفس إعدادات البيئة = نفس العالم في الخادم والمتصفح.
import { Noise, hash2, hash3, rng, clamp, smooth, lerp } from './noise.ts';
import { STRUCTS, TREES, B, prefab, type StructDef } from './structures.ts';

export const CW = 16, CH = 128, CVOL = CW * CW * CH;
export const idx = (x: number, y: number, z: number) => x + z * 16 + y * 256;

export interface EnvParams {
  sea?: number; base?: number; landBias?: number; coast?: 'none' | 'west' | 'east' | 'north' | 'south' | 'islands';
  hillAmp?: number; hillScale?: number; duneAmp?: number; duneScale?: number;
  mtAmp?: number; mtScale?: number; mtT?: number;
  wadi?: boolean; wadiWater?: boolean; wadiScale?: number; wadiWidth?: number;
  surface?: string; surface2?: string; patch?: number; sub?: string; rock?: string; peak?: string; beach?: string; seabed?: string; wadiBed?: string;
  rockLine?: number; peakLine?: number;
  trees?: { type: string; density: number; zone: string }[];
  plants?: { block: string; density: number }[];
  ores?: Record<string, number>; caves?: boolean;
  structures?: { key: string; freq: number }[]; structCell?: number;
  city?: { t: number; structures: { key: string; freq: number }[] } | null;
  [k: string]: any;
}
export interface GenOpts { ores?: number; structures?: boolean; amp?: number; prefabs?: Record<string, any> }

const DEF: EnvParams = {
  sea: 40, base: 4, landBias: 0.15, coast: 'west', hillAmp: 4, hillScale: 110, duneAmp: 0, duneScale: 46,
  mtAmp: 0, mtScale: 260, mtT: 0.55, wadi: false, wadiWater: false, wadiScale: 260, wadiWidth: 0.07,
  surface: 'sand', surface2: 'sand', patch: 0, sub: 'sandstone', rock: 'mountain_rock', peak: 'limestone', beach: 'sand', seabed: 'sand', wadiBed: 'gravel',
  rockLine: 26, peakLine: 58, trees: [], plants: [], ores: { copper: 1, iron: 1, gold: 1, diamond: 1 }, caves: true, structures: [], structCell: 64, city: null,
};

export interface Col { h: number; m: number; k: number; c: number; city: number }

export function makeGen(seed: number, envParams: EnvParams, ids: Record<string, number>, opts: GenOpts = {}) {
  const p: EnvParams = { ...DEF, ...envParams };
  const nC = new Noise(seed + 1), nH = new Noise(seed + 2), nM = new Noise(seed + 3), nD = new Noise(seed + 4), nW = new Noise(seed + 5), nV = new Noise(seed + 6), nV2 = new Noise(seed + 7), nP = new Noise(seed + 8);
  const sea = p.sea!, amp = opts.amp ?? 1, oreMul = opts.ores ?? 1;
  const id = (k: string) => ids[k] ?? ids.stone ?? 1;
  const AIR = 0, WATER = id('water'), STONE = id('stone'), BED = id('bedrock');
  const structOn = opts.structures !== false;
  const prefabs: Record<string, StructDef> = {};
  for (const k in opts.prefabs || {}) try { prefabs[k] = prefab(opts.prefabs![k]); } catch { /* تجاهل تعريف غير صالح */ }
  const getStruct = (k: string): StructDef | undefined => prefabs[k] || STRUCTS[k];

  function col(x: number, z: number): Col {
    let c: number;
    const n = nC.fbm(x / 520, z / 520, 3) * 0.55;
    switch (p.coast) {
      case 'west': c = n + clamp(x / 320, -1.3, 1.3) + p.landBias!; break;
      case 'east': c = n + clamp(-x / 320, -1.3, 1.3) + p.landBias!; break;
      case 'north': c = n + clamp(z / 320, -1.3, 1.3) + p.landBias!; break;
      case 'south': c = n + clamp(-z / 320, -1.3, 1.3) + p.landBias!; break;
      case 'islands': c = nC.fbm(x / 170, z / 170, 3) * 1.15 - 0.3 + p.landBias!; break;
      default: c = 0.6 + n * 0.3 + p.landBias!;
    }
    if (c <= 0) return { h: Math.max(8, Math.floor(sea - 1 + c * 42)), m: 0, k: 1, c, city: 0 };
    const land = smooth(0, 0.22, c);
    let city = 0;
    if (p.city) city = smooth(p.city.t, p.city.t + 0.12, nP.fbm(x / 340 + 9, z / 340 - 4, 2) * 0.5 + 0.5) * smooth(0.08, 0.2, c);
    let m = 0, mh = 0;
    if (p.mtAmp! > 0) {
      m = smooth(p.mtT!, p.mtT! + 0.3, nM.fbm(x / (p.mtScale! * 1.6), z / (p.mtScale! * 1.6), 2) * 0.5 + 0.5 + c * 0.12) * smooth(0.1, 0.45, c);
      if (m > 0) mh = Math.pow(nM.ridged(x / p.mtScale!, z / p.mtScale!, 4), 1.6) * p.mtAmp! * m * amp;
    }
    let h = sea + 1 + land * p.base! + nH.fbm(x / p.hillScale!, z / p.hillScale!, 3) * p.hillAmp! * land * amp + mh;
    if (p.duneAmp! > 0) {
      const w = nD.n2(x / 130, z / 130) * 1.6;
      const d = 1 - Math.abs(nD.n2(x / p.duneScale! + w, z / (p.duneScale! * 2.3)));
      h += d * d * p.duneAmp! * land * (1 - m) * amp;
    }
    let k = 1;
    if (p.wadi) {
      const w = Math.abs(nW.n2(x / p.wadiScale!, z / p.wadiScale!) + 0.25 * nW.n2(x / 55, z / 55));
      k = smooth(0, p.wadiWidth! * (1 + m * 1.5), w);
      if (c > 0.06) h = lerp(sea + (p.wadiWater ? -3.2 : 1.4), h, k);
    }
    if (city > 0) { h = lerp(h, sea + 3, city); m *= 1 - city; }
    return { h: clamp(Math.floor(h), 4, CH - 14), m, k, c, city };
  }

  function surfaceOf(x: number, z: number, cl: Col): number {
    const h = cl.h;
    if (h < sea) return id(p.seabed!);
    if (cl.city > 0.5) {
      const S = p.structCell!; const mx = ((x % S) + S) % S, mz = ((z % S) + S) % S;
      return mx < 4 || mz < 4 ? id('asphalt') : id('concrete');
    }
    if (p.wadi && cl.k < 0.4 && cl.c > 0.06) return h < sea ? id(p.seabed!) : id(p.wadiBed!);
    if (p.wadiGreen && cl.k < 0.9 && cl.m < 0.3) return id('grass');
    if (h <= sea + 2 && cl.c < 0.14) return id(p.beach!);
    if (h > sea + p.peakLine!) return id(p.peak!);
    if (cl.m > 0.3 || h > sea + p.rockLine!) return id(p.rock!);
    if (p.patch! > 0 && nP.n2(x / 38, z / 38) > 1 - p.patch! * 2) return id(p.surface2!);
    return id(p.surface!);
  }

  // منشأة الخلية (إن وجدت) — حتمية بالكامل
  function cellStruct(ci: number, cj: number) {
    if (!structOn) return null;
    const S = p.structCell!;
    const r0 = hash2(ci, cj, seed + 91);
    const cx = ci * S + S / 2, cz = cj * S + S / 2;
    const cc = col(cx, cz);
    const list = p.city && cc.city > 0.5 ? p.city.structures : p.structures!;
    let acc = 0, key = '';
    for (const s of list || []) { acc += s.freq; if (r0 < acc) { key = s.key; break; } }
    const def = key && getStruct(key);
    if (!def) return null;
    const pad = p.city && cc.city > 0.5 ? 5 : 2;
    const rx = Math.max(0, S - def.w - pad * 2), rz = Math.max(0, S - def.d - pad * 2);
    const ox = ci * S + pad + Math.floor(hash2(ci, cj, seed + 92) * rx), oz = cj * S + pad + Math.floor(hash2(ci, cj, seed + 93) * rz);
    const a = col(ox + (def.w >> 1), oz + (def.d >> 1));
    let gy = a.h + 1;
    if (def.site === 'land') {
      if (a.h <= sea || a.m > 0.45) return null;
      const b2 = col(ox, oz), c2 = col(ox + def.w - 1, oz + def.d - 1);
      if (Math.abs(b2.h - a.h) > 5 || Math.abs(c2.h - a.h) > 5 || b2.h <= sea - 1 || c2.h <= sea - 1) return null;
      gy = Math.max(a.h, b2.h, c2.h) + 1;
    } else if (def.site === 'water') { if (a.h > sea - 4) return null; }
    else if (def.site === 'coast') { if (a.h > sea - 1 || a.h < sea - 9) return null; }
    if (def.sea) gy = sea + 1;
    return { def, ox, oz, gy, sd: (hash2(ci, cj, seed + 94) * 2147483647) | 0 };
  }

  function genChunk(cx: number, cz: number): Uint8Array {
    const d = new Uint8Array(CVOL);
    const x0 = cx * 16, z0 = cz * 16;
    const hs = new Int16Array(256);
    const oc = p.ores || {};
    const oreT = [
      [id('diamond_ore'), 18, 0.003 * (oc.diamond ?? 1) * oreMul], [id('gold_ore'), 30, 0.006 * (oc.gold ?? 1) * oreMul],
      [id('iron_ore'), 56, 0.012 * (oc.iron ?? 1) * oreMul], [id('copper_ore'), 70, 0.014 * (oc.copper ?? 1) * oreMul],
    ];
    const sub = id(p.sub!), rock = id(p.rock!);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z;
      const cl = col(wx, wz), h = cl.h;
      hs[x + z * 16] = h;
      const top = surfaceOf(wx, wz, cl);
      const rocky = cl.m > 0.3;
      d[idx(x, 0, z)] = BED;
      for (let y = 1; y <= h; y++) {
        let b = y === h ? top : y > h - 4 ? (rocky ? rock : top === id(p.surface!) || top === id(p.beach!) || top === id(p.seabed!) ? (y > h - 2 ? top : sub) : sub) : STONE;
        if (b === STONE) {
          const r = hash3(wx >> 1, y >> 1, wz >> 1, seed + 11);
          let a = 0;
          for (const o of oreT) { a += o[2]; if (y < o[1] && r < a) { b = o[0]; break; } }
        }
        d[idx(x, y, z)] = b;
      }
      if (h < sea) for (let y = h + 1; y <= sea; y++) d[idx(x, y, z)] = WATER;
      // كهوف
      if (p.caves && h > sea + 2) {
        const yTop = h - (cl.m > 0.2 || hash2(wx >> 3, wz >> 3, seed + 12) < 0.25 ? 0 : 4);
        for (let y = 4; y <= yTop; y++) {
          const a = nV.n3(wx / 42, y / 26, wz / 42);
          let cave = false;
          if (Math.abs(a) < 0.1) { const b2 = nV2.n3(wx / 42, y / 26, wz / 42); cave = a * a + b2 * b2 < 0.011; }
          if (!cave && y < h - 8 && a > 0.3) cave = nV2.n3(wx / 75 + 50, y / 40, wz / 75) > 0.66;
          if (cave) d[idx(x, y, z)] = AIR;
        }
      }
      // نباتات السطح
      if (h >= sea && h < CH - 2 && d[idx(x, h, z)] === top && cl.city < 0.5 && !rocky) {
        let r = hash2(wx, wz, seed + 21);
        for (const pl of p.plants || []) { if (r < pl.density) { d[idx(x, h + 1, z)] = id(pl.block); break; } r -= pl.density; }
      } else if (h < sea - 1 && h > sea - 12 && hash2(wx, wz, seed + 22) < 0.006) d[idx(x, h + 1, z)] = id('oyster');
    }
    const put = (wx: number, y: number, wz: number, key: string, soft: boolean) => {
      const lx = wx - x0, lz = wz - z0;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= CH) return;
      const i = idx(lx, y, lz);
      if (soft && d[i] !== AIR && d[i] !== WATER) return;
      d[i] = key === 'air' ? AIR : id(key);
    };
    // أشجار (تُفحص المواضع في هامش 4 مكعبات حول القطعة)
    const trees = p.trees || [];
    if (trees.length) {
      let maxD = 0; for (const t of trees) maxD += t.density;
      for (let wz = z0 - 4; wz < z0 + 20; wz++) for (let wx = x0 - 4; wx < x0 + 20; wx++) {
        let r = hash2(wx, wz, seed + 31);
        if (r >= maxD) continue;
        const cl = col(wx, wz), h = cl.h;
        if (cl.city > 0.5) continue;
        for (const t of trees) {
          if (r >= t.density) { r -= t.density; continue; }
          const rocky = cl.m > 0.3 || h > sea + p.rockLine!;
          let ok = false;
          switch (t.zone) {
            case 'low': ok = !rocky && h > sea && h < sea + 16; break;
            case 'coast': ok = h > sea && h <= sea + 5; break;
            case 'water': ok = h >= sea - 3 && h <= sea - 1; break;
            case 'wadi': ok = cl.k < 0.75 && h > sea; break;
            case 'oasis': ok = !rocky && h > sea && nP.n2(wx / 95 + 30, wz / 95) > 0.42; break;
            case 'rock': ok = rocky && h < sea + p.peakLine!; break;
            default: ok = !rocky && h > sea;
          }
          if (ok) {
            // في الواحات تتكاثف الأشجار
            const fn = TREES[t.type] || TREES.palm;
            fn({ set: (a, b, c, k) => put(a, b, c, k, true) }, wx, h + 1, wz, rng(hash2(wx, wz, seed + 32) * 1e9));
          }
          break;
        }
      }
    }
    // منشآت
    if (structOn) {
      const S = p.structCell!;
      const i0 = Math.floor((x0 - 34) / S), i1 = Math.floor((x0 + 16) / S), j0 = Math.floor((z0 - 34) / S), j1 = Math.floor((z0 + 16) / S);
      for (let cj = j0; cj <= j1; cj++) for (let ci = i0; ci <= i1; ci++) {
        const s = cellStruct(ci, cj);
        if (!s) continue;
        if (s.ox > x0 + 15 || s.ox + s.def.w <= x0 || s.oz > z0 + 15 || s.oz + s.def.d <= z0) continue;
        s.def.build(new B({ set: (a, b, c, k) => put(s.ox + a, s.gy + b, s.oz + c, k, false) }), rng(s.sd));
      }
    }
    return d;
  }

  function findSpawn(): [number, number, number] {
    let bx = 8, bz = 8;
    search: for (let r = 0; r < 60; r++) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + r * 0.7;
        const x = Math.round(8 + Math.cos(ang) * r * 12), z = Math.round(8 + Math.sin(ang) * r * 12);
        const c = col(x, z);
        if (!(c.h > sea && c.h < sea + 30 && c.m < 0.35 && c.k > 0.6)) continue;
        const S = p.structCell!, st = cellStruct(Math.floor(x / S), Math.floor(z / S));
        if (st && x >= st.ox - 1 && x <= st.ox + st.def.w && z >= st.oz - 1 && z <= st.oz + st.def.d) continue;
        bx = x; bz = z; break search;
      }
    }
    const cx = Math.floor(bx / 16), cz = Math.floor(bz / 16);
    const d = genChunk(cx, cz);
    const lx = bx - cx * 16, lz = bz - cz * 16;
    let y = CH - 1;
    while (y > 1 && (d[idx(lx, y, lz)] === AIR)) y--;
    return [bx + 0.5, y + 1, bz + 0.5];
  }

  return { p, sea, col, genChunk, findSpawn, surfaceOf };
}
export type Gen = ReturnType<typeof makeGen>;
