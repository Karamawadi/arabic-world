// منشآت ومبانٍ إجرائية (حصون، أبراج، بيوت تراثية، ناطحات سحاب...) + أشجار.
// كل منشأة تُبنى عبر واجهة Builder بإحداثيات محلية (y=0 أول مكعب فوق الأرض).

export interface Builder {
  set(x: number, y: number, z: number, key: string): void;
}
export type Rand = () => number;
export interface StructDef {
  w: number; d: number;
  site: 'land' | 'water' | 'coast' | 'any';
  sea?: boolean; // الارتفاع منسوب لمستوى البحر بدل الأرض
  build(b: B, r: Rand): void;
}

export class B {
  constructor(public s: Builder) {}
  set(x: number, y: number, z: number, k: string) { this.s.set(x, y, z, k); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, k: string) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.s.set(x, y, z, k);
  }
  hollow(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, k: string) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      if (x === x0 || x === x1 || z === z0 || z === z1) this.s.set(x, y, z, k);
  }
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { this.box(x0, y0, z0, x1, y1, z1, 'air'); }
  // أساس يملأ ما تحت المبنى ويفرغ ما فوقه
  base(w: number, d: number, h: number, k: string, depth = 7) {
    this.box(0, -depth, 0, w - 1, -1, d - 1, k);
    this.clear(0, 0, 0, w - 1, h, d - 1);
  }
}

export function palm(b: Builder, x: number, y: number, z: number, r: Rand) {
  const h = 5 + ((r() * 4) | 0);
  for (let i = 0; i < h; i++) b.set(x, y + i, z, 'palm_log');
  const t = y + h;
  b.set(x, t, z, 'palm_leaves');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(x + dx, t, z + dz, 'palm_leaves'); b.set(x + dx * 2, t, z + dz * 2, 'palm_leaves');
    b.set(x + dx * 3, t - 1, z + dz * 3, 'palm_leaves');
  }
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { b.set(x + dx, t, z + dz, 'palm_leaves'); b.set(x + dx * 2, t - 1, z + dz * 2, 'palm_leaves'); }
}
export function canopy(b: Builder, x: number, y: number, z: number, r: Rand, log: string, leaves: string, flat: boolean) {
  const h = flat ? 3 + ((r() * 2) | 0) : 3 + ((r() * 3) | 0);
  for (let i = 0; i < h; i++) b.set(x, y + i, z, log);
  const t = y + h, R = flat ? 3 : 2;
  for (let dy = 0; dy <= (flat ? 1 : 2); dy++) {
    const rr = flat ? (dy === 0 ? R : R - 1) : (dy === 2 ? 1 : R);
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dz * dz > rr * rr + 1) continue;
      if (dx === 0 && dz === 0 && dy === 0) continue;
      b.set(x + dx, t + dy - (flat ? 0 : 1), z + dz, leaves);
    }
  }
  b.set(x, t - (flat ? 0 : 1), z, log);
}
export function frank(b: Builder, x: number, y: number, z: number, r: Rand) {
  b.set(x, y, z, 'frank_log'); b.set(x, y + 1, z, 'frank_log');
  const dx = r() < 0.5 ? 1 : -1;
  b.set(x + dx, y + 2, z, 'frank_log'); b.set(x, y + 2, z, 'acacia_leaves'); b.set(x + dx, y + 3, z, 'acacia_leaves');
  b.set(x + dx * 2, y + 2, z, 'acacia_leaves'); b.set(x, y + 2, z + 1, 'acacia_leaves'); b.set(x + dx, y + 2, z - 1, 'acacia_leaves');
}
export const TREES: Record<string, (b: Builder, x: number, y: number, z: number, r: Rand) => void> = {
  palm,
  ghaf: (b, x, y, z, r) => canopy(b, x, y, z, r, 'ghaf_log', 'ghaf_leaves', false),
  acacia: (b, x, y, z, r) => canopy(b, x, y, z, r, 'acacia_log', 'acacia_leaves', true),
  mangrove: (b, x, y, z, r) => { for (let i = 0; i < 3; i++) b.set(x, y + i, z, 'mangrove_log'); canopy(b, x, y + 2, z, r, 'mangrove_log', 'mangrove_leaves', false); },
  frankincense: frank,
};

