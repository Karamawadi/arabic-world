// واجهة اللاعبين /play : الحساب، الرئيسية، إنشاء العوالم، الانضمام بالكود، الشخصية، الإعدادات
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Api, ApiError, makeT, isTouch, type TFn } from '../common/api';
import { DEFAULT_SETTINGS, type Settings } from '../engine/game';
import { makeAvatar, DEFAULT_CHAR } from '../engine/avatar';
import { audio } from '../engine/audio';
import { GameView } from './GameView';

export const api = new Api('aw_token');
export interface Ctx { t: TFn; lang: string; content: any; me: any; setMe: (m: any) => void; settings: Settings; saveSettings: (s: Settings) => void; nm: (d: any) => string; ds: (d: any) => string; go: (s: string, arg?: any) => void; reloadI18n: (lang: string, dialect: string) => Promise<void> }
const errText = (t: TFn, e: any) => { const c = e instanceof ApiError ? e.code : 'server_error'; const s = t('err.' + c); return s === 'err.' + c ? t('err.generic') : s; };
const loadSettings = (): Settings => { try { return { ...DEFAULT_SETTINGS(isTouch()), ...JSON.parse(localStorage.getItem('aw_settings') || '{}') }; } catch { return DEFAULT_SETTINGS(isTouch()); } };
const click = () => { audio.unlock(); audio.play('ui_click'); };

