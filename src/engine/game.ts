// المحرك الرئيسي: العرض، حلقة اللعب، الإدخال، التكسير والبناء، الحقيبة، المزامنة مع الخادم
import * as THREE from 'three';
import { World } from './world';
import { PlayerCtl } from './player';
import { Sky } from './sky';
import { Net } from './net';
import { audio } from './audio';
import { Entities, type Ent } from './entities';
import { makeAvatar, makeVehicle, nameTag, animateAvatar, SEAT, type Avatar } from './avatar';
import { SPECIES } from './entities';
import { heldModel } from './items3d';
import { CH } from '../../shared/gen';

export interface Settings { renderDistance: number; quality: 'low' | 'medium' | 'high'; fov: number; sensitivity: number; autoJump: boolean; invertY: boolean; showCoords: boolean; master: number; sfx: number; ambient: number; music: number }
export const DEFAULT_SETTINGS = (touch: boolean): Settings => ({ renderDistance: touch ? 4 : 6, quality: touch ? 'low' : 'medium', fov: 72, sensitivity: 1, autoJump: touch, invertY: false, showCoords: true, master: 0.8, sfx: 0.9, ambient: 0.5, music: 0.4 });
export interface Slot { k: string; n: number }
export interface GameOpts { canvas: HTMLCanvasElement; char?: any; content: any; code: string; token: string; settings: Settings; t: (k: string, a?: any) => string; lang: string; touch: boolean }
interface Remote { av: Avatar; tp: THREE.Vector3; yaw: number; tyaw: number; pitch: number; name: string; role: string; phase: number; moving: boolean; veh: string; held: string; hasFalcon: boolean; a: number; id: number }
const TIER = [1, 2, 3.5, 5, 8];
const CREATIVE_BAR = ['sandstone', 'mud_brick', 'plaster', 'palm_planks', 'coral_stone', 'glass', 'barjeel', 'lantern', 'door_closed'];
// ترتيب أقسام الحقيبة
export const SECTIONS = ['weapon', 'tool', 'food', 'block', 'material', 'heritage', 'vehicle'];
const FUEL: Record<string, number> = { palm_log: 4, ghaf_log: 4, acacia_log: 4, mangrove_log: 4, frank_log: 4, palm_log_x: 4, palm_log_z: 4, palm_planks: 1.5, ghaf_planks: 1.5, dhow_wood: 1.5, stick: 0.5, dry_grass: 0.5, arish: 1 };
const VIEWS = 3; // 0 منظور الشخص الأول، 1 من الخلف، 2 من الأمام

