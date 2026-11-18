// خادم اللعب الجماعي: غرف العوالم، مزامنة الحركة والبناء، الدردشة، المهام والإنجازات (الخادم هو المرجع)
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { all, get, run, now, J, tx, addStat, maxStat } from './db.ts';
import { userFromToken, permsOf } from './auth.ts';
import { content } from './content.ts';
import { makeGen, idx, CH, type Gen } from '../shared/gen.ts';

interface Player {
  ws: WebSocket; id: number; name: string; char: any; role: string; admin: boolean;
  p: number[]; r: number[]; a: number; v: string; h: string; moved: boolean;
  tokens: number; lastTok: number; lastChat: number; seq: number; session: number; joined: number;
  best: number; caveDone: boolean; lastCheck: number; missions: Map<number, { progress: number; status: string }>;
}
const send = (ws: WebSocket, m: any) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const ck = (cx: number, cz: number) => cx + ',' + cz;

class Room {
  players = new Map<number, Player>();
  deltas = new Map<string, Map<number, number>>();
  dirty = new Set<string>();
  base = new Map<string, Uint8Array>();
  gen: Gen; c: any; settings: any; rules: any; env: any;
  time = 0.3; weather = 'clear'; nextWeather = 0; challenge: any = null; emptySince = 0; lastEnv = 0;
  // جلسة الغرفة: رقم الغرفة، وقت الانتهاء (يحسبه الخادم)، مقاعد محجوزة للمنقطعين
  no = 0; endsAt = 0; startedAt = now(); warned = new Set<number>(); held = new Map<number, number>(); peak = 0;
  constructor(public w: any) {
    this.c = content();
    this.settings = J(get('SELECT data FROM world_settings WHERE world_id=?', w.id)?.data, {});
    this.env = this.c.envs[w.environment] || Object.values(this.c.envs)[0];
    this.rules = this.c.settings.mode_rules[w.mode] || {};
    this.gen = makeGen(w.seed, this.env.params, this.c.blockIds, { amp: this.settings.amp, ores: Number(this.settings.ores), structures: this.settings.structures, prefabs: this.c.prefabs });
    for (const r of all('SELECT cx,cz,data FROM world_chunks WHERE world_id=?', w.id)) {
      const a = J(r.data, []), m = new Map<number, number>();
      for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]);
      this.deltas.set(ck(r.cx, r.cz), m);
    }
    this.time = this.settings.start_time ?? 0.3;
    this.weather = this.settings.weather && this.settings.weather !== 'dynamic' ? this.settings.weather : 'clear';
    // نسخة احتياطية تلقائية يومية
    if (this.deltas.size) {
      const last = get('SELECT MAX(created_at) t FROM world_backups WHERE world_id=?', w.id)?.t || 0;
      if (now() - last > 86400) run('INSERT INTO world_backups(world_id,created_at,note,data) VALUES(?,?,?,?)', w.id, now(), 'auto', JSON.stringify(all('SELECT cx,cz,data FROM world_chunks WHERE world_id=?', w.id)));
      for (const o of all('SELECT id FROM world_backups WHERE world_id=? ORDER BY id DESC LIMIT -1 OFFSET 8', w.id)) run('DELETE FROM world_backups WHERE id=?', o.id);
    }
  }
  baseChunk(cx: number, cz: number) {
    const k = ck(cx, cz); let b = this.base.get(k);
    if (!b) { b = this.gen.genChunk(cx, cz); this.base.set(k, b); if (this.base.size > 400) this.base.delete(this.base.keys().next().value!); }
    return b;
  }
  blockAt(x: number, y: number, z: number): number {
    if (y < 0 || y >= CH) return 0;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), i = idx(x - cx * 16, y, z - cz * 16);
    const d = this.deltas.get(ck(cx, cz));
    if (d && d.has(i)) return d.get(i)!;
    return this.baseChunk(cx, cz)[i];
  }
  modified(x: number, y: number, z: number) {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    return !!this.deltas.get(ck(cx, cz))?.has(idx(x - cx * 16, y, z - cz * 16));
  }
  setBlock(x: number, y: number, z: number, id: number) {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), k = ck(cx, cz);
    let d = this.deltas.get(k); if (!d) this.deltas.set(k, (d = new Map()));
    d.set(idx(x - cx * 16, y, z - cz * 16), id); this.dirty.add(k);
  }
  flush() {
    if (!this.dirty.size) return;
    tx(() => {
      for (const k of this.dirty) {
        const [cx, cz] = k.split(',').map(Number), d = this.deltas.get(k)!, a: number[] = [];
        for (const [i, v] of d) a.push(i, v);
        run('INSERT INTO world_chunks(world_id,cx,cz,data,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(world_id,cx,cz) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at', this.w.id, cx, cz, JSON.stringify(a), now());
      }
      run('UPDATE worlds SET updated_at=? WHERE id=?', now(), this.w.id);
    });
    this.dirty.clear();
  }
  bc(m: any, except?: number) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.id !== except && p.ws.readyState === 1) p.ws.send(s); }
  canBuild(p: Player) { return p.role === 'owner' || p.role === 'builder' || p.admin || (p.role === 'visitor' && this.settings.visitor_perm === 'build'); }
  left() { return this.endsAt ? Math.max(0, this.endsAt - now()) : -1; }
  envMsg() { return { t: 'env', time: this.time, weather: this.weather, fixed: !!this.settings.fixed_time, left: this.left() }; }

  // ----- الإنجازات والمهام -----
  stat(p: Player, stat: string, value: number) {
    for (const a of this.c.achievements) {
      if (a.stat !== stat || value < a.threshold) continue;
      const r = run('INSERT OR IGNORE INTO player_achievements(user_id,achievement_id,world_id,achieved_at) VALUES(?,?,?,?)', p.id, a.id, this.w.id, now());
      if (!r.changes) continue;
      run('UPDATE player_profiles SET points=points+? WHERE user_id=?', a.points || 0, p.id);
      send(p.ws, { t: 'ach', id: a.id, key: a.key, title_ar: a.title_ar, title_en: a.title_en, icon: a.icon, points: a.points, items: a.reward_items, sound: a.sound_key });
      this.bc({ t: 'sys', key: 'sys.achievement', args: { name: p.name, title_ar: a.title_ar, title_en: a.title_en } }, p.id);
    }
  }
  inc(p: Player, stat: string, n = 1) { this.stat(p, stat, addStat(p.id, stat, n)); }
  modeMissions() { return this.c.missionsFull.filter((m: any) => m.modes.includes(this.w.mode)); }
  loadMissions(p: Player) {
    for (const r of all('SELECT mission_id,progress,status FROM player_missions WHERE user_id=? AND world_id=?', p.id, this.w.id)) p.missions.set(r.mission_id, { progress: r.progress, status: r.status });
    for (const m of this.modeMissions()) if (!m.npc && !m.time_limit && m.type !== 'quiz' && !p.missions.has(m.id)) this.activate(p, m);
  }
  activate(p: Player, m: any) {
    p.missions.set(m.id, { progress: 0, status: 'active' });
    run("INSERT OR IGNORE INTO player_missions(user_id,mission_id,world_id,progress,status,started_at) VALUES(?,?,?,0,'active',?)", p.id, m.id, this.w.id, now());
  }
  complete(p: Player, m: any) {
    const st = p.missions.get(m.id) || { progress: 0, status: 'active' };
    st.status = 'done'; st.progress = m.count; p.missions.set(m.id, st);
    run("INSERT INTO player_missions(user_id,mission_id,world_id,progress,status,started_at,done_at) VALUES(?,?,?,?, 'done',?,?) ON CONFLICT(user_id,mission_id,world_id) DO UPDATE SET progress=excluded.progress,status='done',done_at=excluded.done_at", p.id, m.id, this.w.id, m.count, now(), now());
    run('UPDATE player_profiles SET points=points+? WHERE user_id=?', m.points || 0, p.id);
    send(p.ws, { t: 'mis', id: m.id, progress: m.count, status: 'done', items: m.reward_items, points: m.points });
    this.inc(p, m.type === 'quiz' ? 'quizzes_done' : 'missions_done');
  }
  matches(m: any, kind: string, key: string, cat: string) { return m.type === kind && (m.target === 'any' || m.target === key || m.target === 'cat:' + cat); }
  event(p: Player, kind: 'break' | 'place', key: string, cat: string) {
    for (const m of this.modeMissions()) {
      if (m.time_limit) continue;
      const st = p.missions.get(m.id);
      if (!st || st.status !== 'active' || !this.matches(m, kind, key, cat)) continue;
      st.progress++;
      if (st.progress >= m.count) this.complete(p, m);
      else { run('UPDATE player_missions SET progress=? WHERE user_id=? AND mission_id=? AND world_id=?', st.progress, p.id, m.id, this.w.id); send(p.ws, { t: 'mis', id: m.id, progress: st.progress, status: 'active' }); }
    }
    const ch = this.challenge;
    if (ch && ch.state === 'run' && this.matches(ch.m, kind, key, cat)) { ch.progress++; this.chalCheck(); }
  }
  height(p: Player, y: number) {
    for (const m of this.modeMissions()) {
      if (m.type !== 'reach_height' || m.time_limit) continue;
      const st = p.missions.get(m.id);
      if (st && st.status === 'active' && y >= m.count) this.complete(p, m);
    }
    const ch = this.challenge;
    if (ch && ch.state === 'run' && ch.m.type === 'reach_height' && y >= ch.m.count) { ch.progress = ch.m.count; this.chalCheck(); }
  }
  chalMsg() { const ch = this.challenge; return ch ? { t: 'chal', id: ch.m.id, state: ch.state, progress: ch.progress, count: ch.m.count, left: Math.max(0, ch.ends - now()) } : { t: 'chal', id: 0, state: 'none' }; }
  chalCheck() {
    const ch = this.challenge; if (!ch || ch.state !== 'run') return;
    if (ch.progress >= ch.m.count) {
      ch.state = 'win';
      const group = this.players.size >= 2;
      for (const p of this.players.values()) {
        run('UPDATE player_profiles SET points=points+? WHERE user_id=?', ch.m.points || 0, p.id);
        this.inc(p, 'challenges_done'); if (group) this.inc(p, 'group_challenges_done');
      }
    } else if (now() >= ch.ends) ch.state = 'lose';
    this.bc(this.chalMsg());
    if (ch.state !== 'run') this.challenge = null;
  }

  tick(t: number) {
    const day = Math.max(60, this.c.settings.day_length_sec || 900);
    if (this.players.size && !this.settings.fixed_time) this.time = (this.time + 1 / day) % 1;
    if (this.settings.weather === 'dynamic' || !this.settings.weather) {
      if (t >= this.nextWeather) {
        const wts = this.env.weather || { clear: 1 }; let sum = 0; for (const k in wts) sum += wts[k];
        let r = Math.random() * sum, pick = 'clear'; for (const k in wts) { r -= wts[k]; if (r <= 0) { pick = k; break; } }
        const ch = pick !== this.weather; this.weather = pick; this.nextWeather = t + 90 + Math.random() * 180;
        if (ch) this.bc(this.envMsg());
      }
    }
    if (t - this.lastEnv >= 10) { this.lastEnv = t; this.bc(this.envMsg()); }
    if (this.endsAt) { const left = this.endsAt - now(); for (const w of [600, 300, 60]) if (left <= w && left > w - 5 && !this.warned.has(w)) { this.warned.add(w); this.bc({ t: 'sess', left, warn: w }); } }
    if (this.challenge) { const ch = this.challenge; if (now() >= ch.ends) this.chalCheck(); else if (t % 5 === 0) this.bc(this.chalMsg()); }
  }
  snapshot() {
    const out: any[] = [];
    for (const p of this.players.values()) if (p.moved) { p.moved = false; out.push([p.id, +p.p[0].toFixed(2), +p.p[1].toFixed(2), +p.p[2].toFixed(2), +p.r[0].toFixed(2), +p.r[1].toFixed(2), p.a, p.v, p.h]); }
    if (out.length) this.bc({ t: 'ps', l: out });
  }
  pub(p: Player) { return { id: p.id, name: p.name, char: p.char, role: p.role, p: p.p, r: p.r, a: p.a, v: p.v, h: p.h }; }
  leave(p: Player, notify = true, holdSec = 0) {
    if (this.players.get(p.id) !== p) return;
    this.players.delete(p.id);
    if (holdSec > 0) this.held.set(p.id, now() + holdSec);
    const dur = now() - p.joined;
    run('UPDATE world_members SET last_pos=?,last_seen=? WHERE world_id=? AND user_id=?', JSON.stringify([...p.p, ...p.r]), now(), this.w.id, p.id);
    run('UPDATE game_sessions SET ended_at=?,duration=? WHERE id=?', now(), dur, p.session);
    run('UPDATE player_profiles SET playtime=playtime+? WHERE user_id=?', dur, p.id);
    if (notify) { this.bc({ t: 'pl', id: p.id }); this.bc({ t: 'sys', key: 'sys.left', args: { name: p.name } }); }
    if (!this.players.size) { this.flush(); this.emptySince = now(); }
  }
}

