// عالم المكعبات: تخزين القطع (Chunks)، التحميل التدريجي، وبناء الشبكات مع إخفاء الأوجه و AO
import * as THREE from 'three';
import { makeGen, CW, CH, CVOL, type Gen } from '../../shared/gen';
import { buildAtlas, T, COLS, type Atlas } from './atlas';

const PW = 18, PS = PW * PW; // القطعة مع هامش 1
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.82 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.82 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.6 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.9 },
];
const UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
const po = (x: number, y: number, z: number) => x + z * PW + y * PS;
// إزاحات AO لكل وجه وكل زاوية
const AO: number[][][] = FACES.map((f) => f.c.map((c) => {
  const ax = f.n[0] ? 0 : f.n[1] ? 1 : 2, t = [0, 1, 2].filter((a) => a !== ax);
  const d1 = [0, 0, 0], d2 = [0, 0, 0]; d1[t[0]] = c[t[0]] * 2 - 1; d2[t[1]] = c[t[1]] * 2 - 1;
  const nn = po(f.n[0], f.n[1], f.n[2]);
  return [nn + po(d1[0], d1[1], d1[2]), nn + po(d2[0], d2[1], d2[2]), nn + po(d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2])];
}));
const AOV = [0.5, 0.68, 0.84, 1];

class MB {
  p: number[] = []; n: number[] = []; u: number[] = []; c: number[] = []; i: number[] = []; v = 0;
  build(): THREE.BufferGeometry | null {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.u), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.c), 3, true));
    g.setIndex(this.v > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.i), 1) : new THREE.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

export interface Chunk { cx: number; cz: number; data: Uint8Array; meshes: (THREE.Mesh | null)[]; dirty: boolean; meshed: boolean; top: Uint8Array; topId: Uint8Array }

export class World {
  chunks = new Map<string, Chunk>();
  gen: Gen; atlas: Atlas; group = new THREE.Group();
  solid = new Uint8Array(256); opaque = new Uint8Array(256); shape = new Uint8Array(256); emissive = new Uint8Array(256); known = new Uint8Array(256);
  mats: THREE.Material[]; tex: THREE.CanvasTexture;
  deltas = new Map<string, Map<number, number>>();
  byId: any[] = []; ids: Record<string, number> = {};
  radius = 6; limit = 384; shadows = false;
  private pad = new Uint8Array(PS * CH); private ptop = new Int16Array(PS);
  private queue: [number, number][] = []; private lastC = '';
  pending = 0;

