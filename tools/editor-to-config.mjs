// Config editöründeki veriyi oyunun okuduğu src/config/oyun-config.json dosyasına çevirir.
// Kullanım:
//   node tools/editor-to-config.mjs indirilen/oyun-config.json   (editörün "Dışa aktar" dosyası: olduğu gibi kopyalanır)
//   node tools/editor-to-config.mjs <nodes-klasoru> <meta.json>   (veritabanı dökümünden üretir)
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("src/config/oyun-config.json");
const [a, b] = process.argv.slice(2);
if (!a) { console.error("Kullanım: node tools/editor-to-config.mjs <oyun-config.json> | <nodes-klasoru> <meta.json>"); process.exit(1); }

if (fs.statSync(a).isFile()) {
  const cfg = JSON.parse(fs.readFileSync(a, "utf8"));
  if (cfg.format !== "gelisim-oyun-config") { console.error("Bu dosya editörün oyun config'i değil."); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify(cfg, null, 2));
  console.log("Kopyalandı →", out);
  process.exit(0);
}

const nodes = {};
for (const f of fs.readdirSync(a).filter(f => f.endsWith(".json"))) {
  const raw = JSON.parse(fs.readFileSync(path.join(a, f), "utf8"));
  const id = raw.id ?? f.replace(/\.json$/, "");
  nodes[id] = { ...(raw.data ?? raw), id };
}
const metaRaw = JSON.parse(fs.readFileSync(b, "utf8"));
const meta = metaRaw.data ?? metaRaw;

const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const all = Object.values(nodes);
const order = n => [n.order ?? 0, n.name ?? ""];
const by = t => all.filter(n => n.type === t).sort((x, y) => (order(x)[0] - order(y)[0]) || String(order(x)[1]).localeCompare(order(y)[1], "tr"));
const incoming = n => all.filter(o => o.links && o.links[n.id]).map(o => [o, o.links[n.id]]);
const pick = (n, keys) => { const o = { id: n.id }; for (const k of keys) if (n[k] !== undefined && n[k] !== "") o[k] = n[k]; if (n.params && Object.keys(n.params).length) o.params = n.params; return o; };
const outLinks = (n, type, key) => Object.entries(n.links || {}).filter(([t]) => nodes[t]?.type === type).map(([t, l]) => ({ [key]: t, w: num(l.w) }));
const strip = arr => (arr || []).map(r => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "" && v != null)));
const ingredients = n => incoming(n).filter(([o]) => o.type === "element" || o.type === "combo");
const manaOf = (id, seen = new Set()) => {
  const n = nodes[id]; if (!n || seen.has(id)) return 0; seen.add(id);
  if (n.type === "element") return num(n.manaCost);
  if (n.type === "combo") return ingredients(n).reduce((m, [o, l]) => m + num(l.w) * manaOf(o.id, new Set(seen)), 0) * (num(n.manaMult) || 1);
  return 0;
};

const cfg = {
  format: "gelisim-oyun-config", version: 1, exportedAt: new Date().toISOString(),
  attributeCategories: strip(meta.attrCats), environmentCategories: strip(meta.envCats),
  attributes: by("attribute").map(n => ({ ...pick(n, ["name", "cat", "base", "max", "learnRate", "diminish", "decayRate", "decayFloor", "desc"]), transfers: outLinks(n, "attribute", "to"), derivedTerms: outLinks(n, "derived", "to") })),
  activities: by("activity").map(n => ({ ...pick(n, ["name", "kind", "duration", "fatigue", "realUse", "teacherRep", "requirement", "desc"]), gains: outLinks(n, "attribute", "attribute") })),
  derived: by("derived").map(n => ({ ...pick(n, ["name", "unit", "base", "min", "max", "desc"]), terms: incoming(n).filter(([o]) => o.type === "attribute").map(([o, l]) => ({ attribute: o.id, w: num(l.w) })) })),
  environment: by("environment").map(n => ({ ...pick(n, ["name", "cat", "desc"]), modifiersPct: ["attribute", "derived", "element", "combo", "spell"].flatMap(t => outLinks(n, t, "target")) })),
  elements: by("element").map(n => pick(n, ["name", "color", "state", "temperature", "density", "conductivity", "manaCost", "mastery", "desc"])),
  combos: by("combo").map(n => ({ ...pick(n, ["name", "color", "kind", "state", "temperature", "density", "manaMult", "minMastery", "stability", "desc"]), ingredients: ingredients(n).map(([o, l]) => ({ id: o.id, ratio: num(l.w) })), manaTotal: manaOf(n.id) })),
  spells: by("spell").map(n => ({ ...pick(n, ["name", "mastery", "minMastery", "manaCost", "castTime", "range", "area", "damage", "duration", "focusNeed", "effect", "desc"]), sources: ingredients(n).map(([o, l]) => ({ id: o.id, amount: num(l.w) })) })),
  items: by("item").map(n => ({ ...pick(n, ["name", "slot", "weight", "durability", "familiarity", "value", "desc"]), bonuses: [...outLinks(n, "attribute", "target"), ...outLinks(n, "derived", "target")] })),
  reputation: { dimensions: strip(meta.repDims), questImportance: strip(meta.importance), givers: strip(meta.givers) },
};
fs.writeFileSync(out, JSON.stringify(cfg, null, 2));
console.log(`Yazıldı → ${out}: ${cfg.attributes.length} özellik, ${cfg.activities.length} aktivite, ${cfg.spells.length} büyü`);
