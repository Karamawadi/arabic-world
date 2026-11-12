// لوحة الإدارة /admin — واجهة مستقلة تماماً عن واجهة اللاعبين، محمية بصلاحيات RBAC من الخادم
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import './admin.css';
import { Api, ApiError } from '../common/api';
import { RES, PERMS, PERM_LABELS, SOUND_KEYS, STRUCT_KEYS, type Field } from '../../shared/resources';
import { drawTile, T } from '../engine/atlas';
import { makeGen } from '../../shared/gen';
import { audio } from '../engine/audio';

const api = new Api('aw_admin_token');
const E: Record<string, string> = { duplicate: 'المعرّف مستخدم من قبل.', forbidden: 'لا تملك صلاحية لهذا الإجراء.', invalid_key: 'المعرّف غير صالح (أحرف إنجليزية وأرقام و _).', bad_credentials: 'بيانات الدخول غير صحيحة.', last_admin: 'لا يمكن إزالة آخر مدير.', system_block_disable_instead: 'مكعب أساسي: عطّله بدلاً من حذفه.', system_role: 'دور أساسي لا يُحذف.', block_limit: 'بلغت الحد الأقصى للمكعبات (255).', invalid_audio_only_mp3_wav: 'الملف يجب أن يكون MP3 أو WAV صالحاً.', too_large: 'الملف أكبر من 8MB.', network: 'تعذر الاتصال بالخادم.', too_many_requests: 'محاولات كثيرة، انتظر قليلاً.' };
const em = (e: any) => { const c = e instanceof ApiError ? e.code : 'error'; return E[c] || (c.startsWith('invalid_json') ? 'صيغة JSON غير صحيحة في: ' + c.slice(13) : c.startsWith('missing_') ? 'حقل مطلوب: ' + c.slice(8) : c.startsWith('invalid_') ? 'قيمة غير صالحة: ' + c.slice(8) : 'حدث خطأ: ' + c); };
const dt = (s: number) => (s ? new Date(s * 1000).toLocaleString('ar') : '—');

const NAV: [string, string, string, string?][] = [
  ['dashboard', '📊', 'لوحة المعلومات'], ['users', '👤', 'المستخدمون', 'users.manage'], ['worlds', '🌍', 'العوالم', 'worlds.manage'], ['geo', '🗺️', 'الدول والمناطق', 'content.manage'],
  ['envs', '⛰️', 'البيئات والمباني', 'content.manage'], ['blocks', '🧱', 'المكعبات والعناصر', 'content.manage'], ['chars', '🧑', 'الشخصيات والأزياء', 'content.manage'], ['missions', '🏅', 'المهام والإنجازات', 'content.manage'],
  ['sounds', '🔊', 'الأصوات والموسيقى', 'sounds.manage'], ['i18n', '🌐', 'اللغات واللهجات', 'i18n.manage'], ['monitor', '📡', 'مراقبة اللعب الجماعي', 'monitor.view'], ['reports', '📈', 'التقارير والتحليلات', 'reports.view'],
  ['roles', '🔐', 'الأدوار والصلاحيات', 'roles.manage'], ['settings', '⚙️', 'إعدادات اللعبة', 'settings.manage'],
];

function App() {
  const [sess, setSess] = useState<any>(undefined); const [page, setPage] = useState(location.hash.slice(1) || 'dashboard');
  const check = async () => { if (!api.token) return setSess(null); try { setSess(await api.get('/admin/session')); } catch (e: any) { if (e.status === 403) setSess({ denied: true }); else { api.setToken(null); setSess(null); } } };
  useEffect(() => { check(); }, []);
  useEffect(() => { location.hash = page; }, [page]);
  if (sess === undefined) return <div className="center">…</div>;
  if (!sess || sess.denied) return <Login denied={sess?.denied} onDone={check} />;
  const can = (p?: string) => !p || sess.perms.includes(p);
  const nav = NAV.filter((n) => can(n[3])); const cur = nav.find((n) => n[0] === page) || nav[0];
  return <div className="lay">
    <aside><div className="brand">🛠️ إدارة عالم العرب</div>{nav.map((n) => <button key={n[0]} className={cur[0] === n[0] ? 'on' : ''} onClick={() => setPage(n[0])}><span>{n[1]}</span>{n[2]}</button>)}
      <div className="who">{sess.username} · {sess.role}<br /><a href="/play">↗ واجهة اللاعبين</a> · <a href="#" onClick={async (e) => { e.preventDefault(); try { await api.post('/auth/logout'); } catch { /* */ } api.setToken(null); setSess(null); }}>خروج</a></div></aside>
    <main><h1>{cur[1]} {cur[2]}</h1>
      {cur[0] === 'dashboard' && <Dashboard />}{cur[0] === 'users' && <Users sess={sess} />}{cur[0] === 'worlds' && <Worlds />}
      {cur[0] === 'geo' && <Tabs tabs={[['countries', 'الدول'], ['regions', 'المناطق والإمارات والمدن']]} />}
      {cur[0] === 'envs' && <Tabs tabs={[['environments', 'البيئات والتضاريس'], ['structures', 'المباني الجاهزة']]} />}
      {cur[0] === 'blocks' && <Tabs tabs={[['blocks', 'المكعبات'], ['items', 'العناصر والأدوات']]} />}{cur[0] === 'chars' && <Crud res="characters" />}
      {cur[0] === 'missions' && <Tabs tabs={[['achievements', 'الإنجازات'], ['missions', 'المهام والتحديات']]} />}{cur[0] === 'sounds' && <Sounds />}
      {cur[0] === 'i18n' && <Tabs tabs={[['dialects', 'اللهجات'], ['translations', 'النصوص والترجمات']]} />}{cur[0] === 'monitor' && <Monitor />}{cur[0] === 'reports' && <Reports />}
      {cur[0] === 'roles' && <Crud res="roles" />}{cur[0] === 'settings' && <Settings />}
    </main></div>;
}