export function App() {
  const [content, setContent] = useState<any>(null);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [lang, setLang] = useState(localStorage.getItem('aw_lang') || 'ar');
  const [me, setMe] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [fail, setFail] = useState(false);
  const [screen, setScreen] = useState<{ s: string; arg?: any }>({ s: 'home' });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const t = useMemo(() => makeT(dict), [dict]);
  const reloadI18n = async (l: string, d: string) => { setDict(await api.get(`/i18n?lang=${l}&dialect=${d}`)); setLang(l); localStorage.setItem('aw_lang', l); };
  useEffect(() => {
    (async () => {
      try {
        const c = await api.get('/content'); setContent(c);
        let m: any = null;
        if (api.token) try { m = await api.get('/me'); } catch { api.setToken(null); }
        setMe(m);
        await reloadI18n(m?.profile.lang || lang, m?.profile.dialect || c.settings.default_dialect);
        const j = new URLSearchParams(location.search).get('join'); if (j) setScreen({ s: 'join', arg: j });
        setReady(true);
      } catch { setFail(true); }
    })();
  }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  if (fail) return <div className="auth"><div className="panel"><h2>⚠️</h2><p>تعذر الاتصال بالخادم. حاول مجدداً.<br />Could not reach the server.</p><button className="btn" onClick={() => location.reload()}>↻</button></div></div>;
  if (!ready) return <div className="auth"><div className="spin" /></div>;
  const saveSettings = (s: Settings) => { setSettings(s); localStorage.setItem('aw_settings', JSON.stringify(s)); };
  const ctx: Ctx = { t, lang, content, me, setMe, settings, saveSettings, reloadI18n, go: (s, arg) => { click(); setScreen({ s, arg }); window.scrollTo(0, 0); },
    nm: (d) => (d ? (lang === 'en' ? d.name_en : d.name_ar) || d.key : ''), ds: (d) => (d ? (lang === 'en' ? d.desc_en : d.desc_ar) || '' : '') };
  if (!me) return <Auth c={ctx} />;
  if (screen.s === 'game') return <GameView key={screen.arg + ':' + (screen as any).n} c={ctx} code={screen.arg} onAgain={() => setScreen({ s: 'game', arg: screen.arg, n: Date.now() } as any)} onExit={async () => { try { setMe(await api.get('/me')); } catch { /* */ } setScreen({ s: 'home' }); }} />;
  return (
    <div className="app">
      <div className="top">
        <button className="logo" style={{ color: '#fff' }} onClick={() => ctx.go('home')}><i />{t('app.name')}</button>
        <div className="sp" />
        <span className="chip">⭐ {me.profile.points}</span>
        <button className="chip" onClick={() => ctx.go('profile')}>🏅 {t('nav.achievements')}</button>
        <button className="chip" onClick={() => ctx.go('character')}>🧑 {me.profile.display_name}</button>
        <button className="chip" onClick={() => ctx.go('settings')}>⚙️ {t('nav.settings')}</button>
        {me.admin && <a className="chip" href="/admin" style={{ textDecoration: 'none' }}>🛠️ {t('nav.admin')}</a>}
        <button className="chip" onClick={async () => { try { await api.post('/auth/logout'); } catch { /* */ } api.setToken(null); setMe(null); }}>⎋ {t('nav.logout')}</button>
      </div>
      <div className="wrap">
        {screen.s === 'home' && <Home c={ctx} />}
        {screen.s === 'create' && <Create c={ctx} tpl={screen.arg} />}
        {screen.s === 'join' && <Join c={ctx} code={screen.arg} />}
        {screen.s === 'character' && <Character c={ctx} />}
        {screen.s === 'settings' && <SettingsScreen c={ctx} />}
        {screen.s === 'profile' && <Profile c={ctx} />}
      </div>
    </div>
  );
}

function GeoFields({ c, v, set }: { c: Ctx; v: any; set: (p: any) => void }) {
  const regs = c.content.regions.filter((r: any) => r.country_key === v.country);
  return <div className="two">
    <label>{c.t('auth.country')}<select className="in" value={v.country || ''} onChange={(e) => set({ country: e.target.value, region: '' })}><option value="">—</option>{c.content.countries.map((x: any) => <option key={x.key} value={x.key}>{x.flag} {c.nm(x)}</option>)}</select></label>
    <label>{c.t('auth.region')}<select className="in" value={v.region || ''} onChange={(e) => set({ region: e.target.value })}><option value="">—</option>{regs.map((x: any) => <option key={x.key} value={x.key}>{c.nm(x)}</option>)}</select></label>
  </div>;
}

function Auth({ c }: { c: Ctx }) {
  const { t } = c;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const def = c.content.dialects.find((d: any) => d.is_default)?.key || 'ae';
  const [f, setF] = useState<any>({ username: '', password: '', display_name: '', dialect: def, country: 'UAE', region: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (p: any) => setF((o: any) => ({ ...o, ...p }));
  const submit = async (e: any) => {
    e.preventDefault(); setErr(''); setBusy(true); click();
    try {
      const r = mode === 'login' ? await api.post('/auth/login', { username: f.username, password: f.password }) : await api.post('/auth/register', { ...f, lang: c.lang, character: DEFAULT_CHAR });
      api.setToken(r.token); await c.reloadI18n(r.me.profile.lang, r.me.profile.dialect); c.setMe(r.me);
    } catch (x) { setErr(errText(t, x)); }
    setBusy(false);
  };
  return <div className="app"><div className="top"><div className="logo"><i />{t('app.name')}</div><div className="sp" />
    <button className="chip" onClick={() => c.reloadI18n(c.lang === 'ar' ? 'en' : 'ar', f.dialect)}>🌐 {c.lang === 'ar' ? 'English' : 'العربية'}</button></div>
    <div className="auth"><form className="panel form" onSubmit={submit}>
      <div><h2 style={{ marginBottom: 4 }}>{t('auth.title')}</h2><div style={{ color: 'var(--mute)' }}>{t('auth.subtitle')}</div></div>
      <div className="tabs"><button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>{t('auth.login')}</button><button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>{t('auth.register')}</button></div>
      <label>{t('auth.username')}<input className="in" value={f.username} onChange={(e) => set({ username: e.target.value })} autoComplete="username" required minLength={3} maxLength={20} dir="auto" /></label>
      <label>{t('auth.password')}<input className="in" type="password" value={f.password} onChange={(e) => set({ password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} /></label>
      {mode === 'register' && <>
        <label>{t('auth.display_name')}<input className="in" value={f.display_name} onChange={(e) => set({ display_name: e.target.value })} maxLength={24} dir="auto" /></label>
        <label>{t('auth.dialect')}<select className="in" value={f.dialect} onChange={(e) => { set({ dialect: e.target.value }); c.reloadI18n(c.lang, e.target.value); }}>{c.content.dialects.map((d: any) => <option key={d.key} value={d.key}>{c.nm(d)}</option>)}</select></label>
        <GeoFields c={c} v={f} set={set} />
      </>}
      {err && <div className="err">{err}</div>}
      <button className="btn" disabled={busy}>{mode === 'login' ? t('auth.login') : t('auth.create_account')}</button>
    </form></div></div>;
}

// صورة مصغرة إجرائية للبيئة (تُرسم من إعدادات التضاريس الفعلية)
export function EnvThumb({ env, seed = 1 }: { env: any; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !env) return; const g = cv.getContext('2d')!, W = cv.width, H = cv.height, p = env.params || {};
    let s = seed * 9301 + 49297; const R = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, env.sky?.day || '#8cc4ea'); gr.addColorStop(1, env.sky?.horizon || '#f4e2c2'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,244,200,.95)'; g.beginPath(); g.arc(W * 0.78, H * 0.24, 15, 0, 7); g.fill();
    const col: Record<string, string> = { sand: '#e8cf95', red_sand: '#d98a55', grass: '#7fae4e', mountain_rock: '#6f6259', red_sandstone: '#c2714a', limestone: '#d7d0c0' };
    const ridge = (base: number, amp: number, c: string, f: number) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, H); let y = base; for (let x = 0; x <= W; x += 6) { y += (R() - 0.5) * amp; y = Math.max(base - amp * 2.2, Math.min(base + amp, y)); g.lineTo(x, y + Math.sin(x * f) * amp * 0.6); } g.lineTo(W, H); g.fill(); };
    if (p.mtAmp > 0) { ridge(H * 0.42, 14, col[p.rock || 'mountain_rock'] || '#6f6259', 0.05); ridge(H * 0.55, 9, 'rgba(0,0,0,.15)', 0.08); }
    if (p.city) { for (let x = 8; x < W; x += 14 + R() * 10) { const h = 30 + R() * 62, w = 9 + R() * 7; const gg = g.createLinearGradient(x, 0, x + w, 0); gg.addColorStop(0, '#8cc6e6'); gg.addColorStop(1, '#3d86b3'); g.fillStyle = gg; g.fillRect(x, H * 0.72 - h, w, h); g.fillStyle = '#9aa7b3'; g.fillRect(x + w / 2 - 1, H * 0.72 - h - 8, 2, 8); } }
    ridge(H * 0.7, p.duneAmp ? 5 : 2, col[p.surface || 'sand'] || '#e8cf95', 0.03);
    if (p.coast && p.coast !== 'none') { g.fillStyle = '#2f8fb8'; g.fillRect(0, H * 0.84, W, H); g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) g.fillRect(R() * W, H * 0.86 + R() * 14, 22, 2); }
    else ridge(H * 0.86, 3, 'rgba(0,0,0,.08)', 0.05);
    if ((p.trees || []).length) for (let i = 0; i < 4; i++) { const x = 14 + R() * (W - 28), y = H * 0.74 + R() * 8; g.fillStyle = '#6e5233'; g.fillRect(x, y - 20, 3, 20); g.fillStyle = '#3c7a2c'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x + 1.5 + k * 5, y - 20 + Math.abs(k) * 2.5, 6, 2.4, k * 0.4, 0, 7); g.fill(); } }
  }, [env, seed]);
  return <canvas ref={ref} className="thumb" width={320} height={180} />;
}

