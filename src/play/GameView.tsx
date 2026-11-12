// شاشة اللعب: لوحة العرض + واجهة HUD (شريط الأدوات، الحقيبة، الخريطة، اللاعبون، الدردشة، أزرار اللمس)
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../engine/game';
import { iconURL } from '../engine/atlas';
import { audio } from '../engine/audio';
import { isTouch } from '../common/api';
import { SettingsForm, type Ctx } from './App';

export function GameView({ c, code, onExit, onAgain }: { c: Ctx; code: string; onExit: () => void; onAgain: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const touch = isTouch();
  useEffect(() => {
    audio.unlock();
    const g = new Game({ canvas: cv.current!, content: c.content, code, token: (localStorage.getItem('aw_token') || ''), settings: c.settings, t: c.t, lang: c.lang, touch, char: c.me.profile.character });
    if (location.search.includes('debug')) (window as any).__game = g;
    setGame(g);
    const leave = () => g.saveInv(); window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); g.dispose(); };
  }, []);
  useEffect(() => { game?.applySettings(c.settings); }, [c.settings, game]);
  return <div className="game" dir={c.lang === 'ar' ? 'rtl' : 'ltr'}><canvas ref={cv} className="view" />{game && <Hud c={c} g={game} touch={touch} onExit={onExit} onAgain={onAgain} />}</div>;
}