function Login({ denied, onDone }: { denied?: boolean; onDone: () => void }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(denied ? 'هذا الحساب لا يملك صلاحيات إدارية.' : '');
  const go = async (e: any) => { e.preventDefault(); setErr(''); try { const r = await api.post('/auth/login', { username: u, password: p }); api.setToken(r.token); onDone(); } catch (x) { setErr(em(x)); } };
  return <div className="center"><form className="box" onSubmit={go}><h2>🔐 لوحة الإدارة</h2><p className="mute">الدخول للمسؤولين فقط.</p>
    <label>اسم المستخدم<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></label><label>كلمة المرور<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
    {err && <div className="err">{err}</div>}<button className="b pri">دخول</button>{denied && <button type="button" className="b" onClick={() => { api.setToken(null); onDone(); }}>تبديل الحساب</button>}</form></div>;
}

function Tabs({ tabs }: { tabs: [string, string][] }) { const [t, setT] = useState(tabs[0][0]); return <><div className="tabs">{tabs.map((x) => <button key={x[0]} className={t === x[0] ? 'on' : ''} onClick={() => setT(x[0])}>{x[1]}</button>)}</div><Crud key={t} res={t} /></>; }

// ---------- CRUD عام مولَّد من تعريف الموارد ----------
function Crud({ res }: { res: string }) {
  const R = RES[res]; const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState(''); const [edit, setEdit] = useState<any>(null); const [err, setErr] = useState(''); const [refs, setRefs] = useState<Record<string, any[]>>({});
  const load = async () => { try { setRows(await api.get(`/admin/r/${res}?q=${encodeURIComponent(q)}`)); setErr(''); } catch (e) { setErr(em(e)); } };
  useEffect(() => { load(); const need = [...new Set(R.fields.filter((f) => f.ref).map((f) => f.ref!))]; if (res === 'environments' || res === 'blocks') need.push('blocks'); if (res === 'environments') need.push('structures'); need.forEach((n) => api.get('/admin/r/' + n).then((d) => setRefs((o) => ({ ...o, [n]: d }))).catch(() => {})); }, [res]);
  const cols = R.fields.filter((f) => !f.hide);
  const del = async (r: any) => { if (!confirm('تأكيد الحذف؟')) return; try { await api.del(`/admin/r/${res}/${r[R.pk]}`); load(); } catch (e) { setErr(em(e)); } };
  const cell = (f: Field, v: any) => f.t === 'bool' ? (v ? '✅' : '—') : f.t === 'json' ? <code>{String(v ?? '').slice(0, 60)}</code> : String(v ?? '').slice(0, 70);
  return <div>
    <div className="bar"><input placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /><button className="b" onClick={load}>بحث</button><span className="mute">{rows.length} سجل</span><span style={{ flex: 1 }} /><button className="b pri" onClick={() => setEdit({})}>➕ إضافة</button></div>
    {err && <div className="err">{err}</div>}
    <div className="tw"><table><thead><tr>{res === 'blocks' && <th />}{cols.map((f) => <th key={f.n}>{f.l}</th>)}<th /></tr></thead>
      <tbody>{rows.map((r) => <tr key={r[R.pk]}>{res === 'blocks' && <td><TexPrev tex={r.tex} /></td>}{cols.map((f) => <td key={f.n}>{cell(f, r[f.n])}</td>)}<td className="act"><button className="b sm" onClick={() => setEdit(r)}>تعديل</button><button className="b sm dng" onClick={() => del(r)}>حذف</button></td></tr>)}</tbody></table></div>
    {edit && <EditForm res={res} row={edit} refs={refs} close={(ch) => { setEdit(null); if (ch) load(); }} />}
  </div>;
}
function TexPrev({ tex }: { tex: any }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const g = ref.current?.getContext('2d'); if (!g) return; g.clearRect(0, 0, T * 2, T); try { const t = typeof tex === 'string' ? JSON.parse(tex) : tex; const a = t?.all || ['#888888', '#666666', 'grain']; drawTile(g, 0, 0, t?.top || a); drawTile(g, T, 0, t?.side || a); } catch { /* */ } }, [tex]);
  return <canvas ref={ref} width={T * 2} height={T} className="tex" />;
}
function EnvPrev({ params, blocks, structs }: { params: string; blocks: any[]; structs: any[] }) {
  const ref = useRef<HTMLCanvasElement>(null); const [msg, setMsg] = useState('');
  useEffect(() => {
    const cv = ref.current; if (!cv || !blocks?.length) return;
    try {
      const p = JSON.parse(params || '{}'), ids: any = {}, col: any = {}; for (const b of blocks) { ids[b.key] = b.id; const t = JSON.parse(b.tex || '{}'); col[b.id] = (t.top || t.all || ['#888888'])[0]; }
      const prefabs: any = {}; for (const s of structs || []) prefabs[s.key] = { w: s.w, d: s.d, site: s.site, ops: JSON.parse(s.ops || '[]') };
      const gen = makeGen(4242, p, ids, { prefabs }), g = cv.getContext('2d')!, N = cv.width, img = g.createImageData(N, N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i - N / 2) * 4, z = (j - N / 2) * 4, c = gen.col(x, z), id = c.h < gen.sea ? ids.water : gen.surfaceOf(x, z, c); const n = parseInt((col[id] || '#888888').slice(1), 16), s = c.h < gen.sea ? 0.6 + (c.h - gen.sea + 30) / 75 : 0.7 + Math.min(0.5, (c.h - gen.sea) / 90), o = (i + j * N) * 4; img.data[o] = ((n >> 16) & 255) * s; img.data[o + 1] = ((n >> 8) & 255) * s; img.data[o + 2] = (n & 255) * s; img.data[o + 3] = 255; }
      g.putImageData(img, 0, 0); setMsg('معاينة علوية للتضاريس (كل بكسل = 4 مكعبات) بالمولّد الفعلي للعبة');
    } catch { setMsg('JSON غير صالح — لا يمكن المعاينة'); }
  }, [params, blocks, structs]);
  return <div><canvas ref={ref} width={200} height={200} className="envp" /><div className="mute">{msg}</div><div className="mute">المنشآت المتاحة: {[...STRUCT_KEYS, ...(structs || []).map((s) => s.key)].join('، ')}</div></div>;
}
function EditForm({ res, row, refs, close }: { res: string; row: any; refs: Record<string, any[]>; close: (changed?: boolean) => void }) {
  const R = RES[res], isNew = row[R.pk] === undefined;
  const init: any = {}; for (const f of R.fields) { let v = row[f.n]; if (v === undefined || v === null) v = isNew && f.d !== undefined ? f.d : f.t === 'bool' ? 0 : ''; if (f.t === 'json' && typeof v !== 'string') v = JSON.stringify(v, null, 1); else if (f.t === 'json' && v) try { v = JSON.stringify(JSON.parse(v), null, 1); } catch { /* */ } init[f.n] = v; }
  const [v, setV] = useState<any>(init); const [err, setErr] = useState('');
  const set = (k: string, x: any) => setV((o: any) => ({ ...o, [k]: x }));
  const save = async (e: any) => { e.preventDefault(); setErr(''); try { if (isNew) await api.post('/admin/r/' + res, v); else await api.put(`/admin/r/${res}/${row[R.pk]}`, v); close(true); } catch (x) { setErr(em(x)); } };
  const inp = (f: Field) => {
    if (res === 'roles' && f.n === 'permissions') { let cur: string[] = []; try { cur = JSON.parse(v[f.n] || '[]'); } catch { /* */ } return <div className="checks">{PERMS.map((p) => <label key={p}><input type="checkbox" checked={cur.includes(p)} onChange={(e) => set(f.n, JSON.stringify(e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))} /> {PERM_LABELS[p]}</label>)}</div>; }
    if (f.t === 'bool') return <input type="checkbox" checked={!!Number(v[f.n])} onChange={(e) => set(f.n, e.target.checked ? 1 : 0)} />;
    if (f.t === 'sel') { const opts = f.ref ? [...(f.req ? [] : ['']), ...(refs[f.ref] || []).map((r) => r.key)] : f.o!; return <select value={v[f.n] ?? ''} onChange={(e) => set(f.n, e.target.value)}>{opts.map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>; }
    if (f.t === 'json' || f.t === 'area') return <textarea dir={f.t === 'json' ? 'ltr' : 'auto'} rows={f.t === 'json' ? Math.min(14, Math.max(3, String(v[f.n]).split('\n').length)) : 2} value={v[f.n]} onChange={(e) => set(f.n, e.target.value)} />;
    return <input type={f.t === 'num' ? 'number' : 'text'} step="any" value={v[f.n]} disabled={f.ro} dir="auto" onChange={(e) => set(f.n, e.target.value)} />;
  };
  return <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && close()}><form className="box wide" onSubmit={save}><h2>{isNew ? 'إضافة' : 'تعديل'} — {R.title}</h2>
    <div className="fg">{R.fields.filter((f) => !(isNew && f.ro)).map((f) => <label key={f.n} className={f.t === 'json' || f.t === 'area' ? 'full' : ''}>{f.l}{f.req && ' *'}{inp(f)}{f.hint && <small className="mute" dir="auto">{f.hint}</small>}</label>)}</div>
    {res === 'blocks' && <div>معاينة المظهر (أعلى / جانب): <TexPrev tex={v.tex} /></div>}
    {res === 'environments' && <EnvPrev params={v.params} blocks={refs.blocks} structs={refs.structures} />}
    {err && <div className="err">{err}</div>}<div className="bar"><button className="b pri">💾 حفظ</button><button type="button" className="b" onClick={() => close()}>إلغاء</button></div></form></div>;
}

