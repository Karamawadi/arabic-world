// نماذج الشخصيات (بأزياء عربية وخليجية) والحيوانات والمركبات — كلها مبنية من مجسمات بسيطة بالكود
import * as THREE from 'three';

const matCache = new Map<string, THREE.MeshLambertMaterial>();
const M = (c: string) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); matCache.set(c, m); } return m; };
const geoCache = new Map<string, THREE.BoxGeometry>();
function box(w: number, h: number, d: number, c: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const k = w + ',' + h + ',' + d; let g = geoCache.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  const m = new THREE.Mesh(g, typeof c === 'string' ? M(c) : c); m.position.set(x, y, z); return m;
}
function pivot(x: number, y: number, z: number, ...kids: THREE.Object3D[]) { const g = new THREE.Group(); g.position.set(x, y, z); kids.forEach((k) => g.add(k)); return g; }

function faceTex(skin: string): THREE.Material {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d')!;
  g.fillStyle = skin; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff'; g.fillRect(12, 26, 14, 12); g.fillRect(38, 26, 14, 12);
  g.fillStyle = '#2a1c12'; g.fillRect(17, 28, 8, 10); g.fillRect(39, 28, 8, 10);
  g.fillStyle = '#fff'; g.fillRect(18, 29, 3, 3); g.fillRect(40, 29, 3, 3);
  g.fillStyle = 'rgba(40,20,10,.75)'; g.fillRect(11, 20, 16, 3); g.fillRect(37, 20, 16, 3);
  g.strokeStyle = 'rgba(90,30,20,.85)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(32, 44, 9, 0.25, Math.PI - 0.25); g.stroke();
  g.fillStyle = 'rgba(220,90,80,.25)'; g.fillRect(6, 40, 10, 6); g.fillRect(48, 40, 10, 6);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}
function checkTex(a: string, b: string): THREE.Material {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d')!;
  g.fillStyle = b; g.fillRect(0, 0, 32, 32); g.fillStyle = a;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 4, y * 4, 4, 4);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}

export interface Avatar { group: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group; head: THREE.Group; body: THREE.Group; held: THREE.Mesh; tag?: THREE.Sprite; veh?: THREE.Group; vehKind?: string }
export const DEFAULT_CHAR = { skin: '#c68e5e', hairColor: '#2a1c12', outfit: 'kandura_white', head: 'ghutra_white', hair: 'hair_short', acc: 'acc_none' };