function Icon({ g, k }: { g: Game; k: string }) { const b = g.blockByKey[k], d = b || g.itemByKey[k]; return d ? <img src={iconURL(d, !!b)} alt="" draggable={false} /> : null; }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function Hud({ c, g, touch, onExit, onAgain }: { c: Ctx; g: Game; touch: boolean; onExit: () => void; onAgain: () => void }) {
  useSyncExternalStore(g.subscribe, () => g.ver);
  const { t } = c, ui = g.ui, rules = ui.rules || {};
  const mini = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const id = setInterval(() => { const m = mini.current; if (m && ui.status === 'playing') g.drawMinimap(m.getContext('2d')!, m.width); }, 450); return () => clearInterval(id); }, []);
  const [toast, setToast] = useState<any>(null);
  useEffect(() => { if (!toast && ui.toasts.length) { const x = ui.toasts[0]; ui.toasts = ui.toasts.slice(1); setToast(x); setTimeout(() => setToast(null), 5200); } }, [g.ver, toast]);
  const hour = Math.floor(ui.time * 24), min = Math.floor(((ui.time * 24) % 1) * 60);
  const wIcon: any = { clear: ui.time > 0.22 && ui.time < 0.79 ? '☀️' : '🌙', rain: '🌧️', storm: '⛈️', fog: '🌫️', sandstorm: '🌪️' };
  const recent = ui.chat.slice(-6).filter((m: any) => Date.now() / 1000 - m.ts < 14);
  const [, tick] = useState(0); useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const left = ui.sessEnd ? Math.max(0, (ui.sessEnd - performance.now()) / 1000) : -1;
  if (ui.status === 'closed' && ui.reason === 'session_ended') return <div className="ov"><div className="panel" style={{ textAlign: 'center', maxWidth: 460 }}><h2>⏳ {t('sess.ended_title')}</h2><p style={{ fontSize: '1.1rem', lineHeight: 1.8 }}>{t('sess.ended')}</p><div className="rowx" style={{ justifyContent: 'center' }}><button className="btn teal" onClick={onAgain}>🔄 {t('sess.new')}</button><button className="btn light" onClick={onExit}>{t('game.back_home')}</button></div></div></div>;
  if (ui.status === 'queued') { const q = ui.queue || {}, eta = Math.max(0, (q.eta || 0) - (performance.now() - (q.at || 0)) / 1000); return <div className="ov" style={{ color: '#fff' }}><div style={{ textAlign: 'center', maxWidth: 480 }}><div className="spin" /><h2>{t('queue.title')}</h2><p style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>{t('queue.busy')}</p><p><span className="chip">{t('queue.pos', { pos: q.pos, total: q.total })}</span> <span className="chip">⏱️ {t('queue.eta', { time: mmss(eta) })}</span></p><button className="btn ghost sm" onClick={onExit}>{t('ui.cancel')}</button></div></div>; }
  if (ui.status === 'closed') return <div className="ov"><div className="panel" style={{ textAlign: 'center', maxWidth: 420 }}><h2>⚠️ {t('game.closed')}</h2><p>{t('closed.' + (ui.reason || 'generic')) === 'closed.' + ui.reason ? t('closed.generic') : t('closed.' + (ui.reason || 'generic'))}</p><button className="btn" onClick={onExit}>{t('game.back_home')}</button></div></div>;
  if (ui.status === 'connecting' || ui.status === 'loading') return <div className="ov" style={{ color: '#fff' }}><div style={{ textAlign: 'center' }}><div className="spin" /><h2>{t(ui.status === 'connecting' ? 'game.connecting' : 'game.loading')}</h2>{ui.status === 'loading' && <p>{t('game.chunks', { n: ui.pending })}</p>}<button className="btn ghost sm" onClick={onExit}>{t('ui.cancel')}</button></div></div>;
  const mdef = (id: number) => c.content.missions.find((m: any) => m.id === id);
  return <div className="hud">
    {ui.underwater && <div className="water" />}
    {ui.hurtAt > 0 && <div className="hurt" key={ui.hurtAt} />}
    {!ui.panel && <><div className="cross" />{ui.target && <div className="tgt">{ui.target}</div>}{ui.breakProg > 0 && <div className="prog"><i style={{ width: ui.breakProg * 100 + '%' }} /></div>}</>}
    <div className="info">
      <div className="pill" dir="auto">{ui.world?.name} · <span className="code">{ui.world?.code}</span></div>
      <div className="pill">{wIcon[ui.weather]} {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')} · 👥 {ui.players.length}/{ui.world?.max}{c.settings.showCoords && <> · {ui.coords.join(', ')}</>}</div>
      {left >= 0 && <div className="pill" style={left <= 300 ? { background: 'rgba(170,40,20,.85)' } : undefined}>⏳ {t('sess.left')} {mmss(left)}</div>}
      <div className="pill">{ui.fps} FPS · {ui.ping}ms{ui.flying ? ' · ✈️' : ''}{ui.vehicle ? ' · ' + ({ boat: '⛵', buggy: '🏎️', camel: '🐪' } as any)[ui.vehicle] : ''}{!ui.canBuild ? ' · 👁️ ' + t('role.visitor') : ''}</div>
    </div>
    <canvas ref={mini} className="mini" width={118} height={118} />
    <div className="topbtns pe">
      <button onClick={() => g.setPanel('pause')} aria-label="menu">☰</button><button onClick={() => g.setPanel('inventory')} aria-label="inventory">🎒</button>
      <button onClick={() => g.setPanel('chat')} aria-label="chat">💬</button><button onClick={() => g.setPanel('missions')} aria-label="missions">📜</button>
    </div>
    <div className="notes">{ui.notices.map((n: any) => <div className="note" key={n.id} dir="auto">{n.text}</div>)}</div>
    {ui.chal && <div className="chal">🏆 {(() => { const m = mdef(ui.chal.id); return m ? (c.lang === 'en' ? m.title_en : m.title_ar) : ''; })()} — {ui.chal.progress}/{ui.chal.count} · ⏱️ {Math.floor(ui.chal.left / 60)}:{String(ui.chal.left % 60).padStart(2, '0')}</div>}
    {toast && <div className="toast" dir={c.lang === 'ar' ? 'rtl' : 'ltr'}><div className="ic">{toast.icon || '🏅'}</div><div><small>{t('ach.unlocked')}</small><b>{c.lang === 'en' ? toast.title_en : toast.title_ar}</b><small>+{toast.points} {t('profile.points')}</small></div></div>}
    {ui.status === 'reconnecting' && <div className="notes" style={{ top: '40%' }}><div className="note" style={{ background: 'rgba(150,40,20,.85)' }}><div className="spin" style={{ width: 26, height: 26, borderWidth: 4, margin: '4px auto' }} />{t('game.reconnecting')}</div></div>}
    {!ui.panel && <div className="chatlog">{recent.map((m: any, i: number) => <div key={i} className={m.sys ? 'sys' : ''} dir="auto">{m.sys ? m.text : <><b>{m.name}:</b> {m.text}</>}</div>)}</div>}
    {rules.damage && <div className="bars"><div className="bar" title="health"><i style={{ width: (ui.health / 20) * 100 + '%', background: '#e5484d' }} /></div>{rules.hunger && <div className="bar" title="hunger"><i style={{ width: (ui.hunger / 20) * 100 + '%', background: '#e0a030' }} /></div>}</div>}
    <div className="hot pe">{ui.slots.slice(0, 9).map((s: any, i: number) => <button key={i} className={'slot' + (ui.sel === i ? ' on' : '')} onClick={() => g.select(i)}>{s && <><Icon g={g} k={s.k} />{s.n > 1 && <b>{s.n}</b>}</>}</button>)}</div>
    {touch && !ui.panel && <Touch g={g} fly={!!rules.fly} flying={ui.flying} vehicle={ui.vehicle} />}
    {ui.panel === 'players' && <div className="ov clear" onClick={() => g.setPanel('')}><Players c={c} g={g} /></div>}
    {ui.panel === 'pause' && <Pause c={c} g={g} onExit={onExit} touch={touch} />}
    {ui.panel === 'inventory' && <Inventory c={c} g={g} />}
    {ui.panel === 'chat' && <Chat c={c} g={g} />}
    {ui.panel === 'missions' && <Missions c={c} g={g} />}
    {ui.panel === 'npc' && ui.npc && <div className="ov clear"><div className="panel" style={{ maxWidth: 480 }}><h2>🗣️ {t('npc.' + ui.npc.role + '.name')}</h2><p style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>{t(ui.npc.say, { name: g.you.name })}</p>
      {ui.npc.mission && (() => { const m = mdef(ui.npc.mission); const st = ui.missions.find((x: any) => x.id === ui.npc.mission); return m ? <div className="li"><span style={{ flex: 1 }}><b>📜 {c.lang === 'en' ? m.title_en : m.title_ar}</b><br /><small>{c.lang === 'en' ? m.desc_en : m.desc_ar}</small></span><span className="tag g">{st?.status === 'done' ? '✓' : `${st?.progress || 0}/${m.type === 'reach_height' ? 1 : m.count}`}</span></div> : null; })()}
      <button className="btn teal" style={{ marginTop: 12 }} onClick={() => g.setPanel('')}>{t('npc.ok')}</button></div></div>}
    {ui.panel === 'dead' && <div className="ov" style={{ background: 'rgba(120,10,10,.55)' }}><div className="panel" style={{ textAlign: 'center', maxWidth: 380 }}><h2>💫 {t('game.dead')}</h2><p>{t('msg.died')}</p><button className="btn" onClick={() => g.respawn()}>{t('game.respawn')}</button></div></div>}
  </div>;
}

