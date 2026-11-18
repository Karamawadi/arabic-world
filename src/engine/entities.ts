// الكائنات المحلية: حيوانات البيئة والبحر، شخصيات غير لاعبة (NPC)، ومخلوقات الليل الخيالية (غيلان الرمال)
import * as THREE from 'three';
import { makeAnimal, makeAvatar, nameTag, animateAvatar, type Animal, type Avatar } from './avatar';
import type { Game } from './game';

export interface Ent { type: string; kind: 'animal' | 'water' | 'hostile' | 'npc'; obj: THREE.Group; pos: THREE.Vector3; yaw: number; vy: number; hp: number; timer: number; dir: number; speed: number; phase: number; atk: number; h: number; w: number; role?: string; animal?: Animal; av?: Avatar; hurt: number; flee: number; kb: THREE.Vector3; placed?: boolean }

// خصائص كل نوع: الموطن، الصحة، السرعة، حجم القطيع، والغنائم [عنصر، أقل، أكثر]
export const SPECIES: Record<string, { habitat: 'land' | 'coast' | 'water'; hp: number; speed: number; herd: [number, number]; drops: [string, number, number][]; ride?: boolean }> = {
  camel: { habitat: 'land', hp: 14, speed: 1.2, herd: [1, 3], drops: [['raw_meat', 2, 3], ['leather', 0, 2]], ride: true },
  horse: { habitat: 'land', hp: 14, speed: 1.6, herd: [1, 3], drops: [['leather', 0, 2]], ride: true },
  goat: { habitat: 'land', hp: 8, speed: 1.4, herd: [2, 4], drops: [['raw_meat', 1, 2]] },
  sheep: { habitat: 'land', hp: 8, speed: 1.1, herd: [2, 4], drops: [['raw_meat', 1, 2], ['wool', 1, 2]] },
  cow: { habitat: 'land', hp: 10, speed: 1.0, herd: [2, 3], drops: [['raw_meat', 1, 3], ['leather', 0, 2]] },
  chicken: { habitat: 'land', hp: 4, speed: 1.2, herd: [2, 4], drops: [['raw_chicken', 1, 1], ['feather', 0, 2]] },
  oryx: { habitat: 'land', hp: 10, speed: 1.8, herd: [2, 3], drops: [['raw_meat', 1, 2], ['leather', 0, 1]] },
  gazelle: { habitat: 'land', hp: 8, speed: 2.2, herd: [2, 4], drops: [['raw_meat', 1, 2]] },
  fox: { habitat: 'land', hp: 6, speed: 2.0, herd: [1, 1], drops: [] },
  cat: { habitat: 'land', hp: 6, speed: 1.4, herd: [1, 1], drops: [] },
  flamingo: { habitat: 'coast', hp: 6, speed: 1.0, herd: [3, 5], drops: [['feather', 1, 3]] },
  turtle: { habitat: 'coast', hp: 12, speed: 0.5, herd: [1, 2], drops: [] },
  fish: { habitat: 'water', hp: 3, speed: 1.6, herd: [3, 5], drops: [['raw_fish', 1, 1]] },
  ghoul: { habitat: 'land', hp: 14, speed: 3.1, herd: [1, 1], drops: [['gunpowder', 0, 2]] },
};
const NPC_CHARS: Record<string, any> = {
  guide: { skin: '#b97a4a', outfit: 'kandura_white', head: 'ghutra_white', hair: 'hair_short', acc: 'acc_none' },
  elder: { skin: '#a86a3e', outfit: 'bisht', head: 'ghutra_white', hair: 'hair_short', acc: 'acc_none' },
  merchant: { skin: '#c68e5e', outfit: 'kandura_sand', head: 'hamdaniya', hair: 'hair_short', acc: 'belt' },
  teacher: { skin: '#c68e5e', outfit: 'abaya', head: 'shayla_black', hair: 'hair_long', acc: 'glasses' },
};
const NPC_OFF = [[3, 2], [-3, 3], [4, -3], [-4, -2]];
const LAND_CAP = 18, WATER_CAP = 8;

