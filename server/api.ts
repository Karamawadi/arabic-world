// واجهة API للاعبين: الحسابات، الملفات الشخصية، العوالم، أكواد الانضمام
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { all, get, run, now, J, tx, addStat } from './db.ts';
import { auth, hashPass, checkPass, issueToken, revokeToken, limited, permsOf } from './auth.ts';
import { content, publicContent } from './content.ts';
import { makeGen } from '../shared/gen.ts';
import { hub } from './hub.ts';

export const api = Router();
const wrap = (fn: any) => (req: any, res: any) => { try { fn(req, res); } catch (e: any) { if (e?.status) res.status(e.status).json({ error: e.message }); else { console.error(e); res.status(500).json({ error: 'server_error' }); } } };
export const bad = (m: string, status = 400) => Object.assign(new Error(m), { status });
export const str = (v: any, min: number, max: number, name: string) => { if (typeof v !== 'string') throw bad('invalid_' + name); const s = v.trim(); if (s.length < min || s.length > max) throw bad('invalid_' + name); return s; };
export const int = (v: any, min: number, max: number, name: string) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw bad('invalid_' + name); return n; };
const oneOf = (v: any, list: string[], d: string) => (list.includes(v) ? v : d);
const ip = (req: any) => req.ip || 'x';

api.get('/content', wrap((_q: any, res: any) => res.json(publicContent())));
api.get('/i18n', wrap((req: any, res: any) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar', dialect = String(req.query.dialect || '').slice(0, 10);
  const out: Record<string, string> = {};
  for (const r of all("SELECT key,value FROM translations WHERE lang='en' AND dialect=''")) out[r.key] = r.value;
  if (lang === 'ar') {
    for (const r of all("SELECT key,value FROM translations WHERE lang='ar' AND dialect=''")) out[r.key] = r.value;
    if (dialect && dialect !== 'msa') for (const r of all("SELECT key,value FROM translations WHERE lang='ar' AND dialect=?", dialect)) out[r.key] = r.value;
  }
  res.json(out);
}));