function Touch({ g, fly, flying, vehicle }: { g: Game; fly: boolean; flying: boolean; vehicle: string }) {
  const joy = useRef<HTMLDivElement>(null), knob = useRef<HTMLElement>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const jd = (e: React.PointerEvent) => { try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* */ } jm(e); };
  const jm = (e: React.PointerEvent) => { if (!e.buttons && e.pointerType === 'mouse') return; const r = joy.current!.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } g.tmove.x = x; g.tmove.y = -y; if (knob.current) knob.current.style.transform = `translate(${x * 38}px,${y * 38}px)`; };
  const ju = () => { g.tmove.x = 0; g.tmove.y = 0; if (knob.current) knob.current.style.transform = ''; };
  const hold = (on: () => void, off: () => void) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* */ } audio.unlock(); on(); }, onPointerUp: off, onPointerCancel: off, onContextMenu: (e: any) => e.preventDefault() });
  const R = 'calc(18px + env(safe-area-inset-right))', B = 'env(safe-area-inset-bottom)';
  return <>
    <div className="looklayer pe" onPointerDown={(e) => { audio.unlock(); if (!look.current) look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => { const l = look.current; if (l && l.id === e.pointerId) { g.look((e.clientX - l.x) * 2.4, (e.clientY - l.y) * 2.4); l.x = e.clientX; l.y = e.clientY; } }}
      onPointerUp={(e) => { if (look.current?.id === e.pointerId) look.current = null; }} onPointerCancel={() => (look.current = null)} />
    <div className="joy pe" ref={joy} onPointerDown={jd} onPointerMove={jm} onPointerUp={ju} onPointerCancel={ju}><i ref={knob as any} /></div>
    <button className="tbtn pe" style={{ right: R, bottom: `calc(150px + ${B})` }} {...hold(() => (g.tjump = true), () => (g.tjump = false))} aria-label="jump">⤒</button>
    <button className="tbtn pe act" style={{ right: `calc(96px + env(safe-area-inset-right))`, bottom: `calc(96px + ${B})` }} {...hold(() => { g.primary = true; g.hit(); }, () => (g.primary = false))} aria-label="break">⛏️</button>
    <button className="tbtn pe" style={{ right: R, bottom: `calc(74px + ${B})` }} {...hold(() => g.secondary(), () => {})} aria-label="place">🧱</button>
    {flying && <button className="tbtn pe s" style={{ right: `calc(102px + env(safe-area-inset-right))`, bottom: `calc(174px + ${B})` }} {...hold(() => (g.tdown = true), () => (g.tdown = false))} aria-label="down">⤓</button>}
    {fly && <button className={'tbtn pe s' + (flying ? ' act' : '')} style={{ right: R, bottom: `calc(226px + ${B})` }} onClick={() => g.toggleFly()} aria-label="fly">✈️</button>}
    {vehicle && <button className="tbtn pe s act" style={{ right: `calc(76px + env(safe-area-inset-right))`, bottom: `calc(226px + ${B})` }} onClick={() => g.dismount()} aria-label="dismount">⏏</button>}
    <button className="tbtn pe s" style={{ left: 'calc(170px + env(safe-area-inset-left))', bottom: `calc(84px + ${B})` }} onClick={() => g.rotateHeld()} aria-label="rotate">⟳</button>
  </>;
}