const MODE_ICON: Record<string, string> = { creative: '🎨', survival: '⛺', adventure: '🧭', challenge: '🏆', education: '🎓' };
function WorldCard({ c, w, onManage }: { c: Ctx; w: any; onManage?: () => void }) {
  const { t } = c; const env = c.content.envs[w.environment]; const reg = c.content.regions.find((r: any) => r.key === w.region);
  const [copied, setCopied] = useState(false);
  const share = async () => { click(); const url = `${location.origin}/play?join=${w.code}`; try { if (navigator.share) await navigator.share({ title: w.name, text: t('share.text', { name: w.name, code: w.code }), url }); else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } } catch { /* */ } };
  return <div className="card"><EnvThumb env={env} seed={w.id} /><div className="bd">
    <h3 dir="auto">{w.name}</h3>
    <div className="rowx" style={{ gap: 6 }}><span className="tag g">{MODE_ICON[w.mode]} {t('mode.' + w.mode)}</span><span className="tag">{reg ? c.nm(reg) : c.nm(env)}</span><span className="tag b">👥 {w.online}/{w.cap ?? w.max_players}</span></div>
    <p>{t('world.owner')}: <b dir="auto">{w.owner}</b> · <span className="code">{w.code}</span></p>
    <div className="row"><button className="btn sm teal" onClick={() => c.go('game', w.code)}>▶ {t('world.play')}</button><button className="btn sm light" onClick={share}>{copied ? '✓' : '🔗'} {t('world.invite')}</button>{onManage && <button className="btn sm light" onClick={() => { click(); onManage(); }}>⚙️</button>}</div>
  </div></div>;
}

function Home({ c }: { c: Ctx }) {
  const { t, me } = c; const [ws, setWs] = useState<any>(null); const [manage, setManage] = useState<any>(null);
  const [rs, setRs] = useState<any>(null);
  const load = () => { api.get('/rooms/status').then(setRs).catch(() => {}); return api.get('/worlds').then(setWs).catch(() => setWs({ mine: [], joined: [], public: [] })); };
  useEffect(() => { load(); const i = setInterval(() => api.get('/rooms/status').then(setRs).catch(() => {}), 15000); return () => clearInterval(i); }, []);
  const motd = c.lang === 'en' ? c.content.settings.motd_en : c.content.settings.motd_ar;
  return <>
    <div className="hero"><h1>{t('home.greeting', { name: me.profile.display_name })}</h1><p>{t('home.tagline')}</p>
      {motd && <div className="chip" style={{ marginTop: 10 }}>📢 {motd}</div>}
      {rs?.enabled && <div className="rowx" style={{ marginTop: 10 }}><span className="chip">🚪 {t('rooms.status', { busy: rs.busy, total: rs.total })}</span><span className="chip">👥 {t('rooms.capacity', { n: rs.capacity })}</span><span className="chip">⏳ {t('rooms.minutes', { n: rs.minutes })}</span>{rs.busy >= rs.total && <span className="chip" style={{ background: 'rgba(239,108,77,.75)' }}>{t('rooms.full', { time: Math.ceil(rs.next_free / 60) })}</span>}</div>}
      <div className="cta"><button className="btn" onClick={() => c.go('create')}>➕ {t('home.create')}</button><button className="btn teal" onClick={() => c.go('join')}>🔑 {t('home.join')}</button><button className="btn ghost" onClick={() => c.go('character')}>🧑‍🎨 {t('home.character')}</button></div></div>
    <h2 className="sec">🌟 {t('home.library')}</h2>
    <div className="grid">{c.content.templates.map((tp: any) => <button key={tp.key} className="card" onClick={() => c.go('create', tp.key)}><EnvThumb env={c.content.envs[tp.environment]} seed={tp.id + 40} /><div className="bd"><h3>{c.nm(tp)}</h3><p>{c.ds(tp)}</p><div className="row"><span className="tag g">{MODE_ICON[tp.mode]} {t('mode.' + tp.mode)}</span></div></div></button>)}</div>
    <h2 className="sec">🗺️ {t('home.my_worlds')}</h2>
    {!ws ? <div className="spin" /> : ws.mine.length ? <div className="grid">{ws.mine.map((w: any) => <WorldCard key={w.id} c={c} w={w} onManage={() => setManage(w)} />)}</div> : <div className="chip">{t('home.no_worlds')}</div>}
    {ws?.joined.length > 0 && <><h2 className="sec">🤝 {t('home.joined')}</h2><div className="grid">{ws.joined.map((w: any) => <WorldCard key={w.id} c={c} w={w} />)}</div></>}
    {ws?.public.length > 0 && <><h2 className="sec">🌍 {t('home.public')}</h2><div className="grid">{ws.public.map((w: any) => <WorldCard key={w.id} c={c} w={w} />)}</div></>}
    {manage && <ManageWorld c={c} w={manage} close={() => { setManage(null); load(); }} />}
  </>;
}