class Hub {
  rooms = new Map<number, Room>();
  wss!: WebSocketServer;
  queue: { ws: any; m: any; uid: number }[] = [];
  cfg() { const s = content().settings; return { on: s.room_system_enabled !== false, rooms: Math.max(1, s.rooms_count || 10), cap: Math.max(1, s.room_capacity || 5), secs: Math.max(1, s.session_minutes || 60) * 60, empty: s.empty_release_sec ?? 180, hold: s.reconnect_hold_sec ?? 120 }; }
  capOf(w: any) { const c = this.cfg(); return c.on ? Math.min(w.max_players, c.cap) : w.max_players; }
  status() {
    const c = this.cfg(), lefts = [...this.rooms.values()].map((r) => r.left()).filter((l) => l >= 0).sort((a, b) => a - b);
    return { enabled: c.on, total: c.rooms, busy: this.rooms.size, capacity: c.cap, minutes: c.secs / 60, queue: this.queue.length, next_free: this.rooms.size >= c.rooms ? lefts[0] ?? 0 : 0 };
  }
  // إنهاء جلسة الغرفة: حفظ العالم، إخراج اللاعبين، حذف المؤقت، وتحرير الغرفة
  endSession(wid: number, reason: string) {
    const r = this.rooms.get(wid); if (!r) return;
    for (const p of [...r.players.values()]) { send(p.ws, { t: 'kicked', reason }); r.leave(p, false); p.ws.close(4001, reason); }
    r.flush(); this.rooms.delete(wid);
    if (this.cfg().on) {
      run('INSERT INTO room_sessions(room_no,world_id,started_at,ended_at,reason,peak_players) VALUES(?,?,?,?,?,?)', r.no, wid, r.startedAt, now(), reason, r.peak);
      run('DELETE FROM messages WHERE world_id=?', wid); run('UPDATE world_members SET last_pos=NULL WHERE world_id=?', wid);
      if (r.settings.temp && reason !== 'world_deleted' && reason !== 'world_restored') { run('DELETE FROM world_chunks WHERE world_id=?', wid); run('DELETE FROM inventories WHERE world_id=?', wid); run('DELETE FROM player_missions WHERE world_id=?', wid); }
    }
    this.pump();
  }
  queueMsg(i: number) {
    const lefts = [...this.rooms.values()].map((r) => r.left()).filter((l) => l >= 0).sort((a, b) => a - b);
    return { t: 'queue', pos: i + 1, total: this.queue.length, eta: lefts.length ? lefts[Math.min(i, lefts.length - 1)] : 0 };
  }
  // إدخال المنتظرين بالدور عند توفر غرفة (أو عند فتح غرفة عالمهم)
  pump() {
    const c = this.cfg();
    for (const q of [...this.queue]) {
      const drop = () => { const i = this.queue.indexOf(q); if (i >= 0) this.queue.splice(i, 1); };
      if (q.ws.readyState !== 1) { drop(); continue; }
      const w = get('SELECT id FROM worlds WHERE code=?', String(q.m.code || '').toUpperCase().slice(0, 24));
      if (w && !this.rooms.has(w.id) && c.on && this.rooms.size >= c.rooms) continue;
      drop(); const r = this.join(q.ws, q.m); if (r && r !== 'queued') q.ws.st = r;
    }
    this.queue.forEach((q, i) => send(q.ws, this.queueMsg(i)));
  }
  room(wid: number) { return this.rooms.get(wid); }
  onlineCount(wid: number) { return this.rooms.get(wid)?.players.size || 0; }
  isOnline(wid: number, uid: number) { return !!this.rooms.get(wid)?.players.has(uid); }
  flush(wid: number) { this.rooms.get(wid)?.flush(); }
  kick(wid: number, uid: number, reason = 'kicked') { const r = this.rooms.get(wid), p = r?.players.get(uid); if (r && p) { send(p.ws, { t: 'kicked', reason }); r.leave(p); p.ws.close(4001, reason); } }
  closeRoom(wid: number, reason = 'closed') { this.endSession(wid, reason); }
  reloadWorld(wid: number) {
    const r = this.rooms.get(wid); if (!r) return;
    const w = get('SELECT * FROM worlds WHERE id=?', wid); if (!w) return;
    const s = J(get('SELECT data FROM world_settings WHERE world_id=?', wid)?.data, {});
    r.w = w; r.settings = { ...r.settings, ...s }; r.rules = content().settings.mode_rules[w.mode] || {};
    if (s.weather && s.weather !== 'dynamic') r.weather = s.weather;
    r.bc({ t: 'wupd', world: this.worldInfo(r) }); r.bc(r.envMsg());
  }
  memberChanged(wid: number, uid: number) {
    const r = this.rooms.get(wid), p = r?.players.get(uid); if (!r || !p) return;
    const m = get('SELECT role FROM world_members WHERE world_id=? AND user_id=?', wid, uid);
    if (m) { p.role = m.role; r.bc({ t: 'role', uid, role: m.role }); }
  }
  announce(text: string) { for (const r of this.rooms.values()) r.bc({ t: 'chat', id: 0, name: '📢', text, ts: now(), admin: true }); }
  monitor() {
    return [...this.rooms.values()].map((r) => ({ room: r.no, left: r.left(), id: r.w.id, code: r.w.code, name: r.w.name, mode: r.w.mode, environment: r.w.environment, max: this.capOf(r.w), time: r.time, weather: r.weather,
      players: [...r.players.values()].map((p) => ({ id: p.id, name: p.name, role: p.role, pos: p.p.map((v) => Math.round(v)), since: p.joined })) }));
  }
  worldInfo(r: Room) { const w = r.w; return { id: w.id, code: w.code, name: w.name, mode: w.mode, owner_id: w.owner_id, max: this.capOf(w), environment: w.environment, country: w.country, region: w.region, seed: w.seed, settings: r.settings, rules: r.rules }; }