function Players({ c, g }: { c: Ctx; g: Game }) {
  const { t } = c, ui = g.ui, owner = ui.you?.role === 'owner';
  return <div className="panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}><h2>👥 {t('hud.players')} ({ui.players.length}/{ui.world?.max})</h2>
    <div className="list">{ui.players.map((p: any) => <div className="li" key={p.id}><span style={{ flex: 1 }} dir="auto">{p.name}{p.me ? ' ★' : ''}</span><span className={'tag ' + (p.role === 'owner' ? 'g' : p.role === 'builder' ? 'b' : '')}>{t('role.' + p.role)}</span>
      {owner && !p.me && <><button className="btn sm light" onClick={() => g.setRole(p.id, p.role === 'builder' ? 'visitor' : 'builder')}>{p.role === 'builder' ? t('hud.make_visitor') : t('hud.make_builder')}</button><button className="btn sm coral" onClick={() => g.kick(p.id)}>{t('hud.kick')}</button><button className="btn sm coral" onClick={() => { if (confirm(t('hud.ban_confirm'))) g.kick(p.id, true); }}>🚫</button></>}</div>)}</div></div>;
}

function Pause({ c, g, onExit, touch }: { c: Ctx; g: Game; onExit: () => void; touch: boolean }) {
  const { t } = c, ui = g.ui, owner = ui.you?.role === 'owner'; const [tab, setTab] = useState('main'); const [copied, setCopied] = useState(false);
  const url = `${location.origin}/play?join=${ui.world?.code}`;
  const share = async () => { try { if (navigator.share) await navigator.share({ title: ui.world.name, text: t('share.text', { name: ui.world.name, code: ui.world.code }), url }); else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } } catch { /* */ } };
  return <div className="ov"><div className="panel">
    <div className="rowx" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, flex: 1 }} dir="auto">{ui.world?.name}</h2><span className="tag g">{t('mode.' + ui.world?.mode)}</span></div>
    <div className="tabs">{[['main', '🎮 ' + t('pause.game')], ['players', '👥 ' + t('hud.players')], ['settings', '⚙️ ' + t('nav.settings')], ...(owner ? [['world', '🌍 ' + t('pause.world')]] : []), ['help', '❔ ' + t('pause.help')]].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === 'main' && <div className="form">
      <button className="btn teal" onClick={() => g.setPanel('')}>▶ {touch ? t('pause.resume') : t('pause.click_play')}</button>
      <div style={{ background: '#f2f6f8', borderRadius: 14, padding: 12 }}><b>🔗 {t('pause.invite')}</b><div className="bigcode code" style={{ fontSize: '1.5rem', margin: '8px 0' }}>{ui.world?.code}</div>
        <div className="rowx"><button className="btn sm light" onClick={() => { navigator.clipboard?.writeText(ui.world.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>📋 {copied ? '✓' : t('ui.copy')}</button><button className="btn sm light" onClick={share}>📤 {t('pause.share_link')}</button></div></div>
      <div className="rowx"><button className="btn sm light" onClick={() => g.setPanel('inventory')}>🎒 {t('hud.inventory')}</button><button className="btn sm light" onClick={() => g.setPanel('missions')}>📜 {t('hud.missions')}</button><button className="btn sm light" onClick={() => g.respawn()}>🏠 {t('pause.to_spawn')}</button></div>
      <button className="btn coral" onClick={onExit}>⎋ {t('pause.exit')}</button></div>}
    {tab === 'players' && <Players c={c} g={g} />}
    {tab === 'settings' && <SettingsForm c={c} inGame />}
    {tab === 'world' && owner && <div className="form">
      <div><b>{t('create.start_time')}</b><div className="rowx" style={{ marginTop: 6 }}>{[[0.27, 'morning'], [0.5, 'noon'], [0.73, 'sunset'], [0, 'night']].map(([v, k]) => <button key={k} className="btn sm light" onClick={() => g.worldSet({ time: v })}>{t('time.' + k)}</button>)}</div></div>
      <div><b>{t('create.weather')}</b><div className="rowx" style={{ marginTop: 6 }}>{['clear', 'rain', 'storm', 'fog', 'sandstorm'].map((k) => <button key={k} className={'btn sm ' + (ui.weather === k ? 'teal' : 'light')} onClick={() => g.worldSet({ weather: k })}>{t('weather.' + k)}</button>)}</div></div>
      <div><b>{t('create.visitor_perm')}</b><div className="rowx" style={{ marginTop: 6 }}>{['build', 'view'].map((k) => <button key={k} className={'btn sm ' + (ui.world?.settings?.visitor_perm === k ? 'teal' : 'light')} onClick={() => g.worldSet({ visitor_perm: k })}>{t('perm.' + k)}</button>)}</div></div></div>}
    {tab === 'help' && <div className="list" style={{ lineHeight: 1.9 }}>{touch ? <div>{t('help.touch')}</div> : <>
      <div><span className="kbd">W A S D</span> {t('help.move')} · <span className="kbd">Space</span> {t('help.jump')} · <span className="kbd">Shift</span> {t('help.run')}</div>
      <div><span className="kbd">🖱 L</span> {t('help.break')} · <span className="kbd">🖱 R</span> {t('help.place')} · <span className="kbd">1-9</span> {t('help.hotbar')}</div>
      <div><span className="kbd">E</span> {t('hud.inventory')} · <span className="kbd">T</span> {t('hud.chat')} · <span className="kbd">M</span> {t('hud.missions')} · <span className="kbd">Tab</span> {t('hud.players')}</div>
      <div><span className="kbd">F</span> {t('help.fly')} · <span className="kbd">R</span> {t('help.rotate')} · <span className="kbd">V</span> {t('help.camera')} · <span className="kbd">Q</span> {t('help.dismount')}</div></>}
      <div style={{ color: 'var(--mute)' }}>{t('msg.tip_break')}</div></div>}
  </div></div>;
}

const CATS = ['all', 'natural', 'wood', 'plant', 'building', 'heritage', 'modern', 'decor', 'ore', 'tool', 'weapon', 'food', 'vehicle', 'material'];
function Inventory({ c, g }: { c: Ctx; g: Game }) {
  const { t } = c, ui = g.ui, inf = !!ui.rules?.infinite; const [pick, setPick] = useState<number | null>(null); const [tab, setTab] = useState(inf ? 'catalog' : 'bag'); const [cat, setCat] = useState('all'); const [q, setQ] = useState('');
  const tap = (i: number) => { audio.play('ui_click'); if (pick === null) { if (ui.slots[i]) setPick(i); } else { g.moveSlot(pick, i); setPick(null); } };
  const S = (i: number) => { const s = ui.slots[i]; return <button key={i} className={'slot' + (pick === i ? ' pick' : '') + (i === ui.sel ? ' on' : '')} title={s ? g.name(g.def(s.k)) : ''} onClick={() => tap(i)}>{s && <><Icon g={g} k={s.k} />{s.n > 1 && <b>{s.n}</b>}</>}</button>; };
  const all = [...c.content.blocks.filter((b: any) => b.shape !== 'liquid' && b.hardness >= 0), ...c.content.items].filter((d: any) => (cat === 'all' || d.category === cat) && (!q || (d.name_ar + d.name_en + d.key).toLowerCase().includes(q.toLowerCase())));
  const recs = g.recipes();
  return <div className="ov"><div className="panel">
    <div className="rowx" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, flex: 1 }}>🎒 {t('hud.inventory')}</h2><button className="btn sm light" onClick={() => g.setPanel('')}>✕</button></div>
    <div className="tabs"><button className={tab === 'bag' ? 'on' : ''} onClick={() => setTab('bag')}>{t('inv.bag')}</button>{inf && <button className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>{t('inv.catalog')}</button>}<button className={tab === 'craft' ? 'on' : ''} onClick={() => setTab('craft')}>🔨 {t('inv.craft')}</button></div>
    {tab === 'bag' && <><div className="invgrid">{Array.from({ length: 27 }, (_, i) => S(i + 9))}</div>
      <div className="rowx" style={{ margin: '8px 0' }}><button className="btn sm light" onClick={() => g.sortInv()}>↕ {t('inv.sort')}</button>{pick !== null && <button className="btn sm coral" onClick={() => { g.dropSlot(pick); setPick(null); }}>🗑️ {t('inv.discard')}</button>}<small style={{ color: 'var(--mute)' }}>{pick !== null ? g.name(g.def(ui.slots[pick]?.k)) + ' — ' + t('inv.move_hint2') : t('inv.move_hint')}</small></div></>}
    {tab === 'catalog' && <><div className="rowx" style={{ marginBottom: 8 }}><input className="in" style={{ flex: 1, minWidth: 120 }} placeholder={t('inv.search')} value={q} onChange={(e) => setQ(e.target.value)} dir="auto" /><select className="in" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((k) => <option key={k} value={k}>{t('cat.' + k)}</option>)}</select></div>
      <div className="cat">{all.map((d: any) => <button key={d.key} title={g.name(d)} onClick={() => { audio.play('ui_click'); g.give(d.key); }}><img src={iconURL(d, !!g.blockByKey[d.key])} alt={g.name(d)} /></button>)}</div>
      <small style={{ color: 'var(--mute)' }}>{t('inv.catalog_hint')}</small></>}
    {tab === 'craft' && <div className="list" style={{ maxHeight: '44vh', overflow: 'auto' }}>{recs.sort((a, b) => +b.can - +a.can).map((r) => <div className="rec" key={r.key} style={{ opacity: r.can || inf ? 1 : 0.55 }}><img src={iconURL(r.def, !!g.blockByKey[r.key])} alt="" /><b style={{ minWidth: 110 }}>{g.name(r.def)} ×{r.out}</b>
      <div className="need">{Object.keys(r.in).map((k) => <span key={k}>{g.name(g.def(k))} {g.count(k)}/{r.in[k]}</span>)}</div><button className="btn sm teal" disabled={!r.can} onClick={() => g.craft(r.key)}>{t('inv.make')}</button></div>)}</div>}
    <div style={{ marginTop: 10 }}><small style={{ color: 'var(--mute)' }}>{t('inv.hotbar')}</small><div className="invgrid">{Array.from({ length: 9 }, (_, i) => S(i))}</div></div>
  </div></div>;
}