function ManageWorld({ c, w, close }: { c: Ctx; w: any; close: () => void }) {
  const { t } = c; const [f, setF] = useState<any>(null); const [backups, setBackups] = useState<any[]>([]); const [members, setMembers] = useState<any[]>([]); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const load = async () => { const d = await api.get('/worlds/' + w.id); setF({ name: d.name, max_players: d.max_players, is_public: d.is_public, join_policy: d.join_policy, visitor_perm: d.settings.visitor_perm, weather: d.settings.weather, difficulty: d.settings.difficulty }); setBackups(await api.get(`/worlds/${w.id}/backups`)); setMembers(await api.get(`/worlds/${w.id}/members`)); };
  useEffect(() => { load().catch((e) => setErr(errText(t, e))); }, []);
  const run = async (fn: () => Promise<any>, ok = t('ui.saved')) => { setErr(''); setMsg(''); click(); try { await fn(); setMsg(ok); await load(); } catch (e) { setErr(errText(t, e)); } };
  if (!f) return <div className="modal"><div className="spin" /></div>;
  const set = (p: any) => setF((o: any) => ({ ...o, ...p }));
  return <div className="modal" onClick={(e) => e.target === e.currentTarget && close()}><div className="panel form">
    <div className="rowx"><h2 style={{ margin: 0, flex: 1 }}>⚙️ {t('manage.title')}</h2><span className="code tag b">{w.code}</span><button className="btn sm light" onClick={close}>✕</button></div>
    <label>{t('create.name')}<input className="in" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} dir="auto" /></label>
    <div className="two">
      <label>{t('create.max_players')}: {f.max_players}<input type="range" min={1} max={c.content.settings.max_players_limit} value={f.max_players} onChange={(e) => set({ max_players: +e.target.value })} /></label>
      <label>{t('create.visitor_perm')}<select className="in" value={f.visitor_perm} onChange={(e) => set({ visitor_perm: e.target.value })}><option value="build">{t('perm.build')}</option><option value="view">{t('perm.view')}</option></select></label>
      <label>{t('create.join_policy')}<select className="in" value={f.join_policy} onChange={(e) => set({ join_policy: e.target.value })}><option value="open">{t('policy.open')}</option><option value="closed">{t('policy.closed')}</option></select></label>
      <label>{t('create.public')}<select className="in" value={f.is_public ? '1' : '0'} onChange={(e) => set({ is_public: e.target.value === '1' })}><option value="0">{t('ui.no')}</option><option value="1">{t('ui.yes')}</option></select></label>
    </div>
    <div className="rowx"><button className="btn sm teal" onClick={() => run(() => api.patch('/worlds/' + w.id, { name: f.name, max_players: f.max_players, is_public: f.is_public, join_policy: f.join_policy, settings: { visitor_perm: f.visitor_perm } }))}>💾 {t('ui.save')}</button>
      <button className="btn sm light" onClick={() => run(() => api.post(`/worlds/${w.id}/clone`, {}), t('manage.cloned'))}>🧬 {t('manage.clone')}</button>
      <button className="btn sm light" onClick={() => run(() => api.post(`/worlds/${w.id}/backups`, { note: 'manual' }), t('manage.backup_done'))}>🗄️ {t('manage.backup')}</button>
      <button className="btn sm coral" onClick={() => { if (confirm(t('manage.delete_confirm'))) run(() => api.del('/worlds/' + w.id)).then(close); }}>🗑️ {t('ui.delete')}</button></div>
    {msg && <div className="okmsg">{msg}</div>}{err && <div className="err">{err}</div>}
    {backups.length > 0 && <div><b>{t('manage.backups')}</b><div className="list" style={{ marginTop: 6 }}>{backups.map((b) => <div className="li" key={b.id}><span style={{ flex: 1 }}>{new Date(b.created_at * 1000).toLocaleString(c.lang === 'ar' ? 'ar' : 'en')} · {b.note} · {(b.size / 1024).toFixed(1)}KB</span><button className="btn sm light" onClick={() => { if (confirm(t('manage.restore_confirm'))) run(() => api.post(`/worlds/${w.id}/restore/${b.id}`), t('manage.restored')); }}>↩ {t('manage.restore')}</button></div>)}</div></div>}
    <div><b>{t('manage.members')}</b><div className="list" style={{ marginTop: 6 }}>{members.map((m) => <div className="li" key={m.id}><span style={{ flex: 1 }} dir="auto">{m.online ? '🟢' : '⚪'} {m.name}</span>
      {m.role === 'owner' ? <span className="tag g">{t('role.owner')}</span> : <>
        <select className="in" style={{ width: 'auto', padding: '4px 8px' }} value={m.role} onChange={(e) => run(() => api.patch(`/worlds/${w.id}/members/${m.id}`, { role: e.target.value }))}><option value="visitor">{t('role.visitor')}</option><option value="builder">{t('role.builder')}</option></select>
        <button className="btn sm light" onClick={() => run(() => api.patch(`/worlds/${w.id}/members/${m.id}`, { banned: !m.banned }))}>{m.banned ? '✅ ' + t('manage.unban') : '🚫 ' + t('manage.ban')}</button></>}</div>)}</div></div>
  </div></div>;
}

