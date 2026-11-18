// مجسمات العناصر في اليد: الأدوات والأسلحة والطعام تُبنى كمجسم بكسلي بارز من أيقونتها (سيف يظهر كسيف)،
// والمكعبات تظهر كمكعب صغير بخاماتها الحقيقية.
import * as THREE from 'three';
import { iconCanvas, T, COLS, type Atlas } from './atlas';

const geoCache = new Map<string, THREE.BufferGeometry>();
const voxMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// تحويل أيقونة إلى مجسم بكسلي بسماكة (عرضه 1 وحدة، متمركز حول الأصل، الوجه نحو +z)
function voxelize(cv: HTMLCanvasElement, N = 24): THREE.BufferGeometry {
  const small = document.createElement('canvas'); small.width = small.height = N;
  const g = small.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data;
  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && d[(i + j * N) * 4 + 3] > 110;
  const pos: number[] = [], nor: number[] = [], col: number[] = [], s = 1 / N, h = s * 0.7;
  const c = new THREE.Color();
  const quad = (v: number[][], n: number[], f: number) => {
    const base = pos.length / 3;
    for (const p of v) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c.r * f, c.g * f, c.b * f); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const idx: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!on(i, j)) continue;
    const o = (i + j * N) * 4; c.setRGB(d[o] / 255, d[o + 1] / 255, d[o + 2] / 255, THREE.SRGBColorSpace);
    const x0 = i * s - 0.5, x1 = x0 + s, y1 = 0.5 - j * s, y0 = y1 - s;
    quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], [0, 0, 1], 1);
    quad([[x1, y0, -h], [x0, y0, -h], [x0, y1, -h], [x1, y1, -h]], [0, 0, -1], 0.8);
    if (!on(i - 1, j)) quad([[x0, y0, -h], [x0, y0, h], [x0, y1, h], [x0, y1, -h]], [-1, 0, 0], 0.7);
    if (!on(i + 1, j)) quad([[x1, y0, h], [x1, y0, -h], [x1, y1, -h], [x1, y1, h]], [1, 0, 0], 0.7);
    if (!on(i, j - 1)) quad([[x0, y1, h], [x1, y1, h], [x1, y1, -h], [x0, y1, -h]], [0, 1, 0], 0.9);
    if (!on(i, j + 1)) quad([[x0, y0, -h], [x1, y0, -h], [x1, y0, h], [x0, y0, h]], [0, -1, 0], 0.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeBoundingSphere();
  return geo;
}

function blockCube(def: any, atlas: Atlas, tex: THREE.Texture): THREE.Mesh {
  const k = 'cube:' + def.key;
  let geo = geoCache.get(k);
  if (!geo) {
    geo = new THREE.BoxGeometry(1, 1, 1);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute, W = COLS * T, H = atlas.rows * T, e = 0.5;
    // ترتيب أوجه BoxGeometry: +x -x +y -y +z -z
    const which = [1, 1, 0, 2, 1, 1];
    for (let f = 0; f < 6; f++) {
      const ti = atlas.tiles[def.id * 3 + which[f]], tx = (ti % COLS) * T, ty = ((ti / COLS) | 0) * T;
      for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, (tx + e + uv.getX(i) * (T - 2 * e)) / W, (ty + e + (1 - uv.getY(i)) * (T - 2 * e)) / H); }
    }
    uv.needsUpdate = true; geoCache.set(k, geo);
  }
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: !def.opaque, alphaTest: def.opaque ? 0 : 0.4 }));
}

export type HeldView = 'first' | 'third';
// يُرجع مجموعة جاهزة للوضع في اليد
export function heldModel(def: any, isBlock: boolean, view: HeldView, atlas?: Atlas, tex?: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  if (!def) return g;
  const flatBlock = isBlock && def.shape !== 'cube';
  if (isBlock && !flatBlock && atlas && tex) {
    const m = blockCube(def, atlas, tex);
    if (view === 'first') { m.scale.setScalar(0.22); m.position.set(0.04, 0.02, 0); m.rotation.set(0.25, 0.75, 0); }
    else { m.scale.setScalar(0.24); m.position.set(0, -0.06, -0.1); m.rotation.set(0.2, 0.6, 0); }
    g.add(m); return g;
  }
  const k = 'vox:' + (isBlock ? 'b:' : 'i:') + def.key + JSON.stringify(isBlock ? def.tex : def.icon);
  let geo = geoCache.get(k);
  if (!geo) { geo = voxelize(iconCanvas(def, isBlock, flatBlock)); geoCache.set(k, geo); }
  const m = new THREE.Mesh(geo, voxMat);
  const tool = !isBlock && ['tool', 'weapon'].includes(def.category);
  if (view === 'first') {
    // الأدوات تُمسك من المقبض (الزاوية السفلية اليسرى للأيقونة) ورأسها للأعلى والأمام
    m.scale.setScalar(tool ? 0.62 : 0.42);
    m.rotation.set(0, tool ? -1.15 : -0.55, tool ? 0.12 : 0);
    if (tool) m.position.set(0.04, 0.14, -0.06);
  } else {
    m.scale.setScalar(tool ? 0.62 : 0.34);
    const pivot = new THREE.Group(); pivot.rotation.set(-0.6, Math.PI / 2, 0); pivot.add(m); // النصل للأمام وقليلاً للأعلى
    if (tool) m.position.set(0.22, 0.22, 0); // نقل المقبض إلى اليد
    g.add(pivot); return g;
  }
  g.add(m); return g;
}