function me(uid: number) {
  const u = get('SELECT id,username,role,created_at FROM users WHERE id=?', uid);
  const p = get('SELECT * FROM player_profiles WHERE user_id=?', uid) || {};
  return {
    id: u.id, username: u.username, role: u.role, admin: permsOf(u.role).length > 0, perms: permsOf(u.role),
    profile: { display_name: p.display_name || u.username, country: p.country, region: p.region, lang: p.lang || 'ar', dialect: p.dialect || 'ae', character: J(p.character, null), points: p.points || 0, settings: J(p.settings, {}), playtime: p.playtime || 0 },
    achievements: all('SELECT achievement_id id, achieved_at FROM player_achievements WHERE user_id=?', uid),
    stats: Object.fromEntries(all('SELECT stat,value FROM player_stats WHERE user_id=?', uid).map((s) => [s.stat, s.value])),
  };
}
const USER_RE = /^[\p{L}\p{N}_]{3,20}$/u;
function cleanChar(c: any) {
  if (!c || typeof c !== 'object') return null;
  const keys = new Set(content().characters.map((x: any) => x.key));
  const col = (v: any, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const k = (v: any, d: string) => (keys.has(v) ? v : d);
  return { skin: col(c.skin, '#c68e5e'), hairColor: col(c.hairColor, '#2a1c12'), outfit: k(c.outfit, 'kandura_white'), head: k(c.head, 'head_none'), hair: k(c.hair, 'hair_short'), acc: k(c.acc, 'acc_none') };
}
function profileFields(b: any) {
  const c = content(); const out: any = {};
  if (b.display_name !== undefined) out.display_name = str(b.display_name, 2, 24, 'display_name');
  if (b.country !== undefined) out.country = c.countries.some((x: any) => x.key === b.country) ? b.country : null;
  if (b.region !== undefined) out.region = c.regions.some((x: any) => x.key === b.region) ? b.region : null;
  if (b.lang !== undefined) out.lang = b.lang === 'en' ? 'en' : 'ar';
  if (b.dialect !== undefined) out.dialect = c.dialects.some((x: any) => x.key === b.dialect) ? b.dialect : c.settings.default_dialect;
  if (b.character !== undefined) out.character = JSON.stringify(cleanChar(b.character));
  if (b.settings !== undefined) { const s = JSON.stringify(b.settings || {}); if (s.length > 2000) throw bad('invalid_settings'); out.settings = s; }
  return out;
}

api.post('/auth/register', wrap((req: any, res: any) => {
  if (!content().settings.registration_open) throw bad('registration_closed', 403);
  if (limited('reg:' + ip(req), 8, 3600)) throw bad('too_many_requests', 429);
  const b = req.body || {};
  const username = str(b.username, 3, 20, 'username');
  if (!USER_RE.test(username)) throw bad('invalid_username');
  const password = str(b.password, 6, 72, 'password');
  if (get('SELECT 1 x FROM users WHERE username=?', username)) throw bad('username_taken', 409);
  const f = profileFields({ display_name: b.display_name || username, country: b.country, region: b.region, lang: b.lang, dialect: b.dialect, character: b.character || {} });
  const uid = tx(() => {
    const r = run("INSERT INTO users(username,pass_hash,role,created_at,last_login) VALUES(?,?,'player',?,?)", username, hashPass(password), now(), now());
    const id = Number(r.lastInsertRowid);
    run('INSERT INTO player_profiles(user_id,display_name,country,region,lang,dialect,character) VALUES(?,?,?,?,?,?,?)', id, f.display_name, f.country ?? null, f.region ?? null, f.lang || 'ar', f.dialect || 'ae', f.character);
    return id;
  });
  res.json({ token: issueToken(uid), me: me(uid) });
}));
api.post('/auth/login', wrap((req: any, res: any) => {
  const b = req.body || {};
  const username = str(b.username, 1, 40, 'username'), password = str(b.password, 1, 72, 'password');
  if (limited('login:' + ip(req) + ':' + username.toLowerCase(), 10, 300)) throw bad('too_many_requests', 429);
  const u = get('SELECT * FROM users WHERE username=?', username);
  if (!u || !checkPass(password, u.pass_hash)) throw bad('bad_credentials', 401);
  if (u.banned) throw bad('banned', 403);
  run('UPDATE users SET last_login=? WHERE id=?', now(), u.id);
  res.json({ token: issueToken(u.id), me: me(u.id) });
}));
api.post('/auth/logout', auth, wrap((req: any, res: any) => { revokeToken(req.headers.authorization.slice(7)); res.json({ ok: true }); }));
api.get('/me', auth, wrap((req: any, res: any) => res.json(me(req.user.id))));
api.put('/profile', auth, wrap((req: any, res: any) => {
  const f = profileFields(req.body || {});
  const ks = Object.keys(f);
  if (ks.length) run(`UPDATE player_profiles SET ${ks.map((k) => k + '=?').join(',')} WHERE user_id=?`, ...ks.map((k) => f[k]), req.user.id);
  res.json(me(req.user.id));
}));
api.post('/auth/password', auth, wrap((req: any, res: any) => {
  const u = get('SELECT * FROM users WHERE id=?', req.user.id);
  if (!checkPass(str(req.body?.old, 1, 72, 'password'), u.pass_hash)) throw bad('bad_credentials', 401);
  run('UPDATE users SET pass_hash=? WHERE id=?', hashPass(str(req.body?.password, 6, 72, 'password')), u.id);
  res.json({ ok: true });
}));

// ---------- العوالم ----------
const SIZES: Record<string, number> = { small: 160, medium: 384, large: 1024 };
export function cleanSettings(s: any, c = content()) {
  s = s && typeof s === 'object' ? s : {};
  const npcs = Array.isArray(s.npcs) ? s.npcs.filter((n: any) => ['guide', 'elder', 'merchant', 'teacher'].includes(n)).slice(0, 4) : [];
  const size = oneOf(s.size, Object.keys(SIZES), 'medium');
  return {
    size, limit: SIZES[size], amp: Math.min(1.6, Math.max(0.4, Number(s.amp) || 1)),
    weather: oneOf(s.weather, ['dynamic', 'clear', 'rain', 'storm', 'fog', 'sandstorm'], 'dynamic'),
    start_time: Math.min(0.99, Math.max(0, Number(s.start_time) || 0.3)), fixed_time: !!s.fixed_time,
    ores: oneOf(String(s.ores), ['0.5', '1', '2'], '1'), structures: s.structures !== false,
    difficulty: oneOf(s.difficulty, ['peaceful', 'easy', 'normal', 'hard'], 'normal'), npcs,
    visitor_perm: oneOf(s.visitor_perm, ['build', 'view'], 'build'), temp: !!s.temp,
  };
}
export function worldView(w: any) {
  const o = get('SELECT COALESCE(p.display_name,u.username) n FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.id=?', w.owner_id);
  return { id: w.id, code: w.code, name: w.name, owner_id: w.owner_id, owner: o?.n || '—', country: w.country, region: w.region, environment: w.environment, mode: w.mode, max_players: w.max_players,
    cap: hub.capOf(w), is_public: !!w.is_public, featured: !!w.featured, join_policy: w.join_policy, online: hub.onlineCount(w.id), created_at: w.created_at, last_played: w.last_played, template: w.template };
}
export function createWorld(ownerId: number, b: any) {
  const c = content();
  const name = str(b.name, 2, 40, 'name');
  let env = '', country: string | null = null, region: string | null = null, tplSettings: any = {}, tplMode = 'creative';
  if (b.template) { const t = c.templates.find((x: any) => x.key === b.template); if (!t) throw bad('invalid_template'); env = t.environment; country = t.country; region = t.region; tplSettings = t.settings; tplMode = t.mode; }
  if (b.region) { const r = c.regions.find((x: any) => x.key === b.region); if (!r) throw bad('invalid_region'); region = r.key; country = r.country_key; env = r.environment_key; }
  if (b.environment && c.envs[b.environment]) env = b.environment;
  if (!c.envs[env]) throw bad('invalid_environment');
  const mode = oneOf(b.mode, Object.keys(c.settings.mode_rules), tplMode);
  const max = int(b.max_players ?? 8, 1, c.settings.max_players_limit, 'max_players');
  const settings: any = cleanSettings({ ...tplSettings, ...(b.settings || {}) }, c);
  const seed = Number.isInteger(b.seed) ? b.seed | 0 : randomInt(1, 2147483647);
  const gen = makeGen(seed, c.envs[env].params, c.blockIds, { amp: settings.amp, ores: Number(settings.ores), structures: settings.structures, prefabs: c.prefabs });
  settings.spawn = gen.findSpawn();
  let code = '';
  for (let i = 0; i < 50; i++) { code = `${country || 'ARW'}-${region || 'WLD'}-${String(randomInt(0, 100000)).padStart(5, '0')}`; if (!get('SELECT 1 x FROM worlds WHERE code=?', code)) break; code = ''; }
  if (!code) throw bad('code_generation_failed', 500);
  return tx(() => {
    const r = run('INSERT INTO worlds(code,name,owner_id,country,region,environment,mode,max_players,is_public,join_policy,seed,template,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      code, name, ownerId, country, region, env, mode, max, b.is_public ? 1 : 0, oneOf(b.join_policy, ['open', 'closed'], 'open'), seed, b.template || null, now(), now());
    const id = Number(r.lastInsertRowid);
    run('INSERT INTO world_settings(world_id,data) VALUES(?,?)', id, JSON.stringify(settings));
    run("INSERT INTO world_members(world_id,user_id,role,joined_at) VALUES(?,?,'owner',?)", id, ownerId, now());
    return id;
  });
}
const ownWorld = (req: any) => {
  const w = get('SELECT * FROM worlds WHERE id=?', int(req.params.id, 1, 1e12, 'id'));
  if (!w) throw bad('not_found', 404);
  if (w.owner_id !== req.user.id && !permsOf(req.user.role).includes('worlds.manage')) throw bad('forbidden', 403);
  return w;
};

api.get('/rooms/status', auth, wrap((_q: any, res: any) => res.json(hub.status())));
api.get('/worlds', auth, wrap((req: any, res: any) => {
  const mine = all('SELECT * FROM worlds WHERE owner_id=? ORDER BY COALESCE(last_played,created_at) DESC', req.user.id).map(worldView);
  const joined = all("SELECT w.* FROM worlds w JOIN world_members m ON m.world_id=w.id WHERE m.user_id=? AND w.owner_id<>? AND m.banned=0 ORDER BY m.last_seen DESC LIMIT 30", req.user.id, req.user.id).map(worldView);
  const pub = all('SELECT * FROM worlds WHERE is_public=1 ORDER BY featured DESC, COALESCE(last_played,created_at) DESC LIMIT 24').map(worldView);
  res.json({ mine, joined, public: pub });
}));
api.post('/worlds', auth, wrap((req: any, res: any) => {
  const c = content();
  if (get('SELECT COUNT(*) n FROM worlds WHERE owner_id=?', req.user.id).n >= c.settings.max_worlds_per_player) throw bad('world_limit', 403);
  if (limited('mkworld:' + req.user.id, 10, 600)) throw bad('too_many_requests', 429);
  const id = createWorld(req.user.id, req.body || {});
  addStat(req.user.id, 'worlds_created', 1);
  res.json(worldView(get('SELECT * FROM worlds WHERE id=?', id)));
}));
api.get('/worlds/lookup/:code', auth, wrap((req: any, res: any) => {
  if (limited('lookup:' + req.user.id, 30, 300)) throw bad('too_many_requests', 429);
  const code = String(req.params.code).trim().toUpperCase().slice(0, 24);
  const w = get('SELECT * FROM worlds WHERE code=?', code);
  if (!w) throw bad('world_not_found', 404);
  const m = get('SELECT role,banned FROM world_members WHERE world_id=? AND user_id=?', w.id, req.user.id);
  const v: any = worldView(w);
  v.can_join = !(m?.banned) && (w.owner_id === req.user.id || !!m || w.join_policy === 'open') && (v.online < v.cap || hub.isOnline(w.id, req.user.id));
  v.rooms = hub.status(); v.needs_room = !hub.room(w.id);
  v.reason = m?.banned ? 'banned' : !v.can_join ? (v.online >= v.cap ? 'full' : 'closed') : null;
  res.json(v);
}));
api.get('/worlds/:id', auth, wrap((req: any, res: any) => { const w = ownWorld(req); res.json({ ...worldView(w), settings: J(get('SELECT data FROM world_settings WHERE world_id=?', w.id)?.data, {}) }); }));
api.patch('/worlds/:id', auth, wrap((req: any, res: any) => {
  const w = ownWorld(req), b = req.body || {}, c = content();
  const name = b.name !== undefined ? str(b.name, 2, 40, 'name') : w.name;
  const max = b.max_players !== undefined ? int(b.max_players, 1, c.settings.max_players_limit, 'max_players') : w.max_players;
  const mode = b.mode !== undefined ? oneOf(b.mode, Object.keys(c.settings.mode_rules), w.mode) : w.mode;
  run('UPDATE worlds SET name=?,max_players=?,mode=?,is_public=?,join_policy=?,updated_at=? WHERE id=?', name, max, mode,
    b.is_public !== undefined ? (b.is_public ? 1 : 0) : w.is_public, b.join_policy !== undefined ? oneOf(b.join_policy, ['open', 'closed'], 'open') : w.join_policy, now(), w.id);
  if (b.settings) {
    const old = J(get('SELECT data FROM world_settings WHERE world_id=?', w.id)?.data, {});
    const s: any = cleanSettings({ ...old, ...b.settings }, c);
    s.spawn = old.spawn; s.amp = old.amp; s.ores = old.ores; s.structures = old.structures; // لا تُغيَّر خصائص التوليد بعد الإنشاء
    run('UPDATE world_settings SET data=? WHERE world_id=?', JSON.stringify(s), w.id);
  }
  hub.reloadWorld(w.id);
  res.json(worldView(get('SELECT * FROM worlds WHERE id=?', w.id)));
}));
api.delete('/worlds/:id', auth, wrap((req: any, res: any) => { const w = ownWorld(req); hub.closeRoom(w.id, 'world_deleted'); run('DELETE FROM worlds WHERE id=?', w.id); res.json({ ok: true }); }));
api.post('/worlds/:id/clone', auth, wrap((req: any, res: any) => {
  const w = ownWorld(req);
  hub.flush(w.id);
  const s = J(get('SELECT data FROM world_settings WHERE world_id=?', w.id)?.data, {});
  const id = createWorld(req.user.id, { name: str(req.body?.name || w.name + ' ②', 2, 40, 'name'), environment: w.environment, mode: w.mode, max_players: w.max_players, settings: s, seed: w.seed });
  run('UPDATE worlds SET country=?,region=?,template=? WHERE id=?', w.country, w.region, w.template, id);
  run('INSERT INTO world_chunks(world_id,cx,cz,data,updated_at) SELECT ?,cx,cz,data,? FROM world_chunks WHERE world_id=?', id, now(), w.id);
  res.json(worldView(get('SELECT * FROM worlds WHERE id=?', id)));
}));
export function backupWorld(wid: number, note: string) {
  hub.flush(wid);
  const chunks = all('SELECT cx,cz,data FROM world_chunks WHERE world_id=?', wid);
  run('INSERT INTO world_backups(world_id,created_at,note,data) VALUES(?,?,?,?)', wid, now(), note, JSON.stringify(chunks));
  const old = all('SELECT id FROM world_backups WHERE world_id=? ORDER BY id DESC LIMIT -1 OFFSET 8', wid);
  for (const o of old) run('DELETE FROM world_backups WHERE id=?', o.id);
}
api.get('/worlds/:id/backups', auth, wrap((req: any, res: any) => { const w = ownWorld(req); res.json(all('SELECT id,created_at,note,LENGTH(data) size FROM world_backups WHERE world_id=? ORDER BY id DESC', w.id)); }));
api.post('/worlds/:id/backups', auth, wrap((req: any, res: any) => { const w = ownWorld(req); backupWorld(w.id, String(req.body?.note || 'manual').slice(0, 60)); res.json({ ok: true }); }));
api.post('/worlds/:id/restore/:bid', auth, wrap((req: any, res: any) => {
  const w = ownWorld(req);
  const b = get('SELECT * FROM world_backups WHERE id=? AND world_id=?', int(req.params.bid, 1, 1e12, 'id'), w.id);
  if (!b) throw bad('not_found', 404);
  hub.closeRoom(w.id, 'world_restored');
  tx(() => {
    run('DELETE FROM world_chunks WHERE world_id=?', w.id);
    for (const c of J(b.data, [])) run('INSERT INTO world_chunks(world_id,cx,cz,data,updated_at) VALUES(?,?,?,?,?)', w.id, c.cx, c.cz, c.data, now());
  });
  res.json({ ok: true });
}));
api.get('/worlds/:id/members', auth, wrap((req: any, res: any) => {
  const w = ownWorld(req);
  res.json(all('SELECT m.user_id id, COALESCE(p.display_name,u.username) name, m.role, m.banned, m.last_seen FROM world_members m JOIN users u ON u.id=m.user_id LEFT JOIN player_profiles p ON p.user_id=u.id WHERE m.world_id=?', w.id)
    .map((m) => ({ ...m, online: hub.isOnline(w.id, m.id) })));
}));
api.patch('/worlds/:id/members/:uid', auth, wrap((req: any, res: any) => {
  const w = ownWorld(req), uid = int(req.params.uid, 1, 1e12, 'uid');
  if (uid === w.owner_id) throw bad('forbidden', 403);
  const b = req.body || {};
  if (b.role !== undefined) run('UPDATE world_members SET role=? WHERE world_id=? AND user_id=?', oneOf(b.role, ['builder', 'visitor'], 'visitor'), w.id, uid);
  if (b.banned !== undefined) { run('UPDATE world_members SET banned=? WHERE world_id=? AND user_id=?', b.banned ? 1 : 0, w.id, uid); if (b.banned) hub.kick(w.id, uid, 'banned'); }
  hub.memberChanged(w.id, uid);
  res.json({ ok: true });
}));
