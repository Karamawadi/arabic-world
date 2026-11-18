// المحتوى الأساسي للعبة (يُزرع مرة واحدة ثم يُدار من لوحة الإدارة)
import { all, get, run, tx, now } from './db.ts';
import { AR, EN, DIALECTS } from './i18n-seed.ts';

const S = (o: any) => JSON.stringify(o);
const count = (t: string) => get(`SELECT COUNT(*) n FROM ${t}`).n as number;

function blocks() {
  const b = (id: number, key: string, ar: string, en: string, category: string, tex: any, x: any = {}) =>
    run(`INSERT INTO blocks(id,key,name_ar,name_en,category,tex,shape,solid,opaque,hardness,tool,min_tier,drop_key,drop_n,drop_chance,emissive,rot_group,toggle,recipe,sort)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, key, ar, en, category, S(tex), x.shape || 'cube', x.solid ?? 1, x.opaque ?? 1, x.h ?? 1, x.tool || null, x.tier || 0,
      x.drop || null, x.dropN || 1, x.chance ?? 1, x.em || 0, x.rot || null, x.toggle || null, x.recipe ? S(x.recipe) : null, id);
  const a = (c: string, c2: string, p: string) => ({ all: [c, c2, p] });
  b(1, 'stone', 'حجر', 'Stone', 'natural', a('#8d8f94', '#75777d', 'rock'), { h: 1.6, tool: 'pick' });
  b(2, 'sand', 'رمل', 'Sand', 'natural', a('#e8cf95', '#d9bd7d', 'sand'), { h: 0.45, tool: 'shovel' });
  b(3, 'red_sand', 'رمل أحمر', 'Red Sand', 'natural', a('#d98a55', '#c47543', 'sand'), { h: 0.45, tool: 'shovel' });
  b(4, 'sandstone', 'حجر رملي', 'Sandstone', 'natural', a('#d9bc85', '#c4a56e', 'layers'), { h: 1.2, tool: 'pick' });
  b(5, 'red_sandstone', 'حجر رملي أحمر', 'Red Sandstone', 'natural', a('#c2714a', '#a95c3a', 'layers'), { h: 1.3, tool: 'pick' });
  b(6, 'dirt', 'تراب', 'Soil', 'natural', a('#8a6a48', '#765939', 'grain'), { h: 0.5, tool: 'shovel' });
  b(7, 'grass', 'عشب', 'Grass', 'natural', { top: ['#7fae4e', '#6c9a40', 'grain'], side: ['#8a6a48', '#7fae4e', 'turf'], bottom: ['#8a6a48', '#765939', 'grain'] }, { h: 0.55, tool: 'shovel' });
  b(8, 'gravel', 'حصى', 'Gravel', 'natural', a('#a59c8e', '#857d71', 'pebble'), { h: 0.6, tool: 'shovel' });
  b(9, 'mountain_rock', 'صخر جبال الحجر', 'Hajar Rock', 'natural', a('#6f6259', '#5a4f48', 'rock'), { h: 2, tool: 'pick' });
  b(10, 'limestone', 'حجر جيري', 'Limestone', 'natural', a('#d7d0c0', '#c2baa8', 'rock'), { h: 1.4, tool: 'pick' });
  b(11, 'clay', 'طين', 'Clay', 'natural', a('#b08d6e', '#9c7b5e', 'smooth'), { h: 0.6, tool: 'shovel' });
  b(12, 'water', 'ماء', 'Water', 'liquid', a('#2f8fb8', '#49a9cf', 'water'), { shape: 'liquid', solid: 0, opaque: 0, h: -1 });
  b(13, 'bedrock', 'حجر القاع', 'Bedrock', 'natural', a('#3a3a40', '#26262b', 'rock'), { h: -1 });
  b(14, 'salt_flat', 'سبخة', 'Salt Flat', 'natural', a('#ece7dc', '#d8d0c0', 'crack'), { h: 0.7, tool: 'shovel' });
  b(15, 'coral_stone', 'حجر مرجاني', 'Coral Stone', 'heritage', a('#e3d6c1', '#c9b89d', 'coral'), { h: 1.4, tool: 'pick', recipe: { in: { limestone: 1, sand: 1 }, out: 2 } });
  b(16, 'palm_log', 'جذع نخلة', 'Palm Trunk', 'wood', { top: ['#b89468', '#8b6a44', 'rings'], side: ['#8b6a44', '#6e5233', 'bark'], bottom: ['#b89468', '#8b6a44', 'rings'] }, { h: 1.2, tool: 'axe', rot: 'palm_log' });
  b(17, 'palm_log_x', 'جذع نخلة (أفقي)', 'Palm Trunk (X)', 'wood', a('#8b6a44', '#6e5233', 'bark_x'), { h: 1.2, tool: 'axe', rot: 'palm_log', drop: 'palm_log' });
  b(18, 'palm_log_z', 'جذع نخلة (عرضي)', 'Palm Trunk (Z)', 'wood', a('#93714a', '#6e5233', 'bark_x'), { h: 1.2, tool: 'axe', rot: 'palm_log', drop: 'palm_log' });
  b(19, 'palm_leaves', 'سعف النخيل', 'Palm Fronds', 'plant', a('#4f8f3a', '#3c7a2c', 'leaves'), { opaque: 0, h: 0.2, drop: 'dates', chance: 0.3 });
  b(20, 'ghaf_log', 'جذع الغاف', 'Ghaf Trunk', 'wood', { top: ['#a98d6c', '#6b5a48', 'rings'], side: ['#6b5a48', '#55473a', 'bark'], bottom: ['#a98d6c', '#6b5a48', 'rings'] }, { h: 1.3, tool: 'axe' });
  b(21, 'ghaf_leaves', 'أوراق الغاف', 'Ghaf Leaves', 'plant', a('#6f9a52', '#5b8443', 'leaves'), { opaque: 0, h: 0.2, drop: 'none' });
  b(22, 'mangrove_log', 'جذع القرم', 'Mangrove Trunk', 'wood', a('#5c4a3c', '#48392e', 'bark'), { h: 1.3, tool: 'axe' });
  b(23, 'mangrove_leaves', 'أوراق القرم', 'Mangrove Leaves', 'plant', a('#3f7f4a', '#2f6a3a', 'leaves'), { opaque: 0, h: 0.2, drop: 'none' });
  b(24, 'palm_planks', 'ألواح النخيل', 'Palm Planks', 'building', a('#c9a372', '#ad8857', 'planks'), { h: 1, tool: 'axe', recipe: { in: { palm_log: 1 }, out: 4 } });
  b(25, 'ghaf_planks', 'ألواح الغاف', 'Ghaf Planks', 'building', a('#9b7d5b', '#806446', 'planks'), { h: 1, tool: 'axe', recipe: { in: { ghaf_log: 1 }, out: 4 } });
  b(26, 'mud_brick', 'طابوق طيني', 'Mud Brick', 'heritage', a('#b88e62', '#96704a', 'brick'), { h: 1.4, tool: 'pick', recipe: { in: { clay: 2 }, out: 2 } });
  b(27, 'plaster', 'جص أبيض', 'White Plaster', 'heritage', a('#f3efe6', '#e2dccf', 'smooth'), { h: 1.1, tool: 'pick', recipe: { in: { limestone: 1 }, out: 2 } });
  b(28, 'arish', 'عريش', 'Arish Panel', 'heritage', a('#c8a86a', '#a3854c', 'weave'), { h: 0.6, tool: 'axe', recipe: { in: { palm_leaves: 3 }, out: 2 } });
  b(29, 'mashrabiya', 'مشربية', 'Mashrabiya', 'heritage', a('#8a6238', '#6e4c2a', 'lattice'), { opaque: 0, h: 0.6, tool: 'axe', recipe: { in: { palm_planks: 2 }, out: 2 } });
  b(30, 'barjeel', 'برجيل', 'Barjeel Vent', 'heritage', a('#e6d9c2', '#5b4a3a', 'vent'), { h: 1.2, tool: 'pick', recipe: { in: { coral_stone: 2, palm_planks: 1 }, out: 2 } });
  b(31, 'glass', 'زجاج', 'Glass', 'building', a('#cfe9f2', '#ffffff', 'glass'), { opaque: 0, h: 0.3, recipe: { in: { sand: 2 }, out: 1 } });
  b(32, 'tinted_glass', 'زجاج أزرق', 'Blue Glass', 'modern', a('#3d86b3', '#8cc6e6', 'glass2'), { h: 0.4, recipe: { in: { glass: 2, copper_ore: 1 }, out: 2 } });
  b(33, 'concrete', 'خرسانة', 'Concrete', 'modern', a('#c9c9c6', '#b7b7b3', 'smooth'), { h: 1.8, tool: 'pick', recipe: { in: { gravel: 1, sand: 1 }, out: 2 } });
  b(34, 'steel', 'فولاذ', 'Steel', 'modern', a('#9aa7b3', '#7d8b98', 'metal'), { h: 3, tool: 'pick', tier: 2, recipe: { in: { iron_ingot: 2 }, out: 1 } });
  b(35, 'marble', 'رخام', 'Marble', 'building', a('#f4f2ee', '#d9d5cf', 'marble'), { h: 1.6, tool: 'pick', recipe: { in: { limestone: 2 }, out: 1 } });
  b(36, 'sadu', 'نسيج السدو', 'Sadu Weave', 'heritage', a('#a8272d', '#f0e6d2', 'sadu'), { h: 0.5, recipe: { in: { palm_leaves: 2, desert_flower: 1 }, out: 1 } });
  b(37, 'lantern', 'فانوس', 'Lantern', 'heritage', a('#f7c948', '#5b3d1e', 'lantern'), { h: 0.3, em: 1, toggle: 'lantern_off', recipe: { in: { iron_ingot: 1, glass: 1 }, out: 1 } });
  b(38, 'lantern_off', 'فانوس مطفأ', 'Lantern (off)', 'decor', a('#8d7a4a', '#5b3d1e', 'lantern'), { h: 0.3, toggle: 'lantern', drop: 'lantern' });
  b(39, 'door_closed', 'باب خشبي منقوش', 'Carved Door', 'heritage', a('#7a4f2a', '#d6a94a', 'door'), { h: 1, tool: 'axe', toggle: 'door_open', recipe: { in: { palm_planks: 3 }, out: 1 } });
  b(40, 'door_open', 'باب مفتوح', 'Open Door', 'decor', a('#7a4f2a', '#d6a94a', 'door_open'), { solid: 0, opaque: 0, h: 1, tool: 'axe', toggle: 'door_closed', drop: 'door_closed' });
  b(41, 'copper_ore', 'خام النحاس', 'Copper Ore', 'ore', a('#8d8f94', '#d07a45', 'ore'), { h: 2.4, tool: 'pick', tier: 1 });
  b(42, 'iron_ore', 'خام الحديد', 'Iron Ore', 'ore', a('#8d8f94', '#c9a58c', 'ore'), { h: 2.8, tool: 'pick', tier: 2 });
  b(43, 'gold_ore', 'خام الذهب', 'Gold Ore', 'ore', a('#8d8f94', '#f2c94c', 'ore'), { h: 3.2, tool: 'pick', tier: 3 });
  b(44, 'diamond_ore', 'خام الألماس', 'Diamond Ore', 'ore', a('#8d8f94', '#69e0e6', 'ore'), { h: 3.8, tool: 'pick', tier: 3, drop: 'diamond' });
  b(45, 'oyster', 'محار', 'Oyster', 'natural', a('#b9b3a6', '#f4eee2', 'oyster'), { h: 0.8, drop: 'pearl', chance: 0.6 });
  b(46, 'desert_shrub', 'شجيرة صحراوية', 'Desert Shrub', 'plant', a('#8a9a52', '#6f7d3f', 'shrub'), { shape: 'cross', solid: 0, opaque: 0, h: 0.05 });
  b(47, 'desert_flower', 'زهرة البر', 'Desert Flower', 'plant', a('#e8c53a', '#5f8f3a', 'flower'), { shape: 'cross', solid: 0, opaque: 0, h: 0.05 });
  b(48, 'dry_grass', 'عشب جاف', 'Dry Grass', 'plant', a('#c9b56a', '#a8944f', 'tuft'), { shape: 'cross', solid: 0, opaque: 0, h: 0.05 });
  b(49, 'reed', 'قصب', 'Reed', 'plant', a('#6fa04a', '#c9b56a', 'reed'), { shape: 'cross', solid: 0, opaque: 0, h: 0.05 });
  b(50, 'frank_log', 'شجرة اللبان', 'Frankincense Wood', 'wood', a('#a08a72', '#7d6a55', 'bark'), { h: 1.2, tool: 'axe', drop: 'frankincense' });
  b(51, 'acacia_log', 'جذع السمر', 'Samr Trunk', 'wood', a('#6e5a44', '#584635', 'bark'), { h: 1.3, tool: 'axe' });
  b(52, 'acacia_leaves', 'أوراق السمر', 'Samr Leaves', 'plant', a('#7c9a4a', '#66823a', 'leaves'), { opaque: 0, h: 0.2, drop: 'none' });
  b(53, 'asphalt', 'أسفلت', 'Asphalt', 'modern', a('#3f4347', '#34383b', 'grain'), { h: 1.6, tool: 'pick', recipe: { in: { gravel: 2 }, out: 2 } });
  b(54, 'gold_block', 'مكعب ذهب', 'Gold Block', 'decor', a('#f2c94c', '#d9a92e', 'metal'), { h: 2, tool: 'pick', tier: 2, recipe: { in: { gold_ingot: 4 }, out: 1 } });
  b(55, 'diamond_block', 'مكعب ألماس', 'Diamond Block', 'decor', a('#69e0e6', '#3fc0c9', 'metal'), { h: 2.5, tool: 'pick', tier: 3, recipe: { in: { diamond: 4 }, out: 1 } });
  b(56, 'zellige', 'بلاط مزخرف', 'Patterned Tile', 'decor', a('#1f6f9c', '#f1ead8', 'tiles'), { h: 1.2, tool: 'pick', recipe: { in: { clay: 1, copper_ore: 1 }, out: 2 } });
  b(57, 'dhow_wood', 'خشب السفن', 'Dhow Timber', 'building', a('#6b452a', '#55351f', 'planks'), { h: 1.2, tool: 'axe', recipe: { in: { ghaf_log: 1 }, out: 4 } });
  b(58, 'tent_cloth', 'قماش بيت الشعر', 'Tent Cloth', 'heritage', a('#2e2a28', '#e9e2d2', 'stripes'), { h: 0.4, recipe: { in: { dry_grass: 3 }, out: 1 } });
  b(59, 'basalt', 'بازلت', 'Basalt', 'natural', a('#4a4a50', '#3a3a40', 'rock'), { h: 2, tool: 'pick' });
  b(60, 'granite', 'غرانيت وردي', 'Pink Granite', 'natural', a('#c79a8c', '#a87c70', 'pebble'), { h: 2, tool: 'pick' });
  b(61, 'limestone_brick', 'طوب جيري', 'Limestone Brick', 'building', a('#e0d3b0', '#c4b48c', 'brick'), { h: 1.6, tool: 'pick', recipe: { in: { limestone: 1 }, out: 1 } });
}

function items() {
  let n = 0;
  const it = (key: string, ar: string, en: string, category: string, icon: any, x: any = {}) =>
    run(`INSERT INTO items(key,name_ar,name_en,category,icon,tool,tier,power,food,vehicle,stack,recipe,sort) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      key, ar, en, category, S(icon), x.tool || null, x.tier || 0, x.power || 0, x.food || 0, x.vehicle || null, x.stack || 64, x.recipe ? S(x.recipe) : null, n++);
  it('stick', 'عصا', 'Stick', 'material', ['#b08a55', '#8a6a3c', 'stick'], { recipe: { in: { palm_planks: 1 }, out: 4 } });
  it('copper_ingot', 'سبيكة نحاس', 'Copper Ingot', 'material', ['#d07a45', '#a85a2c', 'ingot'], { recipe: { in: { copper_ore: 1, palm_log: 1 }, out: 1 } });
  it('iron_ingot', 'سبيكة حديد', 'Iron Ingot', 'material', ['#c7ccd1', '#9aa1a8', 'ingot'], { recipe: { in: { iron_ore: 1, palm_log: 1 }, out: 1 } });
  it('gold_ingot', 'سبيكة ذهب', 'Gold Ingot', 'material', ['#f2c94c', '#c99a22', 'ingot'], { recipe: { in: { gold_ore: 1, palm_log: 1 }, out: 1 } });
  it('diamond', 'ألماس', 'Diamond', 'material', ['#69e0e6', '#2fb0ba', 'gem']);
  it('pearl', 'لؤلؤة', 'Pearl', 'heritage', ['#f7f2ea', '#d9cfc0', 'orb']);
  it('frankincense', 'لبان', 'Frankincense', 'heritage', ['#e8d49a', '#c2a860', 'gem']);
  it('wood_pickaxe', 'معول خشبي', 'Wooden Pickaxe', 'tool', ['#c9a372', '#8a6a3c', 'pick'], { tool: 'pick', tier: 1, stack: 1, recipe: { in: { palm_planks: 3, stick: 2 }, out: 1 } });
  it('stone_pickaxe', 'معول حجري', 'Stone Pickaxe', 'tool', ['#8d8f94', '#8a6a3c', 'pick'], { tool: 'pick', tier: 2, stack: 1, recipe: { in: { stone: 3, stick: 2 }, out: 1 } });
  it('iron_pickaxe', 'معول حديدي', 'Iron Pickaxe', 'tool', ['#c7ccd1', '#8a6a3c', 'pick'], { tool: 'pick', tier: 3, stack: 1, recipe: { in: { iron_ingot: 3, stick: 2 }, out: 1 } });
  it('diamond_pickaxe', 'معول ألماسي', 'Diamond Pickaxe', 'tool', ['#69e0e6', '#8a6a3c', 'pick'], { tool: 'pick', tier: 4, stack: 1, recipe: { in: { diamond: 3, stick: 2 }, out: 1 } });
  it('stone_axe', 'فأس حجري', 'Stone Axe', 'tool', ['#8d8f94', '#8a6a3c', 'axe'], { tool: 'axe', tier: 2, stack: 1, recipe: { in: { stone: 3, stick: 2 }, out: 1 } });
  it('iron_axe', 'فأس حديدي', 'Iron Axe', 'tool', ['#c7ccd1', '#8a6a3c', 'axe'], { tool: 'axe', tier: 3, stack: 1, recipe: { in: { iron_ingot: 3, stick: 2 }, out: 1 } });
  it('shovel', 'مجرفة', 'Shovel', 'tool', ['#c7ccd1', '#8a6a3c', 'shovel'], { tool: 'shovel', tier: 2, stack: 1, recipe: { in: { stone: 1, stick: 2 }, out: 1 } });
  it('sword', 'سيف', 'Sword', 'weapon', ['#dfe5ea', '#c99a22', 'sword'], { tool: 'sword', power: 6, stack: 1, recipe: { in: { iron_ingot: 2, stick: 1 }, out: 1 } });
  it('shield', 'ترس', 'Shield', 'weapon', ['#8a6238', '#c7ccd1', 'shield'], { tool: 'shield', power: 0.5, stack: 1, recipe: { in: { palm_planks: 4, iron_ingot: 1 }, out: 1 } });
  it('dates', 'تمر', 'Dates', 'food', ['#7a3f1e', '#a85f2c', 'orb'], { food: 3 });
  it('bread', 'خبز رقاق', 'Regag Bread', 'food', ['#e3c48a', '#c9a060', 'disc'], { food: 5, recipe: { in: { dry_grass: 3 }, out: 1 } });
  it('luqaimat', 'لقيمات', 'Luqaimat', 'food', ['#d99a3a', '#a86a1c', 'orb'], { food: 8, recipe: { in: { dates: 2, bread: 1 }, out: 3 } });
  it('gahwa', 'قهوة عربية', 'Arabic Coffee', 'food', ['#c99a22', '#7a4f2a', 'cup'], { food: 1, power: 1, recipe: { in: { desert_flower: 1, dry_grass: 1 }, out: 1 } });
  it('abra', 'عبرة (قارب)', 'Abra Boat', 'vehicle', ['#6b452a', '#e9e2d2', 'boat'], { vehicle: 'boat', stack: 1, recipe: { in: { dhow_wood: 6 }, out: 1 } });
  it('buggy', 'دراجة الكثبان', 'Dune Buggy', 'vehicle', ['#d9482e', '#3f4347', 'buggy'], { vehicle: 'buggy', stack: 1, recipe: { in: { steel: 2, iron_ingot: 2 }, out: 1 } });
}

