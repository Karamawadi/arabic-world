// أطلس الخامات الإجرائي: كل خامات المكعبات وأيقونات العناصر تُرسم بالكود (لا أصول منسوخة)
import { rng, strSeed } from '../../shared/noise';

export const T = 32, COLS = 16;
type Spec = [string, string, string];

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function drawTile(g: CanvasRenderingContext2D, ox: number, oy: number, [c, c2, pat]: Spec) {
  const r = rng(strSeed(c + c2 + pat));
  const R = (n: number) => (r() * n) | 0;
  g.save(); g.beginPath(); g.rect(ox, oy, T, T); g.clip(); g.translate(ox, oy);
  g.clearRect(0, 0, T, T);
  const fill = (col: string) => { g.fillStyle = col; g.fillRect(0, 0, T, T); };
  const speck = (n: number, col: string, s = 2, a = 1) => { g.globalAlpha = a; g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(R(T), R(T), 1 + R(s), 1 + R(s)); g.globalAlpha = 1; };
  const line = (x0: number, y0: number, x1: number, y1: number, col: string, w = 1, a = 1) => { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.globalAlpha = 1; };
  const cutout = ['leaves', 'lattice', 'door_open', 'shrub', 'flower', 'tuft', 'reed', 'glass'].includes(pat);
  if (!cutout) fill(c);
  switch (pat) {
    case 'grain': speck(70, c2, 2, 0.8); speck(24, shade(c, 0.18), 2, 0.7); break;
    case 'sand': speck(46, c2, 2, 0.7); speck(20, shade(c, 0.2), 1, 0.8);
      for (let i = 0; i < 3; i++) { g.globalAlpha = 0.28; g.strokeStyle = c2; g.beginPath(); const y = 5 + i * 10 + R(4); g.moveTo(0, y); g.bezierCurveTo(10, y - 4, 22, y + 4, 32, y); g.stroke(); g.globalAlpha = 1; } break;
    case 'rock': for (let i = 0; i < 12; i++) { g.globalAlpha = 0.5; g.fillStyle = i % 3 ? c2 : shade(c, 0.14); g.fillRect(R(T), R(T), 3 + R(7), 2 + R(5)); } g.globalAlpha = 1;
      line(R(10), R(T), 14 + R(10), R(T), shade(c2, -0.3), 1, 0.6); line(18 + R(6), R(T), 30, R(T), shade(c2, -0.3), 1, 0.5); break;
    case 'layers': for (let y = 0; y < T; y += 5 + R(4)) { g.fillStyle = R(2) ? c2 : shade(c, 0.1); g.globalAlpha = 0.6; g.fillRect(0, y, T, 2 + R(2)); } g.globalAlpha = 1; speck(30, shade(c2, -0.15), 2, 0.5); break;
    case 'pebble': for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? c2 : shade(c, 0.15); g.beginPath(); g.ellipse(R(T), R(T), 2 + R(3), 2 + R(2), 0, 0, 7); g.fill(); } speck(20, shade(c2, -0.25), 1, 0.6); break;
    case 'crack': speck(30, c2, 2, 0.6); for (let i = 0; i < 5; i++) line(R(T), R(T), R(T), R(T), shade(c2, -0.2), 1, 0.7); break;
    case 'smooth': { const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, shade(c, 0.08)); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, T, T); speck(12, shade(c2, -0.1), 2, 0.4); break; }
    case 'brick': for (let row = 0; row < 4; row++) { const off = row % 2 ? 8 : 0; for (let x = -8; x < T; x += 16) { g.fillStyle = shade(c, (r() - 0.5) * 0.16); g.fillRect(x + off + 1, row * 8 + 1, 14, 6); } }
      g.globalCompositeOperation = 'destination-over'; fill(c2); g.globalCompositeOperation = 'source-over'; speck(20, c2, 1, 0.4); break;
    case 'planks': for (let row = 0; row < 4; row++) { g.fillStyle = shade(c, (r() - 0.5) * 0.14); g.fillRect(0, row * 8, T, 7); g.fillStyle = c2; g.fillRect(0, row * 8 + 7, T, 1); const jx = R(T); g.fillRect(jx, row * 8, 1, 7); g.fillStyle = shade(c2, -0.3); g.fillRect((jx + 2) % T, row * 8 + 3, 1, 1); }
      speck(20, c2, 3, 0.25); break;
    case 'bark': for (let x = 0; x < T; x += 2 + R(3)) { g.fillStyle = R(2) ? c2 : shade(c, 0.1); g.globalAlpha = 0.75; g.fillRect(x, 0, 1 + R(2), T); } g.globalAlpha = 1; for (let y = 6; y < T; y += 9) line(0, y + R(2), T, y + R(2), shade(c2, -0.25), 1, 0.5); break;
    case 'bark_x': for (let y = 0; y < T; y += 2 + R(3)) { g.fillStyle = R(2) ? c2 : shade(c, 0.1); g.globalAlpha = 0.75; g.fillRect(0, y, T, 1 + R(2)); } g.globalAlpha = 1; break;
    case 'rings': for (let i = 14; i > 1; i -= 3) { g.strokeStyle = i % 2 ? c2 : shade(c, -0.12); g.lineWidth = 1.5; g.beginPath(); g.arc(16, 16, i, 0, 7); g.stroke(); } g.strokeStyle = shade(c2, -0.3); g.lineWidth = 2; g.strokeRect(1, 1, 30, 30); break;
    case 'leaves': for (let i = 0; i < 90; i++) { g.fillStyle = [c, c2, shade(c, 0.18), shade(c2, -0.15)][R(4)]; const x = R(T), y = R(T); g.beginPath(); g.ellipse(x, y, 2 + R(3), 1.5 + R(2), r() * 3, 0, 7); g.fill(); } break;
    case 'ore': for (let i = 0; i < 10; i++) { g.globalAlpha = 0.5; g.fillStyle = shade(c, -0.18); g.fillRect(R(T), R(T), 3 + R(6), 2 + R(5)); } g.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { const x = 3 + R(24), y = 3 + R(24), s = 3 + R(3); g.fillStyle = shade(c2, -0.25); g.fillRect(x - 1, y - 1, s + 2, s + 2); g.fillStyle = c2; g.fillRect(x, y, s, s); g.fillStyle = shade(c2, 0.5); g.fillRect(x, y, 2, 1); } break;
    case 'glass': g.globalAlpha = 0.22; fill(c); g.globalAlpha = 1; g.strokeStyle = shade(c, -0.25); g.lineWidth = 2; g.strokeRect(1, 1, 30, 30); line(6, 12, 12, 6, c2, 2, 0.9); line(9, 17, 17, 9, c2, 1.5, 0.7); break;
    case 'glass2': { const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, c2); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.25)); g.fillStyle = gr; g.fillRect(0, 0, T, T);
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 2; g.strokeRect(0, 0, T, T); line(16, 0, 16, T, shade(c, -0.4), 1, 0.8); line(3, 10, 10, 3, '#ffffff', 2, 0.55); break; }
    case 'weave': for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) { const hz = ((x + y) / 4) % 2 === 0; g.fillStyle = hz ? c : c2; g.fillRect(x, y, 4, 4); g.fillStyle = shade(c2, -0.2); if (hz) g.fillRect(x, y + 3, 4, 1); else g.fillRect(x + 3, y, 1, 4); } break;
    case 'lattice': g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 29, 29); for (let i = -T; i < T * 2; i += 8) { line(i, 0, i + T, T, c, 2.5); line(i, T, i + T, 0, c2, 2.5); } break;
    case 'vent': speck(20, shade(c, -0.1), 2, 0.5); for (let x = 4; x < T; x += 7) { g.fillStyle = c2; g.fillRect(x, 4, 3, 24); g.fillStyle = shade(c2, -0.4); g.fillRect(x, 4, 1, 24); } g.fillStyle = shade(c, -0.15); g.fillRect(0, 0, T, 2); g.fillRect(0, 30, T, 2); break;
    case 'sadu': { const bands = [c2, '#1c1a1a', c, c2, '#1c1a1a']; for (let i = 0; i < 5; i++) { g.fillStyle = bands[i]; g.fillRect(0, 2 + i * 6, T, i === 2 ? 4 : 2); }
      g.fillStyle = c2; for (let x = 0; x < T; x += 8) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 4, 9); g.lineTo(x + 8, 14); g.fill(); g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 4, 25); g.lineTo(x + 8, 20); g.fill(); } break; }
    case 'tiles': fill(c2); for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const cx = 8 + tx * 16, cy = 8 + ty * 16; g.fillStyle = c; g.save(); g.translate(cx, cy); g.fillRect(-5, -5, 10, 10); g.rotate(Math.PI / 4); g.fillRect(-5, -5, 10, 10); g.restore(); g.fillStyle = '#e0b84a'; g.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 1; g.strokeRect(0.5, 0.5, 31, 31); break;
    case 'stripes': for (let y = 0; y < T; y += 8) { g.fillStyle = (y / 8) % 2 ? c2 : c; g.fillRect(0, y, T, 8); } speck(40, shade(c, 0.2), 2, 0.25); break;
    case 'metal': { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, shade(c, 0.25)); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, T, T); g.strokeStyle = shade(c2, -0.25); g.strokeRect(1.5, 1.5, 29, 29);
      for (const [x, y] of [[5, 5], [26, 5], [5, 26], [26, 26]]) { g.fillStyle = shade(c, 0.4); g.fillRect(x, y, 2, 2); } break; }
    case 'marble': speck(14, c2, 3, 0.3); for (let i = 0; i < 4; i++) { g.globalAlpha = 0.5; g.strokeStyle = c2; g.lineWidth = 1 + R(2); g.beginPath(); g.moveTo(R(T), 0); g.bezierCurveTo(R(T), 10, R(T), 22, R(T), T); g.stroke(); } g.globalAlpha = 1; break;
    case 'coral': for (let i = 0; i < 40; i++) { g.fillStyle = i % 4 ? c2 : shade(c2, -0.2); g.beginPath(); g.arc(R(T), R(T), 0.8 + r() * 1.6, 0, 7); g.fill(); } line(0, 16, T, 16, shade(c2, -0.15), 1, 0.5); line(16, 0, 16, 16, shade(c2, -0.15), 1, 0.5); line(8, 16, 8, T, shade(c2, -0.15), 1, 0.5); break;
    case 'turf': speck(50, shade(c, -0.15), 2, 0.7); g.fillStyle = c2; g.fillRect(0, 0, T, 6); for (let x = 0; x < T; x += 2) g.fillRect(x, 6, 2, R(5)); break;
    case 'lantern': fill(c2); { const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15); gr.addColorStop(0, shade(c, 0.6)); gr.addColorStop(1, c); g.fillStyle = gr; g.fillRect(4, 4, 24, 24); }
      g.strokeStyle = c2; g.lineWidth = 2; g.strokeRect(4, 4, 24, 24); line(16, 4, 16, 28, c2, 2); line(4, 16, 28, 16, c2, 2); break;
    case 'door': for (let x = 0; x < T; x += 8) { g.fillStyle = shade(c, (r() - 0.5) * 0.12); g.fillRect(x, 0, 7, T); } g.strokeStyle = shade(c, -0.4); g.lineWidth = 2; g.strokeRect(1, 1, 30, 30);
      g.fillStyle = c2; for (let y = 5; y < T; y += 7) for (let x = 5; x < T; x += 7) g.fillRect(x, y, 2, 2); g.beginPath(); g.arc(25, 17, 2.5, 0, 7); g.fill(); break;
    case 'door_open': g.fillStyle = c; g.fillRect(0, 0, 4, T); g.fillRect(28, 0, 4, T); g.fillRect(0, 0, T, 3); g.fillStyle = c2; g.fillRect(1, 8, 2, 2); g.fillRect(1, 22, 2, 2); break;
    case 'oyster': speck(40, shade(c, -0.12), 2, 0.6); for (let i = 0; i < 3; i++) { const x = 6 + R(20), y = 8 + R(18); g.fillStyle = shade(c2, -0.25); g.beginPath(); g.ellipse(x, y, 6, 4, 0, 0, 7); g.fill(); g.fillStyle = c2; g.beginPath(); g.ellipse(x, y - 1, 5, 3, 0, 0, 7); g.fill(); line(x - 4, y - 1, x + 4, y - 1, shade(c2, -0.3), 1, 0.7); } break;
    case 'water': for (let i = 0; i < 5; i++) { const y = 3 + i * 7; g.globalAlpha = 0.5; g.strokeStyle = c2; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(8, y - 3, 16, y + 3, 32, y); g.stroke(); } g.globalAlpha = 1; break;
    case 'shrub': for (let i = 0; i < 26; i++) { const x = 16 + (r() - 0.5) * 24; line(16 + (x - 16) * 0.2, T, x, 8 + R(16), i % 2 ? c : c2, 2); } break;
    case 'flower': for (let i = 0; i < 5; i++) { const x = 5 + R(22), h = 8 + R(14); line(x, T, x, T - h, c2, 1.5); g.fillStyle = c; g.beginPath(); g.arc(x, T - h, 3, 0, 7); g.fill(); g.fillStyle = shade(c, 0.5); g.fillRect(x - 1, T - h - 1, 2, 2); } break;
    case 'tuft': for (let i = 0; i < 22; i++) { const x = 2 + R(28); line(x, T, x + (r() - 0.5) * 8, 10 + R(14), i % 2 ? c : c2, 1.5); } break;
    case 'reed': for (let i = 0; i < 7; i++) { const x = 3 + R(26); line(x, T, x + (r() - 0.5) * 3, 1 + R(6), c, 2); g.fillStyle = c2; g.fillRect(x - 1, 2 + R(6), 3, 6); } break;
    default: speck(40, c2, 2, 0.6);
  }
  if (!cutout && pat !== 'water') { g.globalAlpha = 0.1; g.fillStyle = '#fff'; g.fillRect(0, 0, T, 1); g.fillRect(0, 0, 1, T); g.fillStyle = '#000'; g.fillRect(0, T - 1, T, 1); g.fillRect(T - 1, 0, 1, T); g.globalAlpha = 1; }
  g.restore();
}

