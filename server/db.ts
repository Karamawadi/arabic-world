// قاعدة البيانات (SQLite المدمجة في Node). كل الجداول المطلوبة معرّفة هنا.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const DATA_DIR = resolve(process.env.DATA_DIR || './data');
mkdirSync(resolve(DATA_DIR, 'uploads'), { recursive: true });
export const db = new DatabaseSync(resolve(DATA_DIR, 'game.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;');

export const all = (sql: string, ...a: any[]): any[] => db.prepare(sql).all(...a) as any[];
export const get = (sql: string, ...a: any[]): any => db.prepare(sql).get(...a) as any;
export const run = (sql: string, ...a: any[]) => db.prepare(sql).run(...a);
export const now = () => Math.floor(Date.now() / 1000);
export const J = (s: any, d: any = null) => { if (s == null || s === '') return d; try { return JSON.parse(s); } catch { return d; } };
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, email TEXT, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player', banned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_login INTEGER);
CREATE TABLE IF NOT EXISTS auth_tokens(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS player_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, display_name TEXT, country TEXT, region TEXT,
  lang TEXT DEFAULT 'ar', dialect TEXT DEFAULT 'ae', character TEXT, points INTEGER DEFAULT 0, settings TEXT, playtime INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS player_stats(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, stat TEXT, value REAL DEFAULT 0, PRIMARY KEY(user_id, stat));
CREATE TABLE IF NOT EXISTS player_coplay(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, other_id INTEGER, PRIMARY KEY(user_id, other_id));
CREATE TABLE IF NOT EXISTS worlds(id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  country TEXT, region TEXT, environment TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'creative', max_players INTEGER DEFAULT 8, is_public INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0, join_policy TEXT DEFAULT 'open', seed INTEGER NOT NULL, template TEXT, created_at INTEGER, updated_at INTEGER, last_played INTEGER);
CREATE TABLE IF NOT EXISTS world_settings(world_id INTEGER PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS world_members(world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'visitor', banned INTEGER DEFAULT 0, last_pos TEXT, joined_at INTEGER, last_seen INTEGER, PRIMARY KEY(world_id, user_id));
CREATE TABLE IF NOT EXISTS world_chunks(world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE, cx INTEGER, cz INTEGER, data TEXT NOT NULL, updated_at INTEGER, PRIMARY KEY(world_id, cx, cz));
CREATE TABLE IF NOT EXISTS world_backups(id INTEGER PRIMARY KEY, world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE, created_at INTEGER, note TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blocks(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, category TEXT DEFAULT 'building', tex TEXT,
  shape TEXT DEFAULT 'cube', solid INTEGER DEFAULT 1, opaque INTEGER DEFAULT 1, hardness REAL DEFAULT 1, tool TEXT, min_tier INTEGER DEFAULT 0,
  drop_key TEXT, drop_n INTEGER DEFAULT 1, drop_chance REAL DEFAULT 1, emissive INTEGER DEFAULT 0, rot_group TEXT, toggle TEXT, recipe TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, category TEXT DEFAULT 'material', icon TEXT,
  tool TEXT, tier INTEGER DEFAULT 0, power REAL DEFAULT 0, food REAL DEFAULT 0, vehicle TEXT, stack INTEGER DEFAULT 64, recipe TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS inventories(world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  slots TEXT, health REAL DEFAULT 20, hunger REAL DEFAULT 20, selected INTEGER DEFAULT 0, updated_at INTEGER, PRIMARY KEY(world_id, user_id));
CREATE TABLE IF NOT EXISTS characters(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, slot TEXT NOT NULL, kind TEXT NOT NULL, colors TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS environments(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, desc_ar TEXT, desc_en TEXT, params TEXT, sky TEXT, weather TEXT, animals TEXT, ambient TEXT DEFAULT 'desert', enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS structures(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, w INTEGER DEFAULT 5, d INTEGER DEFAULT 5, site TEXT DEFAULT 'land', ops TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS countries(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, flag TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS regions(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, country_key TEXT NOT NULL, name_ar TEXT, name_en TEXT, desc_ar TEXT, desc_en TEXT, environment_key TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS dialects(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, is_default INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS translations(id INTEGER PRIMARY KEY, key TEXT NOT NULL, lang TEXT NOT NULL, dialect TEXT NOT NULL DEFAULT '', value TEXT NOT NULL, UNIQUE(key, lang, dialect));
CREATE TABLE IF NOT EXISTS achievements(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, title_ar TEXT, title_en TEXT, desc_ar TEXT, desc_en TEXT, icon TEXT, stat TEXT NOT NULL, threshold REAL DEFAULT 1,
  points INTEGER DEFAULT 10, reward_items TEXT, sound_key TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS player_achievements(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE, world_id INTEGER, achieved_at INTEGER, PRIMARY KEY(user_id, achievement_id));
CREATE TABLE IF NOT EXISTS missions(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, title_ar TEXT, title_en TEXT, desc_ar TEXT, desc_en TEXT, type TEXT NOT NULL, target TEXT, count INTEGER DEFAULT 1,
  modes TEXT, npc TEXT, time_limit INTEGER DEFAULT 0, points INTEGER DEFAULT 10, reward_items TEXT, quiz TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS player_missions(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE, world_id INTEGER, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'active', started_at INTEGER, done_at INTEGER, PRIMARY KEY(user_id, mission_id, world_id));
CREATE TABLE IF NOT EXISTS sounds(id INTEGER PRIMARY KEY, key TEXT NOT NULL, name TEXT, category TEXT DEFAULT 'effect', file TEXT NOT NULL, mime TEXT, size INTEGER, volume REAL DEFAULT 1, approved INTEGER DEFAULT 0, created_at INTEGER);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE, user_id INTEGER, username TEXT, text TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS game_sessions(id INTEGER PRIMARY KEY, world_id INTEGER, user_id INTEGER, mode TEXT, region TEXT, started_at INTEGER, ended_at INTEGER, duration INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS admin_roles(key TEXT PRIMARY KEY, name_ar TEXT, name_en TEXT, permissions TEXT, system INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS world_templates(id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name_ar TEXT, name_en TEXT, desc_ar TEXT, desc_en TEXT, country TEXT, region TEXT, environment TEXT, mode TEXT DEFAULT 'creative', settings TEXT, enabled INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS room_sessions(id INTEGER PRIMARY KEY, room_no INTEGER, world_id INTEGER, started_at INTEGER, ended_at INTEGER, reason TEXT, peak_players INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, detail TEXT, created_at INTEGER);
CREATE INDEX IF NOT EXISTS i_msg ON messages(world_id, id);
CREATE INDEX IF NOT EXISTS i_sess ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS i_worlds_owner ON worlds(owner_id);
`);

export function setting(key: string, d: any = null) { const r = get('SELECT value FROM settings WHERE key=?', key); return r ? J(r.value, d) : d; }
export function addStat(uid: number, stat: string, n = 1): number {
  run('INSERT INTO player_stats(user_id,stat,value) VALUES(?,?,?) ON CONFLICT(user_id,stat) DO UPDATE SET value=value+excluded.value', uid, stat, n);
  return get('SELECT value FROM player_stats WHERE user_id=? AND stat=?', uid, stat).value;
}
export function maxStat(uid: number, stat: string, v: number): number {
  run('INSERT INTO player_stats(user_id,stat,value) VALUES(?,?,?) ON CONFLICT(user_id,stat) DO UPDATE SET value=MAX(value,excluded.value)', uid, stat, v);
  return get('SELECT value FROM player_stats WHERE user_id=? AND stat=?', uid, stat).value;
}
