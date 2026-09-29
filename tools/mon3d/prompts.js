// 给 Gemini 的出图提示词：每个进化家族一张图（各阶段从左到右排一排），岛屿对战场地背景各一张
// 用法：node tools/mon3d/prompts.js  → art/gemini/families.json、art/gemini/arenas.json
// 要点：正面 3/4 视角、全身、站着、四肢分开、有体积感——这样 Hunyuan3D 生成的模型才不会扁
const fs = require('fs'), path = require('path');
global.window = {};
require('../../dex.js');
const D = window.DEX;
const ROOT = path.join(__dirname, '..', '..');

const STYLE = "Original creature design for a kids' monster-collecting adventure game (NOT from any existing franchise; must not resemble any existing Pokemon or other known character). " +
  "Style: polished 2D game creature illustration, clean cel shading with 2-3 tones, soft rim light, bold dark-brown outline of even weight, rounded friendly shapes, big expressive eyes with highlights, vibrant but not neon colors. " +
  "IMPORTANT (the art will be turned into 3D models): every creature is drawn FULL BODY, standing on the ground, facing the viewer in a front three-quarter view (body turned about 25 degrees to the viewer's left, face looking at the viewer, both eyes visible), " +
  "symmetrical relaxed pose, legs and arms clearly separated from the body, chunky round volume (not flat, not a side view), no motion, no action pose. " +
  "Background plain pure white, no ground plane, no cast shadow, no glow, no sparkles or floating effects, no text, no logo, no border.";

// 16 进制颜色 → 英文颜色名（给模型一个词，再附上色号）
const NAMED = [['white', '#ffffff'], ['cream', '#fff4d6'], ['light gray', '#cfd8dc'], ['gray', '#90a4ae'], ['charcoal', '#37474f'], ['black', '#212121'],
  ['red', '#e53935'], ['crimson', '#b71c1c'], ['pink', '#f48fb1'], ['hot pink', '#ff4f9a'], ['coral', '#ff7f6a'], ['orange', '#ff8a3c'], ['amber', '#ffb300'],
  ['yellow', '#ffe14d'], ['lime green', '#b2dd4c'], ['leaf green', '#8bc34a'], ['green', '#43a047'], ['dark green', '#1b5e20'], ['mint', '#a6e8c8'], ['teal', '#26a69a'],
  ['sky blue', '#81d4fa'], ['blue', '#1e88e5'], ['navy', '#1a237e'], ['lavender', '#c5b3f0'], ['purple', '#8e44c7'], ['violet', '#6a1b9a'], ['brown', '#8d6e63'],
  ['dark brown', '#5d4037'], ['tan', '#d7b98a'], ['sand', '#f0dca8'], ['gold', '#ffc107'], ['silver', '#b0bec5'], ['ice blue', '#d6f3ff'], ['peach', '#ffcc99']];
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const cname = h => { if (!h) return ''; const a = rgb(h); let best = null, bd = 1e9; NAMED.forEach(([n, x]) => { const b = rgb(x), d = a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0); if (d < bd) { bd = d; best = n; } }); return best + ' (' + h + ')'; };

const BODY = { blob: 'round chubby blob-shaped creature with tiny stubby feet', biped: 'creature standing upright on two legs with two small arms', quad: 'four-legged animal-like creature standing on all fours',
  fish: 'fish-like creature with fins, hovering just above the ground', serpent: 'serpent-like creature with a long body coiled on the ground and its head raised', bug: 'insect-like creature standing on small legs',
  bird: 'bird-like creature standing on two feet with its wings folded', shell: 'creature carrying a big rounded shell', plant: 'plant-like creature with leafy parts, standing on root-like feet',
  ghost: 'friendly ghost-like creature floating just above the ground with a soft wavy lower body', golem: 'chunky golem-like creature made of rock or metal plates, standing on sturdy legs', dragon: 'dragon standing on sturdy legs' };