export interface Atlas { canvas: HTMLCanvasElement; tiles: Int16Array; rows: number; main: string[] }
// tiles[id*3 + (0 أعلى | 1 جانب | 2 أسفل)]
export function buildAtlas(blocks: any[]): Atlas {
  const specs: Spec[] = [], map = new Map<string, number>(), tiles = new Int16Array(256 * 3), main: string[] = [];
  const idx = (s: Spec) => { const k = s.join('|'); let i = map.get(k); if (i === undefined) { i = specs.length; specs.push(s); map.set(k, i); } return i; };
  for (const b of blocks) {
    const t = b.tex || {}, a = t.all || ['#888888', '#666666', 'grain'];
    tiles[b.id * 3] = idx(t.top || a); tiles[b.id * 3 + 1] = idx(t.side || a); tiles[b.id * 3 + 2] = idx(t.bottom || a);
    main[b.id] = (t.top || a)[0];
  }
  const rows = Math.max(1, Math.ceil(specs.length / COLS));
  const canvas = document.createElement('canvas'); canvas.width = COLS * T; canvas.height = rows * T;
  const g = canvas.getContext('2d')!;
  specs.forEach((s, i) => { try { drawTile(g, (i % COLS) * T, ((i / COLS) | 0) * T, s); } catch { /* خامة غير صالحة */ } });
  return { canvas, tiles, rows, main };
}

