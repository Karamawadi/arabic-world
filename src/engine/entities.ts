// الكائنات المحلية: حيوانات البيئة، شخصيات غير لاعبة (NPC)، ومخلوقات الليل الخيالية (غيلان الرمال)
import * as THREE from 'three';
import { makeAnimal, makeAvatar, nameTag, animateAvatar, type Animal, type Avatar } from './avatar';
import type { Game } from './game';

export interface Ent { type: string; kind: 'animal' | 'hostile' | 'npc'; obj: THREE.Group; pos: THREE.Vector3; yaw: number; vy: number; hp: number; timer: number; dir: number; speed: number; phase: number; atk: number; h: number; role?: string; animal?: Animal; av?: Avatar; hurt: number; placed?: boolean }

const NPC_CHARS: Record<string, any> = {
  guide: { skin: '#b97a4a', outfit: 'kandura_white', head: 'ghutra_white', hair: 'hair_short', acc: 'acc_none' },
  elder: { skin: '#a86a3e', outfit: 'bisht', head: 'ghutra_white', hair: 'hair_short', acc: 'acc_none' },
  merchant: { skin: '#c68e5e', outfit: 'kandura_sand', head: 'hamdaniya', hair: 'hair_short', acc: 'belt' },
  teacher: { skin: '#c68e5e', outfit: 'abaya', head: 'shayla_black', hair: 'hair_long', acc: 'glasses' },
};
const NPC_OFF = [[3, 2], [-3, 3], [4, -3], [-4, -2]];

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
      const e: Ent = { type: 'npc', kind: 'npc', role, obj: av.group, av, pos: new THREE.Vector3(Math.floor(sp[0]) + o[0] + 0.5, sp[1], Math.floor(sp[2]) + o[1] + 0.5), yaw: 0, vy: 0, hp: 1, timer: 0, dir: 0, speed: 0, phase: 0, atk: 0, h: 1.9, hurt: 0 };
      this.group.add(av.group); this.list.push(e);
    });
  }
  private spawn(type: string, kind: 'animal' | 'hostile', x: number, z: number) {
    const w = this.g.world; if (!w.loaded(Math.floor(x), Math.floor(z))) return;
    const y = w.groundY(Math.floor(x), 127, Math.floor(z));
    if (w.isWater(Math.floor(x), y, Math.floor(z)) || y <= w.gen.sea) return;
    const a = makeAnimal(type);
    const e: Ent = { type, kind, obj: a.group, animal: a, pos: new THREE.Vector3(x, y, z), yaw: Math.random() * 6.28, vy: 0, hp: kind === 'hostile' ? 12 : 8, timer: 0, dir: 0, speed: 0, phase: 0, atk: 0, h: a.h, hurt: 0 };
    this.group.add(a.group); this.list.push(e);
  }
  remove(e: Ent) { this.group.remove(e.obj); const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); }

  // أقرب كائن على خط النظر
  pick(o: THREE.Vector3, d: THREE.Vector3, max: number): { e: Ent; t: number } | null {
    let best: { e: Ent; t: number } | null = null;
    for (const e of this.list) {
      const cx = e.pos.x - o.x, cy = e.pos.y + e.h * 0.5 - o.y, cz = e.pos.z - o.z;
      const t = cx * d.x + cy * d.y + cz * d.z; if (t < 0 || t > max) continue;
      const px = cx - d.x * t, py = cy - d.y * t, pz = cz - d.z * t;
      if (px * px + pz * pz < 0.5 && Math.abs(py) < e.h * 0.55 && (!best || t < best.t)) best = { e, t };
    }
    return best;
  }

  update(dt: number) {
    const g = this.g, w = g.world, pp = g.player.pos, env = g.env;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 2.5;
      const animals = this.list.filter((e) => e.kind === 'animal').length, hostiles = this.list.filter((e) => e.kind === 'hostile').length;
      const types: string[] = env.animals || [];
      const ang = Math.random() * 6.28, dist = 26 + Math.random() * 22;
      if (types.length && animals < 7) this.spawn(types[(Math.random() * types.length) | 0], 'animal', pp.x + Math.cos(ang) * dist, pp.z + Math.sin(ang) * dist);
      const diff = g.info.settings?.difficulty || 'normal', cap = ({ peaceful: 0, easy: 2, normal: 4, hard: 6 } as any)[diff] ?? 4;
      if (g.rules.hostile && g.sky.isNight() && hostiles < cap && !g.ui.dead) this.spawn('ghoul', 'hostile', pp.x + Math.cos(ang) * (16 + Math.random() * 10), pp.z + Math.sin(ang) * (16 + Math.random() * 10));
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const dx = pp.x - e.pos.x, dz = pp.z - e.pos.z, d2 = dx * dx + dz * dz;
      if (e.kind === 'npc') {
        if (!e.placed) { if (w.loaded(Math.floor(e.pos.x), Math.floor(e.pos.z))) { e.pos.y = w.groundY(Math.floor(e.pos.x), Math.min(127, e.pos.y + 6), Math.floor(e.pos.z)); e.placed = true; } }
        if (d2 < 100) e.yaw = Math.atan2(-dx, -dz);
        e.obj.position.copy(e.pos); e.obj.rotation.y = e.yaw; animateAvatar(e.av!, 0, false, 0, false);
        continue;
      }
      if (d2 > 80 * 80 || (e.kind === 'hostile' && !g.sky.isNight() && g.sky.dayF > 0.8)) { this.remove(e); continue; }
      e.timer -= dt; e.atk -= dt; e.hurt -= dt;
      if (e.kind === 'hostile') {
        if (d2 < 26 * 26 && !g.ui.dead) { e.yaw = Math.atan2(-dx, -dz); e.speed = d2 > 1.6 ? 3.1 : 0; if (d2 < 2.6 && Math.abs(pp.y - e.pos.y) < 2 && e.atk <= 0) { e.atk = 1.2; g.damage(({ easy: 2, normal: 3, hard: 5 } as any)[g.info.settings?.difficulty] ?? 3, true); } }
        else if (e.timer <= 0) { e.timer = 2 + Math.random() * 3; e.yaw += (Math.random() - 0.5) * 2; e.speed = 1.2; }
      } else if (e.timer <= 0) { e.timer = 2 + Math.random() * 5; e.speed = Math.random() < 0.45 ? 0 : 1 + Math.random() * 0.8; e.yaw += (Math.random() - 0.5) * 2.4; }
      if (e.speed > 0) {
        const nx = e.pos.x - Math.sin(e.yaw) * e.speed * dt, nz = e.pos.z - Math.cos(e.yaw) * e.speed * dt;
        const fx = Math.floor(nx), fz = Math.floor(nz), fy = Math.floor(e.pos.y);
        if (!w.loaded(fx, fz)) { e.speed = 0; }
        else if (w.isSolid(fx, fy, fz)) { if (!w.isSolid(fx, fy + 1, fz) && !w.isSolid(fx, fy + 2, fz)) { e.pos.set(nx, fy + 1, nz); } else { e.yaw += 1.6; e.timer = 1; } }
        else if (w.isWater(fx, fy, fz) || w.isWater(fx, fy - 1, fz)) { e.yaw += 2.4; }
        else { e.pos.x = nx; e.pos.z = nz; }
        e.phase += dt * e.speed * 3;
      }
      // جاذبية
      const gy = w.groundY(Math.floor(e.pos.x), e.pos.y + 0.2, Math.floor(e.pos.z));
      if (e.pos.y > gy) { e.vy -= 24 * dt; e.pos.y = Math.max(gy, e.pos.y + e.vy * dt); } else { e.vy = 0; e.pos.y = gy; }
      e.obj.position.copy(e.pos); e.obj.rotation.y = e.yaw;
      const s = e.speed > 0 ? Math.sin(e.phase) * 0.6 : 0;
      e.animal!.legs.forEach((l, k) => { if (e.type === 'ghoul' && k > 1) return; l.rotation.x = k % 2 ? s : -s; });
      e.obj.scale.setScalar(e.hurt > 0 ? 0.92 : 1);
    }
  }
}