function Stat({ l, v }: { l: string; v: any }) { return <div className="stat"><b>{v}</b><span>{l}</span></div>; }
function Dashboard() {
  const [d, setD] = useState<any>(null); useEffect(() => { const f = () => api.get('/admin/dashboard').then(setD).catch(() => {}); f(); const i = setInterval(f, 8000); return () => clearInterval(i); }, []);
  if (!d) return null;
  return <><div className="stats"><Stat l="متصلون الآن" v={d.online} /><Stat l="عوالم نشطة" v={d.rooms} /><Stat l="المستخدمون" v={d.users} /><Stat l="مستخدمون جدد (7 أيام)" v={d.users_week} /><Stat l="العوالم" v={d.worlds} /><Stat l="جلسات (24 ساعة)" v={d.sessions_day} /><Stat l="رسائل (24 ساعة)" v={d.messages_day} /><Stat l="إنجازات ممنوحة" v={d.achievements_granted} /><Stat l="المكعبات" v={d.blocks} /><Stat l="العناصر" v={d.items} /><Stat l="البيئات" v={d.environments} /><Stat l="الأصوات" v={d.sounds} /></div>
    <h3>آخر العمليات الإدارية</h3><div className="tw"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>{d.audit.map((a: any, i: number) => <tr key={i}><td>{dt(a.created_at)}</td><td>{a.username}</td><td dir="ltr">{a.action}</td><td dir="auto">{a.detail}</td></tr>)}</tbody></table>{!d.audit.length && <p className="mute">لا عمليات بعد.</p>}</div></>;
}