function crenel(b: B, x0: number, z0: number, x1: number, z1: number, y: number, k: string) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
    if ((x === x0 || x === x1 || z === z0 || z === z1) && (x + z) % 2 === 0) b.set(x, y, z, k);
}

export const STRUCTS: Record<string, StructDef> = {
  fort: {
    w: 19, d: 19, site: 'land',
    build(b, r) {
      const wall = r() < 0.5 ? 'coral_stone' : 'mud_brick';
      b.base(19, 19, 14, 'sandstone');
      b.hollow(1, 0, 1, 17, 5, 17, wall);
      crenel(b, 1, 1, 17, 17, 6, wall);
      for (const [tx, tz] of [[0, 0], [14, 0], [0, 14], [14, 14]]) {
        b.hollow(tx, 0, tz, tx + 4, 9, tz + 4, wall);
        b.box(tx, 6, tz, tx + 4, 6, tz + 4, 'palm_planks');
        crenel(b, tx, tz, tx + 4, tz + 4, 10, wall);
        b.set(tx + 2, 3, tz === 0 ? tz : tz + 4, 'mashrabiya');
      }
      b.clear(8, 0, 1, 10, 3, 1); // البوابة
      b.set(7, 4, 0, 'lantern'); b.set(11, 4, 0, 'lantern');
      b.hollow(11, 0, 11, 16, 3, 16, 'plaster'); b.box(11, 4, 11, 16, 4, 16, 'arish');
      b.clear(11, 0, 13, 11, 1, 13); b.set(11, 0, 13, 'door_closed');
      b.box(12, 0, 12, 15, 0, 15, 'sadu'); b.set(15, 2, 15, 'lantern');
      b.hollow(8, 0, 8, 10, 0, 10, 'coral_stone'); b.set(9, 0, 9, 'water'); b.set(9, -1, 9, 'water');
      for (let y = 0; y < 9; y++) b.set(4, y + 7, 4, 'palm_log');
      b.box(5, 14, 4, 6, 15, 4, 'sadu');
    },
  },
  watchtower: {
    w: 7, d: 7, site: 'land',
    build(b) {
      b.base(7, 7, 16, 'sandstone');
      b.hollow(1, 0, 1, 5, 10, 5, 'mud_brick');
      for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) b.clear(x, 0, z, x, 10, z);
      b.box(0, 11, 0, 6, 11, 6, 'palm_planks');
      b.hollow(0, 12, 0, 6, 12, 6, 'mud_brick'); crenel(b, 0, 0, 6, 6, 13, 'mud_brick');
      b.clear(3, 0, 1, 3, 1, 1);
      b.set(3, 6, 1, 'mashrabiya'); b.set(1, 7, 3, 'mashrabiya'); b.set(5, 7, 3, 'mashrabiya'); b.set(3, 12, 3, 'lantern');
      for (let y = 0; y < 11; y++) b.set(4, y, 4, 'palm_log_x'); // سلّم بسيط
    },
  },
  barjeel_house: {
    w: 12, d: 10, site: 'land',
    build(b) {
      b.base(12, 10, 12, 'sandstone');
      b.hollow(1, 0, 1, 10, 3, 8, 'plaster');
      b.box(1, 4, 1, 10, 4, 8, 'palm_planks'); b.hollow(1, 5, 1, 10, 5, 8, 'plaster');
      b.clear(5, 0, 1, 5, 1, 1); b.set(5, 0, 1, 'door_closed');
      b.set(3, 2, 1, 'mashrabiya'); b.set(8, 2, 1, 'mashrabiya'); b.set(1, 2, 4, 'mashrabiya'); b.set(10, 2, 5, 'mashrabiya');
      b.box(2, 0, 2, 9, 0, 7, 'palm_planks'); b.box(3, 1, 5, 6, 1, 7, 'air'); b.box(3, 0, 5, 6, 0, 7, 'sadu');
      b.set(9, 2, 7, 'lantern');
      b.hollow(7, 5, 5, 9, 7, 7, 'coral_stone'); b.hollow(7, 8, 5, 9, 10, 7, 'barjeel'); b.box(7, 11, 5, 9, 11, 7, 'coral_stone');
    },
  },
  souq: {
    w: 16, d: 8, site: 'land',
    build(b) {
      b.base(16, 8, 6, 'sandstone', 5);
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 5;
        for (const [px, pz] of [[x, 1], [x + 3, 1], [x, 5], [x + 3, 5]]) for (let y = 0; y < 3; y++) b.set(px, y, pz, 'palm_log');
        b.box(x - 1, 3, 0, x + 4, 3, 6, 'arish');
        b.box(x, 0, 5, x + 3, 2, 5, i === 1 ? 'sadu' : 'tent_cloth');
        b.box(x + 1, 0, 2, x + 2, 0, 2, 'palm_planks');
        b.set(x + 1, 1, 2, ['gold_block', 'sadu', 'zellige'][i]);
        b.set(x, 2, 1, 'lantern');
      }
    },
  },
  tent: {
    w: 8, d: 6, site: 'land',
    build(b) {
      b.base(8, 6, 5, 'sand', 4);
      b.box(1, 0, 1, 6, 0, 4, 'sadu');
      b.hollow(1, 1, 1, 6, 1, 4, 'tent_cloth'); b.clear(2, 1, 1, 5, 1, 1);
      b.box(0, 2, 0, 7, 2, 5, 'tent_cloth'); b.box(1, 3, 1, 6, 3, 4, 'tent_cloth');
      b.clear(1, 1, 2, 6, 1, 3); b.box(1, 0, 1, 6, 0, 4, 'sadu');
      b.set(6, 1, 4, 'lantern'); b.set(0, 0, 0, 'palm_log'); b.set(7, 0, 0, 'palm_log'); b.set(0, 1, 0, 'palm_log'); b.set(7, 1, 0, 'palm_log');
    },
  },
  well: {
    w: 5, d: 5, site: 'land',
    build(b) {
      b.base(5, 5, 5, 'sandstone', 4);
      b.hollow(1, 0, 1, 3, 0, 3, 'coral_stone'); b.box(2, -3, 2, 2, 0, 2, 'water');
      for (let y = 1; y < 3; y++) { b.set(1, y, 1, 'palm_log'); b.set(3, y, 3, 'palm_log'); }
      b.box(1, 3, 1, 3, 3, 3, 'arish');
    },
  },
  skyscraper: {
    w: 13, d: 13, site: 'land',
    build(b, r) {
      const w = 7 + 2 * ((r() * 3) | 0), o = (13 - w) >> 1, h = 26 + ((r() * 46) | 0);
      const glass = r() < 0.6 ? 'tinted_glass' : 'glass', frame = r() < 0.5 ? 'steel' : 'concrete';
      b.base(13, 13, 2, 'concrete');
      b.box(0, -1, 0, 12, -1, 12, 'concrete');
      let x0 = o, x1 = o + w - 1;
      for (let y = 0; y < h; y++) {
        if (y > h * 0.8 && y % 4 === 0 && x1 - x0 > 3) { x0++; x1--; }
        const slab = y % 4 === 0;
        for (let z = x0; z <= x1; z++) for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || z === x0 || z === x1;
          const corner = (x === x0 || x === x1) && (z === x0 || z === x1);
          if (corner) b.set(x, y, z, frame);
          else if (edge) b.set(x, y, z, slab ? frame : glass);
          else b.set(x, y, z, slab ? 'concrete' : 'air');
        }
      }
      b.box(x0, h, x0, x1, h, x1, frame);
      const c = 6; for (let y = 1; y <= 7; y++) b.set(c, h + y, c, 'steel');
      b.set(c, h + 8, c, 'lantern');
      b.clear(c - 1, 1, o, c + 1, 2, o);
    },
  },
  villa: {
    w: 12, d: 10, site: 'land',
    build(b) {
      b.base(12, 10, 10, 'concrete');
      b.hollow(1, 0, 1, 10, 3, 8, 'plaster'); b.box(1, 4, 1, 10, 4, 8, 'concrete');
      b.hollow(1, 5, 1, 7, 7, 8, 'plaster'); b.box(0, 8, 0, 8, 8, 9, 'concrete');
      b.box(3, 1, 1, 8, 2, 1, 'tinted_glass'); b.box(3, 5, 1, 6, 6, 1, 'tinted_glass');
      b.clear(9, 0, 1, 9, 1, 1); b.set(9, 0, 1, 'door_closed');
      b.box(2, 0, 2, 9, 0, 7, 'marble'); b.clear(2, 1, 2, 9, 3, 7); b.box(2, 0, 2, 9, 0, 7, 'marble');
      b.set(2, 3, 7, 'lantern'); b.hollow(8, 5, 1, 10, 5, 8, 'steel');
    },
  },
  dome_hall: {
    w: 15, d: 15, site: 'land',
    build(b) {
      b.base(15, 15, 16, 'marble');
      b.hollow(1, 0, 1, 13, 5, 13, 'marble');
      for (let i = 3; i <= 11; i += 4) { b.clear(i, 0, 1, i + 1, 3, 1); b.clear(i, 0, 13, i + 1, 3, 13); b.clear(1, 0, i, 1, 3, i + 1); b.clear(13, 0, i, 13, 3, i + 1); }
      b.box(1, 6, 1, 13, 6, 13, 'marble'); b.clear(4, 6, 4, 10, 6, 10);
      for (let y = 0; y <= 6; y++) for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) {
        const d = Math.sqrt(x * x + y * y * 1.2 + z * z);
        if (d <= 6.3 && d > 5.2) b.set(7 + x, 6 + y, 7 + z, 'plaster');
      }
      b.set(7, 12, 7, 'gold_block'); b.set(7, 13, 7, 'gold_block');
      b.box(2, 0, 2, 12, 0, 12, 'zellige'); b.clear(2, 1, 2, 12, 5, 12); b.box(2, 0, 2, 12, 0, 12, 'zellige');
      for (const [x, z] of [[2, 2], [12, 2], [2, 12], [12, 12]]) b.set(x, 4, z, 'lantern');
    },
  },
  pier: {
    w: 5, d: 22, site: 'coast', sea: true,
    build(b) {
      b.clear(0, 0, 0, 4, 4, 21);
      b.box(1, 0, 0, 3, 0, 21, 'palm_planks');
      for (let z = 0; z < 22; z += 5) for (const x of [1, 3]) { b.box(x, -12, z, x, -1, z, 'dhow_wood'); b.set(x, 1, z, 'dhow_wood'); }
      b.box(0, 0, 17, 4, 0, 21, 'palm_planks'); b.set(0, 1, 21, 'lantern'); b.set(4, 1, 21, 'lantern');
    },
  },
  dhow: {
    w: 7, d: 16, site: 'water', sea: true,
    build(b) {
      const prof = [0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1];
      for (let z = 0; z < 16; z++) {
        const hw = prof[z];
        for (let x = 3 - hw; x <= 3 + hw; x++) {
          const edge = x === 3 - hw || x === 3 + hw || z === 0 || z === 15;
          b.set(x, -2, z, 'dhow_wood'); b.set(x, -1, z, edge ? 'dhow_wood' : 'air'); b.set(x, 0, z, edge ? 'dhow_wood' : 'palm_planks');
          if (!edge) { b.set(x, -1, z, 'palm_planks'); b.set(x, 0, z, 'air'); }
          for (let y = 1; y < 12; y++) b.set(x, y, z, 'air');
        }
      }
      b.set(3, 0, 0, 'dhow_wood'); b.set(3, 1, 0, 'dhow_wood'); b.box(2, 0, 13, 4, 0, 14, 'dhow_wood');
      for (let y = 0; y < 11; y++) b.set(3, y, 7, 'palm_log');
      for (let i = 0; i < 8; i++) b.box(3, 3 + i, 8, 3, 3 + i, 8 + (7 - i) - 1, 'plaster');
      b.set(3, 1, 14, 'lantern');
    },
  },
  lighthouse: {
    w: 7, d: 7, site: 'land',
    build(b) {
      b.base(7, 7, 22, 'coral_stone');
      for (let y = 0; y < 16; y++) b.hollow(2, y, 2, 4, y, 4, y % 4 < 2 ? 'plaster' : 'red_sandstone');
      b.hollow(1, 0, 1, 5, 2, 5, 'coral_stone'); b.clear(3, 0, 1, 3, 1, 2);
      b.box(1, 16, 1, 5, 16, 5, 'palm_planks'); b.hollow(2, 17, 2, 4, 18, 4, 'glass');
      b.set(3, 17, 3, 'lantern'); b.set(3, 18, 3, 'lantern'); b.box(2, 19, 2, 4, 19, 4, 'red_sandstone'); b.set(3, 20, 3, 'steel');
    },
  },
  palm_farm: {
    w: 19, d: 19, site: 'land',
    build(b, r) {
      b.base(19, 19, 12, 'dirt', 5);
      b.box(0, -1, 0, 18, -1, 18, 'grass');
      b.hollow(0, 0, 0, 18, 0, 18, 'mud_brick'); b.clear(8, 0, 0, 10, 0, 0);
      b.box(1, -1, 9, 17, -1, 9, 'water'); b.box(9, -1, 1, 9, -1, 17, 'water');
      for (let z = 3; z < 18; z += 4) for (let x = 3; x < 18; x += 4) { if (x === 9 || z === 9) continue; palm(b.s, x, 0, z, r); }
      for (let i = 0; i < 14; i++) { const x = 1 + ((r() * 17) | 0), z = 1 + ((r() * 17) | 0); if (x !== 9 && z !== 9 && x % 4 !== 3) b.set(x, 0, z, r() < 0.5 ? 'dry_grass' : 'desert_flower'); }
    },
  },
  pyramid: {
    w: 27, d: 27, site: 'land',
    build(b) {
      b.base(27, 27, 16, 'limestone_brick', 8);
      for (let i = 0; i < 13; i++) b.box(i, i, i, 26 - i, i, 26 - i, 'limestone_brick');
      b.set(13, 13, 13, 'gold_block');
      b.clear(11, 1, 11, 15, 3, 15); b.box(11, 0, 11, 15, 0, 15, 'granite');
      b.set(13, 1, 13, 'gold_block'); b.set(11, 3, 11, 'lantern'); b.set(15, 3, 15, 'lantern');
      b.clear(13, 1, 0, 13, 2, 10);
    },
  },
  rock_tomb: {
    w: 13, d: 7, site: 'land',
    build(b) {
      b.base(13, 7, 15, 'red_sandstone');
      b.box(0, 0, 1, 12, 13, 6, 'red_sandstone');
      b.clear(1, 0, 1, 11, 9, 1);
      for (const x of [2, 4, 8, 10]) b.box(x, 0, 1, x, 8, 1, 'red_sandstone');
      b.clear(5, 0, 2, 7, 4, 4); b.set(6, 3, 4, 'lantern');
      b.box(1, 10, 0, 11, 10, 0, 'red_sandstone');
      for (let i = 0; i < 4; i++) b.box(3 + i, 11 + i, 0, 9 - i, 11 + i, 0, 'red_sandstone');
      for (let x = 0; x < 13; x += 2) b.set(x, 14, 1, 'red_sandstone');
    },
  },
};

// منشآت تُعرَّف من لوحة الإدارة كقائمة عمليات: ["box",x0,y0,z0,x1,y1,z1,"block"] | ["hollow",...] | ["clear",...] | ["set",x,y,z,"block"]
export function prefab(def: { w: number; d: number; site?: string; ops: any[] }): StructDef {
  const w = Math.max(1, Math.min(32, def.w | 0)), d = Math.max(1, Math.min(32, def.d | 0));
  return {
    w, d, site: (def.site as any) || 'land',
    build(b) {
      b.base(w, d, 1, 'sandstone', 4);
      for (const op of def.ops || []) {
        if (!Array.isArray(op)) continue;
        const [t, a, c, e, f, g, h, k] = op;
        if (t === 'box') b.box(a, c, e, f, g, h, String(k));
        else if (t === 'hollow') b.hollow(a, c, e, f, g, h, String(k));
        else if (t === 'clear') b.clear(a, c, e, f, g, h);
        else if (t === 'set') b.set(a, c, e, String(f));
      }
    },
  };
}
