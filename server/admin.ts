// واجهة API للوحة الإدارة — كل مسار محمي بصلاحية محددة (RBAC)
import { Router, raw } from 'express';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { all, get, run, now, J, DATA_DIR } from './db.ts';
import { auth, requirePerm, requireAnyAdmin, can, hashPass, permsOf } from './auth.ts';
import { invalidate, content } from './content.ts';
import { RES, PERMS } from '../shared/resources.ts';
import { hub } from './hub.ts';
import { bad, str, int, createWorld, worldView } from './api.ts';

export const admin = Router();
const wrap = (fn: any) => (req: any, res: any) => { try { fn(req, res); } catch (e: any) { if (e?.status) res.status(e.status).json({ error: e.message }); else if (String(e?.message).includes('UNIQUE')) res.status(409).json({ error: 'duplicate' }); else { console.error(e); res.status(500).json({ error: 'server_error' }); } } };
const audit = (req: any, action: string, detail: any = '') => run('INSERT INTO audit_log(user_id,action,detail,created_at) VALUES(?,?,?,?)', req.user.id, action, typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 500), now());

admin.get('/session', requireAnyAdmin, wrap((req: any, res: any) => res.json({ id: req.user.id, username: req.user.username, role: req.user.role, perms: permsOf(req.user.role) })));

// ---------- CRUD عام ----------
function resOf(req: any) { const r = RES[req.params.res]; if (!r) throw bad('unknown_resource', 404); if (!can(req.user.role, r.perm)) throw bad('forbidden', 403); return r; }
function clean(r: any, body: any, create: boolean) {
  const out: any = {};
  for (const f of r.fields) {
    if (f.ro) continue;
    let v = body[f.n];
    if (v === undefined) { if (create && f.req) throw bad('missing_' + f.n); if (create && f.d !== undefined) v = f.d; else continue; }
    if (f.t === 'num') { v = v === '' || v === null ? 0 : Number(v); if (!Number.isFinite(v)) throw bad('invalid_' + f.n); }
    else if (f.t === 'bool') v = v && v !== '0' ? 1 : 0;
    else if (f.t === 'json') {
      if (typeof v === 'string') { if (v.trim() === '') v = null; else try { v = JSON.parse(v); } catch { throw bad('invalid_json_' + f.n); } }
      v = v === null ? null : JSON.stringify(v); if (v && v.length > 30000) throw bad('too_long_' + f.n);
    } else {
      v = v === null ? '' : String(v); if (v.length > 5000) throw bad('too_long_' + f.n);
      if (f.req && !v.trim()) throw bad('missing_' + f.n);
      if (f.o && v !== '' && !f.o.includes(v)) throw bad('invalid_' + f.n);
      if (f.n === 'key' && r.table !== 'translations' && !/^[A-Za-z0-9_]{2,40}$/.test(v)) throw bad('invalid_key');
      if (v === '' && !f.req && f.n !== 'dialect') v = null;
    }
    out[f.n] = v;
  }
  return out;
}
admin.get('/r/:res', auth, wrap((req: any, res: any) => {
  const r = resOf(req); const q = String(req.query.q || '').trim();
  let sql = `SELECT * FROM ${r.table}`; const args: any[] = [];
  if (q) { const cols = r.search || r.fields.filter((f: any) => f.t === 'text').map((f: any) => f.n); sql += ' WHERE ' + cols.map((c: string) => `${c} LIKE ?`).join(' OR '); cols.forEach(() => args.push('%' + q + '%')); }
  sql += ` ORDER BY ${r.order || r.pk} LIMIT 1500`;
  res.json(all(sql, ...args));
}));
admin.post('/r/:res', auth, wrap((req: any, res: any) => {
  const r = resOf(req), v = clean(r, req.body || {}, true);
  if (r.table === 'blocks') { const id = (get('SELECT MAX(id) m FROM blocks').m || 0) + 1; if (id > 255) throw bad('block_limit'); v.id = id; v.sort = id; }
  if (r.table === 'admin_roles') v.permissions = JSON.stringify((J(v.permissions, []) as string[]).filter((p) => PERMS.includes(p)));
  const ks = Object.keys(v);
  const x = run(`INSERT INTO ${r.table}(${ks.join(',')}) VALUES(${ks.map(() => '?').join(',')})`, ...ks.map((k) => v[k]));
  invalidate(); audit(req, 'create:' + req.params.res, v.key || x.lastInsertRowid);
  res.json({ ok: true, id: r.pk === 'id' ? Number(x.lastInsertRowid) : v.key });
}));
admin.put('/r/:res/:id', auth, wrap((req: any, res: any) => {
  const r = resOf(req), v = clean(r, req.body || {}, false);
  const cur = get(`SELECT * FROM ${r.table} WHERE ${r.pk}=?`, req.params.id); if (!cur) throw bad('not_found', 404);
  if (r.table === 'admin_roles') { if (cur.system) delete v.key; if (cur.key === 'admin') delete v.permissions; else if (v.permissions) v.permissions = JSON.stringify((J(v.permissions, []) as string[]).filter((p) => PERMS.includes(p))); if (cur.key === 'player') v.permissions = '[]'; }
  if (r.table === 'blocks' && cur.id <= 13) delete v.key;
  const ks = Object.keys(v);
  if (ks.length) run(`UPDATE ${r.table} SET ${ks.map((k) => k + '=?').join(',')} WHERE ${r.pk}=?`, ...ks.map((k) => v[k]), req.params.id);
  invalidate(); audit(req, 'update:' + req.params.res, req.params.id);
  res.json({ ok: true });
}));
admin.delete('/r/:res/:id', auth, wrap((req: any, res: any) => {
  const r = resOf(req);
  const cur = get(`SELECT * FROM ${r.table} WHERE ${r.pk}=?`, req.params.id); if (!cur) throw bad('not_found', 404);
  if (r.table === 'blocks' && cur.id <= 61) throw bad('system_block_disable_instead', 409);
  if (r.table === 'admin_roles' && cur.system) throw bad('system_role', 409);
  if (r.table === 'admin_roles') run("UPDATE users SET role='player' WHERE role=?", cur.key);
  run(`DELETE FROM ${r.table} WHERE ${r.pk}=?`, req.params.id);
  invalidate(); audit(req, 'delete:' + req.params.res, cur.key || req.params.id);
  res.json({ ok: true });
}));