const W = { clear: 78, rain: 4, storm: 2, fog: 6, sandstorm: 10 };
const sky = (day: string, horizon: string, fog = 0.011) => ({ day, horizon, fog });
const ENVS: any[] = [
  ['rak_mountains', 'جبال رأس الخيمة', 'Ras Al Khaimah Mountains', 'جبال الحجر الشاهقة وقمة جبل جيس، وديان، شواطئ وقلاع.', 'Towering Hajar mountains, wadis, beaches and forts.',
    { coast: 'west', landBias: 0.2, mtAmp: 74, mtT: 0.4, mtScale: 240, wadi: true, duneAmp: 3, patch: 0.22, surface2: 'gravel', rockLine: 22, peakLine: 54,
      trees: [{ type: 'palm', density: 0.006, zone: 'coast' }, { type: 'acacia', density: 0.004, zone: 'wadi' }, { type: 'ghaf', density: 0.0025, zone: 'low' }],
      plants: [{ block: 'desert_shrub', density: 0.02 }, { block: 'dry_grass', density: 0.025 }],
      structures: [{ key: 'fort', freq: 0.14 }, { key: 'watchtower', freq: 0.14 }, { key: 'palm_farm', freq: 0.08 }, { key: 'well', freq: 0.05 }, { key: 'tent', freq: 0.05 }, { key: 'barjeel_house', freq: 0.06 }, { key: 'pier', freq: 0.1 }, { key: 'dhow', freq: 0.1 }] },
    sky('#86bfe6', '#f1dcb6'), { ...W, fog: 14, rain: 8 }, ['goat', 'camel', 'oryx'], 'mountain'],
  ['dubai_city', 'دبي: أبراج وصحراء', 'Dubai: Towers & Desert', 'ناطحات سحاب حديثة، مراسٍ، وكثبان ذهبية على أطراف المدينة.', 'Modern skyscrapers, marinas and golden dunes.',
    { coast: 'west', landBias: 0.18, duneAmp: 8, structCell: 32, city: { t: 0.4, structures: [{ key: 'skyscraper', freq: 0.62 }, { key: 'villa', freq: 0.16 }, { key: 'dome_hall', freq: 0.05 }] },
      trees: [{ type: 'palm', density: 0.006, zone: 'coast' }, { type: 'ghaf', density: 0.002, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.015 }],
      structures: [{ key: 'tent', freq: 0.03 }, { key: 'pier', freq: 0.2 }, { key: 'dhow', freq: 0.12 }, { key: 'souq', freq: 0.02 }, { key: 'well', freq: 0.02 }] },
    sky('#8cc4ea', '#f4e2c2'), W, ['camel', 'oryx'], 'city'],
  ['abudhabi_dunes', 'أبوظبي: كثبان وجزر', 'Abu Dhabi: Dunes & Islands', 'كثبان ليوا العالية، غابات القرم، جزر ومعالم عمرانية بيضاء.', 'High Liwa dunes, mangroves, islands and white landmarks.',
    { coast: 'west', landBias: 0.05, duneAmp: 15, duneScale: 62, patch: 0.3, surface2: 'red_sand', structCell: 48, city: { t: 0.6, structures: [{ key: 'dome_hall', freq: 0.3 }, { key: 'skyscraper', freq: 0.3 }, { key: 'villa', freq: 0.2 }] },
      trees: [{ type: 'mangrove', density: 0.03, zone: 'water' }, { type: 'palm', density: 0.03, zone: 'oasis' }, { type: 'ghaf', density: 0.001, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.012 }, { block: 'dry_grass', density: 0.01 }],
      structures: [{ key: 'palm_farm', freq: 0.06 }, { key: 'tent', freq: 0.07 }, { key: 'fort', freq: 0.05 }, { key: 'dhow', freq: 0.1 }, { key: 'pier', freq: 0.08 }, { key: 'well', freq: 0.04 }] },
    sky('#8fc6ea', '#f6e3bd'), { ...W, sandstorm: 16 }, ['camel', 'oryx'], 'desert'],
  ['fujairah_coast', 'الفجيرة: جبال وبحر', 'Fujairah: Mountains & Sea', 'جبال تعانق البحر، وديان جارية وشواطئ الساحل الشرقي.', 'Mountains meeting the sea, flowing wadis and east-coast beaches.',
    { coast: 'east', landBias: 0.2, mtAmp: 58, mtT: 0.34, mtScale: 200, wadi: true, wadiWater: true, patch: 0.2, surface2: 'gravel', rockLine: 20, peakLine: 50,
      trees: [{ type: 'palm', density: 0.012, zone: 'coast' }, { type: 'palm', density: 0.02, zone: 'wadi' }, { type: 'acacia', density: 0.004, zone: 'rock' }, { type: 'ghaf', density: 0.003, zone: 'low' }],
      plants: [{ block: 'dry_grass', density: 0.03 }, { block: 'desert_flower', density: 0.01 }, { block: 'reed', density: 0.01 }],
      structures: [{ key: 'fort', freq: 0.12 }, { key: 'watchtower', freq: 0.1 }, { key: 'palm_farm', freq: 0.1 }, { key: 'pier', freq: 0.12 }, { key: 'dhow', freq: 0.12 }, { key: 'lighthouse', freq: 0.05 }] },
    sky('#7fbde6', '#e9dcc0'), { ...W, rain: 10, fog: 10, sandstorm: 3 }, ['goat', 'oryx'], 'sea'],
  ['sharjah_heritage', 'الشارقة: تراث وأسواق', 'Sharjah: Heritage & Souqs', 'فرجان تراثية، براجيل، أسواق قديمة وقاعات ثقافية.', 'Heritage quarters, wind towers, old souqs and culture halls.',
    { coast: 'west', landBias: 0.2, duneAmp: 4, hillAmp: 3, structCell: 48,
      trees: [{ type: 'palm', density: 0.01, zone: 'low' }, { type: 'ghaf', density: 0.004, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.012 }, { block: 'desert_flower', density: 0.008 }],
      structures: [{ key: 'souq', freq: 0.2 }, { key: 'barjeel_house', freq: 0.26 }, { key: 'fort', freq: 0.07 }, { key: 'dome_hall', freq: 0.09 }, { key: 'well', freq: 0.05 }, { key: 'lighthouse', freq: 0.03 }, { key: 'pier', freq: 0.1 }, { key: 'dhow', freq: 0.1 }] },
    sky('#8cc4ea', '#f4e2c2'), W, ['camel', 'goat'], 'city'],
  ['ajman_beach', 'عجمان: شواطئ وتراث', 'Ajman: Beaches & Heritage', 'شواطئ رملية هادئة، بيوت قديمة وأبراج مراقبة ساحلية.', 'Calm sandy beaches, old houses and coastal watchtowers.',
    { coast: 'west', landBias: 0.04, base: 3, hillAmp: 2, duneAmp: 3, structCell: 48,
      trees: [{ type: 'palm', density: 0.014, zone: 'coast' }, { type: 'mangrove', density: 0.012, zone: 'water' }, { type: 'ghaf', density: 0.002, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.012 }],
      structures: [{ key: 'barjeel_house', freq: 0.16 }, { key: 'watchtower', freq: 0.1 }, { key: 'souq', freq: 0.08 }, { key: 'fort', freq: 0.06 }, { key: 'pier', freq: 0.18 }, { key: 'dhow', freq: 0.16 }] },
    sky('#86c4ec', '#f6e6c6'), W, ['camel', 'goat'], 'sea'],
  ['uaq_lagoons', 'أم القيوين: جزر وبحيرات', 'Umm Al Quwain: Isles & Lagoons', 'جزر منخفضة، خيران هادئة وغابات قرم غنية بالحياة.', 'Low islands, calm lagoons and rich mangroves.',
    { coast: 'islands', landBias: 0.14, base: 2, hillAmp: 2,
      trees: [{ type: 'mangrove', density: 0.06, zone: 'water' }, { type: 'palm', density: 0.008, zone: 'coast' }], plants: [{ block: 'desert_shrub', density: 0.015 }, { block: 'reed', density: 0.01 }],
      structures: [{ key: 'dhow', freq: 0.2 }, { key: 'pier', freq: 0.14 }, { key: 'watchtower', freq: 0.07 }, { key: 'fort', freq: 0.05 }, { key: 'tent', freq: 0.06 }, { key: 'barjeel_house', freq: 0.05 }] },
    sky('#84c6ea', '#eef0d8'), { ...W, fog: 12 }, ['goat'], 'sea'],
  ['saudi_najd', 'نجد والعُلا', 'Najd & AlUla', 'رمال حمراء، جبال رملية منحوتة، واحات نخيل وحصون طينية.', 'Red sands, carved sandstone mesas, palm oases and mud forts.',
    { coast: 'none', duneAmp: 12, surface: 'red_sand', sub: 'red_sandstone', patch: 0.16, surface2: 'basalt', mtAmp: 34, mtT: 0.5, mtScale: 130, rock: 'red_sandstone', peak: 'red_sandstone', rockLine: 30,
      trees: [{ type: 'palm', density: 0.035, zone: 'oasis' }, { type: 'acacia', density: 0.002, zone: 'any' }], plants: [{ block: 'desert_shrub', density: 0.012 }, { block: 'dry_grass', density: 0.008 }],
      structures: [{ key: 'rock_tomb', freq: 0.1 }, { key: 'fort', freq: 0.09 }, { key: 'tent', freq: 0.1 }, { key: 'well', freq: 0.06 }, { key: 'palm_farm', freq: 0.08 }, { key: 'watchtower', freq: 0.05 }] },
    sky('#8dc0e4', '#f3d2a8'), { ...W, sandstorm: 18 }, ['camel', 'oryx'], 'desert'],
  ['jordan_rum', 'وادي رم والبتراء', 'Wadi Rum & Petra', 'جبال وردية شاهقة، وديان رملية حمراء وواجهات منحوتة في الصخر.', 'Rose mountains, red sand valleys and rock-carved facades.',
    { coast: 'none', surface: 'red_sand', sub: 'red_sandstone', duneAmp: 5, mtAmp: 62, mtT: 0.42, mtScale: 150, wadi: true, wadiBed: 'red_sand', rock: 'red_sandstone', peak: 'sandstone', rockLine: 18, peakLine: 52,
      trees: [{ type: 'acacia', density: 0.003, zone: 'any' }], plants: [{ block: 'desert_shrub', density: 0.012 }, { block: 'desert_flower', density: 0.004 }],
      structures: [{ key: 'rock_tomb', freq: 0.16 }, { key: 'tent', freq: 0.12 }, { key: 'well', freq: 0.05 }, { key: 'watchtower', freq: 0.05 }] },
    sky('#8ab8e0', '#f0c8a2'), { ...W, sandstorm: 12 }, ['camel', 'goat'], 'desert'],
  ['oman_hajar', 'عُمان: الحجر واللبان', 'Oman: Hajar & Frankincense', 'جبال الحجر، أفلاج ووديان خضراء، قلاع وأشجار اللبان.', 'Hajar mountains, aflaj and green wadis, forts and frankincense trees.',
    { coast: 'north', landBias: 0.22, mtAmp: 78, mtT: 0.3, mtScale: 230, wadi: true, wadiWater: true, patch: 0.2, surface2: 'gravel', rockLine: 20, peakLine: 56,
      trees: [{ type: 'frankincense', density: 0.005, zone: 'rock' }, { type: 'palm', density: 0.03, zone: 'wadi' }, { type: 'palm', density: 0.006, zone: 'coast' }, { type: 'acacia', density: 0.003, zone: 'low' }],
      plants: [{ block: 'dry_grass', density: 0.025 }, { block: 'desert_flower', density: 0.008 }],
      structures: [{ key: 'fort', freq: 0.16 }, { key: 'watchtower', freq: 0.12 }, { key: 'palm_farm', freq: 0.1 }, { key: 'dhow', freq: 0.1 }, { key: 'pier', freq: 0.08 }, { key: 'well', freq: 0.04 }] },
    sky('#80bce4', '#ecdcc0'), { ...W, rain: 9, fog: 10 }, ['goat', 'camel', 'oryx'], 'mountain'],
  ['qatar_coast', 'قطر: ساحل وسبخات', 'Qatar: Coast & Sabkha', 'شبه جزيرة منبسطة، سبخات، خور بحري وأفق عمراني.', 'A flat peninsula with salt flats, inlets and a city skyline.',
    { coast: 'east', landBias: 0.15, base: 3, hillAmp: 2, duneAmp: 5, patch: 0.3, surface2: 'salt_flat', structCell: 48, city: { t: 0.56, structures: [{ key: 'skyscraper', freq: 0.5 }, { key: 'villa', freq: 0.15 }, { key: 'dome_hall', freq: 0.1 }] },
      trees: [{ type: 'mangrove', density: 0.02, zone: 'water' }, { type: 'palm', density: 0.006, zone: 'coast' }, { type: 'ghaf', density: 0.001, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.012 }],
      structures: [{ key: 'fort', freq: 0.08 }, { key: 'dhow', freq: 0.14 }, { key: 'pier', freq: 0.1 }, { key: 'tent', freq: 0.08 }, { key: 'souq', freq: 0.07 }] },
    sky('#8cc4ea', '#f4e2c2'), W, ['camel', 'oryx'], 'sea'],
  ['kuwait_bay', 'الكويت: الجون والصحراء', 'Kuwait: Bay & Desert', 'صحراء منبسطة تطل على الخليج، مخيمات بر وسفن بوم خشبية.', 'Flat desert on the Gulf, desert camps and wooden boom ships.',
    { coast: 'east', landBias: 0.18, base: 3, hillAmp: 2, duneAmp: 3, structCell: 48, city: { t: 0.52, structures: [{ key: 'skyscraper', freq: 0.5 }, { key: 'villa', freq: 0.2 }] },
      trees: [{ type: 'palm', density: 0.005, zone: 'coast' }, { type: 'ghaf', density: 0.001, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.014 }, { block: 'desert_flower', density: 0.01 }],
      structures: [{ key: 'tent', freq: 0.14 }, { key: 'dhow', freq: 0.18 }, { key: 'pier', freq: 0.12 }, { key: 'souq', freq: 0.08 }, { key: 'well', freq: 0.04 }] },
    sky('#8cc4ea', '#f4dcb8'), { ...W, sandstorm: 16 }, ['camel'], 'desert'],
  ['bahrain_isles', 'البحرين: جزر اللؤلؤ', 'Bahrain: Pearl Isles', 'جزر تحيط بها مغاصات اللؤلؤ، بساتين نخيل وقلاع ساحلية.', 'Islands ringed by pearl beds, palm groves and coastal forts.',
    { coast: 'islands', landBias: 0.2, base: 3, hillAmp: 3, structCell: 48, city: { t: 0.62, structures: [{ key: 'skyscraper', freq: 0.4 }, { key: 'villa', freq: 0.2 }] },
      trees: [{ type: 'palm', density: 0.04, zone: 'oasis' }, { type: 'palm', density: 0.006, zone: 'coast' }, { type: 'mangrove', density: 0.015, zone: 'water' }], plants: [{ block: 'desert_shrub', density: 0.012 }],
      structures: [{ key: 'fort', freq: 0.1 }, { key: 'dhow', freq: 0.2 }, { key: 'pier', freq: 0.12 }, { key: 'barjeel_house', freq: 0.1 }, { key: 'souq', freq: 0.06 }] },
    sky('#86c4ec', '#f0e8cc'), W, ['goat'], 'sea'],
  ['egypt_nile', 'مصر: النيل والأهرامات', 'Egypt: Nile & Pyramids', 'نهر عظيم يشق الصحراء، ضفاف خضراء وأهرامات شامخة.', 'A great river through the desert, green banks and pyramids.',
    { coast: 'none', duneAmp: 6, wadi: true, wadiWater: true, wadiScale: 430, wadiWidth: 0.11, wadiGreen: true, wadiBed: 'clay', sub: 'limestone', rock: 'limestone', patch: 0.1, surface2: 'granite',
      trees: [{ type: 'palm', density: 0.035, zone: 'wadi' }, { type: 'acacia', density: 0.001, zone: 'any' }], plants: [{ block: 'reed', density: 0.006 }, { block: 'dry_grass', density: 0.008 }],
      structures: [{ key: 'pyramid', freq: 0.14 }, { key: 'palm_farm', freq: 0.1 }, { key: 'rock_tomb', freq: 0.05 }, { key: 'well', freq: 0.05 }, { key: 'tent', freq: 0.05 }, { key: 'dhow', freq: 0.08 }] },
    sky('#8cc0e6', '#f4dcb0'), { ...W, sandstorm: 12 }, ['camel', 'goat'], 'desert'],
  ['arabian_desert', 'الصحراء العربية', 'Arabian Desert', 'بحر من الكثبان، واحات نخيل ومخيمات بدوية.', 'A sea of dunes, palm oases and Bedouin camps.',
    { coast: 'none', duneAmp: 17, duneScale: 58, patch: 0.25, surface2: 'red_sand',
      trees: [{ type: 'palm', density: 0.04, zone: 'oasis' }, { type: 'ghaf', density: 0.0015, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.012 }, { block: 'dry_grass', density: 0.008 }],
      structures: [{ key: 'tent', freq: 0.16 }, { key: 'well', freq: 0.08 }, { key: 'palm_farm', freq: 0.08 }, { key: 'fort', freq: 0.05 }, { key: 'watchtower', freq: 0.04 }] },
    sky('#8dc2e8', '#f5dcae'), { ...W, sandstorm: 20 }, ['camel', 'oryx'], 'desert'],
  ['uae_mountains', 'جبال الإمارات', 'UAE Mountains', 'سلاسل جبلية متصلة، قمم جيرية وكهوف عميقة.', 'Continuous ranges, limestone peaks and deep caves.',
    { coast: 'none', mtAmp: 80, mtT: 0.22, mtScale: 220, wadi: true, patch: 0.2, surface2: 'gravel', rockLine: 18, peakLine: 54, ores: { copper: 1.6, iron: 1.3, gold: 1.2, diamond: 1.2 },
      trees: [{ type: 'acacia', density: 0.005, zone: 'wadi' }, { type: 'ghaf', density: 0.003, zone: 'low' }, { type: 'palm', density: 0.02, zone: 'oasis' }], plants: [{ block: 'dry_grass', density: 0.03 }, { block: 'desert_shrub', density: 0.02 }],
      structures: [{ key: 'watchtower', freq: 0.14 }, { key: 'fort', freq: 0.08 }, { key: 'well', freq: 0.05 }, { key: 'palm_farm', freq: 0.06 }] },
    sky('#82bce6', '#eadcc2'), { ...W, fog: 14, rain: 9 }, ['goat', 'oryx'], 'mountain'],
  ['future_city', 'المدينة المستقبلية', 'Future City', 'مدينة أبراج زجاجية متلألئة تمتد حتى الأفق.', 'A glittering glass-tower city stretching to the horizon.',
    { coast: 'west', landBias: 0.3, structCell: 32, city: { t: 0.12, structures: [{ key: 'skyscraper', freq: 0.8 }, { key: 'dome_hall', freq: 0.06 }, { key: 'villa', freq: 0.08 }] },
      trees: [{ type: 'palm', density: 0.008, zone: 'coast' }], plants: [], structures: [{ key: 'pier', freq: 0.2 }, { key: 'dhow', freq: 0.1 }] },
    sky('#7fb6ea', '#d8e6f2', 0.009), { clear: 85, rain: 6, storm: 3, fog: 6, sandstorm: 0 }, [], 'city'],
  ['lost_island', 'الجزيرة المفقودة', 'The Lost Island', 'جزر خضراء غامضة، جبال وكهوف وآثار منسية.', 'Mysterious green isles with mountains, caves and forgotten ruins.',
    { coast: 'islands', landBias: 0.1, surface: 'grass', sub: 'dirt', mtAmp: 46, mtT: 0.4, mtScale: 140, rockLine: 24, ores: { copper: 1.5, iron: 1.5, gold: 1.5, diamond: 1.5 },
      trees: [{ type: 'ghaf', density: 0.02, zone: 'low' }, { type: 'palm', density: 0.02, zone: 'coast' }, { type: 'mangrove', density: 0.02, zone: 'water' }], plants: [{ block: 'dry_grass', density: 0.05 }, { block: 'desert_flower', density: 0.03 }, { block: 'reed', density: 0.01 }],
      structures: [{ key: 'rock_tomb', freq: 0.07 }, { key: 'watchtower', freq: 0.07 }, { key: 'well', freq: 0.04 }, { key: 'dhow', freq: 0.1 }, { key: 'lighthouse', freq: 0.04 }] },
    sky('#78bfe8', '#dcecd8'), { clear: 60, rain: 18, storm: 8, fog: 14, sandstorm: 0 }, ['goat', 'oryx'], 'sea'],
  ['seas_islands', 'البحار والجزر', 'Seas & Islands', 'أرخبيل من الجزر الرملية الصغيرة وسفن الداو والمغاصات.', 'An archipelago of sandy islets, dhows and pearl beds.',
    { coast: 'islands', landBias: 0.0, base: 3, hillAmp: 3,
      trees: [{ type: 'palm', density: 0.02, zone: 'coast' }, { type: 'mangrove', density: 0.03, zone: 'water' }], plants: [{ block: 'desert_shrub', density: 0.012 }],
      structures: [{ key: 'dhow', freq: 0.3 }, { key: 'pier', freq: 0.16 }, { key: 'lighthouse', freq: 0.06 }, { key: 'tent', freq: 0.05 }, { key: 'watchtower', freq: 0.04 }] },
    sky('#7cc2ec', '#e8f0dc'), { clear: 70, rain: 12, storm: 6, fog: 12, sandstorm: 0 }, [], 'sea'],
  ['uae_heritage', 'التراث الإماراتي', 'Emirati Heritage', 'فريج تراثي كبير: براجيل، أسواق، حصون ومزارع نخيل.', 'A large heritage quarter: wind towers, souqs, forts and palm farms.',
    { coast: 'west', landBias: 0.22, hillAmp: 2, duneAmp: 3, structCell: 40,
      trees: [{ type: 'palm', density: 0.012, zone: 'low' }, { type: 'ghaf', density: 0.004, zone: 'low' }], plants: [{ block: 'desert_shrub', density: 0.01 }, { block: 'desert_flower', density: 0.01 }],
      structures: [{ key: 'barjeel_house', freq: 0.3 }, { key: 'souq', freq: 0.18 }, { key: 'fort', freq: 0.1 }, { key: 'palm_farm', freq: 0.1 }, { key: 'well', freq: 0.06 }, { key: 'watchtower', freq: 0.06 }, { key: 'tent', freq: 0.05 }, { key: 'dhow', freq: 0.08 }, { key: 'pier', freq: 0.07 }] },
    sky('#8cc4ea', '#f4e2c2'), W, ['camel', 'goat'], 'desert'],
];