function Users({ sess }: { sess: any }) {
  const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState(''); const [roles, setRoles] = useState<any[]>([]); const [err, setErr] = useState('');
  const load = () => api.get('/admin/users?q=' + encodeURIComponent(q)).then(setRows).catch((e) => setErr(em(e)));
  useEffect(() => { load(); if (sess.perms.includes('roles.manage')) api.get('/admin/r/roles').then(setRoles).catch(() => {}); }, []);
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(em(e)); } };
  return <div><div className="bar"><input placeholder="بحث بالاسم..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /><button className="b" onClick={load}>بحث</button><span className="mute">{rows.length} مستخدم</span></div>{err && <div className="err">{err}</div>}
    <div className="tw"><table><thead><tr><th>#</th><th>المستخدم</th><th>الاسم الظاهر</th><th>الدور</th><th>الدولة</th><th>اللهجة</th><th>النقاط</th><th>ساعات اللعب</th><th>العوالم</th><th>آخر دخول</th><th /></tr></thead>
      <tbody>{rows.map((u) => <tr key={u.id} className={u.banned ? 'off' : ''}><td>{u.id}</td><td dir="auto">{u.username}</td><td dir="auto">{u.display_name}</td>
        <td>{roles.length ? <select value={u.role} onChange={(e) => act(() => api.patch('/admin/users/' + u.id, { role: e.target.value }))}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name_ar}</option>)}</select> : u.role}</td>
        <td>{u.country}</td><td>{u.dialect}</td><td>{u.points}</td><td>{((u.playtime || 0) / 3600).toFixed(1)}</td><td>{u.worlds}</td><td>{dt(u.last_login)}</td>
        <td className="act"><button className="b sm" onClick={() => act(() => api.patch('/admin/users/' + u.id, { banned: !u.banned }))}>{u.banned ? 'رفع الإيقاف' : 'إيقاف'}</button><button className="b sm" onClick={() => { const p = prompt('كلمة مرور جديدة (6 أحرف على الأقل):'); if (p) act(() => api.patch('/admin/users/' + u.id, { password: p })); }}>كلمة المرور</button><button className="b sm dng" onClick={() => confirm('حذف المستخدم وكل عوالمه؟') && act(() => api.del('/admin/users/' + u.id))}>حذف</button></td></tr>)}</tbody></table></div></div>;
}