const EARS = { leaf: 'a leaf sprouting from the top of its head', flower: 'a flower on its head', dog: 'floppy dog ears', cat: 'pointy cat ears', horns: 'two small horns', fin: 'fin-shaped ears',
  crown: 'a crown-shaped crest on its head', antenna: 'two antennae', round: 'round ears', crest: 'a crest on its head', spikes: 'spiky tufts on its head', bunny: 'long bunny ears', curl: 'curled horns',
  flame: 'a small flame on top of its head', gem: 'a gem on its forehead', horn: 'a single horn', ice: 'icy crystal spikes on its head', cloud: 'a fluffy cloud puff on its head' };
const TAIL = { leaf: 'a leaf-shaped tail', flame: 'a tail tipped with a flame', fin: 'a fish-fin tail', long: 'a long tail', stinger: 'a stinger tail', bolt: 'a lightning-bolt-shaped tail', feather: 'a feathered tail',
  fluffy: 'a fluffy tail', spike: 'a spiked tail', cloud: 'a cloud-puff tail', club: 'a club-shaped tail', curl: 'a curly tail' };
const WING = { bug: 'insect wings', feather: 'feathered wings', fairy: 'translucent fairy wings', bat: 'bat-like wings' };
const PAT = { stripes: 'stripes', spots: 'spots', mask: 'a mask-like marking around its eyes', star: 'a star-shaped mark on its chest' };
const MOUTH = { smile: 'a friendly smile', fang: 'a small fang showing', o: 'a small round mouth', grin: 'a big grin', beak: 'a beak' };
const EXTRA = { leafback: 'leaves growing on its back', mane: 'a big fluffy mane', flames: 'flame-shaped crests on its back', crown: 'a small crown', crystals: 'crystals on its back',
  whiskers: 'whiskers', cloud: 'cloud puffs attached to its body', scarf: 'a scarf', spikesback: 'a row of spikes along its back', shell: 'a shell on its back', antlers: 'antlers', aura: 'a thin halo ring floating behind it' };

function describe(s) {
  const bits = [];
  const ty = s.types.map(t => D.TYPES[t].en).join('/');
  const size = s.legend ? 'a large majestic legendary' : s.stage === 1 ? 'a small cute baby-like' : s.stage === 2 ? 'a medium-sized, more confident' : 'a large, powerful and impressive';
  bits.push(`${s.en}: ${size} ${ty}-type ${BODY[s.b] || 'creature'}`);
  bits.push(`main body color ${cname(s.c)}, belly/face ${cname(s.k)}, accent color ${cname(s.a)}`);
  if (EARS[s.e]) bits.push(EARS[s.e]);
  if (TAIL[s.t]) bits.push(TAIL[s.t]);
  if (WING[s.w]) bits.push(WING[s.w]);
  if (PAT[s.p]) bits.push(PAT[s.p] + ' in the accent color');
  if (MOUTH[s.m]) bits.push(MOUTH[s.m]);
  (s.x || []).forEach(x => { if (EXTRA[x]) bits.push(EXTRA[x]); });
  if (s.eye === 'fierce') bits.push('determined, fierce eyes');
  return bits.join('; ') + '. ' + s.dexEn;
}

// 进化家族
const parent = {};
D.list.forEach(s => (s.evo || []).forEach(e => { parent[e.to] = s.id; }));
const fams = D.list.filter(s => !parent[s.id]).map(r => { const out = []; const walk = id => { if (out.includes(id)) return; out.push(id); (D.byId[id].evo || []).forEach(e => walk(e.to)); }; walk(r.id); return out; });
const families = fams.map((ids, i) => {
  const n = ids.length;
  const layout = n === 1
    ? 'Draw ONE creature, centered, with plenty of white space around it. Square image.'
    : `Draw this evolution family as ${n} separate creatures side by side in one row, from left (first form) to right (final form). They are the same species growing up: each form is bigger and more impressive but keeps the same color scheme and signature features. Leave wide white gaps between them - they must not touch or overlap, and each must be fully visible. Wide landscape image (16:9).`;
  const who = ids.map((id, k) => (n > 1 ? `Form ${k + 1}: ` : '') + describe(D.byId[id])).join('\n');
  return { fam: i + 1, ids, prompt: STYLE + '\n\n' + layout + '\n\n' + who };
});
fs.mkdirSync(path.join(ROOT, 'art', 'gemini'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'art', 'gemini', 'families.json'), JSON.stringify(families, null, 1));