  attach(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
    this.wss.on('connection', (ws: any) => {
      ws.alive = true; ws.on('pong', () => (ws.alive = true));
      const joinTimer = setTimeout(() => { if (!ws.st && !this.queue.some((q) => q.ws === ws)) ws.close(4000, 'no_join'); }, 10000);
      ws.on('message', (raw: Buffer) => {
        let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
        if (!m || typeof m.t !== 'string') return;
        try {
          if (!ws.st) { if (m.t === 'join' && !this.queue.some((q) => q.ws === ws)) { const r = this.join(ws, m); if (r && r !== 'queued') ws.st = r; } return; }
          if (ws.st.room.players.get(ws.st.p.id) !== ws.st.p) return;
          this.handle(ws.st.room, ws.st.p, m);
        } catch (e) { console.error('[ws]', e); }
      });
      ws.on('close', () => { clearTimeout(joinTimer); const i = this.queue.findIndex((q) => q.ws === ws); if (i >= 0) { this.queue.splice(i, 1); this.queue.forEach((q, k) => send(q.ws, this.queueMsg(k))); } if (ws.st) ws.st.room.leave(ws.st.p, true, this.cfg().on ? this.cfg().hold : 0); });
      ws.on('error', () => {});
    });
    setInterval(() => { for (const ws of this.wss.clients as any) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 20000).unref();
    setInterval(() => { for (const r of this.rooms.values()) r.snapshot(); }, 100).unref();
    let t = 0;
    setInterval(() => {
      t++;
      const save = Math.max(5, content().settings.autosave_sec || 15);
      for (const [id, r] of this.rooms) {
        r.tick(t);
        if (t % save === 0) r.flush();
        const c = this.cfg();
        if (r.endsAt && now() >= r.endsAt) this.endSession(id, 'session_ended');
        else if (!r.players.size && r.emptySince && now() - r.emptySince > (c.on ? c.empty : 60)) this.endSession(id, 'empty');
      }
      if (this.queue.length && t % 5 === 0) this.pump();
    }, 1000).unref();
  }
  shutdown() { for (const r of this.rooms.values()) { for (const p of [...r.players.values()]) r.leave(p, false); r.flush(); } }

  join(ws: WebSocket, m: any): { room: Room; p: Player } | 'queued' | null {
    const fail = (key: string) => { send(ws, { t: 'err', key }); ws.close(4002, key); return null; };
    const u = userFromToken(m.token); if (!u) return fail('unauthorized');
    const w = get('SELECT * FROM worlds WHERE code=?', String(m.code || '').toUpperCase().slice(0, 24)); if (!w) return fail('world_not_found');
    const admin = permsOf(u.role).includes('worlds.manage');
    let mem = get('SELECT * FROM world_members WHERE world_id=? AND user_id=?', w.id, u.id);
    if (mem?.banned) return fail('banned');
    if (!mem && w.owner_id !== u.id && w.join_policy !== 'open' && !admin) return fail('closed');
    let room = this.rooms.get(w.id);
    const cfg = this.cfg();
    if (!room) {
      // لا غرفة حرة: يدخل اللاعب طابور الانتظار ويبقى متصلاً
      if (cfg.on && this.rooms.size >= cfg.rooms) { this.queue.push({ ws, m: { token: m.token, code: m.code }, uid: u.id }); send(ws, this.queueMsg(this.queue.length - 1)); return 'queued'; }
      room = new Room(w);
      const used = new Set([...this.rooms.values()].map((r) => r.no)); let no = 1; while (used.has(no)) no++; room.no = no;
      if (cfg.on) room.endsAt = now() + cfg.secs; // يبدأ المؤقت عند دخول أول لاعب
      this.rooms.set(w.id, room);
    }
    const old = room.players.get(u.id);
    for (const [id, exp] of room.held) if (exp <= now() || room.players.has(id)) room.held.delete(id);
    const seats = room.players.size + [...room.held.keys()].filter((id) => id !== u.id).length;
    if (old) { send(old.ws, { t: 'kicked', reason: 'replaced' }); room.leave(old, false); old.ws.close(4001, 'replaced'); }
    else if (seats >= this.capOf(w)) return fail('full');
    room.held.delete(u.id); room.emptySince = 0;
    if (!mem) { run('INSERT INTO world_members(world_id,user_id,role,joined_at) VALUES(?,?,?,?)', w.id, u.id, w.owner_id === u.id ? 'owner' : 'visitor', now()); mem = get('SELECT * FROM world_members WHERE world_id=? AND user_id=?', w.id, u.id); }
    const prof = get('SELECT * FROM player_profiles WHERE user_id=?', u.id) || {};
    const sp = room.settings.spawn || room.gen.findSpawn();
    const lp = J(mem.last_pos, null);
    const s = run('INSERT INTO game_sessions(world_id,user_id,mode,region,started_at) VALUES(?,?,?,?,?)', w.id, u.id, w.mode, w.region || w.environment, now());
    const p: Player = { ws, id: u.id, name: prof.display_name || u.username, char: J(prof.character, null), role: w.owner_id === u.id ? 'owner' : mem.role, admin,
      p: lp ? lp.slice(0, 3) : [...sp], r: lp ? lp.slice(3, 5) : [0, 0], a: 0, v: '', h: '', moved: true, tokens: 30, lastTok: Date.now(), lastChat: 0, seq: 0,
      session: Number(s.lastInsertRowid), joined: now(), best: 0, caveDone: false, lastCheck: 0, missions: new Map() };
    room.players.set(u.id, p); room.peak = Math.max(room.peak, room.players.size);
    run('UPDATE worlds SET last_played=? WHERE id=?', now(), w.id);
    room.loadMissions(p);
    const deltas: Record<string, number[]> = {};
    for (const [k, d] of room.deltas) { const a: number[] = []; for (const [i, v] of d) a.push(i, v); deltas[k] = a; }
    const inv = get('SELECT slots,health,hunger,selected FROM inventories WHERE world_id=? AND user_id=?', w.id, u.id);
    send(ws, { t: 'welcome', you: { id: u.id, name: p.name, role: p.role, admin }, world: this.worldInfo(room), deltas, pos: p.p, rot: p.r, spawn: sp,
      players: [...room.players.values()].filter((x) => x.id !== u.id).map((x) => room!.pub(x)),
      inv: inv ? { slots: J(inv.slots, []), health: inv.health, hunger: inv.hunger, sel: inv.selected } : null,
      env: room.envMsg(), missions: [...p.missions].map(([id, v]) => ({ id, ...v })), chal: room.chalMsg(),
      chat: all('SELECT user_id id,username name,text,created_at ts FROM messages WHERE world_id=? ORDER BY id DESC LIMIT 25', w.id).reverse() });
    room.bc({ t: 'pj', p: room.pub(p) }, u.id);
    room.bc({ t: 'sys', key: 'sys.joined', args: { name: p.name } }, u.id);
    // أصدقاء اللعب المشترك
    for (const o of room.players.values()) if (o.id !== u.id) {
      run('INSERT OR IGNORE INTO player_coplay(user_id,other_id) VALUES(?,?)', u.id, o.id); run('INSERT OR IGNORE INTO player_coplay(user_id,other_id) VALUES(?,?)', o.id, u.id);
      room.stat(o, 'friends_played', maxStat(o.id, 'friends_played', get('SELECT COUNT(*) n FROM player_coplay WHERE user_id=?', o.id).n));
    }
    room.stat(p, 'friends_played', maxStat(u.id, 'friends_played', get('SELECT COUNT(*) n FROM player_coplay WHERE user_id=?', u.id).n));
    const wc = get("SELECT value FROM player_stats WHERE user_id=? AND stat='worlds_created'", u.id); if (wc) room.stat(p, 'worlds_created', wc.value);
    return { room, p };
  }

  handle(room: Room, p: Player, m: any) {
    const c = room.c;
    switch (m.t) {
      case 'pos': {
        const a = m.p, r = m.r;
        if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite) || !Array.isArray(r) || !r.every(Number.isFinite)) return;
        const L = (room.settings.limit || 384) + 2;
        p.p = [Math.max(-L, Math.min(L, a[0])), Math.max(-20, Math.min(CH + 60, a[1])), Math.max(-L, Math.min(L, a[2]))]; p.r = [r[0], r[1]];
        p.a = (m.a | 0) & 255; p.v = typeof m.v === 'string' ? m.v.slice(0, 12) : ''; p.h = typeof m.h === 'string' ? m.h.slice(0, 40) : ''; p.moved = true;
        const t = Date.now();
        if (t - p.lastCheck > 1500) {
          p.lastCheck = t;
          const x = Math.floor(p.p[0]), y = Math.floor(p.p[1]), z = Math.floor(p.p[2]);
          const below = room.blockAt(x, y - 1, z), bd = c.blockById[below];
          if (bd && bd.solid) {
            if (y > p.best) { p.best = y; room.stat(p, 'max_height', maxStat(p.id, 'max_height', y)); }
            room.height(p, y);
            if (!p.caveDone && room.gen.col(x, z).h - y > 9 && y > 3 && room.blockAt(x, y, z) === 0) { p.caveDone = true; room.stat(p, 'caves_found', maxStat(p.id, 'caves_found', 1)); }
          }
        }
        return;
      }
      case 'edit': return this.edit(room, p, m);
      case 'chat': {
        if (!c.settings.chat_enabled) return send(p.ws, { t: 'err', key: 'chat_disabled' });
        const text = typeof m.text === 'string' ? m.text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) : '';
        const t = Date.now(); if (!text || t - p.lastChat < 600) return; p.lastChat = t;
        run('INSERT INTO messages(world_id,user_id,username,text,created_at) VALUES(?,?,?,?,?)', room.w.id, p.id, p.name, text, now());
        room.bc({ t: 'chat', id: p.id, name: p.name, text, ts: now() });
        return;
      }
      case 'inv': {
        if (!Array.isArray(m.slots) || m.slots.length > 45) return;
        const slots = m.slots.map((s: any) => (s && typeof s.k === 'string' && s.k.length <= 40 && Number.isInteger(s.n) && s.n > 0 && s.n <= 999 ? { k: s.k, n: s.n } : null));
        const cl = (v: any) => Math.max(0, Math.min(20, Number(v) || 0));
        run('INSERT INTO inventories(world_id,user_id,slots,health,hunger,selected,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(world_id,user_id) DO UPDATE SET slots=excluded.slots,health=excluded.health,hunger=excluded.hunger,selected=excluded.selected,updated_at=excluded.updated_at',
          room.w.id, p.id, JSON.stringify(slots), cl(m.health), cl(m.hunger), Math.max(0, Math.min(8, m.sel | 0)), now());
        return;
      }
      case 'kick': {
        if (p.role !== 'owner' && !p.admin) return;
        const uid = m.uid | 0; if (uid === room.w.owner_id || uid === p.id) return;
        if (m.ban) run('UPDATE world_members SET banned=1 WHERE world_id=? AND user_id=?', room.w.id, uid);
        const t = room.players.get(uid); if (t) room.bc({ t: 'sys', key: 'sys.kicked', args: { name: t.name } }, uid);
        this.kick(room.w.id, uid, m.ban ? 'banned' : 'kicked');
        return;
      }
      case 'role': {
        if (p.role !== 'owner' && !p.admin) return;
        const uid = m.uid | 0, role = m.role === 'builder' ? 'builder' : 'visitor'; if (uid === room.w.owner_id) return;
        run('UPDATE world_members SET role=? WHERE world_id=? AND user_id=?', role, room.w.id, uid);
        this.memberChanged(room.w.id, uid);
        return;
      }
      case 'wset': {
        if (p.role !== 'owner' && !p.admin) return;
        if (typeof m.time === 'number' && m.time >= 0 && m.time < 1) room.time = m.time;
        // تغيير نمط اللعب للعالم كله (إبداعي، بقاء، ...)
        if (typeof m.mode === 'string' && room.c.settings.mode_rules[m.mode] && m.mode !== room.w.mode) {
          run('UPDATE worlds SET mode=?,updated_at=? WHERE id=?', m.mode, now(), room.w.id);
          room.w.mode = m.mode; room.rules = room.c.settings.mode_rules[m.mode] || {}; room.challenge = null;
          for (const x of room.players.values()) room.loadMissions(x);
          room.bc({ t: 'wupd', world: this.worldInfo(room) });
          room.bc({ t: 'sys', key: 'sys.mode', args: { name: p.name, mode: m.mode } });
        }
        if (['clear', 'rain', 'storm', 'fog', 'sandstorm'].includes(m.weather)) { room.weather = m.weather; room.nextWeather += 120; }
        if (m.visitor_perm === 'build' || m.visitor_perm === 'view') {
          room.settings.visitor_perm = m.visitor_perm; run('UPDATE world_settings SET data=? WHERE world_id=?', JSON.stringify(room.settings), room.w.id);
          room.bc({ t: 'wupd', world: this.worldInfo(room) });
        }
        room.bc(room.envMsg());
        return;
      }
      case 'npc': {
        const role = String(m.role || '');
        if (!(room.settings.npcs || []).includes(role)) return;
        const list = room.modeMissions().filter((x: any) => x.npc === role);
        const act = list.find((x: any) => p.missions.get(x.id)?.status === 'active');
        if (act) return send(p.ws, { t: 'npc', role, say: 'npc.remind', mission: act.id });
        const next = list.find((x: any) => p.missions.get(x.id)?.status !== 'done');
        if (!next) return send(p.ws, { t: 'npc', role, say: list.length ? 'npc.done' : 'npc.' + role + '.hello' });
        room.activate(p, next);
        send(p.ws, { t: 'mis', id: next.id, progress: 0, status: 'active' });
        send(p.ws, { t: 'npc', role, say: 'npc.' + role + '.hello', mission: next.id });
        if (next.type === 'talk') room.complete(p, next);
        return;
      }
      case 'quiz': {
        const ms = room.modeMissions().find((x: any) => x.id === (m.id | 0) && x.type === 'quiz'); if (!ms) return;
        if (p.missions.get(ms.id)?.status === 'done') return;
        const ok = (m.choice | 0) === ms.quiz?.answer;
        send(p.ws, { t: 'quiz', id: ms.id, ok });
        if (ok) room.complete(p, ms);
        return;
      }
      case 'chal': {
        if (p.role !== 'owner' && !p.admin) return send(p.ws, { t: 'err', key: 'owner_only' });
        if (room.challenge) return;
        const ms = room.modeMissions().find((x: any) => x.id === (m.id | 0) && x.time_limit > 0); if (!ms) return;
        room.challenge = { m: ms, state: 'run', progress: 0, ends: now() + ms.time_limit };
        room.bc(room.chalMsg());
        return;
      }
      case 'ignite': return this.ignite(room, p, m);
      case 'ping': return send(p.ws, { t: 'pong', n: m.n });
    }
  }

  // الديناميت: يشعله اللاعب، ثم ينفجر بعد 3 ثوانٍ ويهدم ما حوله ويشعل أي ديناميت قريب
  ignite(room: Room, p: Player, m: any) {
    const x = m.x, y = m.y, z = m.z, tnt = room.c.blockIds.tnt;
    if (![x, y, z].every(Number.isInteger) || !tnt || !room.canBuild(p)) return;
    const dx = x + 0.5 - p.p[0], dy = y + 0.5 - (p.p[1] + 1.5), dz = z + 0.5 - p.p[2];
    if (dx * dx + dy * dy + dz * dz > 100 || room.blockAt(x, y, z) !== tnt) return;
    this.fuse(room, x, y, z, 3000);
  }
  fuse(room: Room, x: number, y: number, z: number, ms: number) {
    const k = x + ',' + y + ',' + z, r: any = room;
    r.fuses ??= new Set<string>();
    if (r.fuses.has(k) || r.fuses.size >= 64) return;
    r.fuses.add(k); room.bc({ t: 'fuse', x, y, z, ms });
    setTimeout(() => { r.fuses.delete(k); if (this.rooms.get(room.w.id) === room) this.explode(room, x, y, z); }, ms);
  }
  explode(room: Room, x: number, y: number, z: number) {
    const c = room.c, tnt = c.blockIds.tnt, R = 3.2, L = room.settings.limit || 384, ed: number[] = [];
    if (room.blockAt(x, y, z) !== tnt) return;
    room.setBlock(x, y, z, 0); ed.push(x, y, z);
    for (let oy = -4; oy <= 4; oy++) for (let oz = -4; oz <= 4; oz++) for (let ox = -4; ox <= 4; ox++) {
      const d = Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.random() * 0.8; if (d > R || (!ox && !oy && !oz)) continue;
      const bx = x + ox, by = y + oy, bz = z + oz; if (by < 1 || by >= CH || Math.abs(bx) > L || Math.abs(bz) > L) continue;
      const id = room.blockAt(bx, by, bz), b = c.blockById[id];
      if (!id || !b || b.hardness < 0 || b.shape === 'liquid') continue;
      if (id === tnt) { this.fuse(room, bx, by, bz, 500 + Math.floor(Math.random() * 700)); continue; }
      room.setBlock(bx, by, bz, 0); ed.push(bx, by, bz);
    }
    room.bc({ t: 'boom', x, y, z, r: R, ed });
  }

  edit(room: Room, p: Player, m: any) {
    const c = room.c, x = m.x, y = m.y, z = m.z, id = m.id, s = m.s | 0;
    const ack = (ok: boolean, extra: any = {}) => send(p.ws, { t: 'ack', s, ok, x, y, z, ...extra });
    if (![x, y, z, id].every(Number.isInteger)) return;
    if (s && s <= p.seq) return; // منع تكرار نفس التعديل
    p.seq = s;
    const cur = y >= 0 && y < CH ? room.blockAt(x, y, z) : 0;
    const no = (reason: string) => ack(false, { id: cur, reason });
    const t = Date.now(); p.tokens = Math.min(30, p.tokens + ((t - p.lastTok) / 1000) * 25); p.lastTok = t;
    if (p.tokens < 1) return no('rate'); p.tokens--;
    if (!room.canBuild(p)) return no('no_permission');
    const L = room.settings.limit || 384;
    if (y < 1 || y >= CH || Math.abs(x) > L || Math.abs(z) > L) return no('bounds');
    const dx = x + 0.5 - p.p[0], dy = y + 0.5 - (p.p[1] + 1.5), dz = z + 0.5 - p.p[2];
    if (dx * dx + dy * dy + dz * dz > 100) return no('too_far');
    if (cur !== (m.prev | 0)) return no('conflict');
    const cb = c.blockById[cur], nb = c.blockById[id];
    const natural = !room.modified(x, y, z);
    if (id === 0) {
      if (!cb || cb.hardness < 0 || cb.shape === 'liquid') return no('unbreakable');
      room.setBlock(x, y, z, 0);
      let drop: any = null;
      if (!room.rules.infinite) {
        const tool = c.itemByKey[String(m.tool || '')];
        const tierOk = !cb.min_tier || (tool && tool.tool === cb.tool && tool.tier >= cb.min_tier);
        const dk = cb.drop_key || cb.key;
        if (tierOk && dk !== 'none' && Math.random() < (cb.drop_chance ?? 1)) drop = [dk, cb.drop_n || 1];
      }
      ack(true, { id: 0, drop });
      room.bc({ t: 'ed', x, y, z, id: 0, by: p.id }, p.id);
      if (natural) { room.inc(p, 'broken_total'); room.inc(p, 'broken:' + cb.key); room.inc(p, 'broken_cat:' + cb.category); room.event(p, 'break', cb.key, cb.category); }
    } else {
      if (!nb) return no('unknown_block');
      const toggle = cb && cb.toggle === nb.key;
      if (!toggle && cur !== 0 && !(cb && (cb.shape === 'liquid' || cb.shape === 'cross'))) return no('occupied');
      if (nb.hardness < 0 && nb.shape !== 'liquid' && !p.admin) return no('forbidden_block');
      room.setBlock(x, y, z, id);
      ack(true, { id });
      room.bc({ t: 'ed', x, y, z, id, by: p.id }, p.id);
      if (natural && !toggle) {
        room.inc(p, 'placed_total'); room.inc(p, 'placed:' + nb.key); room.inc(p, 'placed_cat:' + nb.category); room.event(p, 'place', nb.key, nb.category);
        const st = (k: string) => get('SELECT value FROM player_stats WHERE user_id=? AND stat=?', p.id, k)?.value || 0;
        if (st('placed_total') >= 40 && st('placed:door_closed') >= 1 && st('placed:glass') + st('placed:tinted_glass') + st('placed:mashrabiya') >= 2) room.stat(p, 'houses_built', maxStat(p.id, 'houses_built', 1));
      }
    }
  }
}
export const hub = new Hub();
