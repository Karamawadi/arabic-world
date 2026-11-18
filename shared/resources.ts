// تعريف موارد لوحة الإدارة (يُستخدم في الخادم للتحقق وفي الواجهة لتوليد الجداول والنماذج)
export interface Field { n: string; l: string; t: 'text' | 'area' | 'num' | 'bool' | 'json' | 'sel' | 'color'; o?: string[]; ref?: string; req?: boolean; ro?: boolean; hide?: boolean; d?: any; hint?: string }
export interface Resource { table: string; perm: string; title: string; pk: string; fields: Field[]; order?: string; search?: string[] }

export const PERMS = ['users.manage', 'worlds.manage', 'content.manage', 'sounds.manage', 'i18n.manage', 'monitor.view', 'reports.view', 'roles.manage', 'settings.manage'];
export const PERM_LABELS: Record<string, string> = {
  'users.manage': 'إدارة المستخدمين', 'worlds.manage': 'إدارة العوالم', 'content.manage': 'إدارة المحتوى (مكعبات، بيئات، مهام...)', 'sounds.manage': 'إدارة الأصوات',
  'i18n.manage': 'إدارة اللغات واللهجات', 'monitor.view': 'مراقبة اللعب الجماعي', 'reports.view': 'التقارير والتحليلات', 'roles.manage': 'الأدوار والصلاحيات', 'settings.manage': 'إعدادات اللعبة',
};
export const SOUND_KEYS = ['achievement', 'world_enter', 'world_exit', 'win', 'lose', 'mission_done', 'block_break', 'block_place', 'step', 'hurt', 'eat', 'ui_click', 'chat',
  'ambient_desert', 'ambient_sea', 'ambient_mountain', 'ambient_city', 'rain', 'wind', 'thunder', 'music_menu', 'music_game'];
export const PATTERNS = ['grain', 'sand', 'rock', 'layers', 'pebble', 'crack', 'smooth', 'brick', 'planks', 'bark', 'bark_x', 'rings', 'leaves', 'ore', 'glass', 'glass2', 'weave', 'lattice', 'vent', 'sadu', 'tiles', 'stripes',
  'metal', 'marble', 'coral', 'turf', 'lantern', 'door', 'door_open', 'oyster', 'water', 'shrub', 'flower', 'tuft', 'reed', 'table_top', 'table_side', 'furnace', 'furnace_top', 'tnt_side', 'tnt_top'];
export const BLOCK_CATS = ['natural', 'wood', 'plant', 'ore', 'building', 'heritage', 'modern', 'decor', 'special', 'liquid'];
export const ITEM_CATS = ['material', 'tool', 'weapon', 'food', 'vehicle', 'heritage'];
export const STRUCT_KEYS = ['fort', 'watchtower', 'barjeel_house', 'souq', 'tent', 'well', 'skyscraper', 'villa', 'dome_hall', 'pier', 'dhow', 'lighthouse', 'palm_farm', 'pyramid', 'rock_tomb'];

const names: Field[] = [{ n: 'name_ar', l: 'الاسم بالعربية', t: 'text', req: true }, { n: 'name_en', l: 'الاسم بالإنجليزية', t: 'text', req: true }];
const en: Field = { n: 'enabled', l: 'مفعّل', t: 'bool', d: 1 };
const sort: Field = { n: 'sort', l: 'الترتيب', t: 'num', d: 0, hide: true };
const key: Field = { n: 'key', l: 'المعرّف (key)', t: 'text', req: true, hint: 'أحرف إنجليزية وأرقام و _ فقط' };