function geo() {
  const c = (key: string, ar: string, en: string, flag: string, i: number) => run('INSERT INTO countries(key,name_ar,name_en,flag,sort) VALUES(?,?,?,?,?)', key, ar, en, flag, i);
  [['UAE', 'الإمارات العربية المتحدة', 'United Arab Emirates', '🇦🇪'], ['KSA', 'المملكة العربية السعودية', 'Saudi Arabia', '🇸🇦'], ['JOR', 'الأردن', 'Jordan', '🇯🇴'], ['OMN', 'سلطنة عُمان', 'Oman', '🇴🇲'],
    ['QAT', 'قطر', 'Qatar', '🇶🇦'], ['KWT', 'الكويت', 'Kuwait', '🇰🇼'], ['BHR', 'البحرين', 'Bahrain', '🇧🇭'], ['EGY', 'مصر', 'Egypt', '🇪🇬']].forEach((r, i) => c(r[0], r[1], r[2], r[3], i));
  const R: any[] = [
    ['AUH', 'UAE', 'أبوظبي', 'Abu Dhabi', 'abudhabi_dunes'], ['DXB', 'UAE', 'دبي', 'Dubai', 'dubai_city'], ['SHJ', 'UAE', 'الشارقة', 'Sharjah', 'sharjah_heritage'], ['AJM', 'UAE', 'عجمان', 'Ajman', 'ajman_beach'],
    ['UAQ', 'UAE', 'أم القيوين', 'Umm Al Quwain', 'uaq_lagoons'], ['RAK', 'UAE', 'رأس الخيمة', 'Ras Al Khaimah', 'rak_mountains'], ['FUJ', 'UAE', 'الفجيرة', 'Fujairah', 'fujairah_coast'],
    ['RUH', 'KSA', 'نجد', 'Najd', 'saudi_najd'], ['ULA', 'KSA', 'العُلا', 'AlUla', 'saudi_najd'], ['RUM', 'JOR', 'وادي رم', 'Wadi Rum', 'jordan_rum'], ['PET', 'JOR', 'البتراء', 'Petra', 'jordan_rum'],
    ['MCT', 'OMN', 'مسقط وجبال الحجر', 'Muscat & Hajar', 'oman_hajar'], ['DHO', 'OMN', 'ظفار', 'Dhofar', 'oman_hajar'], ['DOH', 'QAT', 'الدوحة', 'Doha', 'qatar_coast'],
    ['KWI', 'KWT', 'مدينة الكويت', 'Kuwait City', 'kuwait_bay'], ['MNM', 'BHR', 'المنامة', 'Manama', 'bahrain_isles'], ['GIZ', 'EGY', 'الجيزة والنيل', 'Giza & Nile', 'egypt_nile'],
  ];
  R.forEach((r, i) => { const e = ENVS.find((x) => x[0] === r[4]); run('INSERT INTO regions(key,country_key,name_ar,name_en,desc_ar,desc_en,environment_key,sort) VALUES(?,?,?,?,?,?,?,?)', r[0], r[1], r[2], r[3], e[3], e[4], r[4], i); });
}