// ---------- لوحة المعلومات والتقارير ----------
const n = (sql: string, ...a: any[]) => get(sql, ...a).n as number;
admin.get('/dashboard', requireAnyAdmin, wrap((_q: any, res: any) => {
  const day = now() - 86400, mon = hub.monitor();
  res.json({
    users: n('SELECT COUNT(*) n FROM users'), users_week: n('SELECT COUNT(*) n FROM users WHERE created_at>?', now() - 7 * 86400), worlds: n('SELECT COUNT(*) n FROM worlds'),
    sessions_day: n('SELECT COUNT(*) n FROM game_sessions WHERE started_at>?', day), messages_day: n('SELECT COUNT(*) n FROM messages WHERE created_at>?', day),
    achievements_granted: n('SELECT COUNT(*) n FROM player_achievements'), online: mon.reduce((s, r) => s + r.players.length, 0), rooms: mon.length,
    blocks: n('SELECT COUNT(*) n FROM blocks'), items: n('SELECT COUNT(*) n FROM items'), environments: n('SELECT COUNT(*) n FROM environments'), sounds: n('SELECT COUNT(*) n FROM sounds'),
    audit: all('SELECT a.action,a.detail,a.created_at,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 15'),
  });
}));
admin.get('/reports', requirePerm('reports.view'), wrap((_q: any, res: any) => {
  const since = now() - 14 * 86400;
  res.json({
    registrations: all("SELECT date(created_at,'unixepoch') d, COUNT(*) n FROM users WHERE created_at>? GROUP BY d ORDER BY d DESC", since),
    sessions: all("SELECT date(started_at,'unixepoch') d, COUNT(*) n, COUNT(DISTINCT user_id) players, ROUND(AVG(duration)/60.0,1) avg_min FROM game_sessions WHERE started_at>? GROUP BY d ORDER BY d DESC", since),
    by_mode: all('SELECT mode k, COUNT(*) n, ROUND(SUM(duration)/3600.0,1) hours FROM game_sessions GROUP BY mode ORDER BY n DESC'),
    by_region: all('SELECT region k, COUNT(*) n, ROUND(SUM(duration)/3600.0,1) hours FROM game_sessions GROUP BY region ORDER BY n DESC LIMIT 20'),
    achievements: all('SELECT a.title_ar k, COUNT(pa.user_id) n FROM achievements a LEFT JOIN player_achievements pa ON pa.achievement_id=a.id GROUP BY a.id ORDER BY n DESC'),
    top_players: all('SELECT COALESCE(p.display_name,u.username) k, p.points n, ROUND(p.playtime/3600.0,1) hours FROM player_profiles p JOIN users u ON u.id=p.user_id ORDER BY p.points DESC LIMIT 10'),
    top_worlds: all('SELECT w.name k, w.code, COUNT(s.id) n FROM worlds w LEFT JOIN game_sessions s ON s.world_id=w.id GROUP BY w.id ORDER BY n DESC LIMIT 10'),
    dialects: all('SELECT dialect k, COUNT(*) n FROM player_profiles GROUP BY dialect ORDER BY n DESC'),
  });
}));