function Create({ c, tpl }: { c: Ctx; tpl?: string }) {
  const { t } = c; const tp = c.content.templates.find((x: any) => x.key === tpl);
  const [f, setF] = useState<any>({ name: tp ? c.nm(tp) : '', template: tpl || '', country: tp ? '' : c.me.profile.country || 'UAE', region: tp ? '' : c.me.profile.region || '', mode: tp?.mode || 'creative', max_players: Math.min(8, c.content.settings.room_system_enabled !== false ? c.content.settings.room_capacity : 99, c.content.settings.max_players_limit), is_public: false, join_policy: 'open',
    settings: { size: 'medium', amp: 1, weather: 'dynamic', start_time: 0.3, fixed_time: false, ores: '1', structures: true, difficulty: 'normal', npcs: tp?.settings?.npcs || ['guide'], visitor_perm: 'build', temp: false } });
  const capMax = Math.min(c.content.settings.max_players_limit, c.content.settings.room_system_enabled !== false ? c.content.settings.room_capacity : 99);
  const [adv, setAdv] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState<any>(null);
  const set = (p: any) => setF((o: any) => ({ ...o, ...p })); const setS = (p: any) => setF((o: any) => ({ ...o, settings: { ...o.settings, ...p } }));
  const regs = c.content.regions.filter((r: any) => r.country_key === f.country);
  const reg = c.content.regions.find((r: any) => r.key === f.region);
  const env = c.content.envs[f.template ? tp?.environment : reg?.environment_key];
  const submit = async () => { setErr(''); setBusy(true); click(); try { const body: any = { name: f.name, mode: f.mode, max_players: f.max_players, is_public: f.is_public, join_policy: f.join_policy, settings: f.settings }; if (f.template) body.template = f.template; else body.region = f.region; setDone(await api.post('/worlds', body)); audio.play('mission_done'); } catch (e) { setErr(errText(t, e)); } setBusy(false); };
  const rules = c.content.settings.mode_rules;
  const toggleNpc = (r: string) => setS({ npcs: f.settings.npcs.includes(r) ? f.settings.npcs.filter((x: string) => x !== r) : [...f.settings.npcs, r] });
  return <div className="panel form" style={{ marginTop: 10 }}>
    <div className="rowx"><h2 style={{ margin: 0, flex: 1 }}>➕ {t('create.title')}</h2><button className="btn sm light" onClick={() => c.go('home')}>← {t('ui.back')}</button></div>
    <label>{t('create.name')}<input className="in" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} placeholder={t('create.name_ph')} dir="auto" /></label>
    <div className="tabs"><button className={!f.template ? 'on' : ''} onClick={() => set({ template: '', country: f.country || 'UAE' })}>🧭 {t('create.by_country')}</button><button className={f.template ? 'on' : ''} onClick={() => set({ template: f.template || c.content.templates[0]?.key, region: '' })}>🌟 {t('create.by_template')}</button></div>
    {f.template ? <div className="opts">{c.content.templates.map((x: any) => <button key={x.key} className={'opt' + (f.template === x.key ? ' on' : '')} onClick={() => { click(); set({ template: x.key, mode: x.mode, name: f.name || c.nm(x) }); setS({ npcs: x.settings?.npcs || [] }); }}><b>{c.nm(x)}</b><small>{c.ds(x)}</small></button>)}</div> : <>
      <b>{t('create.country')}</b>
      <div className="opts">{c.content.countries.map((x: any) => <button key={x.key} className={'opt' + (f.country === x.key ? ' on' : '')} onClick={() => { click(); set({ country: x.key, region: '' }); }}><b>{x.flag} {c.nm(x)}</b></button>)}</div>
      <b>{f.country === 'UAE' ? t('create.emirate') : t('create.region')}</b>
      <div className="grid">{regs.map((x: any) => <button key={x.key} className={'card' + (f.region === x.key ? ' on' : '')} onClick={() => { click(); set({ region: x.key }); }}><EnvThumb env={c.content.envs[x.environment_key]} seed={x.key.charCodeAt(0) + x.key.charCodeAt(1)} /><div className="bd"><h3>{c.nm(x)}</h3><p>{c.ds(x)}</p></div></button>)}</div>
    </>}
    <b>{t('create.mode')}</b>
    <div className="opts">{Object.keys(rules).map((m) => <button key={m} className={'opt' + (f.mode === m ? ' on' : '')} onClick={() => { click(); set({ mode: m }); }}><b>{MODE_ICON[m] || '🎮'} {t('mode.' + m)}</b><small>{t('mode.' + m + '.desc')}</small></button>)}</div>
    <div className="two">
      <label>{t('create.max_players')}: {f.max_players}<input type="range" min={1} max={capMax} value={f.max_players} onChange={(e) => set({ max_players: +e.target.value })} /><small style={{ color: 'var(--mute)', fontWeight: 500 }}>{f.max_players === 1 ? t('create.solo_hint') : t('create.multi_hint')}</small></label>
      <label>{t('create.visitor_perm')}<select className="in" value={f.settings.visitor_perm} onChange={(e) => setS({ visitor_perm: e.target.value })}><option value="build">{t('perm.build')}</option><option value="view">{t('perm.view')}</option></select></label>
    </div>
    <button className="btn sm light" style={{ justifySelf: 'start' }} onClick={() => { click(); setAdv(!adv); }}>🛠️ {t('create.builder')} {adv ? '▲' : '▼'}</button>
    {adv && <div className="form" style={{ background: '#f2f6f8', borderRadius: 16, padding: 14 }}>
      <div className="two">
        <label>{t('create.size')}<select className="in" value={f.settings.size} onChange={(e) => setS({ size: e.target.value })}>{['small', 'medium', 'large'].map((s) => <option key={s} value={s}>{t('size.' + s)}</option>)}</select></label>
        <label>{t('create.terrain')}: ×{f.settings.amp}<input type="range" min={0.4} max={1.6} step={0.1} value={f.settings.amp} onChange={(e) => setS({ amp: +e.target.value })} /></label>
        <label>{t('create.weather')}<select className="in" value={f.settings.weather} onChange={(e) => setS({ weather: e.target.value })}>{['dynamic', 'clear', 'rain', 'storm', 'fog', 'sandstorm'].map((s) => <option key={s} value={s}>{t('weather.' + s)}</option>)}</select></label>
        <label>{t('create.start_time')}<select className="in" value={f.settings.start_time} onChange={(e) => setS({ start_time: +e.target.value })}><option value={0.27}>{t('time.morning')}</option><option value={0.5}>{t('time.noon')}</option><option value={0.73}>{t('time.sunset')}</option><option value={0}>{t('time.night')}</option></select></label>
        <label>{t('create.resources')}<select className="in" value={f.settings.ores} onChange={(e) => setS({ ores: e.target.value })}><option value="0.5">{t('res.low')}</option><option value="1">{t('res.normal')}</option><option value="2">{t('res.rich')}</option></select></label>
        <label>{t('create.difficulty')}<select className="in" value={f.settings.difficulty} onChange={(e) => setS({ difficulty: e.target.value })}>{['peaceful', 'easy', 'normal', 'hard'].map((s) => <option key={s} value={s}>{t('diff.' + s)}</option>)}</select></label>
        <label>{t('create.join_policy')}<select className="in" value={f.join_policy} onChange={(e) => set({ join_policy: e.target.value })}><option value="open">{t('policy.open')}</option><option value="closed">{t('policy.closed')}</option></select></label>
        <label>{t('create.public')}<select className="in" value={f.is_public ? '1' : '0'} onChange={(e) => set({ is_public: e.target.value === '1' })}><option value="0">{t('ui.no')}</option><option value="1">{t('ui.yes')}</option></select></label>
      </div>
      <div className="rowx"><label className="rowx"><input type="checkbox" checked={f.settings.structures} onChange={(e) => setS({ structures: e.target.checked })} /> {t('create.structures')}</label><label className="rowx"><input type="checkbox" checked={f.settings.fixed_time} onChange={(e) => setS({ fixed_time: e.target.checked })} /> {t('create.fixed_time')}</label><label className="rowx"><input type="checkbox" checked={f.settings.temp} onChange={(e) => setS({ temp: e.target.checked })} /> {t('create.temp')}</label></div>
      <div><b>{t('create.npcs')}</b><div className="rowx" style={{ marginTop: 6 }}>{['guide', 'elder', 'merchant', 'teacher'].map((r) => <label key={r} className="rowx"><input type="checkbox" checked={f.settings.npcs.includes(r)} onChange={() => toggleNpc(r)} /> {t('npc.' + r + '.name')}</label>)}</div></div>
    </div>}
    {env && <div className="rowx" style={{ background: '#f2f6f8', borderRadius: 14, padding: 10 }}><div style={{ width: 150, borderRadius: 10, overflow: 'hidden', flex: 'none' }}><EnvThumb env={env} seed={7} /></div><div style={{ flex: 1, minWidth: 180 }}><b>{c.nm(env)}</b><div style={{ color: 'var(--mute)', fontSize: '.9rem' }}>{c.ds(env)}</div></div></div>}
    {err && <div className="err">{err}</div>}
    <button className="btn" disabled={busy || f.name.trim().length < 2 || (!f.template && !f.region)} onClick={submit}>🌍 {t('create.submit')}</button>
    {done && <div className="modal"><div className="panel" style={{ textAlign: 'center' }}><h2>🎉 {t('create.done')}</h2><p dir="auto"><b>{done.name}</b></p><p>{t('create.share_code')}</p><div className="bigcode code">{done.code}</div>
      <div className="rowx" style={{ justifyContent: 'center' }}><button className="btn light" onClick={() => { click(); navigator.clipboard?.writeText(done.code); }}>📋 {t('ui.copy')}</button><button className="btn teal" onClick={() => c.go('game', done.code)}>▶ {t('world.enter')}</button><button className="btn light" onClick={() => c.go('home')}>{t('ui.later')}</button></div></div></div>}
  </div>;
}