function Chat({ c, g }: { c: Ctx; g: Game }) {
  const { t } = c, ui = g.ui; const [v, setV] = useState(''); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView(); }, [ui.chat.length]);
  const sendMsg = (e: any) => { e.preventDefault(); const s = v.trim(); if (s) g.chat(s); setV(''); };
  return <div className="ov clear" style={{ placeItems: 'end start' }}><div className="panel" style={{ width: 'min(480px,100%)', padding: 14 }}>
    <div className="rowx"><b style={{ flex: 1 }}>💬 {t('hud.chat')}</b><button className="btn sm light" onClick={() => g.setPanel('')}>✕</button></div>
    <div style={{ maxHeight: '38vh', overflow: 'auto', margin: '8px 0', display: 'grid', gap: 4 }}>{ui.chat.length === 0 && <small style={{ color: 'var(--mute)' }}>{t('chat.empty')}</small>}{ui.chat.map((m: any, i: number) => <div key={i} dir="auto" style={{ color: m.sys ? '#9a6b00' : undefined }}>{m.sys ? '• ' + m.text : <><b>{m.name}:</b> {m.text}</>}</div>)}<div ref={end} /></div>
    <form className="rowx" onSubmit={sendMsg}><input className="in" style={{ flex: 1 }} autoFocus value={v} maxLength={200} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') g.setPanel(''); e.stopPropagation(); }} placeholder={t('chat.placeholder')} dir="auto" /><button className="btn sm teal">{t('chat.send')}</button></form></div></div>;
}