// 13 座岛 + 洞穴 + 冠军赛的对战场地背景（参考《宝可梦 冠军》那种每个地区不同风格的场馆）
const ASTYLE = 'Wide panoramic painted background for the battle arena of a cheerful kids\' monster-collecting adventure game. Stylized painterly anime game art, bright and clear, soft atmospheric perspective, rich but friendly colors. ' +
  'Composition: eye-level view; horizon line at about 55% from the top; show only DISTANT and MID-DISTANCE scenery; the bottom 35% of the image is plain, empty, flat ground that continues toward the viewer with no objects on it (the 3D battle field will be placed there). ' +
  'At the far left and far right edges, low spectator stands decorated with banners in the island\'s colors, like a small local battle stadium. No creatures, no people, no characters, no text, no letters, no logos, no UI. 16:9 landscape image, as wide as possible.';
const ISLE = [
  ['hello', 'Hello Island: a seaside village with a sandy beach, palm trees, a wooden pier, turquoise sea; white-walled houses with red tile roofs (Mediterranean); morning sunshine'],
  ['crayon', 'Crayon Island: colorful winding paths, crayon-shaped flowers, pencil-shaped trees, candy-colored cube houses whose roofs look like sharpened pencil tips; pastel sky'],
  ['farm', 'Family Farm Island: rolling farm fields, wooden fences, a windmill, a little river, cozy wooden cottages with thatched roofs; warm afternoon light'],
  ['school', 'School Island: a sports field with a running track, rows of trees, red-brick school buildings with flat roofs and a clock tower; clear blue sky'],
  ['lab', 'Science Island: a tidy campus with satellite dishes, glass-dome buildings, a lab block and an observatory; bright clean light'],
  ['circus', 'Club Island: grassy stage area with colorful bunting, pointed striped circus tents and a seashell-shaped open-air stage; festive'],
  ['clock', 'Clock Island: stone-paved streets, big brass gears, tall stone towers with clock faces and copper roofs, a smoking volcano called Clock Mountain in the distance; golden hour'],
  ['party', 'Birthday Party Island: a candy-colored beach with balloons, round cake-shaped houses with cream-frosting roofs and candy-cane posts; sweet pastel colors'],
  ['jungle', 'Animal Island: dense jungle, a winding river, grassland, treehouses and houses on stilts; lush green, dappled sunlight'],
  ['city', 'Rules City: roads with zebra crossings and traffic lights, gray high-rise buildings with flat roofs, a police station; clean modern city, daytime'],
  ['sports', 'Sports & Food Island: a big sports stadium, fruit orchards, a market with striped awnings; sunny and energetic'],
  ['snow', 'Weather Island: snowy mountains, a frozen lake, pine forest, wooden chalets with steep snowy roofs and a weather observatory; crisp winter light, gentle snowfall far away'],
  ['ruins', 'Memory Island: misty ancient ruins, stone temples with columns covered in vines, soft mysterious light; calm, not scary'],
  ['cave', 'an underground crystal cave arena: rock walls, glowing blue and purple crystals, a faint light shaft from above; cozy adventure mood, not scary'],
  ['league', 'the English Champion League grand stadium on a snowy mountain top: a huge modern stadium interior with tiered stands, big banners, spotlights and confetti in the air, evening sky with stars; exciting final-battle mood'],
];
fs.writeFileSync(path.join(ROOT, 'art', 'gemini', 'arenas.json'), JSON.stringify(ISLE.map(([key, d]) => ({ key, prompt: ASTYLE + '\n\nSetting: ' + d + '.' })), null, 1));
console.log('families', families.length, 'arenas', ISLE.length);
console.log(families[1].prompt);