export const RES: Record<string, Resource> = {
  countries: { table: 'countries', perm: 'content.manage', title: 'الدول', pk: 'id', order: 'sort,id', fields: [key, ...names, { n: 'flag', l: 'العلم (رمز)', t: 'text' }, sort, en] },
  regions: { table: 'regions', perm: 'content.manage', title: 'المناطق والإمارات والمدن', pk: 'id', order: 'sort,id', fields: [key, { n: 'country_key', l: 'الدولة', t: 'sel', ref: 'countries', req: true }, ...names,
    { n: 'environment_key', l: 'البيئة', t: 'sel', ref: 'environments', req: true }, { n: 'desc_ar', l: 'الوصف بالعربية', t: 'area', hide: true }, { n: 'desc_en', l: 'الوصف بالإنجليزية', t: 'area', hide: true }, sort, en] },
  environments: { table: 'environments', perm: 'content.manage', title: 'البيئات والتضاريس', pk: 'id', fields: [key, ...names, { n: 'desc_ar', l: 'الوصف بالعربية', t: 'area', hide: true }, { n: 'desc_en', l: 'الوصف بالإنجليزية', t: 'area', hide: true },
    { n: 'params', l: 'إعدادات التضاريس (JSON)', t: 'json', hide: true, d: { coast: 'west', duneAmp: 6, trees: [{ type: 'palm', density: 0.01, zone: 'low' }], plants: [], structures: [{ key: 'tent', freq: 0.1 }] } },
    { n: 'sky', l: 'السماء والضباب (JSON)', t: 'json', hide: true, d: { day: '#8cc4ea', horizon: '#f4e2c2', fog: 0.011 } },
    { n: 'weather', l: 'أوزان الطقس (JSON)', t: 'json', hide: true, d: { clear: 78, rain: 4, storm: 2, fog: 6, sandstorm: 10 } },
    { n: 'animals', l: 'الحيوانات (JSON)', t: 'json', hide: true, d: ['camel'], hint: 'camel horse goat sheep cow chicken oryx gazelle fox cat flamingo turtle fish' }, { n: 'ambient', l: 'صوت المحيط', t: 'sel', o: ['desert', 'sea', 'mountain', 'city'], d: 'desert' }, en] },
  structures: { table: 'structures', perm: 'content.manage', title: 'المباني الجاهزة (Prefabs)', pk: 'id', fields: [key, ...names, { n: 'w', l: 'العرض', t: 'num', d: 5 }, { n: 'd', l: 'العمق', t: 'num', d: 5 },
    { n: 'site', l: 'الموقع', t: 'sel', o: ['land', 'water', 'coast', 'any'], d: 'land' },
    { n: 'ops', l: 'عمليات البناء (JSON)', t: 'json', hide: true, d: [['hollow', 0, 0, 0, 4, 3, 4, 'mud_brick'], ['box', 0, 4, 0, 4, 4, 4, 'arish'], ['clear', 2, 0, 0, 2, 1, 0], ['set', 2, 2, 2, 'lantern']], hint: '["box"|"hollow",x0,y0,z0,x1,y1,z1,"block"] ، ["clear",x0,y0,z0,x1,y1,z1] ، ["set",x,y,z,"block"]' }, en] },
  blocks: { table: 'blocks', perm: 'content.manage', title: 'المكعبات', pk: 'id', order: 'id', fields: [{ n: 'id', l: 'الرقم', t: 'num', ro: true }, key, ...names, { n: 'category', l: 'التصنيف', t: 'sel', o: BLOCK_CATS, d: 'building' },
    { n: 'tex', l: 'المظهر (JSON)', t: 'json', hide: true, d: { all: ['#c98a4a', '#a56a32', 'brick'] }, hint: '{"all":[لون1,لون2,نقش]} أو {"top":[..],"side":[..],"bottom":[..]}' },
    { n: 'shape', l: 'الشكل', t: 'sel', o: ['cube', 'cross', 'liquid'], d: 'cube', hide: true }, { n: 'solid', l: 'صلب', t: 'bool', d: 1, hide: true }, { n: 'opaque', l: 'معتم', t: 'bool', d: 1, hide: true },
    { n: 'hardness', l: 'الصلابة (ثوانٍ)', t: 'num', d: 1 }, { n: 'tool', l: 'الأداة المناسبة', t: 'sel', o: ['', 'pick', 'axe', 'shovel'], hide: true }, { n: 'min_tier', l: 'أدنى مستوى أداة', t: 'num', d: 0, hide: true },
    { n: 'drop_key', l: 'ما يسقطه (key أو none)', t: 'text', hide: true }, { n: 'drop_n', l: 'عدد السقوط', t: 'num', d: 1, hide: true }, { n: 'drop_chance', l: 'احتمال السقوط', t: 'num', d: 1, hide: true },
    { n: 'emissive', l: 'مضيء', t: 'bool', d: 0, hide: true }, { n: 'rot_group', l: 'مجموعة التدوير', t: 'text', hide: true }, { n: 'toggle', l: 'يتحول عند التفاعل إلى', t: 'text', hide: true },
    { n: 'recipe', l: 'وصفة الصنع (JSON)', t: 'json', hide: true, hint: '{"in":{"sand":2},"out":1} — أضف "at":"table" لطاولة الصناعة أو "at":"furnace" للفرن' }, en] },
  items: { table: 'items', perm: 'content.manage', title: 'العناصر والأدوات', pk: 'id', order: 'sort,id', fields: [key, ...names, { n: 'category', l: 'التصنيف', t: 'sel', o: ITEM_CATS, d: 'material' },
    { n: 'icon', l: 'الأيقونة (JSON)', t: 'json', hide: true, d: ['#c7ccd1', '#8a6a3c', 'gem'], hint: '[لون1, لون2, شكل] الأشكال: stick ingot gem orb pick axe shovel sword shield disc cup boat buggy meat drumstick fish leather feather powder wool' },
    { n: 'tool', l: 'نوع الأداة', t: 'sel', o: ['', 'pick', 'axe', 'shovel', 'sword', 'shield'] }, { n: 'tier', l: 'المستوى', t: 'num', d: 0 }, { n: 'power', l: 'القوة', t: 'num', d: 0, hide: true },
    { n: 'food', l: 'قيمة الغذاء', t: 'num', d: 0 }, { n: 'vehicle', l: 'مركبة', t: 'sel', o: ['', 'boat', 'buggy'], hide: true }, { n: 'stack', l: 'حد التكديس', t: 'num', d: 64, hide: true },
    { n: 'recipe', l: 'وصفة الصنع (JSON)', t: 'json', hide: true, hint: '{"in":{"stone":3,"stick":2},"out":1,"at":"table"} — at: table أو furnace أو بدون' }, sort, en] },
  characters: { table: 'characters', perm: 'content.manage', title: 'الشخصيات والأزياء', pk: 'id', order: 'slot,sort,id', fields: [key, ...names, { n: 'slot', l: 'الخانة', t: 'sel', o: ['outfit', 'head', 'hair', 'accessory'], req: true, d: 'outfit' },
    { n: 'kind', l: 'القالب', t: 'sel', o: ['robe', 'cloak', 'casual', 'none', 'ghutra', 'turban', 'cap', 'shayla', 'short', 'long', 'curly', 'glasses', 'backpack', 'falcon', 'belt'], req: true, d: 'robe' },
    { n: 'colors', l: 'الألوان (JSON)', t: 'json', d: { main: '#f5f3ee', trim: '#d6a94a' }, hint: '{"main":"#..","trim":"#.."}' }, sort, en] },
  achievements: { table: 'achievements', perm: 'content.manage', title: 'الإنجازات', pk: 'id', order: 'sort,id', fields: [key, { n: 'title_ar', l: 'العنوان بالعربية', t: 'text', req: true }, { n: 'title_en', l: 'العنوان بالإنجليزية', t: 'text', req: true },
    { n: 'desc_ar', l: 'الوصف بالعربية', t: 'area', hide: true }, { n: 'desc_en', l: 'الوصف بالإنجليزية', t: 'area', hide: true }, { n: 'icon', l: 'الأيقونة', t: 'text' },
    { n: 'stat', l: 'الإحصائية المُراقبة', t: 'text', req: true, hint: 'placed_total, broken_total, broken:<block>, placed:<block>, broken_cat:<cat>, placed_cat:<cat>, max_height, caves_found, friends_played, missions_done, quizzes_done, challenges_done, group_challenges_done, houses_built, worlds_created' },
    { n: 'threshold', l: 'القيمة المطلوبة', t: 'num', d: 1 }, { n: 'points', l: 'النقاط', t: 'num', d: 10 }, { n: 'reward_items', l: 'مكافأة عناصر (JSON)', t: 'json', hide: true, hint: '{"lantern":2}' },
    { n: 'sound_key', l: 'صوت الإنجاز (مفتاح الصوت)', t: 'text', d: 'achievement' }, sort, en] },
  missions: { table: 'missions', perm: 'content.manage', title: 'المهام والتحديات', pk: 'id', order: 'sort,id', fields: [key, { n: 'title_ar', l: 'العنوان / السؤال بالعربية', t: 'text', req: true }, { n: 'title_en', l: 'العنوان / السؤال بالإنجليزية', t: 'text', req: true },
    { n: 'desc_ar', l: 'الوصف بالعربية', t: 'area', hide: true }, { n: 'desc_en', l: 'الوصف بالإنجليزية', t: 'area', hide: true },
    { n: 'type', l: 'النوع', t: 'sel', o: ['break', 'place', 'reach_height', 'talk', 'quiz'], req: true, d: 'break' }, { n: 'target', l: 'الهدف', t: 'text', hint: 'مفتاح مكعب، أو cat:<تصنيف>، أو any، أو دور الشخصية (guide/elder/merchant/teacher)' },
    { n: 'count', l: 'العدد / الارتفاع', t: 'num', d: 1 }, { n: 'modes', l: 'الأنماط (JSON)', t: 'json', d: ['survival'], hint: '["creative","survival","adventure","challenge","education"]' },
    { n: 'npc', l: 'شخصية المهمة', t: 'sel', o: ['', 'guide', 'elder', 'merchant', 'teacher'], hide: true }, { n: 'time_limit', l: 'المهلة بالثواني (تحدٍّ)', t: 'num', d: 0 }, { n: 'points', l: 'النقاط', t: 'num', d: 15 },
    { n: 'reward_items', l: 'مكافأة عناصر (JSON)', t: 'json', hide: true }, { n: 'quiz', l: 'بيانات السؤال (JSON)', t: 'json', hide: true, hint: '{"choices_ar":["..",".."],"choices_en":["..",".."],"answer":0}' }, sort, en] },
  dialects: { table: 'dialects', perm: 'i18n.manage', title: 'اللهجات', pk: 'id', order: 'sort,id', fields: [key, ...names, { n: 'is_default', l: 'الافتراضية', t: 'bool', d: 0 }, sort, en] },
  translations: { table: 'translations', perm: 'i18n.manage', title: 'النصوص والترجمات', pk: 'id', order: 'key,lang,dialect', search: ['key', 'value'], fields: [{ n: 'key', l: 'المفتاح', t: 'text', req: true }, { n: 'lang', l: 'اللغة', t: 'sel', o: ['ar', 'en'], req: true, d: 'ar' },
    { n: 'dialect', l: 'اللهجة (فارغ = الأساس)', t: 'sel', ref: 'dialects', d: '' }, { n: 'value', l: 'النص', t: 'area', req: true }] },
  templates: { table: 'world_templates', perm: 'worlds.manage', title: 'مكتبة العوالم الجاهزة', pk: 'id', order: 'sort,id', fields: [key, ...names, { n: 'desc_ar', l: 'الوصف بالعربية', t: 'area', hide: true }, { n: 'desc_en', l: 'الوصف بالإنجليزية', t: 'area', hide: true },
    { n: 'environment', l: 'البيئة', t: 'sel', ref: 'environments', req: true }, { n: 'country', l: 'الدولة', t: 'sel', ref: 'countries' }, { n: 'region', l: 'المنطقة', t: 'sel', ref: 'regions' },
    { n: 'mode', l: 'النمط', t: 'sel', o: ['creative', 'survival', 'adventure', 'challenge', 'education'], d: 'creative' }, { n: 'settings', l: 'الإعدادات (JSON)', t: 'json', hide: true, d: { npcs: ['guide'] } }, sort, en] },
  roles: { table: 'admin_roles', perm: 'roles.manage', title: 'الأدوار', pk: 'key', fields: [key, ...names, { n: 'permissions', l: 'الصلاحيات', t: 'json', d: [] }] },
};
