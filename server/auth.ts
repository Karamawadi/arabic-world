// المصادقة: كلمات مرور scrypt، رموز جلسات عشوائية مخزنة مجزأة، وصلاحيات RBAC
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { all, get, run, now, J, DATA_DIR } from './db.ts';

export function hashPass(p: string) { const salt = randomBytes(16); return salt.toString('hex') + ':' + scryptSync(p, salt, 32).toString('hex'); }
export function checkPass(p: string, stored: string) {
  const [s, h] = String(stored).split(':'); if (!s || !h) return false;
  const a = scryptSync(p, Buffer.from(s, 'hex'), 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
export function issueToken(uid: number) {
  const t = randomBytes(32).toString('base64url');
  run('INSERT INTO auth_tokens(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)', sha(t), uid, now(), now() + 30 * 86400);
  return t;
}
export function revokeToken(t: string) { run('DELETE FROM auth_tokens WHERE token_hash=?', sha(t)); }
export function userFromToken(t?: string | null) {
  if (!t || typeof t !== 'string' || t.length > 100) return null;
  const r = get('SELECT u.id,u.username,u.role,u.banned FROM auth_tokens a JOIN users u ON u.id=a.user_id WHERE a.token_hash=? AND a.expires_at>?', sha(t), now());
  if (!r || r.banned) return null;
  return r as { id: number; username: string; role: string; banned: number };
}
export function permsOf(role: string): string[] { const r = get('SELECT permissions FROM admin_roles WHERE key=?', role); return r ? J(r.permissions, []) : []; }
export const can = (role: string, perm: string) => permsOf(role).includes(perm);

export function auth(req: any, res: any, next: any) {
  const h = req.headers.authorization || '';
  const u = userFromToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  req.user = u; next();
}
export const requirePerm = (perm: string) => (req: any, res: any, next: any) => {
  auth(req, res, () => { if (!can(req.user.role, perm)) return res.status(403).json({ error: 'forbidden' }); next(); });
};
export const requireAnyAdmin = (req: any, res: any, next: any) => auth(req, res, () => { if (!permsOf(req.user.role).length) return res.status(403).json({ error: 'forbidden' }); next(); });

// محدِّد معدل بسيط في الذاكرة
const buckets = new Map<string, { n: number; t: number }>();
export function limited(key: string, max: number, windowSec: number) {
  const t = now(), b = buckets.get(key);
  if (!b || t - b.t > windowSec) { buckets.set(key, { n: 1, t }); return false; }
  b.n++; return b.n > max;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t - b.t > 3600) buckets.delete(k); }, 600000).unref();

export function bootstrapAdmin() {
  if (get("SELECT 1 x FROM users u JOIN admin_roles r ON r.key=u.role WHERE r.key='admin'")) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');
  const ex = get('SELECT id FROM users WHERE username=?', username);
  if (ex) run("UPDATE users SET role='admin', pass_hash=? WHERE id=?", hashPass(password), ex.id);
  else {
    const r = run("INSERT INTO users(username,pass_hash,role,created_at) VALUES(?,?,'admin',?)", username, hashPass(password), now());
    run("INSERT INTO player_profiles(user_id,display_name) VALUES(?,?)", Number(r.lastInsertRowid), username);
  }
  if (!process.env.ADMIN_PASSWORD) {
    const f = resolve(DATA_DIR, 'admin-credentials.txt');
    writeFileSync(f, `username: ${username}\npassword: ${password}\n`, { mode: 0o600 });
    console.log(`[admin] تم إنشاء حساب المدير الأول. بيانات الدخول محفوظة في: ${f}`);
  }
  void all;
}
