// فيزياء اللاعب: تصادم AABB، جاذبية، قفز، جري، سباحة، طيران، ومركبات
import * as THREE from 'three';
import type { World } from './world';
import { CH } from '../../shared/gen';
import { SEAT } from './avatar';

export interface MoveInput { mx: number; mz: number; jump: boolean; sprint: boolean; down: boolean; sneak: boolean }
const HW = 0.3, HT = 1.8;

export class PlayerCtl {
  pos = new THREE.Vector3(); vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = false; flying = false; inWater = false; headInWater = false; blocked = false;
  vehicle = ''; speedBoost = 0; fallFrom = 0; landed = 0; walk = 0; moving = false; sneaking = false; sprinting = false; crouchT = 0;
  eye() { return this.vehicle ? SEAT[this.vehicle]?.eye ?? 1.9 : 1.62 - this.crouchT * 0.3; }

  collides(w: World, x: number, y: number, z: number): boolean {
    const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW), y0 = Math.floor(y), y1 = Math.floor(y + HT - 0.01), z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (w.isSolid(xx, yy, zz)) return true;
    return false;
  }

  update(dt: number, inp: MoveInput, w: World, canFly: boolean, autoJump: boolean) {
    if (!canFly) this.flying = false;
    const p = this.pos, v = this.vel;
    const fx = Math.floor(p.x), fz = Math.floor(p.z);
    this.inWater = w.isWater(fx, Math.floor(p.y + 0.4), fz);
    this.headInWater = w.isWater(fx, Math.floor(p.y + this.eye()), fz);
    const boat = this.vehicle === 'boat' && (this.inWater || w.isWater(fx, Math.floor(p.y - 0.3), fz));
    this.sneaking = inp.sneak && !this.flying && !this.vehicle && !this.inWater;
    this.sprinting = inp.sprint && !this.sneaking && inp.mz > 0.3;
    this.crouchT += ((this.sneaking ? 1 : 0) - this.crouchT) * Math.min(1, dt * 14);
    let speed = this.flying ? (this.sprinting ? 22 : 11) : this.inWater ? (boat ? 9 : 2.8) : this.vehicle === 'buggy' ? 12 : this.vehicle === 'horse' ? 10.5 : this.vehicle === 'camel' ? 8 : this.sneaking ? 1.3 : this.sprinting ? 6.8 : 4.3;
    if (this.vehicle === 'boat' && !boat) speed = 1.5;
    if (this.speedBoost > 0) { speed *= 1.35; this.speedBoost -= dt; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let len = Math.hypot(inp.mx, inp.mz); if (len > 1) len = 1 / len; else len = 1;
    const tx = (inp.mx * cos - inp.mz * sin) * speed * len, tz = (-inp.mx * sin - inp.mz * cos) * speed * len;
    const acc = Math.min(1, (this.onGround || this.flying || this.inWater ? 12 : 3.5) * dt);
    v.x += (tx - v.x) * acc; v.z += (tz - v.z) * acc;
    this.moving = Math.abs(inp.mx) + Math.abs(inp.mz) > 0.05;
    if (this.flying) {
      const ty = (inp.jump ? 9 : 0) - (inp.down ? 9 : 0);
      v.y += (ty - v.y) * Math.min(1, 10 * dt);
    } else if (boat) {
      const surf = Math.floor(p.y + 0.4) + 1 - 0.35;
      v.y += ((surf - p.y) * 6 - v.y) * Math.min(1, 8 * dt);
    } else if (this.inWater) {
      v.y -= 7 * dt; if (v.y < -3) v.y = -3;
      if (inp.jump) v.y += (3.6 - v.y) * Math.min(1, 9 * dt);
    } else {
      v.y -= 28 * dt; if (v.y < -55) v.y = -55;
      if (inp.jump && this.onGround) { v.y = this.vehicle === 'buggy' || this.vehicle === 'horse' ? 9.6 : 8.7; this.onGround = false; }
    }
    // حركة على مراحل صغيرة لتفادي اختراق المكعبات
    const steps = Math.max(1, Math.ceil((Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt) / 0.35));
    const h = dt / steps;
    this.blocked = false; this.landed = 0;
    const wasGround = this.onGround;
    for (let s = 0; s < steps; s++) {
      // التسلل (Shift): لا يسقط اللاعب من حافة المكعبات
      const edge = this.sneaking && this.onGround;
      let nx = p.x + v.x * h;
      if (this.collides(w, nx, p.y, p.z)) { nx = p.x; v.x = 0; this.blocked = true; }
      else if (edge && !this.collides(w, nx, p.y - 0.6, p.z)) { nx = p.x; v.x = 0; }
      p.x = nx;
      let nz = p.z + v.z * h;
      if (this.collides(w, p.x, p.y, nz)) { nz = p.z; v.z = 0; this.blocked = true; }
      else if (edge && !this.collides(w, p.x, p.y - 0.6, nz)) { nz = p.z; v.z = 0; }
      p.z = nz;
      let ny = p.y + v.y * h;
      if (this.collides(w, p.x, ny, p.z)) {
        if (v.y < 0) { ny = Math.floor(ny) + 1; if (this.collides(w, p.x, ny, p.z)) ny = p.y; this.onGround = true; if (!wasGround && !this.inWater && !this.flying) this.landed = Math.max(this.landed, this.fallFrom - ny); if (this.flying) this.flying = false; }
        else ny = p.y;
        v.y = 0;
      } else if (v.y !== 0) this.onGround = false;
      p.y = ny;
    }
    if (this.onGround || this.inWater || this.flying) this.fallFrom = p.y; else if (p.y > this.fallFrom) this.fallFrom = p.y;
    // صعود تلقائي لدرجة واحدة
    if (this.blocked && this.onGround && this.moving && (autoJump || this.vehicle === 'buggy' || this.vehicle === 'camel' || this.vehicle === 'horse') && !this.sneaking) {
      const ax = p.x + Math.sign(tx) * 0.45 * (Math.abs(tx) > 0.5 ? 1 : 0), az = p.z + Math.sign(tz) * 0.45 * (Math.abs(tz) > 0.5 ? 1 : 0);
      if (!this.collides(w, ax, p.y + 1.05, az) && !this.collides(w, p.x, p.y + 1.05, p.z)) { v.y = 8.7; this.onGround = false; }
    }
    const L = w.limit - 0.5;
    p.x = Math.max(-L, Math.min(L, p.x)); p.z = Math.max(-L, Math.min(L, p.z));
    if (p.y < -10) { p.y = CH; v.y = 0; }
    if (this.moving && (this.onGround || this.inWater)) this.walk += dt * Math.hypot(v.x, v.z) * 1.6;
  }
}