function Worlds() {
  const [tab, setTab] = useState('list'); const [rows, setRows] = useState<any[]>([]); const [q, setQ] = useState(''); const [err, setErr] = useState(''); const [content, setContent] = useState<any>(null); const [nw, setNw] = useState<any>(null); const [ed, setEd] = useState<any>(null);
  const load = () => api.get('/admin/worlds?q=' + encodeURIComponent(q)).then(setRows).catch((e) => setErr(em(e)));
  useEffect(() => { load(); api.get('/content').then(setContent); }, []);
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(em(e)); } };
  return <><div className="tabs"><button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>كل العوالم</button><button className={tab === 'tpl' ? 'on' : ''} onClick={() => setTab('tpl')}>مكتبة العوالم الجاهزة</button></div>
    {tab === 'tpl' ? <Crud res="templates" /> : <div><div className="bar"><input placeholder="بحث بالاسم أو الكود..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /><button className="b" onClick={load}>بحث</button><span style={{ flex: 1 }} /><button className="b pri" onClick={() => setNw({ name: '', region: 'RAK', template: '', mode: 'creative', max_players: 8, featured: true })}>➕ إنشاء عالم</button></div>{err && <div className="err">{err}</div>}
      <div className="tw"><table><thead><tr><th>الكود</th><th>الاسم</th><th>المالك</th><th>البيئة</th><th>النمط</th><th>اللاعبون</th><th>تعديلات (قطع)</th><th>عام</th><th>مميز</th><th>آخر لعب</th><th /></tr></thead>
        <tbody>{rows.map((w) => <tr key={w.id}><td dir="ltr"><b>{w.code}</b></td><td dir="auto">{w.name}</td><td dir="auto">{w.owner}</td><td>{w.environment}</td><td>{w.mode}</td><td>{w.online}/{w.max_players}</td><td>{w.chunks}</td><td>{w.is_public ? '✅' : '—'}</td>
          <td><input type="checkbox" checked={w.featured} onChange={(e) => act(() => api.patch('/admin/worlds/' + w.id, { featured: e.target.checked }))} /></td><td>{dt(w.last_played)}</td>
          <td className="act"><button className="b sm" onClick={() => setEd({ ...w })}>تعديل</button><button className="b sm" onClick={() => act(() => api.post(`/worlds/${w.id}/clone`, {}))}>استنساخ</button><button className="b sm" onClick={() => act(() => api.post(`/worlds/${w.id}/backups`, { note: 'admin' }))}>نسخ احتياطي</button><button className="b sm dng" onClick={() => confirm('حذف العالم نهائياً؟') && act(() => api.del('/worlds/' + w.id))}>حذف</button></td></tr>)}</tbody></table></div>
      {ed && <div className="modal"><form className="box" onSubmit={(e) => { e.preventDefault(); act(() => api.patch('/worlds/' + ed.id, { name: ed.name, mode: ed.mode, max_players: +ed.max_players, is_public: !!ed.is_public, join_policy: ed.join_policy })).then(() => setEd(null)); }}><h2>تعديل العالم {ed.code}</h2>
        <label>الاسم<input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} dir="auto" /></label><label>النمط<select value={ed.mode} onChange={(e) => setEd({ ...ed, mode: e.target.value })}>{Object.keys(content?.settings.mode_rules || {}).map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>الحد الأقصى للاعبين<input type="number" min={1} value={ed.max_players} onChange={(e) => setEd({ ...ed, max_players: e.target.value })} /></label><label>الانضمام<select value={ed.join_policy} onChange={(e) => setEd({ ...ed, join_policy: e.target.value })}><option value="open">مفتوح</option><option value="closed">مغلق</option></select></label>
        <label><span><input type="checkbox" checked={!!ed.is_public} onChange={(e) => setEd({ ...ed, is_public: e.target.checked })} /> عالم عام</span></label><div className="bar"><button className="b pri">حفظ</button><button type="button" className="b" onClick={() => setEd(null)}>إلغاء</button></div></form></div>}
      {nw && content && <div className="modal"><form className="box" onSubmit={(e) => { e.preventDefault(); const b: any = { name: nw.name, mode: nw.mode, max_players: +nw.max_players, featured: nw.featured, is_public: true }; if (nw.template) b.template = nw.template; else b.region = nw.region; act(() => api.post('/admin/worlds', b)).then(() => setNw(null)); }}><h2>إنشاء عالم</h2>
        <label>الاسم<input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} required minLength={2} dir="auto" /></label>
        <label>من قالب جاهز<select value={nw.template} onChange={(e) => setNw({ ...nw, template: e.target.value })}><option value="">— (حسب المنطقة)</option>{content.templates.map((t: any) => <option key={t.key} value={t.key}>{t.name_ar}</option>)}</select></label>
        {!nw.template && <label>المنطقة<select value={nw.region} onChange={(e) => setNw({ ...nw, region: e.target.value })}>{content.regions.map((r: any) => <option key={r.key} value={r.key}>{r.country_key} — {r.name_ar}</option>)}</select></label>}
        <label>النمط<select value={nw.mode} onChange={(e) => setNw({ ...nw, mode: e.target.value })}>{Object.keys(content.settings.mode_rules).map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>الحد الأقصى للاعبين<input type="number" min={1} max={content.settings.max_players_limit} value={nw.max_players} onChange={(e) => setNw({ ...nw, max_players: e.target.value })} /></label>
        <label><span><input type="checkbox" checked={nw.featured} onChange={(e) => setNw({ ...nw, featured: e.target.checked })} /> عالم مميز يظهر في الصفحة الرئيسية</span></label><div className="bar"><button className="b pri">إنشاء</button><button type="button" className="b" onClick={() => setNw(null)}>إلغاء</button></div></form></div>}</div>}</>;
}