// ---------- المستخدمون ----------
admin.get('/users', requirePerm('users.manage'), wrap((req: any, res: any) => {
  const q = '%' + String(req.query.q || '').trim() + '%';
  res.json(all(`SELECT u.id,u.username,u.role,u.banned,u.created_at,u.last_login,p.display_name,p.country,p.dialect,p.points,p.playtime,
    (SELECT COUNT(*) FROM worlds w WHERE w.owner_id=u.id) worlds FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.username LIKE ? OR p.display_name LIKE ? ORDER BY u.id DESC LIMIT 500`, q, q));
}));
admin.patch('/users/:id', requirePerm('users.manage'), wrap((req: any, res: any) => {
  const id = int(req.params.id, 1, 1e12, 'id'), b = req.body || {};
  const u = get('SELECT * FROM users WHERE id=?', id); if (!u) throw bad('not_found', 404);
  if (b.role !== undefined && b.role !== u.role) {
    if (!can(req.user.role, 'roles.manage')) throw bad('forbidden', 403);
    if (!get('SELECT 1 x FROM admin_roles WHERE key=?', b.role)) throw bad('invalid_role');
    if (u.role === 'admin' && n("SELECT COUNT(*) n FROM users WHERE role='admin'") <= 1) throw bad('last_admin', 409);
    run('UPDATE users SET role=? WHERE id=?', b.role, id);
  }
  if (b.banned !== undefined) { if (id === req.user.id) throw bad('cannot_ban_self', 409); run('UPDATE users SET banned=? WHERE id=?', b.banned ? 1 : 0, id); if (b.banned) { run('DELETE FROM auth_tokens WHERE user_id=?', id); for (const r of hub.monitor()) hub.kick(r.id, id, 'banned'); } }
  if (b.password) { run('UPDATE users SET pass_hash=? WHERE id=?', hashPass(str(b.password, 6, 72, 'password')), id); run('DELETE FROM auth_tokens WHERE user_id=?', id); }
  audit(req, 'user:update', { id, role: b.role, banned: b.banned, password: !!b.password });
  res.json({ ok: true });
}));
admin.delete('/users/:id', requirePerm('users.manage'), wrap((req: any, res: any) => {
  const id = int(req.params.id, 1, 1e12, 'id'); if (id === req.user.id) throw bad('cannot_delete_self', 409);
  const u = get('SELECT * FROM users WHERE id=?', id); if (!u) throw bad('not_found', 404);
  if (u.role === 'admin' && n("SELECT COUNT(*) n FROM users WHERE role='admin'") <= 1) throw bad('last_admin', 409);
  for (const w of all('SELECT id FROM worlds WHERE owner_id=?', id)) hub.closeRoom(w.id, 'world_deleted');
  for (const r of hub.monitor()) hub.kick(r.id, id, 'banned');
  run('DELETE FROM users WHERE id=?', id); audit(req, 'user:delete', u.username);
  res.json({ ok: true });
}));