function Join({ c, code }: { c: Ctx; code?: string }) {
  const { t } = c; const [v, setV] = useState(code || ''); const [w, setW] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const look = async (e?: any) => { e?.preventDefault(); setErr(''); setW(null); setBusy(true); click(); try { setW(await api.get('/worlds/lookup/' + encodeURIComponent(v.trim().toUpperCase()))); } catch (x) { setErr(errText(t, x)); } setBusy(false); };
  useEffect(() => { if (code) look(); }, []);
  return <div className="panel form" style={{ marginTop: 10, maxWidth: 560, marginInline: 'auto' }}>
    <div className="rowx"><h2 style={{ margin: 0, flex: 1 }}>🔑 {t('join.title')}</h2><button className="btn sm light" onClick={() => c.go('home')}>← {t('ui.back')}</button></div>
    <form className="form" onSubmit={look}><label>{t('join.code')}<input className="in code" style={{ fontSize: '1.3rem', textAlign: 'center' }} value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder="UAE-RAK-85241" maxLength={24} /></label>
      <button className="btn teal" disabled={busy || v.trim().length < 5}>🔍 {t('join.check')}</button></form>
    {err && <div className="err">{err}</div>}
    {w && <div className="card" style={{ boxShadow: 'none', border: '2px solid #dbe5ea' }}><EnvThumb env={c.content.envs[w.environment]} seed={w.id} /><div className="bd"><h3 dir="auto">{w.name}</h3>
      <p>{t('world.owner')}: <b dir="auto">{w.owner}</b></p><div className="rowx"><span className="tag g">{MODE_ICON[w.mode]} {t('mode.' + w.mode)}</span><span className="tag b">👥 {w.online}/{w.cap}</span></div>
      {w.can_join && w.needs_room && w.rooms?.enabled && w.rooms.busy >= w.rooms.total && <div className="okmsg" style={{ background: '#fdf0cf', color: '#8a5c00' }}>{t('queue.busy')}</div>}
      {w.can_join ? <button className="btn" style={{ marginTop: 8 }} onClick={() => c.go('game', w.code)}>▶ {t('join.enter')}</button> : <div className="err" style={{ marginTop: 8 }}>{t('join.' + w.reason)}</div>}</div></div>}
  </div>;
}