export class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  world!: World; player = new PlayerCtl(); sky!: Sky; net: Net; ents!: Entities;
  content: any; t: GameOpts['t']; lang: string; touch: boolean; settings: Settings; canvas: HTMLCanvasElement;
  info: any = {}; rules: any = {}; env: any = {}; spawn = [8, 60, 8]; you: any = {};
  blockByKey: Record<string, any> = {}; itemByKey: Record<string, any> = {};
  remotes = new Map<number, Remote>(); me: Avatar | null = null; meVeh = '';
  keys = new Set<string>(); tmove = { x: 0, y: 0 }; tjump = false; tdown = false; tsneak = false; primary = false;
  private seq = 0; private pend = new Map<number, any>(); private raf = 0; private last = 0; private lastSend = 0; private lastPos = ''; private invTimer: any = 0;
  private target: any = null; private tEnt: Ent | null = null; private breakT = 0; private breakKey = ''; private digT = 0; private placeCd = 0; private swing = 0; private stepT = 0;
  private hl: THREE.LineSegments; private crack: THREE.Mesh; private hand: THREE.Group; private torch: THREE.PointLight; view = 0; private lastSpace = 0; private lastW = 0; private sprintLatch = false; private atkCd = 0; private tpWait = false; private shake = 0;
  private fuses = new Map<string, { mesh: THREE.Mesh; end: number }>(); fuel = 0; smelting: { key: string; left: number; t: number } | null = null; station = '';
  private hungerT = 0; private regenT = 0; private starveT = 0; private dayLen = 900; private fpsN = 0; private fpsT = 0; private uiDirty = false; private uiT = 0; private started = false; private disposed = false;
  private listeners = new Set<() => void>(); ver = 0;
  ui: any = { invTab: '', chatDraft: '', sprinting: false, sneaking: false, status: 'connecting', reason: '', panel: '', slots: new Array(36).fill(null) as (Slot | null)[], sel: 0, health: 20, hunger: 20, dead: false, players: [] as any[], chat: [] as any[], toasts: [] as any[], notices: [] as any[],
    target: '', coords: [0, 0, 0], time: 0.3, weather: 'clear', missions: [] as any[], chal: null as any, npc: null as any, quiz: null as any, flying: false, vehicle: '', underwater: false, locked: false, fps: 0, pending: 0, canBuild: true, hurtAt: 0, breakProg: 0, world: null as any, you: null as any, rules: {}, ping: 0, queue: null as any, sessEnd: 0 };

  constructor(o: GameOpts) {
    this.content = o.content; this.profileChar = o.char || null; this.t = o.t; this.lang = o.lang; this.touch = o.touch; this.settings = o.settings; this.canvas = o.canvas;
    for (const b of o.content.blocks) this.blockByKey[b.key] = b;
    for (const i of o.content.items) this.itemByKey[i.key] = i;
    this.dayLen = o.content.settings.day_length_sec || 900;
    const q = o.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2));
    if (q === 'high') { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.camera = new THREE.PerspectiveCamera(o.settings.fov, 1, 0.1, 900); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75 })); this.hl.visible = false; this.scene.add(this.hl);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); this.crack.visible = false; this.scene.add(this.crack);
    this.hand = new THREE.Group(); this.hand.position.set(0.46, -0.4, -0.78); this.camera.add(this.hand);
    this.torch = new THREE.PointLight(0xffd9a0, 0, 16, 1.4); this.camera.add(this.torch);
    audio.setCatalog(o.content.sounds); audio.setVol({ master: o.settings.master, sfx: o.settings.sfx, ambient: o.settings.ambient, music: o.settings.music });
    this.net = new Net(o.code, o.token);
    this.bindNet(); this.bindInput();
    this.net.onStatus = (s, reason) => { if (s === 'reconnecting') { this.ui.status = 'reconnecting'; } else if (s === 'closed') { this.ui.status = 'closed'; this.ui.reason = reason || ''; document.exitPointerLock?.(); } this.emit(true); };
    this.net.connect();
    this.resize(); window.addEventListener('resize', this.resize);
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  emit(now = false) { this.uiDirty = true; if (now) this.flushUI(); }
  private flushUI() { this.uiDirty = false; this.ver++; this.listeners.forEach((f) => f()); }
  resize = () => { const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
  name(d: any) { return d ? (this.lang === 'en' ? d.name_en : d.name_ar) || d.key : ''; }
  def(k: string) { return this.blockByKey[k] || this.itemByKey[k]; }
  notice(text: string) { const id = Math.random(); this.ui.notices = [...this.ui.notices.slice(-3), { id, text }]; this.emit(true); setTimeout(() => { this.ui.notices = this.ui.notices.filter((n: any) => n.id !== id); this.emit(); }, 3800); }

  // ---------- الشبكة ----------
  private bindNet() {
    const n = this.net;
    n.on('welcome', (m) => this.onWelcome(m));
    n.on('queue', (m) => { this.ui.status = 'queued'; this.ui.queue = { ...m, at: performance.now() }; this.emit(true); });
    n.on('sess', (m) => { this.setLeft(m.left); audio.play('chat'); this.notice(this.t('msg.session_warn', { min: Math.max(1, Math.round(m.warn / 60)) })); });
    n.on('pj', (m) => { this.addRemote(m.p); this.syncPlayers(); });
    n.on('pl', (m) => { const r = this.remotes.get(m.id); if (r) { this.scene.remove(r.av.group); this.remotes.delete(m.id); } this.syncPlayers(); });
    n.on('ps', (m) => { for (const a of m.l) { const r = this.remotes.get(a[0]); if (!r) continue; r.tp.set(a[1], a[2], a[3]); r.tyaw = a[4]; r.pitch = a[5]; r.a = a[6]; if (r.veh !== a[7]) this.setVeh(r, a[7]); if (r.held !== a[8]) { r.held = a[8]; this.setHeld(r.av, a[8]); } } });
    n.on('ed', (m) => { this.world?.setBlock(m.x, m.y, m.z, m.id); });
    n.on('ack', (m) => {
      const p = this.pend.get(m.s); this.pend.delete(m.s); if (!p) return;
      if (!m.ok) { this.world.setBlock(p.x, p.y, p.z, m.id); if (p.refund) this.addItem(p.refund, 1); if (m.reason === 'no_permission') this.notice(this.t('msg.no_permission')); else if (m.reason === 'bounds') this.notice(this.t('msg.world_edge')); }
      else if (m.drop) { this.addItem(m.drop[0], m.drop[1]); audio.play('pickup'); }
    });
    n.on('chat', (m) => { this.pushChat(m); if (m.id !== this.you.id) audio.play('chat'); });
    n.on('sys', (m) => { const a = { ...m.args, title: this.lang === 'en' ? m.args?.title_en : m.args?.title_ar, mode: m.args?.mode ? this.t('mode.' + m.args.mode) : '' }; this.pushChat({ sys: true, text: this.t(m.key, a), ts: Date.now() / 1000 }); });
    n.on('env', (m) => { this.setLeft(m.left); this.ui.time = m.time; this.ui.weather = m.weather; if (this.sky) { if (Math.abs(this.sky.time - m.time) > 0.01 && Math.abs(this.sky.time - m.time) < 0.99) this.sky.time = m.time; this.sky.weather = m.weather; (this.sky as any).fixed = m.fixed; audio.setAmbient(this.env.ambient || 'desert', m.weather); } this.emit(); });
    n.on('ach', (m) => { this.ui.toasts = [...this.ui.toasts, { ...m, uid: Math.random() }]; audio.play(m.sound && (audio.sounds[m.sound] || m.sound === 'achievement') ? m.sound : 'achievement'); if (m.items && !this.rules.infinite) for (const k in m.items) this.addItem(k, m.items[k]); this.emit(true); });
    n.on('mis', (m) => {
      const l = this.ui.missions.filter((x: any) => x.id !== m.id); l.push({ id: m.id, progress: m.progress, status: m.status }); this.ui.missions = l;
      if (m.status === 'done') { const d = this.content.missions.find((x: any) => x.id === m.id); audio.play('mission_done'); this.notice(this.t('msg.mission_done', { title: d ? (this.lang === 'en' ? d.title_en : d.title_ar) : '', points: m.points || 0 })); if (m.items && !this.rules.infinite) for (const k in m.items) this.addItem(k, m.items[k]); }
      this.emit(true);
    });
    n.on('npc', (m) => { this.ui.npc = m; this.setPanel('npc'); });
    n.on('quiz', (m) => { this.ui.quiz = { ...m, at: Date.now() }; audio.play(m.ok ? 'mission_done' : 'lose'); this.emit(true); });
    n.on('chal', (m) => { const prev = this.ui.chal; this.ui.chal = m.state === 'none' ? null : m; if (m.state === 'win') { audio.play('win'); this.notice(this.t('msg.challenge_win')); } else if (m.state === 'lose') { audio.play('lose'); this.notice(this.t('msg.challenge_lose')); } else if (m.state === 'run' && (!prev || prev.id !== m.id)) audio.play('world_enter'); if (m.state !== 'run') setTimeout(() => { if (this.ui.chal?.state !== 'run') { this.ui.chal = null; this.emit(); } }, 6000); this.emit(true); });
    n.on('role', (m) => { if (m.uid === this.you.id) { this.you.role = m.role; this.ui.you = { ...this.you }; this.updCan(); this.notice(this.t('msg.role_changed', { role: this.t('role.' + m.role) })); } const r = this.remotes.get(m.uid); if (r) r.role = m.role; this.syncPlayers(); });
    n.on('wupd', (m) => { const prev = this.info.mode; this.info = m.world; this.rules = m.world.rules || {}; this.ui.world = m.world; this.ui.rules = this.rules; this.updCan(); if (prev && prev !== m.world.mode) { this.notice(this.t('msg.mode_changed', { mode: this.t('mode.' + m.world.mode) })); if (this.rules.infinite && !this.ui.slots.slice(0, 9).some(Boolean)) CREATIVE_BAR.forEach((k, i) => { if (this.blockByKey[k]) this.ui.slots[i] = { k, n: 1 }; }); } this.emit(true); });
    n.on('pong', (m) => { this.ui.ping = Math.round(performance.now() - m.n); });
    n.on('fuse', (m) => {
      const k = m.x + ',' + m.y + ',' + m.z; if (this.fuses.has(k)) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      mesh.position.set(m.x + 0.5, m.y + 0.5, m.z + 0.5); this.scene.add(mesh); this.fuses.set(k, { mesh, end: performance.now() + m.ms });
      audio.play('fuse');
    });
    n.on('boom', (m) => {
      const k = m.x + ',' + m.y + ',' + m.z, f = this.fuses.get(k); if (f) { this.scene.remove(f.mesh); this.fuses.delete(k); }
      for (let i = 0; i < m.ed.length; i += 3) this.world?.setBlock(m.ed[i], m.ed[i + 1], m.ed[i + 2], 0);
      const c = new THREE.Vector3(m.x + 0.5, m.y + 0.5, m.z + 0.5), p = this.player.pos, d = c.distanceTo(new THREE.Vector3(p.x, p.y + 0.9, p.z));
      audio.play('explode', Math.max(0.15, 1 - d / 60));
      this.ents?.blast(c, m.r);
      if (d < m.r * 2.2) {
        this.shake = Math.max(this.shake, 1 - d / (m.r * 2.2));
        const push = new THREE.Vector3(p.x - c.x, p.y + 0.9 - c.y, p.z - c.z).normalize().multiplyScalar((1 - d / (m.r * 2.2)) * 14);
        this.player.vel.add(push); this.player.vel.y = Math.max(this.player.vel.y, push.y + 4);
        this.damage(Math.ceil((1 - d / (m.r * 2.2)) * 16));
      }
    });
  }
  private setLeft(left: number) { this.ui.sessEnd = typeof left === 'number' && left >= 0 ? performance.now() + left * 1000 : 0; }
  private updCan() { const r = this.you.role; this.ui.canBuild = r === 'owner' || r === 'builder' || this.info.settings?.visitor_perm === 'build'; }
  private pushChat(m: any) { this.ui.chat = [...this.ui.chat.slice(-60), m]; this.emit(true); }
  private syncPlayers() { this.ui.players = [{ id: this.you.id, name: this.you.name, role: this.you.role, me: true }, ...[...this.remotes].map(([id, r]) => ({ id, name: r.name, role: r.role }))]; this.emit(true); }

  private onWelcome(m: any) {
    const first = !this.world;
    this.info = m.world; this.rules = m.world.rules || {}; this.you = m.you; this.spawn = m.spawn;
    this.env = this.content.envs[m.world.environment] || Object.values(this.content.envs)[0];
    if (first) {
      this.world = new World(this.content, m.world); this.world.radius = this.settings.renderDistance; this.world.shadows = this.settings.quality === 'high';
      this.scene.add(this.world.group);
      this.sky = new Sky(this.scene, this.env, this.settings.quality); this.sky.setShadows(this.settings.quality === 'high'); this.sky.thunder = () => audio.play('thunder');
      this.ents = new Entities(this); this.ents.initNPCs();
      this.player.pos.set(m.pos[0], m.pos[1], m.pos[2]); this.player.yaw = m.rot?.[0] || 0; this.player.pitch = m.rot?.[1] || 0;
      this.me = makeAvatar(this.profileChar, this.content.characters); this.scene.add(this.me.group);
      if (m.inv) { const s = m.inv.slots || []; for (let i = 0; i < 36; i++) this.ui.slots[i] = s[i] && this.def(s[i].k) ? s[i] : null; this.ui.health = m.inv.health ?? 20; this.ui.hunger = m.inv.hunger ?? 20; this.ui.sel = m.inv.sel || 0; if (this.ui.health <= 0) this.ui.health = 20; }
      else if (this.rules.infinite) CREATIVE_BAR.forEach((k, i) => { if (this.blockByKey[k]) this.ui.slots[i] = { k, n: 1 }; });
      else if (this.rules.kit) { for (const k in this.rules.kit) this.addItem(k, this.rules.kit[k], true); }
      this.ui.missions = m.missions || []; this.ui.status = 'loading';
    } else { this.world.reset(); this.pend.clear(); this.ui.status = this.started ? 'playing' : 'loading'; }
    this.world.setDeltas(m.deltas);
    for (const r of this.remotes.values()) this.scene.remove(r.av.group); this.remotes.clear();
    for (const p of m.players) this.addRemote(p);
    this.setLeft(m.env.left); this.ui.queue = null;
    this.sky.time = m.env.time; this.sky.weather = m.env.weather; (this.sky as any).fixed = m.env.fixed;
    this.ui.time = m.env.time; this.ui.weather = m.env.weather; this.ui.world = m.world; this.ui.you = { ...m.you }; this.ui.rules = this.rules; this.ui.chal = m.chal?.state === 'run' ? m.chal : null;
    if (first) this.ui.chat = (m.chat || []).map((c: any) => ({ ...c }));
    this.updCan(); this.syncPlayers(); this.emit(true);
  }
  profileChar: any = null;
  private addRemote(p: any) {
    if (this.remotes.has(p.id) || p.id === this.you.id) return;
    const av = makeAvatar(p.char, this.content.characters);
    const tag = nameTag(p.name); tag.position.y = 2.3; av.group.add(tag); av.tag = tag;
    av.group.position.set(p.p[0], p.p[1], p.p[2]); this.scene.add(av.group);
    const acc = this.content.characters.find((c: any) => c.key === p.char?.acc);
    const r: Remote = { av, tp: new THREE.Vector3(p.p[0], p.p[1], p.p[2]), yaw: p.r[0], tyaw: p.r[0], pitch: p.r[1], name: p.name, role: p.role, phase: 0, moving: false, veh: '', held: '', hasFalcon: acc?.kind === 'falcon', a: p.a || 0, id: p.id };
    this.remotes.set(p.id, r); if (p.v) this.setVeh(r, p.v); if (p.h) { r.held = p.h; this.setHeld(av, p.h); }
  }
  private setVeh(r: { av: Avatar; veh: string }, kind: string) {
    if (r.av.veh) { r.av.group.remove(r.av.veh); r.av.veh = undefined; }
    r.veh = kind;
    if (kind) { const v = makeVehicle(kind); r.av.veh = v; r.av.group.add(v); }
    r.av.body.position.y = kind ? SEAT[kind]?.y ?? 0 : 0;
  }
  private setHeld(av: Avatar, key: string) {
    av.held.clear(); const d = this.def(key); if (!d) return;
    av.held.add(heldModel(d, !!this.blockByKey[key], 'third', this.world?.atlas, this.world?.tex));
  }
  private animVeh(av: Avatar, phase: number, moving: boolean) {
    const a = (av.veh as any)?.animal; if (!a) return;
    const s = moving ? Math.sin(phase * 1.3) * 0.7 : 0; a.legs.forEach((l: THREE.Group, k: number) => (l.rotation.x = k % 2 ? s : -s));
  }

  // ---------- الإدخال ----------
  private onKey = (e: KeyboardEvent) => {
    const tg = e.target as HTMLElement;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT')) return; // الكتابة في الحقول لا تحرك اللاعب
    const d = e.type === 'keydown';
    const panel = this.ui.panel;
    if (panel && panel !== 'players') {
      // نفس الزر يفتح اللوحة ويغلقها، و Esc يغلق أي لوحة
      if (d && !e.repeat) {
        const toggles: Record<string, string[]> = { KeyE: ['inventory', 'furnace'], KeyM: ['map'], KeyJ: ['missions'] };
        if ((e.code === 'Escape' && panel !== 'dead') || toggles[e.code]?.includes(panel)) { e.preventDefault(); this.setPanel(''); }
      }
      return;
    }
    if (d && !e.repeat) {
      audio.unlock();
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) this.select(n - 1); }
      else if (e.code === 'KeyE') { this.station = ''; this.setPanel('inventory'); e.preventDefault(); return; }
      else if (e.code === 'KeyT' || e.code === 'Enter') { this.setPanel('chat'); e.preventDefault(); return; }
      else if (e.code === 'Slash') { this.ui.chatDraft = '/'; this.setPanel('chat'); e.preventDefault(); return; }
      else if (e.code === 'KeyM') { this.setPanel('map'); return; }
      else if (e.code === 'KeyJ') { this.setPanel('missions'); return; }
      else if (e.code === 'Tab') { e.preventDefault(); this.ui.panel = 'players'; this.emit(true); }
      else if (e.code === 'KeyF') this.toggleFly();
      else if (e.code === 'KeyR') this.rotateHeld();
      else if (e.code === 'KeyV') this.cycleView();
      else if (e.code === 'KeyQ') this.dismount();
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (this.player.vehicle) this.dismount(); }
      else if (e.code === 'KeyW' || e.code === 'ArrowUp') { const t = performance.now(); if (t - this.lastW < 350) this.sprintLatch = true; this.lastW = t; }
      else if (e.code === 'Space') { const t = performance.now(); if (t - this.lastSpace < 280) this.toggleFly(); this.lastSpace = t; }
    }
    if (!d && (e.code === 'KeyW' || e.code === 'ArrowUp')) this.sprintLatch = false;
    if (!d && e.code === 'Tab' && this.ui.panel === 'players') { this.ui.panel = ''; this.emit(true); }
    if (d) this.keys.add(e.code); else this.keys.delete(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.look(e.movementX, e.movementY);
    if (!(e.buttons & 1)) this.primary = false; // يمنع بقاء التكسير عالقاً إذا ضاع حدث رفع الزر
  };
  private onMouseDown = (e: MouseEvent) => {
    audio.unlock();
    if (this.touch) return;
    if (document.pointerLockElement !== this.canvas) { if (!this.ui.panel && this.ui.status === 'playing') this.lock(); return; }
    // الزر الأيسر للهدم والضرب فقط، والأيمن للبناء والتفاعل فقط (Ctrl+نقرة على ماك = زر أيمن)
    const mac = /Mac/.test(navigator.platform);
    if (e.button === 2 || (e.button === 0 && mac && e.ctrlKey)) { this.primary = false; this.secondary(); }
    else if (e.button === 0) { this.primary = true; this.hit(); }
    else if (e.button === 1) { e.preventDefault(); this.pick(); }
  };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0 || !(e.buttons & 1)) this.primary = false; };
  private onWheel = (e: WheelEvent) => { if (!this.ui.panel) this.select((this.ui.sel + (e.deltaY > 0 ? 1 : 8)) % 9); };
  private onLock = () => {
    const l = document.pointerLockElement === this.canvas; this.ui.locked = l;
    if (!l) { this.keys.clear(); this.primary = false; if (!this.ui.panel && this.ui.status === 'playing' && !this.touch) this.ui.panel = 'pause'; }
    this.emit(true);
  };
  private noCtx = (e: Event) => e.preventDefault();
  private onBlur = () => { this.keys.clear(); this.primary = false; };
  private bindInput() {
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    document.addEventListener('mousemove', this.onMouseMove); this.canvas.addEventListener('mousedown', this.onMouseDown); window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true }); document.addEventListener('pointerlockchange', this.onLock); this.canvas.addEventListener('contextmenu', this.noCtx); window.addEventListener('blur', this.onBlur);
  }
  lock() { if (!this.touch && this.ui.status === 'playing') { try { const p: any = this.canvas.requestPointerLock(); p?.catch?.(() => {}); } catch { /* */ } } }
  look(dx: number, dy: number) {
    const s = 0.0023 * this.settings.sensitivity;
    this.player.yaw -= dx * s; this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - dy * s * (this.settings.invertY ? -1 : 1)));
  }
  setPanel(p: string) {
    if (!p) { this.station = ''; this.ui.invTab = ''; }
    this.ui.panel = p; this.keys.clear(); this.primary = false;
    if (p) { if (document.pointerLockElement) document.exitPointerLock(); } else this.lock();
    this.emit(true);
  }
  select(i: number) { this.ui.sel = i; this.breakT = 0; this.emit(true); this.saveInvSoon(); }
  cycleView() { this.view = (this.view + 1) % VIEWS; this.notice(this.t('view.' + this.view)); }
  toggleFly() { if (this.rules.fly) { this.player.flying = !this.player.flying; this.player.vel.y = 0; this.ui.flying = this.player.flying; this.emit(true); } }
  applySettings(s: Settings) {
    this.settings = s; this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    if (this.world) { this.world.radius = s.renderDistance; (this.world as any).lastC = ''; }
    audio.setVol({ master: s.master, sfx: s.sfx, ambient: s.ambient, music: s.music });
  }

  // ---------- الحقيبة ----------
  held(): Slot | null { return this.ui.slots[this.ui.sel]; }
  maxStack(k: string) { const i = this.itemByKey[k]; return i ? i.stack || 64 : 99; }
  count(k: string) { let n = 0; for (const s of this.ui.slots) if (s && s.k === k) n += s.n; return n; }
  addItem(k: string, n: number, quiet = false): boolean {
    if (!this.def(k)) return false;
    const max = this.maxStack(k), sl = this.ui.slots;
    for (let i = 0; i < 36 && n > 0; i++) { const s = sl[i]; if (s && s.k === k && s.n < max) { const a = Math.min(n, max - s.n); sl[i] = { k, n: s.n + a }; n -= a; } }
    for (let i = 0; i < 36 && n > 0; i++) if (!sl[i]) { const a = Math.min(n, max); sl[i] = { k, n: a }; n -= a; }
    this.ui.slots = [...sl]; if (!quiet) this.emit(true); this.saveInvSoon();
    if (n > 0 && !quiet) this.notice(this.t('msg.inventory_full'));
    return n === 0;
  }
  removeItem(k: string, n: number) {
    const sl = this.ui.slots;
    for (let i = 35; i >= 0 && n > 0; i--) { const s = sl[i]; if (s && s.k === k) { const a = Math.min(n, s.n); sl[i] = s.n - a > 0 ? { k, n: s.n - a } : null; n -= a; } }
    this.ui.slots = [...sl]; this.emit(true); this.saveInvSoon();
  }
  private consumeHeld() { if (this.rules.infinite) return; const s = this.held(); if (!s) return; this.ui.slots[this.ui.sel] = s.n > 1 ? { k: s.k, n: s.n - 1 } : null; this.ui.slots = [...this.ui.slots]; this.emit(true); this.saveInvSoon(); }
  moveSlot(a: number, b: number) {
    const sl = this.ui.slots, A = sl[a], Bv = sl[b]; if (a === b) return;
    if (A && Bv && A.k === Bv.k) { const max = this.maxStack(A.k), mv = Math.min(A.n, max - Bv.n); sl[b] = { k: A.k, n: Bv.n + mv }; sl[a] = A.n - mv > 0 ? { k: A.k, n: A.n - mv } : null; } else { sl[a] = Bv; sl[b] = A; }
    this.ui.slots = [...sl]; this.emit(true); this.saveInvSoon();
  }
  sortInv() {
    const m = new Map<string, number>(); for (let i = 9; i < 36; i++) { const s = this.ui.slots[i]; if (s) m.set(s.k, (m.get(s.k) || 0) + s.n); this.ui.slots[i] = null; }
    const cat = (k: string) => String(SECTIONS.indexOf(this.section(k))).padStart(2, '0') + (this.blockByKey[k]?.category || '') + k;
    let i = 9; for (const k of [...m.keys()].sort((a, b) => cat(a).localeCompare(cat(b)))) { let n = m.get(k)!; const max = this.maxStack(k); while (n > 0 && i < 36) { this.ui.slots[i++] = { k, n: Math.min(n, max) }; n -= max; } }
    this.ui.slots = [...this.ui.slots]; this.emit(true); this.saveInvSoon();
  }
  dropSlot(i: number) { this.ui.slots[i] = null; this.ui.slots = [...this.ui.slots]; this.emit(true); this.saveInvSoon(); }
  give(k: string) { // الوضع الإبداعي: وضع عنصر في الخانة المحددة
    if (!this.rules.infinite || !this.def(k)) return;
    this.ui.slots[this.ui.sel] = { k, n: 1 }; this.ui.slots = [...this.ui.slots]; this.emit(true); this.saveInvSoon();
  }
  // القسم الذي ينتمي إليه العنصر في الحقيبة
  section(k: string): string { if (this.blockByKey[k]) return 'block'; const c = this.itemByKey[k]?.category || 'material'; return SECTIONS.includes(c) ? c : 'material'; }
  // هل توجد طاولة صناعة أو فرن قريب من اللاعب (4 مكعبات)
  nearStation(kind: string): boolean {
    if (this.station === kind) return true;
    const id = this.blockByKey[kind === 'table' ? 'crafting_table' : 'furnace']?.id; if (!id || !this.world) return false;
    const p = this.player.pos, x0 = Math.floor(p.x), y0 = Math.floor(p.y), z0 = Math.floor(p.z);
    for (let y = -2; y <= 3; y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) if (this.world.getBlock(x0 + x, y0 + y, z0 + z) === id) return true;
    return false;
  }
  recipes(at = '') {
    const out: any[] = [], table = this.nearStation('table');
    for (const d of [...this.content.blocks, ...this.content.items]) {
      const r = d.recipe; if (!r?.in) continue;
      if ((r.at === 'furnace') !== (at === 'furnace')) continue;
      const station = r.at || '';
      out.push({ key: d.key, def: d, in: r.in, out: r.out || 1, at: station, ok: !station || (station === 'table' && table) || this.rules.infinite, can: Object.keys(r.in).every((k) => this.count(k) >= r.in[k]) });
    }
    return out;
  }
  craft(k: string) {
    const d = this.def(k), r = d?.recipe; if (!r?.in || r.at === 'furnace') return;
    if (r.at === 'table' && !this.nearStation('table') && !this.rules.infinite) { this.notice(this.t('craft.need_table')); return; }
    for (const i in r.in) if (this.count(i) < r.in[i]) return;
    for (const i in r.in) this.removeItem(i, r.in[i]);
    this.addItem(k, r.out || 1); audio.play('block_place');
  }
  fuelItems() { return Object.keys(FUEL).filter((k) => this.count(k) > 0); }
  // الفرن: كل عملية صهر تستهلك وحدة وقود وتستغرق ثانية
  smelt(k: string, n: number) {
    const r = this.def(k)?.recipe; if (!r?.in || r.at !== 'furnace') return;
    this.smelting = { key: k, left: n, t: 0, at: performance.now() } as any; this.emit(true);
  }
  private smeltStep(dt: number) {
    const sm = this.smelting; if (!sm) return;
    const r = this.def(sm.key)?.recipe;
    const has = r && Object.keys(r.in).every((i) => this.count(i) >= r.in[i]);
    if (!has || sm.left <= 0) { this.smelting = null; this.emit(true); return; }
    if (this.fuel < 1 && !this.rules.infinite) {
      const f = this.fuelItems()[0];
      if (!f) { this.smelting = null; this.notice(this.t('furnace.no_fuel')); this.emit(true); return; }
      this.removeItem(f, 1); this.fuel += FUEL[f];
    }
    const sa: any = sm; sm.t = (performance.now() - sa.at) / 1000; this.uiDirty = true; // وقت حقيقي (لا يتأثر ببطء الجهاز)
    if (sm.t >= 1) {
      sa.at = performance.now(); sm.t = 0; sm.left--; if (!this.rules.infinite) this.fuel -= 1;
      for (const i in r.in) this.removeItem(i, r.in[i]);
      this.addItem(sm.key, r.out || 1, true); audio.play('pickup');
    }
  }
  private saveInvSoon() { clearTimeout(this.invTimer); this.invTimer = setTimeout(() => this.saveInv(), 1500); }
  saveInv() { if (!this.world) return; this.net.send({ t: 'inv', slots: this.ui.slots, health: this.ui.health, hunger: this.ui.hunger, sel: this.ui.sel }); }

  // ---------- التفاعل ----------
  private edit(x: number, y: number, z: number, id: number, refund?: string) {
    const prev = this.world.getBlock(x, y, z), s = ++this.seq;
    const h = this.held();
    if (!this.net.send({ t: 'edit', s, x, y, z, id, prev, tool: h?.k || '' })) { if (refund) this.addItem(refund, 1); return false; }
    this.pend.set(s, { x, y, z, prev, refund });
    this.world.setBlock(x, y, z, id); return true;
  }
  private breakTime(b: any) {
    if (this.rules.instant) return 0.14;
    const tool = this.itemByKey[this.held()?.k || ''];
    const mult = tool && b.tool && tool.tool === b.tool ? TIER[tool.tier] || 1 : 1;
    return Math.max(0.05, (b.hardness / mult) * (b.tool && mult === 1 ? 1.6 : 1));
  }
  hit() { // ضرب الكائنات والحيوانات (الزر الأيسر)
    this.swing = 1;
    const e = this.tEnt, now = performance.now(); if (!e || e.kind === 'npc' || now - this.atkCd < 400 || this.ui.dead) return;
    this.atkCd = now; // مهلة الضربة بالوقت الحقيقي
    const it = this.itemByKey[this.held()?.k || ''];
    const dmg = this.rules.infinite ? 999 : it?.tool === 'sword' ? it.power || 6 : it?.tool === 'axe' ? 4 : it?.tool === 'pick' || it?.tool === 'shovel' ? 3 : 2;
    audio.play('hurt', 0.5); this.ents.damage(e, dmg, this.player.yaw);
    if (e.hp <= 0) this.tEnt = null;
  }
  secondary() {
    if (this.ui.status !== 'playing' || this.ui.dead || this.placeCd > 0) return;
    this.placeCd = 0.18; this.swing = 1;
    if (this.tEnt) {
      if (this.tEnt.kind === 'npc') { this.net.send({ t: 'npc', role: this.tEnt.role }); return; }
      if (SPECIES[this.tEnt.type]?.ride && !this.player.vehicle) { const e = this.tEnt; this.player.pos.copy(e.pos); this.player.yaw = e.yaw; this.ents.remove(e); this.tEnt = null; this.mount(e.type); return; }
    }
    const h = this.held(), tg = this.target;
    const sneakPlace = this.player.sneaking && h && this.blockByKey[h.k]; // Shift + زر أيمن: يبني على المحطة بدلاً من فتحها
    if (tg && !sneakPlace) {
      const b = this.world.byId[tg.id];
      if (b?.key === 'crafting_table') { this.station = 'table'; this.ui.invTab = 'craft'; this.setPanel('inventory'); return; }
      if (b?.key === 'furnace') { this.station = 'furnace'; this.setPanel('furnace'); return; }
      if (b?.key === 'tnt') { if (!this.ui.canBuild) { this.notice(this.t('msg.no_permission')); return; } this.net.send({ t: 'ignite', x: tg.x, y: tg.y, z: tg.z }); return; }
      if (b?.toggle && this.blockByKey[b.toggle] && this.ui.canBuild) { this.edit(tg.x, tg.y, tg.z, this.blockByKey[b.toggle].id); audio.play('block_place'); return; }
    }
    if (!h) return;
    const it = this.itemByKey[h.k];
    if (it) {
      if (it.food > 0) { if (this.rules.hunger && this.ui.hunger >= 20 && !it.power) return; this.ui.hunger = Math.min(20, this.ui.hunger + it.food); if (!this.rules.hunger) this.ui.health = Math.min(20, this.ui.health + it.food / 2); if (it.power) this.player.speedBoost = 30; audio.play('eat'); this.consumeHeld(); this.emit(true); }
      else if (it.vehicle) { if (this.player.vehicle === it.vehicle) this.dismount(); else this.mount(it.vehicle); }
      return;
    }
    const bd = this.blockByKey[h.k]; if (!bd || !tg) return;
    if (!this.ui.canBuild) { this.notice(this.t('msg.no_permission')); return; }
    const tb = this.world.byId[tg.id];
    let x = tg.x, y = tg.y, z = tg.z;
    if (!(tb && tb.shape === 'cross')) { x += tg.nx; y += tg.ny; z += tg.nz; }
    const cur = this.world.getBlock(x, y, z), cb = this.world.byId[cur];
    if (cur && !(cb && (cb.shape === 'liquid' || cb.shape === 'cross'))) return;
    if (y < 1 || y > 126) return;
    if (bd.solid) { const p = this.player.pos; if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8) return; }
    if (this.edit(x, y, z, bd.id, this.rules.infinite ? undefined : h.k)) { this.consumeHeld(); audio.play('block_place'); }
  }
  pick() { if (this.target && this.rules.infinite) { const b = this.world.byId[this.target.id]; if (b) this.give(b.key); } }
  rotateHeld() {
    const h = this.held(), b = h && this.blockByKey[h.k]; if (!b?.rot_group) return;
    const g = this.content.blocks.filter((x: any) => x.rot_group === b.rot_group); const nx = g[(g.indexOf(b) + 1) % g.length];
    this.ui.slots[this.ui.sel] = { k: nx.key, n: h!.n }; this.ui.slots = [...this.ui.slots]; this.notice(this.name(nx)); this.saveInvSoon();
  }
  mount(kind: string) { this.player.vehicle = kind; this.ui.vehicle = kind; if (this.me) this.setVeh({ av: this.me, veh: '' }, kind); this.meVeh = kind; this.notice(this.t('msg.dismount_hint')); this.emit(true); }
  dismount() {
    const kind = this.player.vehicle; if (!kind) return;
    this.player.vehicle = ''; this.ui.vehicle = ''; if (this.me) this.setVeh({ av: this.me, veh: '' }, ''); this.meVeh = '';
    if (SPECIES[kind]?.ride) this.ents.spawnAt(kind, this.player.pos, this.player.yaw); // يبقى الجمل/الحصان في العالم
    this.player.vel.set(0, 3, 0); this.emit(true);
  }
  damage(n: number, mob = false) {
    if (!this.rules.damage || this.ui.dead) return;
    if (mob && this.count('shield') > 0) n = Math.ceil(n / 2);
    this.ui.health = Math.max(0, this.ui.health - n); this.ui.hurtAt = Date.now(); audio.play('hurt');
    if (this.ui.health <= 0) { this.ui.dead = true; this.dismount(); this.setPanel('dead'); audio.play('lose'); }
    this.emit(true); this.saveInvSoon();
  }
  respawn() { this.player.pos.set(this.spawn[0], this.spawn[1] + 0.2, this.spawn[2]); this.player.vel.set(0, 0, 0); this.player.fallFrom = this.spawn[1]; this.ui.health = 20; this.ui.hunger = 20; this.ui.dead = false; this.setPanel(''); this.saveInv(); }
  chat(text: string) { if (text.startsWith('/')) this.command(text.slice(1)); else this.net.send({ t: 'chat', text }); }
  private sysMsg(text: string) { this.ui.chat = [...this.ui.chat.slice(-60), { sys: true, text, ts: Date.now() / 1000 }]; this.emit(true); }
  // أوامر الدردشة: /tp /spawn /gamemode /time /weather /give /kill /help
  command(line: string) {
    const [cmd, ...a] = line.trim().split(/\s+/), t = this.t, owner = this.you.role === 'owner' || !!this.you.admin;
    const need = (cond: boolean) => { if (!cond) this.sysMsg(t('cmd.no_perm')); return cond; };
    const p = this.player.pos;
    switch ((cmd || '').toLowerCase()) {
      case 'help': case '?': this.sysMsg(t('cmd.help')); return;
      case 'tp': case 'teleport': {
        if (!need(owner || !!this.rules.fly)) return;
        if (a.length === 1) {
          const q = a[0].toLowerCase(), r = [...this.remotes.values()].find((x) => x.name.toLowerCase().startsWith(q));
          if (!r) { this.sysMsg(t('cmd.no_player', { name: a[0] })); return; }
          this.teleport(r.tp.x, r.tp.y, r.tp.z); this.sysMsg(t('cmd.tp_to', { name: r.name })); return;
        }
        const n = (v: string, base: number) => (v?.startsWith('~') ? base + (Number(v.slice(1)) || 0) : Number(v));
        if (a.length === 2) { const x = n(a[0], p.x), z = n(a[1], p.z); if ([x, z].every(Number.isFinite)) { this.teleport(x, NaN, z); this.sysMsg(t('cmd.tp', { pos: `${Math.round(x)}, ${Math.round(z)}` })); return; } }
        if (a.length === 3) { const x = n(a[0], p.x), y = n(a[1], p.y), z = n(a[2], p.z); if ([x, y, z].every(Number.isFinite)) { this.teleport(x, y, z); this.sysMsg(t('cmd.tp', { pos: `${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)}` })); return; } }
        this.sysMsg(t('cmd.usage_tp')); return;
      }
      case 'spawn': case 'home': this.teleport(this.spawn[0], this.spawn[1] + 0.2, this.spawn[2]); this.sysMsg(t('cmd.tp_spawn')); return;
      case 'gamemode': case 'gm': {
        if (!need(owner)) return;
        const m: Record<string, string> = { c: 'creative', '1': 'creative', s: 'survival', '0': 'survival', a: 'adventure', '2': 'adventure', ch: 'challenge', e: 'education' };
        const mode = m[a[0]] || a[0];
        if (!this.content.settings.mode_rules[mode]) { this.sysMsg(t('cmd.usage_gm')); return; }
        this.worldSet({ mode }); return;
      }
      case 'time': {
        if (!need(owner)) return;
        const v = a[a.length - 1], map: Record<string, number> = { day: 0.27, morning: 0.27, noon: 0.5, sunset: 0.73, night: 0 };
        const tm = map[v] ?? Number(v); if (!Number.isFinite(tm)) { this.sysMsg(t('cmd.usage_time')); return; }
        this.worldSet({ time: tm >= 1 ? (tm % 24000) / 24000 : tm }); return;
      }
      case 'weather': if (!need(owner)) return; if (!['clear', 'rain', 'storm', 'fog', 'sandstorm'].includes(a[0])) { this.sysMsg(t('cmd.usage_weather')); return; } this.worldSet({ weather: a[0] }); return;
      case 'give': {
        if (!need(owner || !!this.rules.infinite)) return;
        const key = (a[0] || '').toLowerCase(), n = Math.max(1, Math.min(999, Number(a[1]) || 1));
        const d = this.def(key) || [...this.content.blocks, ...this.content.items].find((x: any) => x.name_ar === a[0] || x.name_en?.toLowerCase() === key);
        if (!d) { this.sysMsg(t('cmd.no_item', { name: a[0] || '' })); return; }
        this.addItem(d.key, n); this.sysMsg(t('cmd.given', { item: this.name(d), n })); return;
      }
      case 'kill': this.ui.health = 0; this.ui.dead = true; this.dismount(); this.setPanel('dead'); return;
      default: this.sysMsg(t('cmd.unknown', { cmd: cmd || '' }));
    }
  }
  // النقل الفوري: إن لم يُحدد الارتفاع يوضع اللاعب على سطح الأرض بعد تحميل المنطقة
  teleport(x: number, y: number, z: number) {
    const L = (this.world?.limit || 384) - 1; x = Math.max(-L, Math.min(L, x)); z = Math.max(-L, Math.min(L, z));
    this.dismount(); this.player.vel.set(0, 0, 0);
    if (Number.isFinite(y)) { this.player.pos.set(x, Math.max(1, Math.min(CH + 20, y)), z); this.player.fallFrom = this.player.pos.y; }
    else { this.player.pos.set(x, CH - 1, z); this.tpWait = true; }
  }
  kick(uid: number, ban = false) { this.net.send({ t: 'kick', uid, ban }); }
  setRole(uid: number, role: string) { this.net.send({ t: 'role', uid, role }); }
  worldSet(o: any) { this.net.send({ t: 'wset', ...o }); }
  startChallenge(id: number) { this.net.send({ t: 'chal', id }); }
  answerQuiz(id: number, choice: number) { this.net.send({ t: 'quiz', id, choice }); }

  // ---------- الحلقة ----------
  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.fpsN++; if (now - this.fpsT > 1000) { this.ui.fps = this.fpsN; this.fpsN = 0; this.fpsT = now; this.uiDirty = true; if (this.world) this.net.send({ t: 'ping', n: performance.now() }); }
    if (this.world) this.step(dt, now);
    this.renderer.render(this.scene, this.camera);
    if (this.uiDirty && now - this.uiT > 120) { this.uiT = now; this.flushUI(); }
  };
  private step(dt: number, now: number) {
    const p = this.player, w = this.world, ui = this.ui;
    w.update(p.pos.x, p.pos.z, ui.status === 'loading' ? 14 : 5);
    if (ui.status === 'loading') {
      ui.pending = w.pending;
      const c = w.chunks.get((Math.floor(p.pos.x) >> 4) + ',' + (Math.floor(p.pos.z) >> 4));
      if (c && c.meshed && w.pending < 12) {
        let guard = 0; while (p.collides(w, p.pos.x, p.pos.y, p.pos.z) && guard++ < 120) p.pos.y += 1;
        p.fallFrom = p.pos.y; this.started = true; ui.status = 'playing'; audio.play('world_enter'); audio.setAmbient(this.env.ambient || 'desert', ui.weather); if (audio.sounds.music_game) audio.setMusic('music_game');
        this.notice(this.t('msg.welcome_world', { name: this.you.name, world: this.info.name }));
        if (!this.touch) ui.panel = 'pause';
        this.emit(true);
      }
    } else if (ui.status === 'playing' || ui.status === 'reconnecting') {
      const free = !ui.panel || ui.panel === 'players', k = this.keys;
      const inp = free && !ui.dead ? {
        mx: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.tmove.x,
        mz: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.tmove.y,
        jump: k.has('Space') || this.tjump, sprint: this.sprintLatch || Math.hypot(this.tmove.x, this.tmove.y) > 0.92,
        down: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC') || this.tdown, sneak: k.has('ShiftLeft') || k.has('ShiftRight') || this.tsneak,
      } : { mx: 0, mz: 0, jump: false, sprint: false, down: false, sneak: false };
      if (inp.mz <= 0) this.sprintLatch = false;
      const wasWater = p.inWater;
      if (this.tpWait) {
        const fx = Math.floor(p.pos.x), fz = Math.floor(p.pos.z), c = w.chunks.get((fx >> 4) + ',' + (fz >> 4));
        if (c && c.meshed) { p.pos.y = w.groundY(fx, CH - 1, fz) + 0.05; p.fallFrom = p.pos.y; this.tpWait = false; }
      } else p.update(dt, inp, w, !!this.rules.fly, this.settings.autoJump);
      if (this.primary && this.tEnt) this.hit(); // الضغط المستمر يواصل الضرب
      this.smeltStep(dt);
      if (ui.sprinting !== p.sprinting || ui.sneaking !== p.sneaking) { ui.sprinting = p.sprinting; ui.sneaking = p.sneaking; this.uiDirty = true; }
      if (p.inWater && !wasWater && p.vel.y < -4) audio.play('splash');
      if (p.landed > 3.6 && !p.vehicle) this.damage(Math.floor(p.landed - 3));
      if (p.moving && p.onGround && !p.inWater) { this.stepT -= dt * Math.hypot(p.vel.x, p.vel.z); if (this.stepT <= 0) { this.stepT = 2.4; audio.play('step', 0.6); } }
      if (ui.flying !== p.flying) { ui.flying = p.flying; this.uiDirty = true; }
      if (ui.underwater !== p.headInWater) { ui.underwater = p.headInWater; this.uiDirty = true; }
      this.interact(dt, free);
      this.survival(dt, p.sprinting && p.moving);
      this.ents.update(dt);
      const cx = Math.floor(p.pos.x), cy = Math.floor(p.pos.y), cz = Math.floor(p.pos.z);
      if (ui.coords[0] !== cx || ui.coords[1] !== cy || ui.coords[2] !== cz) { ui.coords = [cx, cy, cz]; this.uiDirty = true; }
      if (now - this.lastSend > 100) {
        this.lastSend = now;
        const a = (p.moving ? 1 : 0) | (p.flying ? 2 : 0) | (p.inWater ? 4 : 0) | (p.sneaking ? 8 : 0);
        const s = p.pos.x.toFixed(2) + p.pos.y.toFixed(2) + p.pos.z.toFixed(2) + p.yaw.toFixed(2) + p.pitch.toFixed(1) + a + p.vehicle + (this.held()?.k || '');
        if (s !== this.lastPos) { this.lastPos = s; this.net.send({ t: 'pos', p: [p.pos.x, p.pos.y, p.pos.z], r: [p.yaw, p.pitch], a, v: p.vehicle, h: this.held()?.k || '' }); }
      }
    }
    // اللاعبون الآخرون
    const f = 1 - Math.exp(-12 * dt);
    for (const r of this.remotes.values()) {
      const g = r.av.group, before = g.position.clone();
      g.position.lerp(r.tp, f); let dy = r.tyaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * f; g.rotation.y = r.yaw; r.av.head.rotation.x = r.pitch * 0.6;
      const sp = before.distanceTo(g.position) / Math.max(dt, 0.001); r.moving = sp > 0.4; r.phase += dt * Math.min(sp, 8) * 1.6;
      animateAvatar(r.av, r.phase, r.moving, 0, !!r.veh, r.hasFalcon, !!(r.a & 8)); this.animVeh(r.av, r.phase, r.moving);
      if (r.av.tag) r.av.tag.position.y = (r.a & 8 ? 2.0 : 2.3) + (r.veh ? SEAT[r.veh]?.y ?? 0 : 0);
    }
    // الكاميرا والمجسم الشخصي
    const eye = p.eye(), third = this.view > 0;
    this.camera.rotation.set(p.pitch, p.yaw, 0);
    this.camera.position.set(p.pos.x, p.pos.y + eye, p.pos.z);
    if (third) {
      // 1: الكاميرا خلف اللاعب، 2: أمامه وتنظر إليه
      const head = this.camera.position.clone();
      const dir = new THREE.Vector3(0, 0, this.view === 1 ? 1 : -1).applyEuler(this.camera.rotation); const hitB = w.raycast(head, dir, 4.6);
      this.camera.position.addScaledVector(dir, Math.max(0.6, (hitB ? hitB.t : 4.6) - 0.3));
      if (this.view === 2) this.camera.lookAt(head);
    }
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5; }
    const showMe = third || !!p.vehicle;
    if (this.me) {
      this.me.group.visible = showMe; this.me.group.position.copy(p.pos); this.me.group.rotation.y = p.yaw;
      this.me.body.visible = third; if (this.me.veh) this.me.veh.visible = true;
      if (showMe) { animateAvatar(this.me, p.walk, p.moving, this.swing, !!p.vehicle, false, p.sneaking); this.animVeh(this.me, p.walk, p.moving); }
    }
    this.hand.visible = !third && !!this.held();
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4.5);
    const sw = Math.sin(this.swing * Math.PI);
    this.hand.position.set(0.46 - sw * 0.1, -0.4 - sw * 0.1 + (p.moving && p.onGround ? Math.sin(p.walk * 2) * 0.012 : 0), -0.78 - sw * 0.12); this.hand.rotation.set(-sw * 0.9, sw * 0.3, 0);
    // فتيل الديناميت: وميض أبيض
    for (const [k, f] of this.fuses) { const left = f.end - now; if (left <= 0) { this.scene.remove(f.mesh); this.fuses.delete(k); continue; } (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(now / (left < 1000 ? 45 : 110)) > 0 ? 0.55 : 0.05; }
    // الزمن المحلي بين رسائل الخادم
    if (!(this.sky as any).fixed) this.sky.time = (this.sky.time + dt / this.dayLen) % 1;
    this.sky.update(dt, this.camera.position, this.settings.renderDistance * 16, p.headInWater);
    const hk = this.held()?.k; this.torch.intensity = hk === 'lantern' ? 9 * (1.15 - this.sky.dayF) : 0;
  }
  private lastHeld = '';
  private interact(dt: number, free: boolean) {
    const ui = this.ui, w = this.world;
    this.placeCd -= dt;
    const hk = this.held()?.k || '';
    if (hk !== this.lastHeld) { this.lastHeld = hk; this.hand.clear(); const d = this.def(hk); if (d) this.hand.add(heldModel(d, !!this.blockByKey[hk], 'first', this.world.atlas, this.world.tex)); if (this.me) this.setHeld(this.me, hk); }
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    const o = new THREE.Vector3(this.player.pos.x, this.player.pos.y + this.player.eye(), this.player.pos.z);
    const reach = this.rules.infinite ? 8 : 5.5;
    const tg = free && !ui.dead ? w.raycast(o, dir, reach) : null;
    const solidT = tg && w.shape[tg.id] !== 1 ? tg.t : 4.5; // العشب والنباتات لا تحجب ضرب الحيوانات
    const te = free && !ui.dead ? this.ents.pick(o, dir, Math.min(4.5, solidT)) : null;
    this.tEnt = te ? te.e : null; this.target = te ? null : tg;
    const bk = tg ? w.byId[tg.id]?.key : '';
    const label = te ? (te.e.kind === 'npc' ? this.t('npc.' + te.e.role + '.name') + ' — ' + this.t('hud.talk') : this.t('animal.' + te.e.type) + (SPECIES[te.e.type]?.ride ? ' — ' + this.t('hud.ride') : ''))
      : tg ? this.name(w.byId[tg.id]) + (bk === 'crafting_table' || bk === 'furnace' ? ' — ' + this.t('hud.open') : bk === 'tnt' ? ' — ' + this.t('hud.ignite') : '') : '';
    if (label !== ui.target) { ui.target = label; this.uiDirty = true; }
    if (this.target) { this.hl.visible = true; this.hl.position.set(tg!.x + 0.5, tg!.y + 0.5, tg!.z + 0.5); } else this.hl.visible = false;
    // التكسير بالضغط المستمر
    let prog = 0;
    if (this.primary && this.target && ui.status === 'playing') {
      const b = w.byId[tg!.id], key = tg!.x + ',' + tg!.y + ',' + tg!.z;
      if (key !== this.breakKey) { this.breakKey = key; this.breakT = 0; }
      if (!ui.canBuild) { if (this.breakT === 0) this.notice(this.t('msg.no_permission')); this.breakT = 0.001; }
      else if (b && b.hardness >= 0) {
        const need = this.breakTime(b); this.breakT += dt; prog = Math.min(1, this.breakT / need);
        this.digT -= dt; if (this.digT <= 0) { this.digT = 0.22; audio.play('dig'); this.swing = 1; }
        if (this.breakT >= need) { this.breakT = 0; this.breakKey = ''; prog = 0; if (this.edit(tg!.x, tg!.y, tg!.z, 0)) audio.play('block_break'); }
      }
    } else { this.breakT = 0; this.breakKey = ''; }
    this.crack.visible = prog > 0; if (prog > 0) { this.crack.position.copy(this.hl.position); (this.crack.material as THREE.MeshBasicMaterial).opacity = prog * 0.55; }
    if (Math.abs(prog - ui.breakProg) > 0.05 || (prog === 0 && ui.breakProg !== 0)) { ui.breakProg = prog; this.uiDirty = true; }
  }
  private survival(dt: number, sprint: boolean) {
    const ui = this.ui, diff = this.info.settings?.difficulty || 'normal';
    if (ui.dead || !this.rules.damage) return;
    if (this.rules.hunger && diff !== 'peaceful') {
      this.hungerT += dt * (sprint ? 2.2 : 1) * (diff === 'hard' ? 1.4 : 1);
      if (this.hungerT > 36) { this.hungerT = 0; if (ui.hunger > 0) { ui.hunger = Math.max(0, ui.hunger - 1); if (ui.hunger === 5) this.notice(this.t('msg.hungry')); this.emit(); this.saveInvSoon(); } }
      if (ui.hunger <= 0) { this.starveT += dt; if (this.starveT > 4) { this.starveT = 0; this.damage(1); } }
    }
    if (ui.health < 20 && (!this.rules.hunger || ui.hunger >= 15)) { this.regenT += dt; if (this.regenT > 5) { this.regenT = 0; ui.health = Math.min(20, ui.health + 1); this.emit(); } }
  }

  // خريطة مصغرة: منظر علوي من أعلى المكعبات المحمّلة
  // الخريطة: المصغرة (كتلة لكل بكسل) والكاملة (bpp كتلة لكل بكسل)
  drawMinimap(ctx: CanvasRenderingContext2D, size: number, bpp = 1) {
    if (!this.world) return;
    const w = this.world, img = ctx.createImageData(size, size), d = img.data, px = Math.floor(this.player.pos.x), pz = Math.floor(this.player.pos.z), half = size >> 1;
    const cache: Record<number, number[]> = {};
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = px + Math.floor((i - half) * bpp), z = pz + Math.floor((j - half) * bpp), c = w.chunks.get((x >> 4) + ',' + (z >> 4)), o = (i + j * size) * 4;
      if (!c) { d[o] = 20; d[o + 1] = 34; d[o + 2] = 48; d[o + 3] = 255; continue; }
      const li = (x & 15) + (z & 15) * 16, id = c.topId[li], h = c.top[li];
      let col = cache[id]; if (!col) { const hex = w.atlas.main[id] || '#000000', n = parseInt(hex.slice(1), 16); col = cache[id] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      const s = w.shape[id] === 2 ? 1 : 0.62 + Math.min(0.5, (h - 36) / 110);
      d[o] = col[0] * s; d[o + 1] = col[1] * s; d[o + 2] = col[2] * s; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const big = size > 200, dot = (wx: number, wz: number, col: string, r: number, label?: string) => {
      const x = (wx - px) / bpp + half, z = (wz - pz) / bpp + half; if (x < 2 || z < 2 || x > size - 2 || z > size - 2) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, z, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      if (label && big) { ctx.font = '700 13px Tajawal, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(label, x, z - 8); ctx.fillStyle = '#fff'; ctx.fillText(label, x, z - 8); }
    };
    dot(this.spawn[0], this.spawn[2], '#2fb873', big ? 5 : 3, big ? this.t('map.spawn') : undefined);
    for (const r of this.remotes.values()) dot(r.tp.x, r.tp.z, '#ffd24a', big ? 5 : 3, r.name);
    const sc = big ? 1.8 : 1;
    ctx.save(); ctx.translate(half, half); ctx.rotate(-this.player.yaw); ctx.scale(sc, sc); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b2233'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.font = '800 ' + (big ? 16 : 11) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.strokeText('N', half, big ? 18 : 11); ctx.fillText('N', half, big ? 18 : 11);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); clearTimeout(this.invTimer);
    this.saveInv(); audio.play('world_exit'); audio.stopAll(); this.net.close();
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); document.removeEventListener('mousemove', this.onMouseMove); this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp); this.canvas.removeEventListener('wheel', this.onWheel); document.removeEventListener('pointerlockchange', this.onLock); this.canvas.removeEventListener('contextmenu', this.noCtx); window.removeEventListener('blur', this.onBlur); window.removeEventListener('resize', this.resize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.world?.disposeAll(); this.renderer.dispose();
  }
}