// ---------- العوالم ----------
admin.get('/worlds', requirePerm('worlds.manage'), wrap((req: any, res: any) => {
  const q = '%' + String(req.query.q || '').trim() + '%';
  res.json(all('SELECT * FROM worlds WHERE name LIKE ? OR code LIKE ? ORDER BY id DESC LIMIT 500', q, q).map((w) => ({ ...worldView(w), chunks: n('SELECT COUNT(*) n FROM world_chunks WHERE world_id=?', w.id), members: n('SELECT COUNT(*) n FROM world_members WHERE world_id=?', w.id) })));
}));
admin.post('/worlds', requirePerm('worlds.manage'), wrap((req: any, res: any) => { const id = createWorld(req.user.id, req.body || {}); if (req.body?.featured) run('UPDATE worlds SET featured=1,is_public=1 WHERE id=?', id); audit(req, 'world:create', id); res.json(worldView(get('SELECT * FROM worlds WHERE id=?', id))); }));
admin.patch('/worlds/:id', requirePerm('worlds.manage'), wrap((req: any, res: any) => {
  const id = int(req.params.id, 1, 1e12, 'id'), b = req.body || {};
  if (!get('SELECT 1 x FROM worlds WHERE id=?', id)) throw bad('not_found', 404);
  if (b.featured !== undefined) run('UPDATE worlds SET featured=? WHERE id=?', b.featured ? 1 : 0, id);
  audit(req, 'world:update', id); res.json({ ok: true });
}));