function AvatarPreview({ char, catalog }: { char: any; catalog: any[] }) {
  const ref = useRef<HTMLCanvasElement>(null); const st = useRef<any>(null);
  useEffect(() => {
    const cv = ref.current!; const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio));
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 3 / 4, 0.1, 50); cam.position.set(0, 1.25, -4.6); cam.lookAt(0, 1.0, 0);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xb09a7a, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(-2, 4, -3); sc.add(d);
    const holder = new THREE.Group(); sc.add(holder);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 28), new THREE.MeshLambertMaterial({ color: '#e8cf95' })); floor.position.y = -0.04; sc.add(floor);
    let raf = 0, drag = false, rot = 0.5, lx = 0;
    const down = (e: PointerEvent) => { drag = true; lx = e.clientX; }, up = () => (drag = false), move = (e: PointerEvent) => { if (drag) { rot += (e.clientX - lx) * 0.012; lx = e.clientX; } };
    cv.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointermove', move);
    const loop = () => { raf = requestAnimationFrame(loop); const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w * r.getPixelRatio()) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } if (!drag) rot += 0.006; holder.rotation.y = rot; r.render(sc, cam); };
    loop(); st.current = { holder };
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointermove', move); r.dispose(); };
  }, []);
  useEffect(() => { const h = st.current?.holder; if (!h) return; h.clear(); h.add(makeAvatar(char, catalog).group); }, [char, catalog]);
  return <canvas ref={ref} style={{ touchAction: 'none', cursor: 'grab' }} />;
}

const SKINS = ['#f3d2b3', '#e2b48c', '#c68e5e', '#a86a3e', '#7d4a26', '#55331a'], HAIRS = ['#1a1310', '#2a1c12', '#5a3a1e', '#8a5a2c', '#b7b7b7', '#c8323a'];
function Character({ c }: { c: Ctx }) {
  const { t } = c; const [ch, setCh] = useState<any>({ ...DEFAULT_CHAR, ...(c.me.profile.character || {}) }); const [name, setName] = useState(c.me.profile.display_name); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const set = (p: any) => { click(); setCh((o: any) => ({ ...o, ...p })); };
  const list = (slot: string) => c.content.characters.filter((x: any) => x.slot === slot);
  const save = async () => { setErr(''); setMsg(''); try { c.setMe(await api.put('/profile', { character: ch, display_name: name })); setMsg(t('ui.saved')); audio.play('mission_done'); } catch (e) { setErr(errText(t, e)); } };
  const Opt = ({ slot, field, title }: any) => <div><b>{title}</b><div className="opts" style={{ marginTop: 6 }}>{list(slot).map((x: any) => <button key={x.key} className={'opt' + (ch[field] === x.key ? ' on' : '')} onClick={() => set({ [field]: x.key })}><b>{x.colors?.main && <i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: x.colors.main, border: '1px solid #9ab', marginInlineEnd: 6 }} />}{c.nm(x)}</b></button>)}</div></div>;
  return <div className="panel" style={{ marginTop: 10 }}>
    <div className="rowx" style={{ marginBottom: 12 }}><h2 style={{ margin: 0, flex: 1 }}>🧑‍🎨 {t('char.title')}</h2><button className="btn sm light" onClick={() => c.go('home')}>← {t('ui.back')}</button></div>
    <div className="charlay"><div><AvatarPreview char={ch} catalog={c.content.characters} /><div style={{ textAlign: 'center', color: 'var(--mute)', fontSize: '.85rem' }}>{t('char.drag')}</div></div>
      <div className="form">
        <label>{t('auth.display_name')}<input className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} dir="auto" /></label>
        <div><b>{t('char.skin')}</b><div className="sw" style={{ marginTop: 6 }}>{SKINS.map((s) => <button key={s} aria-label={s} className={ch.skin === s ? 'on' : ''} style={{ background: s }} onClick={() => set({ skin: s })} />)}</div></div>
        <Opt slot="outfit" field="outfit" title={t('char.outfit')} /><Opt slot="head" field="head" title={t('char.head')} /><Opt slot="hair" field="hair" title={t('char.hair')} />
        <div><b>{t('char.hair_color')}</b><div className="sw" style={{ marginTop: 6 }}>{HAIRS.map((s) => <button key={s} aria-label={s} className={ch.hairColor === s ? 'on' : ''} style={{ background: s }} onClick={() => set({ hairColor: s })} />)}</div></div>
        <Opt slot="accessory" field="acc" title={t('char.accessory')} />
        {msg && <div className="okmsg">{msg}</div>}{err && <div className="err">{err}</div>}
        <button className="btn teal" onClick={save}>💾 {t('ui.save')}</button>
      </div></div></div>;
}