function misc() {
  ENVS.forEach((e) => run('INSERT INTO environments(key,name_ar,name_en,desc_ar,desc_en,params,sky,weather,animals,ambient) VALUES(?,?,?,?,?,?,?,?,?,?)', e[0], e[1], e[2], e[3], e[4], S(e[5]), S(e[6]), S(e[7]), S(e[8]), e[9]));
  [['ae', 'الإماراتية', 'Emirati', 1], ['sa', 'السعودية', 'Saudi', 0], ['kw', 'الكويتية', 'Kuwaiti', 0], ['om', 'العُمانية', 'Omani', 0], ['jo', 'الأردنية', 'Jordanian', 0], ['lv', 'الشامية', 'Levantine', 0], ['eg', 'المصرية', 'Egyptian', 0], ['msa', 'العربية الفصحى', 'Modern Standard Arabic', 0]]
    .forEach((d, i) => run('INSERT INTO dialects(key,name_ar,name_en,is_default,sort) VALUES(?,?,?,?,?)', d[0], d[1], d[2], d[3], i));
  const ch = (key: string, ar: string, en: string, slot: string, kind: string, colors: any, i: number) => run('INSERT INTO characters(key,name_ar,name_en,slot,kind,colors,sort) VALUES(?,?,?,?,?,?,?)', key, ar, en, slot, kind, S(colors), i);
  [['kandura_white', 'كندورة بيضاء', 'White Kandura', 'outfit', 'robe', { main: '#f5f3ee', trim: '#e2ddd2' }],
    ['kandura_sand', 'كندورة رملية', 'Sand Kandura', 'outfit', 'robe', { main: '#d8c49a', trim: '#c2ad80' }],
    ['kandura_blue', 'كندورة زرقاء', 'Blue Kandura', 'outfit', 'robe', { main: '#5f7fa8', trim: '#4a678c' }],
    ['bisht', 'بشت فوق الكندورة', 'Bisht Cloak', 'outfit', 'cloak', { main: '#f5f3ee', trim: '#3a2a1c', gold: '#d6a94a' }],
    ['abaya', 'عباءة', 'Abaya', 'outfit', 'robe', { main: '#1e1c22', trim: '#c9a24a' }],
    ['jalabiya', 'جلابية مطرزة', 'Embroidered Jalabiya', 'outfit', 'robe', { main: '#8a2f5a', trim: '#e6c15a' }],
    ['mukhawar', 'مخوّر إماراتي', 'Emirati Mukhawar', 'outfit', 'robe', { main: '#1f7a6a', trim: '#f0d48a' }],
    ['casual', 'ملابس عصرية', 'Casual', 'outfit', 'casual', { main: '#2f8fb8', trim: '#3f4a5a' }],
    ['explorer', 'زي المستكشف', 'Explorer', 'outfit', 'casual', { main: '#b08a4a', trim: '#5a4a32' }],
    ['head_none', 'بدون', 'None', 'head', 'none', {}],
    ['ghutra_white', 'غترة بيضاء وعقال', 'White Ghutra & Agal', 'head', 'ghutra', { main: '#f8f6f1', trim: '#1c1c1c' }],
    ['shemagh_red', 'شماغ أحمر', 'Red Shemagh', 'head', 'ghutra', { main: '#c8323a', trim: '#1c1c1c', check: '#f4f0ea' }],
    ['hamdaniya', 'حمدانية', 'Hamdaniya Wrap', 'head', 'turban', { main: '#f1ece2', trim: '#c9a24a' }],
    ['massar', 'مصر عُماني', 'Omani Massar', 'head', 'turban', { main: '#7a3f8a', trim: '#e6c15a' }],
    ['kumma', 'كمّة', 'Kumma Cap', 'head', 'cap', { main: '#f1ece2', trim: '#3f6f9c' }],
    ['shayla_black', 'شيلة سوداء', 'Black Shayla', 'head', 'shayla', { main: '#1e1c22', trim: '#c9a24a' }],
    ['shayla_color', 'شيلة ملونة', 'Colored Shayla', 'head', 'shayla', { main: '#c98aa0', trim: '#f0d48a' }],
    ['cap_red', 'قبعة', 'Cap', 'head', 'cap', { main: '#d9482e', trim: '#ffffff' }],
    ['hair_short', 'شعر قصير', 'Short Hair', 'hair', 'short', {}], ['hair_long', 'شعر طويل', 'Long Hair', 'hair', 'long', {}], ['hair_curly', 'شعر مجعد', 'Curly Hair', 'hair', 'curly', {}], ['hair_none', 'بدون شعر', 'No Hair', 'hair', 'none', {}],
    ['acc_none', 'بدون', 'None', 'accessory', 'none', {}], ['glasses', 'نظارة', 'Glasses', 'accessory', 'glasses', { main: '#1c1c1c' }], ['backpack', 'حقيبة ظهر', 'Backpack', 'accessory', 'backpack', { main: '#b0562e', trim: '#e6c15a' }],
    ['falcon', 'صقر على اليد', 'Falcon on Arm', 'accessory', 'falcon', { main: '#7a6248', trim: '#f1ece2' }], ['belt', 'حزام تراثي', 'Heritage Belt', 'accessory', 'belt', { main: '#5a3a1e', trim: '#d6a94a' }],
  ].forEach((r: any, i) => ch(r[0], r[1], r[2], r[3], r[4], r[5], i));

  const ac = (key: string, ar: string, en: string, dar: string, den: string, icon: string, stat: string, th: number, pts: number, items: any = null) =>
    run('INSERT INTO achievements(key,title_ar,title_en,desc_ar,desc_en,icon,stat,threshold,points,reward_items,sound_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)', key, ar, en, dar, den, icon, stat, th, pts, items ? S(items) : null, 'achievement');
  ac('first_build', 'أول لبنة', 'First Block', 'ضع أول مكعب لك في العالم.', 'Place your first block.', '🧱', 'placed_total', 1, 10);
  ac('first_break', 'أول ضربة', 'First Strike', 'اكسر أول مكعب.', 'Break your first block.', '⛏️', 'broken_total', 1, 10);
  ac('wood_100', 'حطّاب ماهر', 'Master Woodcutter', 'اجمع 100 قطعة خشب.', 'Collect 100 pieces of wood.', '🪵', 'broken_cat:wood', 100, 50, { palm_planks: 32 });
  ac('build_house', 'بيت العمر', 'Home Sweet Home', 'ابنِ منزلاً كاملاً بباب ونوافذ.', 'Build a full house with a door and windows.', '🏠', 'houses_built', 1, 60, { lantern: 4 });
  ac('find_cave', 'مستكشف الكهوف', 'Cave Explorer', 'اكتشف كهفاً تحت الأرض.', 'Discover an underground cave.', '🕳️', 'caves_found', 1, 30);
  ac('peak', 'فوق القمة', 'Summit', 'اصعد إلى قمة جبل شاهق.', 'Reach the summit of a high mountain.', '🏔️', 'max_height', 88, 60);
  ac('landmark', 'معلم إماراتي', 'Emirati Landmark', 'ابنِ معلماً من 30 مكعباً تراثياً.', 'Build a landmark with 30 heritage blocks.', '🕌', 'placed_cat:heritage', 30, 80, { gold_block: 2 });
  ac('friends_5', 'لمّة الربع', 'The Gang', 'العب مع 5 أصدقاء مختلفين.', 'Play with 5 different friends.', '🤝', 'friends_played', 5, 70);
  ac('group_challenge', 'يد واحدة', 'As One', 'أكمل تحدياً جماعياً.', 'Complete a group challenge.', '🏆', 'group_challenges_done', 1, 80);
  ac('pearl_diver', 'غوّاص اللؤلؤ', 'Pearl Diver', 'افتح 5 محارات في قاع البحر.', 'Open 5 oysters on the seabed.', '🦪', 'broken:oyster', 5, 40);
  ac('diamond', 'بريق الألماس', 'Diamond Shine', 'اعثر على الألماس.', 'Find diamond.', '💎', 'broken:diamond_ore', 1, 60);
  ac('missions_3', 'صاحب همّة', 'Go-Getter', 'أكمل 3 مهام.', 'Complete 3 missions.', '📜', 'missions_done', 3, 40);
  ac('quiz_3', 'نجم المعرفة', 'Knowledge Star', 'أجب عن 3 أسئلة معرفية.', 'Answer 3 knowledge questions.', '🎓', 'quizzes_done', 3, 40);
  ac('creator', 'صانع العوالم', 'World Maker', 'أنشئ أول عالم لك.', 'Create your first world.', '🌍', 'worlds_created', 1, 20);

  const ms = (key: string, ar: string, en: string, dar: string, den: string, type: string, target: string | null, cnt: number, modes: string[], x: any = {}) =>
    run('INSERT INTO missions(key,title_ar,title_en,desc_ar,desc_en,type,target,count,modes,npc,time_limit,points,reward_items,quiz,sort) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      key, ar, en, dar, den, type, target, cnt, S(modes), x.npc || null, x.time || 0, x.pts || 15, x.items ? S(x.items) : null, x.quiz ? S(x.quiz) : null, x.sort || 0);
  ms('adv_meet', 'تعرّف على المرشد', 'Meet the Guide', 'تحدث مع المرشد قرب نقطة البداية.', 'Talk to the guide near spawn.', 'talk', 'guide', 1, ['adventure'], { npc: 'guide', sort: 1, items: { wood_pickaxe: 1, dates: 5 } });
  ms('adv_wood', 'حطب للمخيم', 'Wood for Camp', 'اجمع 10 جذوع من الأشجار.', 'Gather 10 tree trunks.', 'break', 'cat:wood', 10, ['adventure'], { npc: 'guide', sort: 2, items: { stone_axe: 1 } });
  ms('adv_shelter', 'مأوى قبل الليل', 'Shelter by Night', 'ضع 20 مكعباً لبناء مأوى.', 'Place 20 blocks to build a shelter.', 'place', 'any', 20, ['adventure'], { npc: 'guide', sort: 3, items: { lantern: 2 } });
  ms('adv_climb', 'نظرة من الأعلى', 'View from Above', 'اصعد إلى ارتفاع 62.', 'Climb to height 62.', 'reach_height', null, 62, ['adventure'], { npc: 'elder', sort: 4, pts: 25, items: { bread: 4 } });
  ms('adv_stone', 'حجارة الحصن', 'Fort Stones', 'اكسر 15 حجراً لترميم الحصن.', 'Break 15 stone for the fort.', 'break', 'stone', 15, ['adventure'], { npc: 'elder', sort: 5, items: { stone_pickaxe: 1 } });
  ms('adv_copper', 'نحاس للتاجر', 'Copper for the Merchant', 'استخرج 3 من خام النحاس.', 'Mine 3 copper ore.', 'break', 'copper_ore', 3, ['adventure'], { npc: 'merchant', sort: 6, pts: 30, items: { sword: 1, shield: 1 } });
  ms('sur_stone', 'عدّة الحجر', 'Stone Kit', 'اكسر 20 حجراً.', 'Break 20 stone.', 'break', 'stone', 20, ['survival'], { sort: 1 });
  ms('sur_light', 'أنِر المكان', 'Light It Up', 'ضع 4 فوانيس.', 'Place 4 lanterns.', 'place', 'lantern', 4, ['survival', 'creative'], { sort: 2 });
  ms('sur_heritage', 'لمسة تراثية', 'Heritage Touch', 'ضع 12 مكعباً تراثياً.', 'Place 12 heritage blocks.', 'place', 'cat:heritage', 12, ['survival', 'creative', 'education'], { sort: 3, pts: 20 });
  ms('ch_wood', 'سباق الحطّابين', 'Woodcutter Race', 'اجمعوا 30 جذعاً قبل انتهاء الوقت.', 'Gather 30 trunks before time runs out.', 'break', 'cat:wood', 30, ['challenge'], { time: 300, pts: 40, sort: 1 });
  ms('ch_build', 'بنّاؤو الحصن', 'Fort Builders', 'ضعوا 80 مكعباً خلال 4 دقائق.', 'Place 80 blocks within 4 minutes.', 'place', 'any', 80, ['challenge'], { time: 240, pts: 40, sort: 2 });
  ms('ch_peak', 'سباق القمة', 'Race to the Top', 'ليصل أحدكم إلى ارتفاع 75.', 'Have someone reach height 75.', 'reach_height', null, 75, ['challenge'], { time: 420, pts: 50, sort: 3 });
  ms('ch_sand', 'حفّارو الرمال', 'Sand Diggers', 'احفروا 60 مكعب رمل خلال 3 دقائق.', 'Dig 60 sand blocks in 3 minutes.', 'break', 'sand', 60, ['challenge'], { time: 180, pts: 35, sort: 4 });
  const qz = (key: string, q_ar: string, q_en: string, ca: string[], ce: string[], answer: number, i: number) =>
    ms(key, q_ar, q_en, 'سؤال معرفي', 'Knowledge question', 'quiz', null, 1, ['education'], { quiz: { choices_ar: ca, choices_en: ce, answer }, sort: 10 + i, pts: 15 });
  qz('q_emirates', 'كم عدد إمارات دولة الإمارات العربية المتحدة؟', 'How many emirates make up the UAE?', ['خمس', 'ست', 'سبع', 'تسع'], ['Five', 'Six', 'Seven', 'Nine'], 2, 0);
  qz('q_capital', 'ما عاصمة دولة الإمارات؟', 'What is the capital of the UAE?', ['دبي', 'أبوظبي', 'الشارقة', 'العين'], ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain'], 1, 1);
  qz('q_jais', 'في أي إمارة يقع جبل جيس؟', 'In which emirate is Jebel Jais?', ['الفجيرة', 'عجمان', 'رأس الخيمة', 'أم القيوين'], ['Fujairah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain'], 2, 2);
  qz('q_barjeel', 'ما وظيفة البرجيل في البيوت القديمة؟', 'What was the barjeel (wind tower) used for?', ['تخزين الماء', 'تبريد وتهوية البيت', 'مراقبة البحر', 'إنارة البيت'], ['Storing water', 'Cooling and ventilation', 'Watching the sea', 'Lighting'], 1, 3);
  qz('q_ghaf', 'ما الشجرة الوطنية لدولة الإمارات؟', 'What is the national tree of the UAE?', ['النخلة', 'الغاف', 'السدر', 'القرم'], ['Date palm', 'Ghaf', 'Sidr', 'Mangrove'], 1, 4);
  qz('q_pearl', 'ما المهنة البحرية التي اشتهر بها أهل الخليج قديماً؟', 'Which sea trade were Gulf people famous for?', ['الغوص على اللؤلؤ', 'صيد الحيتان', 'استخراج الملح', 'بناء الفنارات'], ['Pearl diving', 'Whaling', 'Salt mining', 'Lighthouse building'], 0, 5);
  ms('edu_barjeel', 'مشروع: ابنِ برجيلاً', 'Project: Build a Wind Tower', 'ضع 8 مكعبات برجيل لتتعلم كيف يبرّد الهواء البيت.', 'Place 8 barjeel blocks to learn how air cools a house.', 'place', 'barjeel', 8, ['education'], { sort: 30, pts: 30 });

  const tp = (key: string, ar: string, en: string, env: string, mode: string, country: string | null, region: string | null, settings: any, i: number) => {
    const e = ENVS.find((x) => x[0] === env);
    run('INSERT INTO world_templates(key,name_ar,name_en,desc_ar,desc_en,country,region,environment,mode,settings,sort) VALUES(?,?,?,?,?,?,?,?,?,?,?)', key, ar, en, e[3], e[4], country, region, env, mode, S(settings), i);
  };
  tp('desert', 'عالم الصحراء العربية', 'Arabian Desert World', 'arabian_desert', 'survival', null, null, { npcs: ['guide'] }, 0);
  tp('uae_mountains', 'عالم جبال الإمارات', 'UAE Mountains World', 'uae_mountains', 'adventure', 'UAE', null, { npcs: ['guide', 'elder', 'merchant'] }, 1);
  tp('rak', 'عالم رأس الخيمة', 'Ras Al Khaimah World', 'rak_mountains', 'survival', 'UAE', 'RAK', { npcs: ['guide', 'elder'] }, 2);
  tp('future', 'عالم المدينة المستقبلية', 'Future City World', 'future_city', 'creative', null, null, {}, 3);
  tp('lost', 'عالم الجزيرة المفقودة', 'Lost Island World', 'lost_island', 'adventure', null, null, { npcs: ['guide', 'elder', 'merchant'], weather: 'dynamic' }, 4);
  tp('seas', 'عالم البحار والجزر', 'Seas & Islands World', 'seas_islands', 'challenge', null, null, {}, 5);
  tp('heritage', 'عالم التراث الإماراتي', 'Emirati Heritage World', 'uae_heritage', 'education', 'UAE', null, { npcs: ['teacher', 'elder'] }, 6);

  const P = ['users.manage', 'worlds.manage', 'content.manage', 'sounds.manage', 'i18n.manage', 'monitor.view', 'reports.view', 'roles.manage', 'settings.manage'];
  const rl = (key: string, ar: string, en: string, perms: string[], sys = 1) => run('INSERT INTO admin_roles(key,name_ar,name_en,permissions,system) VALUES(?,?,?,?,?)', key, ar, en, S(perms), sys);
  rl('admin', 'مدير عام', 'Administrator', P);
  rl('moderator', 'مشرف', 'Moderator', ['users.manage', 'worlds.manage', 'monitor.view', 'reports.view'], 0);
  rl('editor', 'محرر محتوى', 'Content Editor', ['content.manage', 'sounds.manage', 'i18n.manage'], 0);
  rl('player', 'لاعب', 'Player', []);

  const st = (k: string, v: any) => run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, S(v));
  st('mode_rules', {
    creative: { fly: true, infinite: true, damage: false, hunger: false, hostile: false, instant: true },
    survival: { fly: false, infinite: false, damage: true, hunger: true, hostile: true, instant: false, kit: { wood_pickaxe: 1, dates: 6 } },
    adventure: { fly: false, infinite: false, damage: true, hunger: false, hostile: true, instant: false, story: true, kit: { dates: 4 } },
    challenge: { fly: false, infinite: false, damage: true, hunger: false, hostile: false, instant: false, timed: true, kit: { stone_pickaxe: 1, stone_axe: 1, shovel: 1, sandstone: 64, palm_planks: 64 } },
    education: { fly: true, infinite: true, damage: false, hunger: false, hostile: false, instant: true, quiz: true },
  });
  st('day_length_sec', 900); st('max_worlds_per_player', 12); st('registration_open', true); st('chat_enabled', true);
  st('max_players_limit', 16); st('motd_ar', ''); st('motd_en', ''); st('default_dialect', 'ae'); st('autosave_sec', 15);
}

// ترقية المحتوى (الإصدار 2): طاولة صناعة، فرن، ديناميت، طعام الصيد، حيوانات جديدة، وصفات تحتاج محطات
function migrate2() {
  if ((get("SELECT value FROM settings WHERE key='content_version'")?.value | 0) >= 2) return;
  const blk = (key: string, ar: string, en: string, category: string, tex: any, x: any = {}) => {
    if (get('SELECT 1 x FROM blocks WHERE key=?', key)) return;
    const id = (get('SELECT MAX(id) m FROM blocks').m || 0) + 1; if (id > 255) return;
    run(`INSERT INTO blocks(id,key,name_ar,name_en,category,tex,hardness,tool,recipe,sort) VALUES(?,?,?,?,?,?,?,?,?,?)`, id, key, ar, en, category, S(tex), x.h ?? 1, x.tool || null, x.recipe ? S(x.recipe) : null, id);
  };
  blk('crafting_table', 'طاولة الصناعة', 'Crafting Table', 'building', { top: ['#b0844e', '#6e4c2a', 'table_top'], side: ['#9b6e3d', '#5a3a1e', 'table_side'], bottom: ['#c9a372', '#ad8857', 'planks'] }, { h: 1.2, tool: 'axe', recipe: { in: { palm_planks: 4 }, out: 1 } });
  blk('furnace', 'فرن', 'Furnace', 'building', { top: ['#7d7f84', '#5f6166', 'furnace_top'], side: ['#7d7f84', '#2a1a10', 'furnace'], bottom: ['#8d8f94', '#75777d', 'rock'] }, { h: 2, tool: 'pick', recipe: { in: { stone: 8 }, out: 1, at: 'table' } });
  blk('tnt', 'ديناميت', 'TNT', 'special', { top: ['#d23a2a', '#e8e2d0', 'tnt_top'], side: ['#d23a2a', '#f2eee4', 'tnt_side'], bottom: ['#d23a2a', '#e8e2d0', 'tnt_top'] }, { h: 0.1, recipe: { in: { gunpowder: 5, sand: 4 }, out: 1, at: 'table' } });
  let n = (get('SELECT MAX(sort) m FROM items').m || 0) + 1;
  const it = (key: string, ar: string, en: string, category: string, icon: any, x: any = {}) => {
    if (get('SELECT 1 x FROM items WHERE key=?', key)) return;
    run('INSERT INTO items(key,name_ar,name_en,category,icon,food,stack,recipe,sort) VALUES(?,?,?,?,?,?,?,?,?)', key, ar, en, category, S(icon), x.food || 0, 64, x.recipe ? S(x.recipe) : null, n++);
  };
  const F = (k: string) => ({ in: { [k]: 1 }, out: 1, at: 'furnace' });
  it('raw_meat', 'لحم نيء', 'Raw Meat', 'food', ['#d9534f', '#f2c0b8', 'meat'], { food: 2 });
  it('cooked_meat', 'مشاوي لحم', 'Grilled Meat', 'food', ['#8a4a22', '#c98a4a', 'meat'], { food: 8, recipe: F('raw_meat') });
  it('raw_chicken', 'دجاج نيء', 'Raw Chicken', 'food', ['#f0c7b0', '#e8a890', 'drumstick'], { food: 2 });
  it('cooked_chicken', 'دجاج مشوي', 'Grilled Chicken', 'food', ['#c98a3a', '#e8b870', 'drumstick'], { food: 6, recipe: F('raw_chicken') });
  it('raw_fish', 'سمك نيء', 'Raw Fish', 'food', ['#8fb3c9', '#5d87a3', 'fish'], { food: 2 });
  it('cooked_fish', 'سمك مشوي', 'Grilled Fish', 'food', ['#b07a3a', '#d9a860', 'fish'], { food: 6, recipe: F('raw_fish') });
  it('leather', 'جلد', 'Leather', 'material', ['#8a5a2c', '#6a4220', 'leather']);
  it('feather', 'ريشة', 'Feather', 'material', ['#f4f0ea', '#c9c2b6', 'feather']);
  it('wool', 'صوف', 'Wool', 'material', ['#f4f0ea', '#d8d2c6', 'wool']);
  it('gunpowder', 'بارود', 'Gunpowder', 'material', ['#5a5a5a', '#3a3a3a', 'powder']);
  // الوصفات: السبائك والزجاج في الفرن، والأدوات والأسلحة على طاولة الصناعة
  const setR = (key: string, r: any) => { run('UPDATE blocks SET recipe=? WHERE key=?', S(r), key); run('UPDATE items SET recipe=? WHERE key=?', S(r), key); };
  setR('copper_ingot', F('copper_ore')); setR('iron_ingot', F('iron_ore')); setR('gold_ingot', F('gold_ore')); setR('glass', F('sand'));
  setR('sadu', { in: { wool: 2, desert_flower: 1 }, out: 1 }); setR('tent_cloth', { in: { wool: 3 }, out: 2, at: 'table' });
  for (const key of ['wood_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe', 'stone_axe', 'iron_axe', 'shovel', 'sword', 'shield', 'abra', 'buggy', 'steel', 'lantern', 'door_closed', 'gold_block', 'diamond_block', 'tinted_glass', 'barjeel', 'mashrabiya', 'zellige']) {
    for (const t of ['blocks', 'items']) { const r = get(`SELECT recipe FROM ${t} WHERE key=?`, key); if (r?.recipe) { const j = JSON.parse(r.recipe); j.at = 'table'; run(`UPDATE ${t} SET recipe=? WHERE key=?`, S(j), key); } }
  }
  // حيوانات أكثر لكل بيئة
  const A: Record<string, string[]> = {
    rak_mountains: ['camel', 'goat', 'oryx', 'horse', 'sheep', 'fox', 'gazelle', 'chicken'], dubai_city: ['camel', 'oryx', 'horse', 'cat', 'chicken', 'gazelle'],
    abudhabi_dunes: ['camel', 'oryx', 'gazelle', 'fox', 'horse', 'flamingo'], fujairah_coast: ['goat', 'sheep', 'oryx', 'cow', 'chicken', 'turtle'],
    sharjah_heritage: ['camel', 'goat', 'sheep', 'cat', 'chicken', 'horse'], ajman_beach: ['camel', 'goat', 'flamingo', 'turtle', 'chicken', 'cat'],
    uaq_lagoons: ['goat', 'flamingo', 'turtle', 'sheep', 'chicken'], saudi_najd: ['camel', 'oryx', 'gazelle', 'horse', 'sheep', 'fox'],
    jordan_rum: ['camel', 'goat', 'sheep', 'horse', 'fox'], oman_hajar: ['goat', 'camel', 'oryx', 'sheep', 'cow', 'chicken'],
    qatar_coast: ['camel', 'oryx', 'flamingo', 'horse', 'gazelle'], kuwait_bay: ['camel', 'sheep', 'horse', 'chicken', 'fox'],
    bahrain_isles: ['goat', 'horse', 'chicken', 'flamingo', 'cat'], egypt_nile: ['camel', 'cow', 'sheep', 'chicken', 'cat', 'horse', 'goat'],
    arabian_desert: ['camel', 'oryx', 'gazelle', 'fox', 'horse'], uae_mountains: ['goat', 'oryx', 'sheep', 'fox', 'gazelle'], future_city: ['cat', 'chicken', 'horse'],
    lost_island: ['goat', 'sheep', 'cow', 'chicken', 'horse', 'fox', 'turtle'], seas_islands: ['flamingo', 'turtle', 'goat', 'chicken'], uae_heritage: ['camel', 'goat', 'sheep', 'chicken', 'horse', 'cat'],
  };
  for (const k in A) run('UPDATE environments SET animals=? WHERE key=?', S(A[k]), k);
  for (const k of ['help.run', 'help.touch', 'help.dismount']) { run("UPDATE translations SET value=? WHERE key=? AND lang='ar' AND dialect=''", AR[k], k); run("UPDATE translations SET value=? WHERE key=? AND lang='en' AND dialect=''", EN[k], k); }
  run("INSERT INTO settings(key,value) VALUES('content_version','2') ON CONFLICT(key) DO UPDATE SET value='2'");
}

export function seed() {
  tx(() => {
    if (!count('blocks')) blocks();
    if (!count('items')) items();
    if (!count('countries')) geo();
    if (!count('environments')) misc();
    // إعدادات نظام غرف اللعب (تُضاف أيضاً لقواعد البيانات القائمة)
    const st = (k: string, v: any) => run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, S(v));
    st('room_system_enabled', true); st('rooms_count', 10); st('room_capacity', 5); st('session_minutes', 60); st('empty_release_sec', 180); st('reconnect_hold_sec', 120);
    const ins = (k: string, l: string, d: string, v: string) => run('INSERT OR IGNORE INTO translations(key,lang,dialect,value) VALUES(?,?,?,?)', k, l, d, v);
    for (const k in AR) ins(k, 'ar', '', AR[k]);
    for (const k in EN) ins(k, 'en', '', EN[k]);
    for (const d in DIALECTS) for (const k in DIALECTS[d]) ins(k, 'ar', d, DIALECTS[d][k]);
    migrate2();
  });
  void all; void now;
}