function Sounds() {
  const [rows, setRows] = useState<any[]>([]); const [err, setErr] = useState(''); const [f, setF] = useState<any>({ key: 'achievement', custom: '', name: '', category: 'effect' }); const file = useRef<HTMLInputElement>(null); const stop = useRef<any>(null); const [ach, setAch] = useState<any[]>([]);
  const load = () => { api.get('/admin/sounds').then(setRows).catch((e) => setErr(em(e))); api.get('/admin/r/achievements').then(setAch).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(em(e)); } };
  const up = (e: any) => { e.preventDefault(); const fl = file.current?.files?.[0]; if (!fl) return; const key = f.key === '_custom' ? f.custom : f.key; act(async () => { await api.req('POST', `/admin/sounds?key=${encodeURIComponent(key)}&name=${encodeURIComponent(f.name || fl.name)}&category=${f.category}`, undefined, fl); file.current!.value = ''; }); };
  const play = async (s: any) => { try { stop.current?.(); stop.current = await audio.preview('/uploads/' + s.file, s.volume); } catch { setErr('تعذر تشغيل الملف.'); } };
  return <div><form className="bar card" onSubmit={up}><b>رفع صوت (MP3 / WAV حتى 8MB):</b>
    <select value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })}>{SOUND_KEYS.map((k) => <option key={k}>{k}</option>)}<option value="_custom">مفتاح مخصص (لإنجاز معيّن)...</option></select>
    {f.key === '_custom' && <input placeholder="مثال: ach_peak" value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value })} dir="ltr" required />}
    <input placeholder="اسم وصفي" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="effect">مؤثر</option><option value="ambient">بيئة</option><option value="music">موسيقى</option></select>
    <input type="file" ref={file} accept=".mp3,.wav,audio/mpeg,audio/wav" required /><button className="b pri">⬆ رفع</button></form>
    <p className="mute">الصوت المرفوع يبقى «مسودة» حتى تعاينه وتعتمده. لكل مفتاح صوت معتمد واحد يستبدل الصوت الافتراضي المولّد في اللعبة. لتخصيص صوت لإنجاز: ارفع بمفتاح مخصص ثم اختره للإنجاز من العمود الأخير.</p>{err && <div className="err">{err}</div>}
    <div className="tw"><table><thead><tr><th>المفتاح</th><th>الاسم</th><th>النوع</th><th>الحجم</th><th>مستوى الصوت</th><th>الحالة</th><th>ربط بإنجاز</th><th /></tr></thead>
      <tbody>{rows.map((s) => <tr key={s.id}><td dir="ltr"><b>{s.key}</b></td><td dir="auto">{s.name}</td><td>{s.category}</td><td>{(s.size / 1024).toFixed(0)}KB</td>
        <td><input type="range" min={0} max={1} step={0.05} defaultValue={s.volume} onMouseUp={(e: any) => act(() => api.patch('/admin/sounds/' + s.id, { volume: +e.target.value }))} onTouchEnd={(e: any) => act(() => api.patch('/admin/sounds/' + s.id, { volume: +e.target.value }))} /> {Math.round(s.volume * 100)}%</td>
        <td>{s.approved ? '✅ معتمد' : '📝 مسودة'}</td>
        <td><select value="" onChange={(e) => { const a = ach.find((x) => String(x.id) === e.target.value); if (a) act(() => api.put('/admin/r/achievements/' + a.id, { sound_key: s.key })); }}><option value="">{ach.filter((a) => a.sound_key === s.key).map((a) => a.title_ar).join('، ') || '—'}</option>{ach.map((a) => <option key={a.id} value={a.id}>{a.title_ar}</option>)}</select></td>
        <td className="act"><button className="b sm" onClick={() => play(s)}>▶ معاينة</button><button className="b sm" onClick={() => stop.current?.()}>⏹</button><button className="b sm pri" onClick={() => act(() => api.patch('/admin/sounds/' + s.id, { approved: !s.approved }))}>{s.approved ? 'إلغاء الاعتماد' : 'اعتماد'}</button>
          <label className="b sm">استبدال<input type="file" hidden accept=".mp3,.wav" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) act(() => api.req('PUT', `/admin/sounds/${s.id}/file`, undefined, fl)); }} /></label><button className="b sm dng" onClick={() => confirm('حذف الصوت؟') && act(() => api.del('/admin/sounds/' + s.id))}>حذف</button></td></tr>)}</tbody></table>{!rows.length && <p className="mute">لا توجد أصوات مرفوعة. اللعبة تستخدم حالياً المؤثرات الافتراضية المولّدة.</p>}</div></div>;
}