const iconCache = new Map<string, string>();
export function iconURL(def: any, isBlock: boolean): string {
  const k = (isBlock ? 'b:' : 'i:') + def.key + JSON.stringify(isBlock ? def.tex : def.icon);
  let u = iconCache.get(k); if (u) return u;
  const cv = document.createElement('canvas'); cv.width = cv.height = 48; const g = cv.getContext('2d')!;
  if (isBlock) {
    const t = def.tex || {}, a = t.all || ['#888888', '#666666', 'grain'];
    const tmp = document.createElement('canvas'); tmp.width = T * 2; tmp.height = T; const tg = tmp.getContext('2d')!;
    drawTile(tg, 0, 0, t.top || a); drawTile(tg, T, 0, t.side || a);
    if (def.shape === 'cross') g.drawImage(tmp, T, 0, T, T, 6, 6, 36, 36);
    else {
      // مكعب متساوي القياس مبسّط
      g.save(); g.setTransform(1, -0.5, 1, 0.5, 0, 0); g.drawImage(tmp, 0, 0, T, T, -6, 18, 21, 21); g.restore();
      g.save(); g.setTransform(1, 0.5, 0, 1, 3, 13.5); g.drawImage(tmp, T, 0, T, T, 0, 0, 21, 22); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 21, 22); g.restore();
      g.save(); g.setTransform(1, -0.5, 0, 1, 24, 24); g.drawImage(tmp, T, 0, T, T, 0, 0, 21, 22); g.fillStyle = 'rgba(0,0,0,.36)'; g.fillRect(0, 0, 21, 22); g.restore();
    }
  } else {
    const [c, c2, sh] = def.icon || ['#888', '#666', 'orb'];
    g.lineCap = 'round'; g.lineJoin = 'round';
    const handle = () => { g.strokeStyle = c2; g.lineWidth = 5; g.beginPath(); g.moveTo(12, 38); g.lineTo(32, 16); g.stroke(); };
    switch (sh) {
      case 'stick': g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.moveTo(11, 38); g.lineTo(37, 10); g.stroke(); g.strokeStyle = c2; g.lineWidth = 2; g.beginPath(); g.moveTo(13, 38); g.lineTo(38, 12); g.stroke(); break;
      case 'ingot': g.fillStyle = c2; g.beginPath(); g.moveTo(6, 32); g.lineTo(14, 18); g.lineTo(40, 18); g.lineTo(44, 32); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(14, 18); g.lineTo(40, 18); g.lineTo(37, 26); g.lineTo(11, 26); g.closePath(); g.fill(); break;
      case 'gem': g.fillStyle = c2; g.beginPath(); g.moveTo(24, 6); g.lineTo(40, 20); g.lineTo(24, 42); g.lineTo(8, 20); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(24, 6); g.lineTo(32, 20); g.lineTo(24, 42); g.lineTo(16, 20); g.closePath(); g.fill(); break;
      case 'orb': g.fillStyle = c2; g.beginPath(); g.arc(24, 25, 14, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(22, 23, 11, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(18, 19, 3, 0, 7); g.fill(); break;
      case 'disc': g.fillStyle = c2; g.beginPath(); g.ellipse(24, 26, 18, 11, 0, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(24, 24, 16, 9, 0, 0, 7); g.fill(); break;
      case 'cup': g.fillStyle = c; g.beginPath(); g.moveTo(14, 14); g.lineTo(34, 14); g.lineTo(30, 36); g.lineTo(18, 36); g.closePath(); g.fill(); g.fillStyle = c2; g.fillRect(15, 15, 18, 5); g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(35, 23, 5, -1.2, 1.2); g.stroke(); break;
      case 'pick': handle(); g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.moveTo(16, 12); g.quadraticCurveTo(34, 8, 40, 28); g.stroke(); break;
      case 'axe': handle(); g.fillStyle = c; g.beginPath(); g.moveTo(26, 8); g.lineTo(42, 14); g.lineTo(38, 28); g.lineTo(28, 20); g.closePath(); g.fill(); break;
      case 'shovel': handle(); g.fillStyle = c; g.beginPath(); g.ellipse(35, 13, 7, 9, 0.75, 0, 7); g.fill(); break;
      case 'sword': g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.moveTo(18, 30); g.lineTo(40, 8); g.stroke(); g.strokeStyle = c2; g.lineWidth = 4; g.beginPath(); g.moveTo(12, 26); g.lineTo(22, 36); g.moveTo(9, 39); g.lineTo(16, 32); g.stroke(); break;
      case 'shield': g.fillStyle = c2; g.beginPath(); g.moveTo(24, 5); g.lineTo(41, 11); g.lineTo(38, 32); g.lineTo(24, 43); g.lineTo(10, 32); g.lineTo(7, 11); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(24, 10); g.lineTo(36, 14); g.lineTo(34, 30); g.lineTo(24, 38); g.lineTo(14, 30); g.lineTo(12, 14); g.closePath(); g.fill(); break;
      case 'boat': g.fillStyle = c; g.beginPath(); g.moveTo(4, 26); g.lineTo(44, 26); g.lineTo(36, 38); g.lineTo(12, 38); g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.moveTo(24, 6); g.lineTo(38, 23); g.lineTo(24, 23); g.closePath(); g.fill(); g.fillRect(22, 6, 2, 20); break;
      case 'buggy': g.fillStyle = c; g.fillRect(8, 18, 32, 12); g.fillRect(16, 10, 16, 9); g.fillStyle = c2; g.beginPath(); g.arc(14, 33, 7, 0, 7); g.arc(34, 33, 7, 0, 7); g.fill(); break;
      default: g.fillStyle = c; g.fillRect(10, 10, 28, 28);
    }
  }
  u = cv.toDataURL(); iconCache.set(k, u); return u;
}