  constructor(content: any, public info: any) {
    for (const b of content.blocks) {
      this.byId[b.id] = b; this.ids[b.key] = b.id; this.known[b.id] = 1;
      this.solid[b.id] = b.solid ? 1 : 0; this.opaque[b.id] = b.opaque && b.shape === 'cube' ? 1 : 0; this.shape[b.id] = b.shape === 'cross' ? 1 : b.shape === 'liquid' ? 2 : 0; this.emissive[b.id] = b.emissive ? 1 : 0;
    }
    const env = content.envs[info.environment] || Object.values(content.envs)[0];
    const s = info.settings || {};
    this.limit = s.limit || 384;
    this.gen = makeGen(info.seed, (env as any).params, this.ids, { amp: s.amp, ores: Number(s.ores), structures: s.structures, prefabs: content.prefabs });
    this.atlas = buildAtlas(content.blocks);
    this.tex = new THREE.CanvasTexture(this.atlas.canvas);
    this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.flipY = false; this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mats = [
      new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true }),
      new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide }),
    ];
  }
  key(cx: number, cz: number) { return cx + ',' + cz; }
  setDeltas(d: Record<string, number[]>) {
    this.deltas.clear();
    for (const k in d) { const m = new Map<number, number>(), a = d[k]; for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]); this.deltas.set(k, m); }
  }
  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= CH) return 0;
    const c = this.chunks.get((x >> 4) + ',' + (z >> 4));
    return c ? c.data[(x & 15) + (z & 15) * 16 + y * 256] : 0;
  }
  loaded(x: number, z: number) { return this.chunks.has((x >> 4) + ',' + (z >> 4)); }
  isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true; if (y >= CH) return false;
    const c = this.chunks.get((x >> 4) + ',' + (z >> 4));
    if (!c) return true;
    return this.solid[c.data[(x & 15) + (z & 15) * 16 + y * 256]] === 1;
  }
  isWater(x: number, y: number, z: number) { return this.shape[this.getBlock(x, y, z)] === 2; }
  setBlock(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CH) return;
    if (!this.known[id]) id = 0;
    const cx = x >> 4, cz = z >> 4, k = cx + ',' + cz, li = (x & 15) + (z & 15) * 16 + y * 256;
    let d = this.deltas.get(k); if (!d) this.deltas.set(k, (d = new Map()));
    d.set(li, id);
    const c = this.chunks.get(k); if (!c) return;
    c.data[li] = id; c.dirty = true; this.colTop(c, x & 15, z & 15);
    const lx = x & 15, lz = z & 15;
    if (lx === 0) this.mark(cx - 1, cz); if (lx === 15) this.mark(cx + 1, cz); if (lz === 0) this.mark(cx, cz - 1); if (lz === 15) this.mark(cx, cz + 1);
  }
  private mark(cx: number, cz: number) { const c = this.chunks.get(cx + ',' + cz); if (c) c.dirty = true; }
  private colTop(c: Chunk, x: number, z: number) {
    let y = CH - 1; const o = x + z * 16;
    while (y > 0 && c.data[o + y * 256] === 0) y--;
    c.top[o] = y; c.topId[o] = c.data[o + y * 256];
  }
  topY(x: number, z: number): number { const c = this.chunks.get((x >> 4) + ',' + (z >> 4)); return c ? c.top[(x & 15) + (z & 15) * 16] : -1; }
  // أعلى مكعب صلب عند أو تحت y
  groundY(x: number, yFrom: number, z: number): number { let y = Math.min(CH - 1, Math.floor(yFrom)); while (y > 0 && !this.isSolid(x, y, z)) y--; return y + 1; }

  private gen1(cx: number, cz: number) {
    const k = this.key(cx, cz);
    const data = this.gen.genChunk(cx, cz);
    const d = this.deltas.get(k);
    if (d) for (const [i, v] of d) if (i >= 0 && i < CVOL) data[i] = this.known[v] ? v : 0;
    for (let i = 0; i < CVOL; i++) if (data[i] && !this.known[data[i]]) data[i] = 0;
    const c: Chunk = { cx, cz, data, meshes: [null, null, null], dirty: true, meshed: false, top: new Uint8Array(256), topId: new Uint8Array(256) };
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) this.colTop(c, x, z);
    this.chunks.set(k, c);
    this.mark(cx - 1, cz); this.mark(cx + 1, cz); this.mark(cx, cz - 1); this.mark(cx, cz + 1);
  }
  private inLimit(cx: number, cz: number) { const L = Math.ceil(this.limit / 16); return cx >= -L - 1 && cx <= L && cz >= -L - 1 && cz <= L; }

  // يُستدعى كل إطار: يولّد ويبني عدداً محدوداً من القطع ضمن ميزانية زمنية
  update(px: number, pz: number, budgetMs: number) {
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16), R = this.radius;
    const ck = pcx + ',' + pcz + ',' + R;
    if (ck !== this.lastC) {
      this.lastC = ck; this.queue = [];
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R + 1) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!this.inLimit(cx, cz) || this.chunks.has(this.key(cx, cz))) continue;
        this.queue.push([cx, cz]);
      }
      this.queue.sort((a, b) => (b[0] - pcx) ** 2 + (b[1] - pcz) ** 2 - ((a[0] - pcx) ** 2 + (a[1] - pcz) ** 2));
      for (const [k, c] of this.chunks) if (Math.abs(c.cx - pcx) > R + 2 || Math.abs(c.cz - pcz) > R + 2) { this.dispose(c); this.chunks.delete(k); }
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) { const [cx, cz] = this.queue.pop()!; if (!this.chunks.has(this.key(cx, cz))) this.gen1(cx, cz); }
    // بناء الشبكات: الأقرب أولاً
    let best: Chunk | null = null, bd = 1e9, dirty = 0;
    for (let n = 0; n < 3; n++) {
      best = null; bd = 1e9; dirty = 0;
      for (const c of this.chunks.values()) {
        if (!c.dirty) continue;
        if (!this.ready(c)) continue;
        dirty++;
        const d = (c.cx - pcx) ** 2 + (c.cz - pcz) ** 2;
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) break;
      this.mesh(best);
      if (performance.now() - t0 > budgetMs * 1.6) break;
    }
    this.pending = this.queue.length + Math.max(0, dirty - 1);
  }
  private ready(c: Chunk) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.chunks.has(this.key(c.cx + dx, c.cz + dz)) && this.inLimit(c.cx + dx, c.cz + dz)) return false;
    return true;
  }
  private dispose(c: Chunk) { for (const m of c.meshes) if (m) { this.group.remove(m); m.geometry.dispose(); } c.meshes = [null, null, null]; }
  disposeAll() { for (const c of this.chunks.values()) this.dispose(c); this.chunks.clear(); this.lastC = ''; this.tex.dispose(); this.mats.forEach((m) => m.dispose()); }
  reset() { for (const c of this.chunks.values()) this.dispose(c); this.chunks.clear(); this.lastC = ''; }

  private mesh(c: Chunk) {
    const pad = this.pad, ptop = this.ptop, opq = this.opaque, shp = this.shape, tiles = this.atlas.tiles;
    // تعبئة المصفوفة ذات الهامش من القطعة وجيرانها الثمانية
    for (let pz = 0; pz < PW; pz++) for (let px = 0; px < PW; px++) {
      const wx = px - 1, wz = pz - 1;
      const dx = wx < 0 ? -1 : wx > 15 ? 1 : 0, dz = wz < 0 ? -1 : wz > 15 ? 1 : 0;
      const src = dx || dz ? this.chunks.get(this.key(c.cx + dx, c.cz + dz)) : c;
      const o = px + pz * PW;
      if (!src) { for (let y = 0; y < CH; y++) pad[o + y * PS] = 0; ptop[o] = 0; continue; }
      const so = (wx & 15) + (wz & 15) * 16, d = src.data;
      let top = 0;
      for (let y = 0; y < CH; y++) { const v = d[so + y * 256]; pad[o + y * PS] = v; if (opq[v]) top = y; }
      ptop[o] = top;
    }
    const B = [new MB(), new MB(), new MB()];
    const W = COLS * T, H = this.atlas.rows * T, e = 0.02;
    const skyL = (i: number, y: number) => { const d = ptop[i % PS] - y; return d <= 0 ? 1 : Math.max(0.2, 1 - d * 0.11); };
    for (let y = 0; y < CH; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = po(x + 1, y, z + 1), id = pad[i];
      if (!id) continue;
      const sh = shp[id];
      if (sh === 1) { // نبات متقاطع
        const b = B[1], ti = tiles[id * 3 + 1], u0 = ((ti % COLS) * T + e) / W, u1 = ((ti % COLS) * T + T - e) / W, v0 = (((ti / COLS) | 0) * T + e) / H, v1 = (((ti / COLS) | 0) * T + T - e) / H;
        const l = (skyL(i, y) * 235) | 0;
        for (const q of [[0.12, 0.12, 0.88, 0.88], [0.12, 0.88, 0.88, 0.12]]) {
          b.p.push(x + q[0], y, z + q[1], x + q[2], y, z + q[3], x + q[2], y + 0.9, z + q[3], x + q[0], y + 0.9, z + q[1]);
          b.n.push(0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127, 0); b.u.push(u0, v1, u1, v1, u1, v0, u0, v0); b.c.push(l, l, l, l, l, l, l, l, l, l, l, l);
          b.i.push(b.v, b.v + 1, b.v + 2, b.v, b.v + 2, b.v + 3); b.v += 4;
        }
        continue;
      }
      const liquid = sh === 2, op = opq[id];
      const b = liquid ? B[2] : op ? B[0] : B[1];
      const em = this.emissive[id];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], ny = y + F.n[1];
        const ni = i + F.n[0] + F.n[2] * PW + F.n[1] * PS;
        const nid = ny < 0 ? 1 : ny >= CH ? 0 : pad[ni];
        if (nid) { if (opq[nid]) continue; if (nid === id) continue; if (liquid && shp[nid] !== 1 && f !== 2) continue; }
        if (ny < 0) continue;
        const ti = tiles[id * 3 + (f === 2 ? 0 : f === 3 ? 2 : 1)], tx = (ti % COLS) * T, ty = ((ti / COLS) | 0) * T;
        const u0 = (tx + e) / W, u1 = (tx + T - e) / W, v0 = (ty + e) / H, v1 = (ty + T - e) / H;
        const base = em ? 255 : F.s * (ny >= CH ? 1 : skyL(ni, ny)) * 255;
        const a = [3, 3, 3, 3];
        const topDrop = liquid && f !== 3 && shp[y + 1 < CH ? pad[i + PS] : 0] !== 2 ? 0.12 : 0;
        for (let k = 0; k < 4; k++) {
          const C = F.c[k];
          if (!liquid && !em) { const o = AO[f][k], s1 = opq[pad[i + o[0]] || 0], s2 = opq[pad[i + o[1]] || 0], cr = opq[pad[i + o[2]] || 0]; a[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + cr); }
          b.p.push(x + C[0], y + C[1] - (C[1] ? topDrop : 0), z + C[2]); b.n.push(F.n[0] * 127, F.n[1] * 127, F.n[2] * 127);
          b.u.push(UV[k][0] ? u1 : u0, UV[k][1] ? v1 : v0);
          const l = (base * AOV[a[k]]) | 0; b.c.push(l, l, l);
        }
        if (a[0] + a[2] > a[1] + a[3]) b.i.push(b.v, b.v + 1, b.v + 2, b.v, b.v + 2, b.v + 3); else b.i.push(b.v + 1, b.v + 2, b.v + 3, b.v + 1, b.v + 3, b.v);
        b.v += 4;
      }
    }
    this.dispose(c);
    for (let k = 0; k < 3; k++) {
      const g = B[k].build(); if (!g) continue;
      const m = new THREE.Mesh(g, this.mats[k]);
      m.position.set(c.cx * 16, 0, c.cz * 16); m.matrixAutoUpdate = false; m.updateMatrix();
      if (k === 2) m.renderOrder = 2;
      m.castShadow = this.shadows && k < 2; m.receiveShadow = this.shadows && k < 2;
      c.meshes[k] = m; this.group.add(m);
    }
    c.dirty = false; c.meshed = true;
  }

  // تتبع الشعاع داخل شبكة المكعبات (DDA)
  raycast(o: THREE.Vector3, d: THREE.Vector3, max: number) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (d.x || 1e-9)), tdy = Math.abs(1 / (d.y || 1e-9)), tdz = Math.abs(1 / (d.z || 1e-9));
    let tx = (d.x > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (d.y > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (d.z > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= max) {
      const id = this.getBlock(x, y, z);
      if (id && this.shape[id] !== 2) return { x, y, z, nx, ny, nz, id, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
}
export { CW, CH };