export function SettingsForm({ c, inGame }: { c: Ctx; inGame?: boolean }) {
  const { t, settings: s } = c; const set = (p: Partial<Settings>) => c.saveSettings({ ...s, ...p });
  const R = ({ k, min, max, step, label, fmt }: any) => <label>{label}: {fmt ? fmt((s as any)[k]) : (s as any)[k]}<input type="range" min={min} max={max} step={step} value={(s as any)[k]} onChange={(e) => set({ [k]: +e.target.value } as any)} /></label>;
  const pc = (v: number) => Math.round(v * 100) + '%';
  return <div className="form">
    <div className="two">
      <label>{t('set.quality')}{inGame && <small style={{ color: 'var(--mute)', fontWeight: 500 }}>{t('set.quality_hint')}</small>}<select className="in" value={s.quality} onChange={(e) => set({ quality: e.target.value as any })}><option value="low">{t('set.q_low')}</option><option value="medium">{t('set.q_medium')}</option><option value="high">{t('set.q_high')}</option></select></label>
      <R k="renderDistance" min={3} max={10} step={1} label={t('set.distance')} />
      <R k="fov" min={55} max={95} step={1} label={t('set.fov')} /><R k="sensitivity" min={0.3} max={2.5} step={0.1} label={t('set.sensitivity')} />
      <R k="master" min={0} max={1} step={0.05} label={t('set.vol_master')} fmt={pc} /><R k="sfx" min={0} max={1} step={0.05} label={t('set.vol_sfx')} fmt={pc} />
      <R k="ambient" min={0} max={1} step={0.05} label={t('set.vol_ambient')} fmt={pc} /><R k="music" min={0} max={1} step={0.05} label={t('set.vol_music')} fmt={pc} />
    </div>
    <div className="rowx"><label className="rowx"><input type="checkbox" checked={s.autoJump} onChange={(e) => set({ autoJump: e.target.checked })} /> {t('set.autojump')}</label><label className="rowx"><input type="checkbox" checked={s.invertY} onChange={(e) => set({ invertY: e.target.checked })} /> {t('set.invert')}</label><label className="rowx"><input type="checkbox" checked={s.showCoords} onChange={(e) => set({ showCoords: e.target.checked })} /> {t('set.coords')}</label></div>
  </div>;
}
function SettingsScreen({ c }: { c: Ctx }) {
  const { t, me } = c; const [p, setP] = useState<any>({ lang: me.profile.lang, dialect: me.profile.dialect, country: me.profile.country || '', region: me.profile.region || '' }); const [msg, setMsg] = useState('');
  const save = async (np: any) => { const v = { ...p, ...np }; setP(v); try { c.setMe(await api.put('/profile', v)); await c.reloadI18n(v.lang, v.dialect); setMsg(t('ui.saved')); setTimeout(() => setMsg(''), 1500); } catch { /* */ } };
  return <div className="panel form" style={{ marginTop: 10 }}>
    <div className="rowx"><h2 style={{ margin: 0, flex: 1 }}>⚙️ {t('nav.settings')}</h2><button className="btn sm light" onClick={() => c.go('home')}>← {t('ui.back')}</button></div>
    <div className="two"><label>{t('set.language')}<select className="in" value={p.lang} onChange={(e) => save({ lang: e.target.value })}><option value="ar">العربية</option><option value="en">English</option></select></label>
      <label>{t('auth.dialect')}<select className="in" value={p.dialect} disabled={p.lang !== 'ar'} onChange={(e) => save({ dialect: e.target.value })}>{c.content.dialects.map((d: any) => <option key={d.key} value={d.key}>{c.nm(d)}</option>)}</select></label></div>
    <GeoFields c={c} v={p} set={save} />
    {msg && <div className="okmsg">{msg}</div>}
    <h3 style={{ margin: '6px 0 0' }}>🎮 {t('set.game')}</h3>
    <SettingsForm c={c} />
    <div className="rowx"><button className="btn sm light" onClick={() => { audio.unlock(); audio.setVol({ master: c.settings.master, sfx: c.settings.sfx }); audio.play('achievement'); }}>🔊 {t('set.test_sound')}</button></div>
  </div>;
}

function Profile({ c }: { c: Ctx }) {
  const { t, me } = c; const got = new Map<number, number>(me.achievements.map((a: any) => [a.id, a.achieved_at]));
  const h = Math.floor(me.profile.playtime / 3600), m = Math.floor((me.profile.playtime % 3600) / 60);
  return <div className="panel" style={{ marginTop: 10 }}>
    <div className="rowx" style={{ marginBottom: 12 }}><h2 style={{ margin: 0, flex: 1 }}>🏅 {t('nav.achievements')}</h2><button className="btn sm light" onClick={() => c.go('home')}>← {t('ui.back')}</button></div>
    <div className="rowx" style={{ marginBottom: 14 }}><span className="tag g">⭐ {t('profile.points')}: {me.profile.points}</span><span className="tag b">⏱️ {t('profile.playtime')}: {h}:{String(m).padStart(2, '0')}</span><span className="tag">🏅 {got.size}/{c.content.achievements.length}</span>
      <span className="tag">🧱 {t('profile.placed')}: {me.stats.placed_total || 0}</span><span className="tag">⛏️ {t('profile.broken')}: {me.stats.broken_total || 0}</span></div>
    <div className="list">{c.content.achievements.map((a: any) => { const at = got.get(a.id); const cur = Math.min(a.threshold, me.stats[a.stat] || 0); return <div key={a.id} className={'ach' + (at ? '' : ' locked')}><div className="ic">{a.icon || '🏅'}</div><div style={{ flex: 1 }}><b>{c.lang === 'en' ? a.title_en : a.title_ar}</b><div style={{ color: 'var(--mute)', fontSize: '.88rem' }}>{c.lang === 'en' ? a.desc_en : a.desc_ar}</div>
      {!at && a.threshold > 1 && <div style={{ background: '#dbe5ea', borderRadius: 6, height: 7, marginTop: 5, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: (cur / a.threshold) * 100 + '%', background: 'var(--teal)' }} /></div>}</div>
      <span className="tag g">+{a.points}</span>{at && <span className="tag">✓ {new Date(at * 1000).toLocaleDateString(c.lang === 'ar' ? 'ar' : 'en')}</span>}</div>; })}</div>
  </div>;
}