function Missions({ c, g }: { c: Ctx; g: Game }) {
  const { t } = c, ui = g.ui, mode = ui.world?.mode, owner = ui.you?.role === 'owner';
  const list = c.content.missions.filter((m: any) => m.modes.includes(mode));
  const st = (id: number) => ui.missions.find((x: any) => x.id === id);
  const title = (m: any) => (c.lang === 'en' ? m.title_en : m.title_ar), desc = (m: any) => (c.lang === 'en' ? m.desc_en : m.desc_ar);
  const normal = list.filter((m: any) => m.type !== 'quiz' && !m.time_limit && st(m.id)), timed = list.filter((m: any) => m.time_limit > 0), quiz = list.filter((m: any) => m.type === 'quiz');
  return <div className="ov"><div className="panel">
    <div className="rowx" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, flex: 1 }}>📜 {t('hud.missions')}</h2><button className="btn sm light" onClick={() => g.setPanel('')}>✕</button></div>
    {!normal.length && !timed.length && !quiz.length && <p style={{ color: 'var(--mute)' }}>{ui.rules?.story ? t('mis.talk_npc') : t('mis.none')}</p>}
    <div className="list">
      {normal.map((m: any) => { const s = st(m.id), done = s.status === 'done'; return <div className="li" key={m.id} style={{ opacity: done ? 0.6 : 1 }}><span style={{ flex: 1 }}><b>{done ? '✅' : '📌'} {title(m)}</b><br /><small>{desc(m)}</small></span><span className="tag g">{m.type === 'reach_height' || m.type === 'talk' ? (done ? '✓' : '…') : `${s.progress}/${m.count}`}</span><span className="tag">+{m.points}</span></div>; })}
      {ui.rules?.story && normal.every((m: any) => st(m.id)?.status === 'done') && <div className="li">🗣️ {t('mis.talk_npc')}</div>}
      {timed.length > 0 && <b style={{ marginTop: 8 }}>🏆 {t('mis.challenges')}</b>}
      {timed.map((m: any) => <div className="li" key={m.id}><span style={{ flex: 1 }}><b>{title(m)}</b><br /><small>{desc(m)} · ⏱️ {Math.round(m.time_limit / 60)} {t('mis.minutes')}</small></span>
        {ui.chal?.id === m.id ? <span className="tag r">{ui.chal.progress}/{ui.chal.count}</span> : owner ? <button className="btn sm teal" disabled={!!ui.chal} onClick={() => { g.startChallenge(m.id); g.setPanel(''); }}>▶ {t('mis.start')}</button> : <span className="tag">{t('mis.owner_starts')}</span>}</div>)}
      {quiz.length > 0 && <b style={{ marginTop: 8 }}>🎓 {t('mis.quizzes')}</b>}
      {quiz.map((m: any) => { const done = st(m.id)?.status === 'done'; const wrong = ui.quiz && ui.quiz.id === m.id && !ui.quiz.ok && Date.now() - ui.quiz.at < 2500; const ch = c.lang === 'en' ? m.quiz?.choices_en : m.quiz?.choices_ar;
        return <div className="li" key={m.id} style={{ display: 'grid' }}><b>{done ? '✅' : '❓'} {title(m)}</b>{!done && <div className="rowx">{(ch || []).map((x: string, i: number) => <button key={i} className="btn sm light" onClick={() => g.answerQuiz(m.id, i)}>{x}</button>)}</div>}{wrong && <span className="err">{t('mis.wrong')}</span>}</div>; })}
    </div></div></div>;
}