// الوجه يتجه نحو -Z (مثل الكاميرا)
export function makeAvatar(char: any, catalog: any[]): Avatar {
  const ch = { ...DEFAULT_CHAR, ...(char || {}) };
  const opt = (k: string) => catalog.find((c) => c.key === k) || { kind: 'none', colors: {} };
  const outfit = opt(ch.outfit), headw = opt(ch.head), hair = opt(ch.hair), acc = opt(ch.acc);
  const oc = { main: '#f5f3ee', trim: '#d9d4c8', ...outfit.colors };
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = ch.skin, long = outfit.kind === 'robe' || outfit.kind === 'cloak';
  // الساقان
  const legC = long ? oc.main : oc.trim;
  const mkLeg = (x: number) => pivot(x, 0.72, 0, box(0.21, long ? 0.2 : 0.62, 0.22, legC, 0, long ? -0.5 : -0.31, 0), box(0.21, 0.1, 0.26, long ? skin : '#3a2a20', 0, -0.67, -0.02));
  const legL = mkLeg(-0.12), legR = mkLeg(0.12); body.add(legL, legR);
  if (long) { body.add(box(0.5, 0.56, 0.3, oc.main, 0, 0.42, 0)); body.add(box(0.52, 0.05, 0.32, oc.trim, 0, 0.14, 0)); }
  // الجذع
  body.add(box(0.5, 0.6, 0.28, oc.main, 0, 1.02, 0));
  body.add(box(0.07, long ? 0.5 : 0.3, 0.02, oc.trim, 0, long ? 1.02 : 1.14, -0.15));
  body.add(box(0.26, 0.05, 0.3, oc.trim, 0, 1.3, 0));
  if (outfit.kind === 'cloak') {
    const cl = oc.trim, gd = oc.gold || '#d6a94a';
    body.add(box(0.6, 1.05, 0.06, cl, 0, 0.78, 0.17)); body.add(box(0.07, 1.05, 0.34, cl, -0.3, 0.78, 0.02)); body.add(box(0.07, 1.05, 0.34, cl, 0.3, 0.78, 0.02));
    body.add(box(0.03, 1.05, 0.03, gd, -0.3, 0.78, -0.16)); body.add(box(0.03, 1.05, 0.03, gd, 0.3, 0.78, -0.16));
  }
  // الذراعان
  const mkArm = (x: number) => pivot(x, 1.28, 0, box(0.17, 0.5, 0.18, oc.main, 0, -0.22, 0), box(0.15, 0.13, 0.16, skin, 0, -0.53, 0));
  const armL = mkArm(-0.34), armR = mkArm(0.34); body.add(armL, armR);
  const held = box(0.2, 0.2, 0.2, '#888888', 0, -0.62, -0.14); held.visible = false; armR.add(held);
  // الرأس
  const hm = [M(skin), M(skin), M(skin), M(skin), M(skin), faceTex(skin)];
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), hm);
  const head = pivot(0, 1.34, 0, headMesh); headMesh.position.y = 0.24; body.add(head);
  const hc = { main: '#f8f6f1', trim: '#1c1c1c', ...headw.colors };
  const covered = ['ghutra', 'shayla', 'turban'].includes(headw.kind);
  if (!covered) {
    const c = ch.hairColor;
    if (hair.kind === 'short') { head.add(box(0.5, 0.12, 0.5, c, 0, 0.47, 0)); head.add(box(0.5, 0.3, 0.08, c, 0, 0.33, 0.22)); }
    else if (hair.kind === 'long') { head.add(box(0.5, 0.12, 0.5, c, 0, 0.47, 0)); head.add(box(0.52, 0.62, 0.1, c, 0, 0.16, 0.23)); head.add(box(0.06, 0.4, 0.3, c, -0.25, 0.28, 0.08)); head.add(box(0.06, 0.4, 0.3, c, 0.25, 0.28, 0.08)); }
    else if (hair.kind === 'curly') { for (let i = 0; i < 9; i++) head.add(box(0.2, 0.18, 0.2, c, ((i % 3) - 1) * 0.17, 0.5, (((i / 3) | 0) - 1) * 0.17)); head.add(box(0.5, 0.26, 0.1, c, 0, 0.36, 0.23)); }
  }
  if (headw.kind === 'ghutra') {
    const cm: any = hc.check ? checkTex(hc.main, hc.check) : hc.main;
    head.add(box(0.52, 0.16, 0.52, cm, 0, 0.45, 0)); head.add(box(0.54, 0.56, 0.07, cm, 0, 0.16, 0.25));
    head.add(box(0.07, 0.5, 0.34, cm, -0.26, 0.2, 0.08)); head.add(box(0.07, 0.5, 0.34, cm, 0.26, 0.2, 0.08));
    head.add(box(0.5, 0.045, 0.5, hc.trim, 0, 0.55, 0)); head.add(box(0.44, 0.045, 0.44, hc.trim, 0, 0.6, 0));
  } else if (headw.kind === 'turban') {
    head.add(box(0.56, 0.2, 0.56, hc.main, 0, 0.43, 0)); head.add(box(0.48, 0.1, 0.48, hc.main, 0, 0.56, 0)); head.add(box(0.14, 0.14, 0.1, hc.trim, 0.12, 0.47, -0.3)); head.add(box(0.1, 0.3, 0.06, hc.main, -0.2, 0.2, 0.26));
  } else if (headw.kind === 'cap') {
    head.add(box(0.48, 0.14, 0.48, hc.main, 0, 0.53, 0)); head.add(box(0.5, 0.05, 0.5, hc.trim, 0, 0.47, 0));
  } else if (headw.kind === 'shayla') {
    head.add(box(0.54, 0.14, 0.54, hc.main, 0, 0.47, 0)); head.add(box(0.56, 0.7, 0.08, hc.main, 0, 0.14, 0.26));
    head.add(box(0.07, 0.62, 0.42, hc.main, -0.27, 0.16, 0.04)); head.add(box(0.07, 0.62, 0.42, hc.main, 0.27, 0.16, 0.04));
    head.add(box(0.5, 0.06, 0.04, hc.trim, 0, 0.42, -0.25)); head.add(box(0.5, 0.1, 0.06, hc.main, 0, -0.02, -0.2));
  }
  const ac = { main: '#1c1c1c', trim: '#d6a94a', ...acc.colors };
  if (acc.kind === 'glasses') { head.add(box(0.17, 0.11, 0.03, ac.main, -0.11, 0.27, -0.245)); head.add(box(0.17, 0.11, 0.03, ac.main, 0.11, 0.27, -0.245)); head.add(box(0.06, 0.03, 0.03, ac.main, 0, 0.28, -0.245)); }
  else if (acc.kind === 'backpack') { body.add(box(0.38, 0.44, 0.16, ac.main, 0, 1.02, 0.23)); body.add(box(0.3, 0.1, 0.18, ac.trim, 0, 0.9, 0.24)); }
  else if (acc.kind === 'belt') { body.add(box(0.53, 0.08, 0.31, ac.main, 0, 0.76, 0)); body.add(box(0.1, 0.1, 0.03, ac.trim, 0, 0.76, -0.16)); }
  else if (acc.kind === 'falcon') { const f = new THREE.Group(); f.add(box(0.13, 0.2, 0.16, ac.main, 0, 0, 0), box(0.11, 0.1, 0.11, ac.trim, 0, 0.14, -0.03), box(0.04, 0.04, 0.06, '#e0b030', 0, 0.13, -0.11), box(0.1, 0.05, 0.14, ac.main, 0, -0.1, 0.1)); f.position.set(-0.02, -0.42, -0.14); armL.add(f); armL.rotation.x = -1.1; }
  return { group: g, armL, armR, legL, legR, head, body, held };
}