// ---------- الأصوات ----------
const UP = resolve(DATA_DIR, 'uploads');
function sniff(buf: Buffer): 'mp3' | 'wav' | null {
  if (buf.length < 16) return null;
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}
function saveAudio(buf: Buffer) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad('empty_file');
  const kind = sniff(buf); if (!kind) throw bad('invalid_audio_only_mp3_wav');
  const file = randomBytes(12).toString('hex') + '.' + kind;
  writeFileSync(resolve(UP, file), buf);
  return { file, mime: kind === 'mp3' ? 'audio/mpeg' : 'audio/wav', size: buf.length };
}
const rm = (f: string) => { const p = resolve(UP, f); if (/^[a-f0-9]+\.(mp3|wav)$/.test(f) && existsSync(p)) unlinkSync(p); };
const audioBody = raw({ type: () => true, limit: '8mb' });
const skey = (v: any) => { const s = String(v || '').trim(); if (!/^[a-z0-9_]{2,40}$/.test(s)) throw bad('invalid_key'); return s; };
admin.get('/sounds', requirePerm('sounds.manage'), wrap((_q: any, res: any) => res.json(all('SELECT * FROM sounds ORDER BY id DESC'))));
admin.post('/sounds', requirePerm('sounds.manage'), audioBody, wrap((req: any, res: any) => {
  const key = skey(req.query.key), a = saveAudio(req.body);
  const r = run('INSERT INTO sounds(key,name,category,file,mime,size,volume,approved,created_at) VALUES(?,?,?,?,?,?,?,0,?)', key, String(req.query.name || key).slice(0, 80), String(req.query.category || 'effect').slice(0, 20), a.file, a.mime, a.size, 1, now());
  audit(req, 'sound:upload', key); res.json({ ok: true, id: Number(r.lastInsertRowid) });
}));
admin.put('/sounds/:id/file', requirePerm('sounds.manage'), audioBody, wrap((req: any, res: any) => {
  const s = get('SELECT * FROM sounds WHERE id=?', req.params.id); if (!s) throw bad('not_found', 404);
  const a = saveAudio(req.body); rm(s.file);
  run('UPDATE sounds SET file=?,mime=?,size=?,approved=0 WHERE id=?', a.file, a.mime, a.size, s.id); invalidate(); audit(req, 'sound:replace', s.key); res.json({ ok: true });
}));
admin.patch('/sounds/:id', requirePerm('sounds.manage'), wrap((req: any, res: any) => {
  const s = get('SELECT * FROM sounds WHERE id=?', req.params.id); if (!s) throw bad('not_found', 404);
  const b = req.body || {};
  const key = b.key !== undefined ? skey(b.key) : s.key, approved = b.approved !== undefined ? (b.approved ? 1 : 0) : s.approved;
  const volume = b.volume !== undefined ? Math.max(0, Math.min(1, Number(b.volume) || 0)) : s.volume;
  if (approved) run('UPDATE sounds SET approved=0 WHERE key=? AND id<>?', key, s.id); // صوت معتمد واحد لكل مفتاح
  run('UPDATE sounds SET key=?,name=?,category=?,volume=?,approved=? WHERE id=?', key, b.name !== undefined ? String(b.name).slice(0, 80) : s.name, b.category !== undefined ? String(b.category).slice(0, 20) : s.category, volume, approved, s.id);
  invalidate(); audit(req, 'sound:update', key); res.json({ ok: true });
}));
admin.delete('/sounds/:id', requirePerm('sounds.manage'), wrap((req: any, res: any) => {
  const s = get('SELECT * FROM sounds WHERE id=?', req.params.id); if (!s) throw bad('not_found', 404);
  rm(s.file); run('DELETE FROM sounds WHERE id=?', s.id); invalidate(); audit(req, 'sound:delete', s.key); res.json({ ok: true });
}));

// ---------- المراقبة ----------
admin.get('/monitor', requirePerm('monitor.view'), wrap((_q: any, res: any) => res.json(hub.monitor())));
admin.post('/monitor/kick', requirePerm('monitor.view'), wrap((req: any, res: any) => { hub.kick(req.body.world | 0, req.body.uid | 0, 'kicked'); audit(req, 'monitor:kick', req.body); res.json({ ok: true }); }));
admin.post('/monitor/close', requirePerm('monitor.view'), wrap((req: any, res: any) => { hub.closeRoom(req.body.world | 0, 'closed'); audit(req, 'monitor:close', req.body); res.json({ ok: true }); }));
admin.post('/monitor/announce', requirePerm('monitor.view'), wrap((req: any, res: any) => { hub.announce(str(req.body?.text, 1, 200, 'text')); audit(req, 'monitor:announce', req.body.text); res.json({ ok: true }); }));

// ---------- الإعدادات ----------
admin.get('/settings', requirePerm('settings.manage'), wrap((_q: any, res: any) => res.json(Object.fromEntries(all('SELECT key,value FROM settings').map((s) => [s.key, J(s.value)])))));
admin.put('/settings', requirePerm('settings.manage'), wrap((req: any, res: any) => {
  const b = req.body || {};
  for (const k of Object.keys(b)) { if (!/^[a-z_]{2,40}$/.test(k)) throw bad('invalid_key'); const v = JSON.stringify(b[k]); if (v.length > 20000) throw bad('too_long'); run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v); }
  invalidate(); content(); audit(req, 'settings:update', Object.keys(b)); res.json({ ok: true });
}));