function Monitor() {
  const [rooms, setRooms] = useState<any[]>([]); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const load = () => api.get('/admin/monitor').then(setRooms).catch((e) => setErr(em(e)));
  useEffect(() => { load(); const i = setInterval(load, 3000); return () => clearInterval(i); }, []);
  const act = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(em(e)); } };
  return <div><form className="bar card" onSubmit={(e) => { e.preventDefault(); act(() => api.post('/admin/monitor/announce', { text: msg })).then(() => setMsg('')); }}><b>📢 إعلان لكل العوالم النشطة:</b><input style={{ flex: 1 }} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={200} required dir="auto" /><button className="b pri">إرسال</button></form>{err && <div className="err">{err}</div>}
    <p className="mute">تحديث مباشر كل 3 ثوانٍ — {rooms.length} عالم نشط، {rooms.reduce((s, r) => s + r.players.length, 0)} لاعب متصل.</p>
    {rooms.map((r) => <div className="card" key={r.id}><div className="bar"><span className="b sm">غرفة {r.room}</span>{r.left >= 0 && <span className="b sm">⏳ {Math.floor(r.left / 60)}:{String(r.left % 60).padStart(2, '0')}</span>}<b dir="auto">{r.name}</b><code>{r.code}</code><span className="mute">{r.mode} · {r.environment} · {r.weather} · {String(Math.floor(r.time * 24)).padStart(2, '0')}:00 · {r.players.length}/{r.max}</span><span style={{ flex: 1 }} /><button className="b sm dng" onClick={() => confirm('إغلاق الغرفة وإخراج كل اللاعبين؟') && act(() => api.post('/admin/monitor/close', { world: r.id }))}>إغلاق الغرفة</button></div>
      <table><tbody>{r.players.map((p: any) => <tr key={p.id}><td dir="auto">{p.name}</td><td>{p.role}</td><td dir="ltr">({p.pos.join(', ')})</td><td>منذ {Math.round((Date.now() / 1000 - p.since) / 60)} د</td><td className="act"><button className="b sm dng" onClick={() => act(() => api.post('/admin/monitor/kick', { world: r.id, uid: p.id }))}>طرد</button></td></tr>)}</tbody></table></div>)}
    {!rooms.length && <p className="mute">لا يوجد لاعبون متصلون الآن.</p>}</div>;
}