export function nameTag(text: string, color = '#ffffff'): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 72; const g = cv.getContext('2d')!;
  g.font = '700 36px Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; (g as any).direction = 'rtl';
  const w = Math.min(370, g.measureText(text).width + 36);
  g.fillStyle = 'rgba(10,25,38,.62)'; g.beginPath(); (g as any).roundRect(192 - w / 2, 8, w, 56, 18); g.fill();
  g.fillStyle = color; g.fillText(text, 192, 38, 350);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(1.9, 0.36, 1); return s;
}

export function animateAvatar(a: Avatar, phase: number, moving: boolean, swing: number, riding: boolean, hasFalcon = false) {
  const s = moving ? Math.sin(phase) * 0.75 : 0;
  if (riding) { a.legL.rotation.x = -1.35; a.legR.rotation.x = -1.35; a.legL.rotation.z = -0.25; a.legR.rotation.z = 0.25; a.armR.rotation.x = -0.6; if (!hasFalcon) a.armL.rotation.x = -0.6; return; }
  a.legL.rotation.z = a.legR.rotation.z = 0;
  a.legL.rotation.x = s; a.legR.rotation.x = -s;
  if (!hasFalcon) a.armL.rotation.x = -s * 0.8;
  a.armR.rotation.x = swing > 0 ? -1.5 * Math.sin(swing * Math.PI) - 0.2 : s * 0.8;
}

export function makeVehicle(kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'boat') {
    g.add(box(1.1, 0.34, 2.6, '#6b452a', 0, 0.12, 0), box(0.8, 0.3, 0.5, '#6b452a', 0, 0.16, -1.5), box(0.9, 0.08, 2.2, '#c9a372', 0, 0.3, 0), box(1.14, 0.08, 2.64, '#e9e2d2', 0, 0.3, 0));
    g.add(box(0.07, 1.7, 0.07, '#8b6a44', 0, 1.1, -0.5), box(0.04, 1.1, 0.9, '#f3efe6', 0, 1.25, 0.0));
  } else if (kind === 'buggy') {
    g.add(box(1.1, 0.3, 1.9, '#d9482e', 0, 0.45, 0), box(0.9, 0.3, 0.6, '#3f4347', 0, 0.75, 0.55), box(1.0, 0.06, 0.06, '#3f4347', 0, 1.25, 0.3), box(0.06, 0.6, 0.06, '#3f4347', -0.5, 0.95, 0.3), box(0.06, 0.6, 0.06, '#3f4347', 0.5, 0.95, 0.3));
    for (const [x, z] of [[-0.62, -0.7], [0.62, -0.7], [-0.62, 0.7], [0.62, 0.7]]) g.add(box(0.26, 0.56, 0.56, '#26282b', x, 0.28, z));
  } else if (kind === 'camel') { const c = makeAnimal('camel'); g.add(c.group); (g as any).animal = c; }
  return g;
}

