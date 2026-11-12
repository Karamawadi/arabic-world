// ذاكرة مؤقتة لمحتوى اللعبة المُدار من قاعدة البيانات (تُبطَل عند أي تعديل إداري)
import { all, J, setting } from './db.ts';

let cache: any = null;
export function invalidate() { cache = null; }
export function content() {
  if (cache) return cache;
  const blocks = all('SELECT * FROM blocks WHERE enabled=1 ORDER BY id').map((b) => ({ ...b, tex: J(b.tex, { all: ['#888', '#666', 'grain'] }), recipe: J(b.recipe) }));
  const items = all('SELECT * FROM items WHERE enabled=1 ORDER BY sort,id').map((i) => ({ ...i, icon: J(i.icon, ['#888', '#666', 'orb']), recipe: J(i.recipe) }));
  const blockIds: Record<string, number> = {}, blockById: any[] = [], itemByKey: Record<string, any> = {};
  for (const b of blocks) { blockIds[b.key] = b.id; blockById[b.id] = b; }
  for (const i of items) itemByKey[i.key] = i;
  const envs: Record<string, any> = {};
  for (const e of all('SELECT * FROM environments WHERE enabled=1')) envs[e.key] = { ...e, params: J(e.params, {}), sky: J(e.sky, {}), weather: J(e.weather, {}), animals: J(e.animals, []) };
  const prefabs: Record<string, any> = {};
  for (const s of all('SELECT * FROM structures WHERE enabled=1')) prefabs[s.key] = { w: s.w, d: s.d, site: s.site, ops: J(s.ops, []) };
  const missionsFull = all('SELECT * FROM missions WHERE enabled=1 ORDER BY sort,id').map((m) => ({ ...m, modes: J(m.modes, []), reward_items: J(m.reward_items), quiz: J(m.quiz) }));
  cache = {
    blocks, items, blockIds, blockById, itemByKey, envs, prefabs, missionsFull,
    countries: all('SELECT key,name_ar,name_en,flag FROM countries WHERE enabled=1 ORDER BY sort,id'),
    regions: all('SELECT key,country_key,name_ar,name_en,desc_ar,desc_en,environment_key FROM regions WHERE enabled=1 ORDER BY sort,id'),
    dialects: all('SELECT key,name_ar,name_en,is_default FROM dialects WHERE enabled=1 ORDER BY sort,id'),
    characters: all('SELECT key,name_ar,name_en,slot,kind,colors FROM characters WHERE enabled=1 ORDER BY sort,id').map((c) => ({ ...c, colors: J(c.colors, {}) })),
    achievements: all('SELECT * FROM achievements WHERE enabled=1 ORDER BY sort,id').map((a) => ({ ...a, reward_items: J(a.reward_items) })),
    templates: all('SELECT * FROM world_templates WHERE enabled=1 ORDER BY sort,id').map((t) => ({ ...t, settings: J(t.settings, {}) })),
    sounds: all('SELECT id,key,name,category,file,volume FROM sounds WHERE approved=1'),
    settings: {
      mode_rules: setting('mode_rules', {}), day_length_sec: setting('day_length_sec', 900), max_players_limit: setting('max_players_limit', 16),
      chat_enabled: setting('chat_enabled', true), registration_open: setting('registration_open', true), motd_ar: setting('motd_ar', ''), motd_en: setting('motd_en', ''),
      default_dialect: setting('default_dialect', 'ae'), max_worlds_per_player: setting('max_worlds_per_player', 12), autosave_sec: setting('autosave_sec', 15),
      room_system_enabled: setting('room_system_enabled', true), rooms_count: setting('rooms_count', 10), room_capacity: setting('room_capacity', 5), session_minutes: setting('session_minutes', 60),
      empty_release_sec: setting('empty_release_sec', 180), reconnect_hold_sec: setting('reconnect_hold_sec', 120),
    },
  };
  return cache;
}
// ما يُرسل للعميل (بدون إجابات الأسئلة)
export function publicContent() {
  const c = content();
  return {
    blocks: c.blocks, items: c.items, envs: c.envs, prefabs: c.prefabs, countries: c.countries, regions: c.regions, dialects: c.dialects, characters: c.characters,
    achievements: c.achievements, templates: c.templates, sounds: c.sounds, settings: c.settings,
    missions: c.missionsFull.map((m: any) => ({ ...m, quiz: m.quiz ? { choices_ar: m.quiz.choices_ar, choices_en: m.quiz.choices_en } : null })),
  };
}