function Tbl({ title, rows, cols }: { title: string; rows: any[]; cols: [string, string][] }) { return <div className="card"><h3>{title}</h3><table><thead><tr>{cols.map((c) => <th key={c[0]}>{c[1]}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[0]} dir="auto">{r[c[0]] ?? '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="mute">لا بيانات بعد.</p>}</div>; }
function Reports() {
  const [d, setD] = useState<any>(null); useEffect(() => { api.get('/admin/reports').then(setD).catch(() => {}); }, []);
  if (!d) return null;
  return <div className="rep"><Tbl title="الجلسات اليومية (14 يوماً)" rows={d.sessions} cols={[['d', 'اليوم'], ['n', 'الجلسات'], ['players', 'لاعبون'], ['avg_min', 'متوسط المدة (د)']]} /><Tbl title="التسجيلات اليومية" rows={d.registrations} cols={[['d', 'اليوم'], ['n', 'حسابات جديدة']]} />
    <Tbl title="حسب نمط اللعب" rows={d.by_mode} cols={[['k', 'النمط'], ['n', 'الجلسات'], ['hours', 'الساعات']]} /><Tbl title="حسب المنطقة / البيئة" rows={d.by_region} cols={[['k', 'المنطقة'], ['n', 'الجلسات'], ['hours', 'الساعات']]} />
    <Tbl title="الإنجازات المحققة" rows={d.achievements} cols={[['k', 'الإنجاز'], ['n', 'عدد اللاعبين']]} /><Tbl title="أفضل اللاعبين" rows={d.top_players} cols={[['k', 'اللاعب'], ['n', 'النقاط'], ['hours', 'ساعات اللعب']]} />
    <Tbl title="أكثر العوالم نشاطاً" rows={d.top_worlds} cols={[['k', 'العالم'], ['code', 'الكود'], ['n', 'الجلسات']]} /><Tbl title="توزيع اللهجات" rows={d.dialects} cols={[['k', 'اللهجة'], ['n', 'اللاعبون']]} /></div>;
}

const SET: [string, string, string][] = [['room_system_enabled', 'تفعيل نظام غرف اللعب والجلسات المحدودة', 'bool'], ['rooms_count', 'عدد غرف اللعب المتزامنة', 'num'], ['room_capacity', 'عدد اللاعبين في كل غرفة', 'num'], ['session_minutes', 'مدة الجلسة (دقائق)', 'num'], ['empty_release_sec', 'تحرير الغرفة الفارغة بعد (ثوانٍ)', 'num'], ['reconnect_hold_sec', 'حفظ مقعد المنقطع (ثوانٍ)', 'num'], ['registration_open', 'السماح بتسجيل حسابات جديدة', 'bool'], ['chat_enabled', 'تفعيل الدردشة', 'bool'], ['day_length_sec', 'طول اليوم الكامل (ثوانٍ)', 'num'], ['max_players_limit', 'أقصى عدد لاعبين في العالم', 'num'], ['max_worlds_per_player', 'أقصى عدد عوالم لكل لاعب', 'num'], ['autosave_sec', 'فاصل الحفظ التلقائي (ثوانٍ)', 'num'], ['default_dialect', 'اللهجة الافتراضية (key)', 'text'], ['motd_ar', 'رسالة الصفحة الرئيسية (عربي)', 'text'], ['motd_en', 'رسالة الصفحة الرئيسية (إنجليزي)', 'text']];
function Settings() {
  const [s, setS] = useState<any>(null); const [rules, setRules] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api.get('/admin/settings').then((d) => { setS(d); setRules(JSON.stringify(d.mode_rules, null, 1)); }).catch((e) => setErr(em(e))); }, []);
  if (!s) return err ? <div className="err">{err}</div> : null;
  const save = async (e: any) => { e.preventDefault(); setErr(''); setMsg(''); let mr; try { mr = JSON.parse(rules); } catch { return setErr('قواعد الأنماط: JSON غير صالح'); } try { await api.put('/admin/settings', { ...s, mode_rules: mr }); setMsg('تم الحفظ ✓ (يُطبق على العوالم عند فتحها من جديد)'); } catch (x) { setErr(em(x)); } };
  return <form className="box wide flat" onSubmit={save}><div className="fg">{SET.map(([k, l, t]) => <label key={k}>{l}{t === 'bool' ? <input type="checkbox" checked={!!s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> : <input type={t === 'num' ? 'number' : 'text'} value={s[k] ?? ''} dir="auto" onChange={(e) => setS({ ...s, [k]: t === 'num' ? +e.target.value : e.target.value })} />}</label>)}
    <label className="full">قواعد أنماط اللعب (JSON) — لكل نمط: fly, infinite, damage, hunger, hostile, instant, story, timed, quiz, kit<textarea dir="ltr" rows={16} value={rules} onChange={(e) => setRules(e.target.value)} /></label></div>
    {msg && <div className="ok">{msg}</div>}{err && <div className="err">{err}</div>}<div className="bar"><button className="b pri">💾 حفظ الإعدادات</button></div></form>;
}

createRoot(document.getElementById('root')!).render(<App />);