export interface Animal { group: THREE.Group; legs: THREE.Group[]; h: number }
export function makeAnimal(type: string): Animal {
  const g = new THREE.Group(), legs: THREE.Group[] = [];
  const quad = (bw: number, bh: number, bl: number, lh: number, c: string, lc = c) => {
    g.add(box(bw, bh, bl, c, 0, lh + bh / 2, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = pivot((x * (bw - 0.16)) / 2, lh, (z * (bl - 0.2)) / 2, box(0.15, lh, 0.15, lc, 0, -lh / 2, 0)); legs.push(l); g.add(l); }
  };
  if (type === 'camel') {
    const c = '#c9a46a', d = '#b08a52';
    quad(0.7, 0.7, 1.7, 1.15, c, d);
    g.add(box(0.5, 0.42, 0.7, c, 0, 2.15, 0.1)); // السنام
    const neck = box(0.3, 1.0, 0.32, c, 0, 2.2, -0.95); neck.rotation.x = 0.35; g.add(neck);
    g.add(box(0.32, 0.32, 0.6, c, 0, 2.72, -1.3), box(0.08, 0.12, 0.06, d, -0.12, 2.92, -1.1), box(0.08, 0.12, 0.06, d, 0.12, 2.92, -1.1), box(0.06, 0.06, 0.02, '#1c1c1c', -0.17, 2.78, -1.42), box(0.06, 0.06, 0.02, '#1c1c1c', 0.17, 2.78, -1.42));
    g.add(box(0.74, 0.1, 0.8, '#a8272d', 0, 1.9, 0.1)); g.add(box(0.06, 0.5, 0.06, d, 0, 1.6, 0.9));
    return { group: g, legs, h: 2.9 };
  }
  if (type === 'oryx') {
    quad(0.5, 0.55, 1.2, 0.75, '#f1ece2', '#3a2a20');
    g.add(box(0.26, 0.5, 0.26, '#f1ece2', 0, 1.45, -0.6), box(0.26, 0.26, 0.46, '#f1ece2', 0, 1.72, -0.78), box(0.27, 0.12, 0.2, '#2a1c12', 0, 1.7, -0.9));
    const h1 = box(0.04, 0.8, 0.04, '#2a1c12', -0.08, 2.2, -0.55), h2 = box(0.04, 0.8, 0.04, '#2a1c12', 0.08, 2.2, -0.55); h1.rotation.x = h2.rotation.x = -0.35; g.add(h1, h2);
    g.add(box(0.06, 0.4, 0.06, '#2a1c12', 0, 1.1, 0.62));
    return { group: g, legs, h: 1.9 };
  }
  if (type === 'ghoul') {
    const c = '#5a4a3a', glow = new THREE.MeshBasicMaterial({ color: '#7ff5ff' });
    for (const x of [-0.14, 0.14]) { const l = pivot(x, 1.0, 0, box(0.2, 1.0, 0.2, c, 0, -0.5, 0)); legs.push(l); g.add(l); }
    g.add(box(0.6, 0.9, 0.3, '#3a2e26', 0, 1.45, 0), box(0.66, 0.5, 0.36, '#2a2220', 0, 1.0, 0));
    for (const x of [-0.42, 0.42]) { const a = pivot(x, 1.85, 0, box(0.18, 1.0, 0.18, c, 0, -0.5, 0)); a.rotation.x = -1.3; legs.push(a); g.add(a); }
    g.add(box(0.46, 0.5, 0.46, c, 0, 2.15, 0), box(0.1, 0.08, 0.02, glow, -0.11, 2.2, -0.24), box(0.1, 0.08, 0.02, glow, 0.11, 2.2, -0.24), box(0.52, 0.16, 0.52, '#2a2220', 0, 2.42, 0));
    return { group: g, legs, h: 2.5 };
  }
  // ماعز جبلي
  quad(0.4, 0.42, 0.85, 0.5, type === 'goat' ? '#7a6248' : '#999', '#3a2a20');
  g.add(box(0.24, 0.3, 0.3, '#7a6248', 0, 1.1, -0.5), box(0.2, 0.2, 0.3, '#e9e2d2', 0, 1.2, -0.68), box(0.05, 0.22, 0.05, '#3a2a20', -0.08, 1.4, -0.5), box(0.05, 0.22, 0.05, '#3a2a20', 0.08, 1.4, -0.5), box(0.06, 0.16, 0.04, '#e9e2d2', 0, 1.0, -0.78));
  return { group: g, legs, h: 1.4 };
}