export class Entities {
  list: Ent[] = []; group = new THREE.Group(); private spawnT = 0;
  constructor(private g: Game) { g.scene.add(this.group); }
  clear() { for (const e of this.list) this.group.remove(e.obj); this.list = []; }
  initNPCs() {
    const roles: string[] = this.g.info.settings?.npcs || [], sp = this.g.spawn;
    roles.forEach((role, i) => {
      const av = makeAvatar(NPC_CHARS[role] || NPC_CHARS.guide, this.g.content.characters);
      const tag = nameTag(this.g.t('npc.' + role + '.name'), '#ffe08a'); tag.position.y = 2.25; av.group.add(tag);
      const o = NPC_OFF[i % 4];
      const e: Ent = { type: 'npc', kind: 'npc', role, obj: av.group, av, pos: new THREE.Vector3(Math.floor(sp[0]) + o[0] + 0.5, sp[1], Math.floor(sp[2]) + o[1] + 0.5), yaw: 0, vy: 0, hp: 1, timer: 0, dir: 0, speed: 0, phase: 0, atk: 0, h: 1.9, w: 0.6, hurt: 0, flee: 0, kb: new THREE.Vector3() };
      this.group.add(av.group); this.list.push(e);
    });
  }
  private add(type: string, x: number, y: number, z: number): Ent {
    const sp = SPECIES[type] || SPECIES.goat, a = makeAnimal(type);
    a.group.traverse((o: any) => { if (o.isMesh) o.material = o.material.clone(); }); // مواد مستقلة ليظهر وميض الضرر على هذا الحيوان فقط
    const kind = type === 'ghoul' ? 'hostile' : sp.habitat === 'water' ? 'water' : 'animal';
    const e: Ent = { type, kind, obj: a.group, animal: a, pos: new THREE.Vector3(x, y, z), yaw: Math.random() * 6.28, vy: 0, hp: sp.hp, timer: Math.random() * 2, dir: 0, speed: 0, phase: 0, atk: 0, h: a.h, w: a.w, hurt: 0, flee: 0, kb: new THREE.Vector3() };
    a.group.position.copy(e.pos); this.group.add(a.group); this.list.push(e);
    return e;
  }
  // إعادة حيوان الركوب إلى العالم عند النزول عنه
  spawnAt(type: string, pos: THREE.Vector3, yaw: number) {
    const w = this.g.world, x = pos.x + Math.cos(yaw) * 1.4, z = pos.z - Math.sin(yaw) * 1.4;
    const e = this.add(type, x, w.groundY(Math.floor(x), pos.y + 2, Math.floor(z)), z); e.yaw = yaw; return e;
  }
  // قطيع على اليابسة
  private spawnLand(type: string, cx: number, cz: number) {
    const w = this.g.world, sp = SPECIES[type]; if (!sp) return;
    const n = sp.herd[0] + Math.floor(Math.random() * (sp.herd[1] - sp.herd[0] + 1));
    for (let i = 0; i < n; i++) {
      const x = cx + (Math.random() - 0.5) * 6, z = cz + (Math.random() - 0.5) * 6, fx = Math.floor(x), fz = Math.floor(z);
      if (!w.loaded(fx, fz)) continue;
      const y = w.groundY(fx, 127, fz);
      if (w.isWater(fx, y, fz) || w.isWater(fx, y - 1, fz)) continue;
      if (sp.habitat === 'coast' ? y > w.gen.sea + 4 : y <= w.gen.sea) continue;
      this.add(type, x, y, z);
    }
  }
  private spawnWater(type: string, cx: number, cz: number) {
    const w = this.g.world, sea = w.gen.sea, sp = SPECIES[type]; if (!sp) return;
    const n = sp.herd[0] + Math.floor(Math.random() * (sp.herd[1] - sp.herd[0] + 1));
    for (let i = 0; i < n; i++) {
      const x = cx + (Math.random() - 0.5) * 5, z = cz + (Math.random() - 0.5) * 5, fx = Math.floor(x), fz = Math.floor(z);
      if (!w.loaded(fx, fz) || !w.isWater(fx, sea, fz) || !w.isWater(fx, sea - 2, fz)) continue;
      let floor = sea; while (floor > 2 && w.isWater(fx, floor - 1, fz)) floor--;
      this.add(type, x, floor + 0.3 + Math.random() * Math.max(0.2, sea - floor - 1.2), z);
    }
  }
  remove(e: Ent) { this.group.remove(e.obj); const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); }

  // ضرب كائن: ضرر، دفع للخلف، هروب الحيوان، وعند الموت يحصل اللاعب على الغنائم
  damage(e: Ent, dmg: number, fromYaw: number, loot = true) {
    if (e.kind === 'npc') return;
    e.hp -= dmg; e.hurt = 0.35;
    e.kb.set(-Math.sin(fromYaw) * 6, 0, -Math.cos(fromYaw) * 6); e.vy = 4.2;
    if (e.kind !== 'hostile') { e.flee = 4; e.yaw = fromYaw; e.speed = (SPECIES[e.type]?.speed || 1.2) * 2.4; }
    if (e.hp > 0) return;
    this.remove(e);
    if (!loot) return;
    const got: string[] = [];
    for (const [k, a, b] of SPECIES[e.type]?.drops || []) {
      const n = a + Math.floor(Math.random() * (b - a + 1));
      if (n > 0 && this.g.addItem(k, n, true)) got.push(this.g.name(this.g.def(k)) + ' ×' + n);
    }
    if (got.length) this.g.notice('+ ' + got.join('، '));
    this.g.emit(true);
  }
  // انفجار قريب
  blast(c: THREE.Vector3, r: number) {
    for (const e of [...this.list]) { if (e.kind === 'npc') continue; const d = e.pos.distanceTo(c); if (d < r * 1.8) this.damage(e, Math.ceil((1 - d / (r * 1.8)) * 22), Math.atan2(c.x - e.pos.x, c.z - e.pos.z), false); }
  }

  // أقرب كائن على خط النظر
  pick(o: THREE.Vector3, d: THREE.Vector3, max: number): { e: Ent; t: number } | null {
    let best: { e: Ent; t: number } | null = null;
    for (const e of this.list) {
      const cx = e.pos.x - o.x, cy = e.pos.y + e.h * 0.5 - o.y, cz = e.pos.z - o.z;
      const t = cx * d.x + cy * d.y + cz * d.z; if (t < 0 || t > max) continue;
      const px = cx - d.x * t, py = cy - d.y * t, pz = cz - d.z * t, r = Math.max(0.45, e.w * 0.75);
      if (px * px + pz * pz < r * r && Math.abs(py) < e.h * 0.6 && (!best || t < best.t)) best = { e, t };
    }
    return best;
  }

  private spawnTick() {
    const g = this.g, w = g.world, pp = g.player.pos, env = g.env;
    const land = this.list.filter((e) => e.kind === 'animal').length, water = this.list.filter((e) => e.kind === 'water').length, hostiles = this.list.filter((e) => e.kind === 'hostile').length;
    const types: string[] = (env.animals || []).filter((t: string) => SPECIES[t]);
    const ang = Math.random() * 6.28, dist = 20 + Math.random() * 26, x = pp.x + Math.cos(ang) * dist, z = pp.z + Math.sin(ang) * dist;
    const fx = Math.floor(x), fz = Math.floor(z);
    if (w.loaded(fx, fz) && w.isWater(fx, w.gen.sea, fz)) {
      if (water < WATER_CAP) this.spawnWater('fish', x, z);
      if (land < LAND_CAP && Math.random() < 0.3) { const coast = types.filter((t) => SPECIES[t].habitat === 'coast'); const t = coast.length ? coast[(Math.random() * coast.length) | 0] : Math.random() < 0.5 ? 'turtle' : 'flamingo'; this.spawnLand(t, x, z); }
    } else if (types.length && land < LAND_CAP) {
      const t = types[(Math.random() * types.length) | 0];
      if (SPECIES[t].habitat === 'water') this.spawnWater(t, x, z); else this.spawnLand(t, x, z);
    }
    const diff = g.info.settings?.difficulty || 'normal', cap = ({ peaceful: 0, easy: 2, normal: 4, hard: 6 } as any)[diff] ?? 4;
    if (g.rules.hostile && g.sky.isNight() && hostiles < cap && !g.ui.dead) {
      const d2 = 16 + Math.random() * 10, gx = pp.x + Math.cos(ang + 1) * d2, gz = pp.z + Math.sin(ang + 1) * d2;
      if (w.loaded(Math.floor(gx), Math.floor(gz))) { const y = w.groundY(Math.floor(gx), 127, Math.floor(gz)); if (y > w.gen.sea) this.add('ghoul', gx, y, gz); }
    }
  }

  update(dt: number) {
    const g = this.g, w = g.world, pp = g.player.pos;
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = this.list.length < 8 ? 0.6 : 1.8; this.spawnTick(); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const dx = pp.x - e.pos.x, dz = pp.z - e.pos.z, d2 = dx * dx + dz * dz;
      if (e.kind === 'npc') {
        if (!e.placed) { if (w.loaded(Math.floor(e.pos.x), Math.floor(e.pos.z))) { e.pos.y = w.groundY(Math.floor(e.pos.x), Math.min(127, e.pos.y + 6), Math.floor(e.pos.z)); e.placed = true; } }
        if (d2 < 100) e.yaw = Math.atan2(-dx, -dz);
        e.obj.position.copy(e.pos); e.obj.rotation.y = e.yaw; animateAvatar(e.av!, 0, false, 0, false);
        continue;
      }
      if (d2 > 90 * 90 || (e.kind === 'hostile' && !g.sky.isNight() && g.sky.dayF > 0.8)) { this.remove(e); continue; }
      e.timer -= dt; e.atk -= dt; e.hurt -= dt; e.flee -= dt;
      const sp = SPECIES[e.type] || SPECIES.goat;
      if (e.kind === 'hostile') {
        if (d2 < 26 * 26 && !g.ui.dead) { e.yaw = Math.atan2(-dx, -dz); e.speed = d2 > 1.6 ? sp.speed : 0; if (d2 < 2.6 && Math.abs(pp.y - e.pos.y) < 2 && e.atk <= 0) { e.atk = 1.2; g.damage(({ easy: 2, normal: 3, hard: 5 } as any)[g.info.settings?.difficulty] ?? 3, true); } }
        else if (e.timer <= 0) { e.timer = 2 + Math.random() * 3; e.yaw += (Math.random() - 0.5) * 2; e.speed = 1.2; }
      } else if (e.flee > 0) { if (e.timer <= 0) { e.timer = 0.6; e.yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.6; } }
      else if (e.timer <= 0) { e.timer = 2 + Math.random() * 5; e.speed = Math.random() < 0.45 ? 0 : sp.speed * (0.6 + Math.random() * 0.5); e.yaw += (Math.random() - 0.5) * 2.4; }
      // دفع الضربة
      if (e.kb.lengthSq() > 0.01) { const nx = e.pos.x + e.kb.x * dt, nz = e.pos.z + e.kb.z * dt; if (!w.isSolid(Math.floor(nx), Math.floor(e.pos.y + 0.2), Math.floor(nz))) { e.pos.x = nx; e.pos.z = nz; } e.kb.multiplyScalar(Math.max(0, 1 - dt * 6)); }
      if (e.kind === 'water') this.swim(e, dt); else this.walk(e, dt);
      e.obj.position.copy(e.pos); e.obj.rotation.y = e.yaw;
      const s = e.speed > 0 ? Math.sin(e.phase) * 0.6 : 0;
      e.animal!.legs.forEach((l, k) => { if (e.type === 'ghoul' && k > 1) return; if (e.type === 'fish') { l.rotation.y = Math.sin(e.phase * 2) * 0.6; return; } l.rotation.x = k % 2 ? s : -s; });
      e.obj.scale.setScalar(e.hurt > 0 ? 0.9 : 1);
      e.obj.traverse((o: any) => { if (o.isMesh && o.material?.emissive) o.material.emissive.setRGB(e.hurt > 0 ? 0.6 : 0, 0, 0); });
    }
  }
  private walk(e: Ent, dt: number) {
    const w = this.g.world;
    if (e.speed > 0) {
      const nx = e.pos.x - Math.sin(e.yaw) * e.speed * dt, nz = e.pos.z - Math.cos(e.yaw) * e.speed * dt;
      const fx = Math.floor(nx), fz = Math.floor(nz), fy = Math.floor(e.pos.y);
      const coast = SPECIES[e.type]?.habitat === 'coast';
      if (!w.loaded(fx, fz)) { e.speed = 0; }
      else if (w.isSolid(fx, fy, fz)) { if (!w.isSolid(fx, fy + 1, fz) && !w.isSolid(fx, fy + 2, fz) && e.vy <= 0) { e.vy = 6; } else { e.yaw += 1.6; e.timer = 1; } }
      else if (!coast && (w.isWater(fx, fy, fz) || (w.isWater(fx, fy - 1, fz) && e.flee <= 0))) { e.yaw += 2.4; }
      else { e.pos.x = nx; e.pos.z = nz; }
      e.phase += dt * e.speed * 3;
    }
    const gy = w.groundY(Math.floor(e.pos.x), e.pos.y + 0.2, Math.floor(e.pos.z));
    if (e.vy > 0 || e.pos.y > gy) { e.vy -= 24 * dt; e.pos.y = Math.max(gy, e.pos.y + e.vy * dt); if (e.pos.y <= gy && e.vy < 0) e.vy = 0; } else { e.vy = 0; e.pos.y = gy; }
  }
  private swim(e: Ent, dt: number) {
    const w = this.g.world, sea = w.gen.sea;
    if (!e.speed) e.speed = 1;
    const nx = e.pos.x - Math.sin(e.yaw) * e.speed * dt, nz = e.pos.z - Math.cos(e.yaw) * e.speed * dt;
    const ny = Math.min(sea + 0.4, e.pos.y + Math.sin(e.phase * 0.5) * dt * 0.3);
    if (w.isWater(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { e.pos.set(nx, ny, nz); } else { e.yaw += 2.2; e.timer = 1; }
    if (!w.isWater(Math.floor(e.pos.x), Math.floor(e.pos.y), Math.floor(e.pos.z))) { e.vy -= 20 * dt; e.pos.y += e.vy * dt; if (e.pos.y < 2) this.remove(e); } else e.vy = 0;
    e.phase += dt * 4;
  }
}
