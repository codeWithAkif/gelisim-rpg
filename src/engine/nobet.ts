// Nöbet (sonsuz kule savunması): kulenin tepesindesin, menziline gireni kendiliğinden vurursun.
// Düşenlerden kırıntı (bakır kırıntısı) toplanır; onunla nöbet boyunca hasar, atış hızı, can,
// yenilenme ve menzil artırılır. Öldürdükçe defter sayfası dolar; dolunca üç karttan biri seçilir.
// Dalgalar sonsuz ve gittikçe zorlaşır; her beşinci dalgada bir lider gelir. Kule düşünce nöbet biter.
// Kırıntı, yükseltmeler ve kartlar YALNIZ O NÖBET içindir; kalıcı para ya da güçlenme yoktur (docs/modlar.md).
// Kalan: en çok kaç dalga dayandığın (rekor), beşer dalgada kese ve karakterin gerçek kullanımla gelişimi.
// Saf simülasyon: stepNobet(dt) zamanı ilerletir; çizim ve dokunma arayüzdedir (DOM yok).
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES, addRep } from "./state";
import { applyGain, realUse, type GainReport } from "./progression";
import { maxHp } from "./combat";
import { Rng } from "./rng";
import { ENEMIES } from "../content/world";
import { addItem } from "./inventory";
import { spellOptions } from "./magic";
import { scavSpellInfo } from "./scavenge";
import { spellAim, wallLen, THROW_RANGE, type SiegeAim } from "./siege";
import { boltStyle, combo, wets, bounces, BOUNCE_MUL, BOUNCE_RANGE, WET_SECS, type BoltStyle } from "./spellfx";
import { SPELL_FX } from "./magic";
import { weaponSet, hasBow } from "./gear";
import { trapEffect, barricadeMul, trapsOwned, owned } from "./engineering";
import { petMul } from "./pet";
import { partyHeroes, heroDef, heroStats } from "./estate";

export const NFIELD = { w: 100, h: 130 };
export const TOWER = { x: 50, y: 65, r: 7 };

/* ---------- nöbet yerleri ---------- */
/** purse: her beş dalgada verilen ödül; yerin parasına göre (köyde köy kadar, şehirde daha çok). */
export interface NobetSite { place: string; name: string; foes: string[]; boss: string; unlock: (s: GameState) => string | null; ground: "cayir" | "kar" | "tas"; purse: { money: number; items: string[] } }
const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
export const NOBET_SITES: NobetSite[] = [
  { place: "yayla", name: "Yayla gözetleme kulesi", foes: ["kurt"], boss: "akyele", ground: "cayir", purse: { money: 3, items: ["deri", "peynir", "ekmek", "ok"] }, unlock: s => done(s, "kurt") ? null : "Önce Hasan'ın kurt derdine yardım et" },
  { place: "karacam_han", name: "Han kulesi", foes: ["haydut", "kurt"], boss: "muhafiz", ground: "tas", purse: { money: 6, items: ["ok", "deri", "ekmek"] }, unlock: s => done(s, "kervan") ? null : "Önce Selim'in kervanını koru" },
  { place: "ayaz_mutfak", name: "Ayazkale suru", foes: ["kar_kurdu", "muhafiz"], boss: "kayhan", ground: "kar", purse: { money: 8, items: ["ekmek", "deri", "ok"] }, unlock: s => done(s, "mutfak") ? null : "Önce Gülizar'ın mutfağında çalış" },
  { place: "ardic_kul", name: "Kül mahallesi damı", foes: ["muhafiz", "haydut"], boss: "sungur", ground: "tas", purse: { money: 10, items: ["ok", "peynir", "deri"] }, unlock: s => done(s, "kul_ana") ? null : "Önce Kül Ana'yı dinle" },
];
export const nobetSite = (place: string) => NOBET_SITES.find(x => x.place === place);

/* ---------- rekor: kalıcı olan yalnız bu ---------- */
export interface NobetSave { best: Record<string, number>; runs: number; fame?: Record<string, number> }   // fame: ün getirmiş en yüksek eşik
const NOBET_REGION: Record<string, string> = { yayla: "taspinar", karacam_han: "karacam", ayaz_mutfak: "ayazkale", ardic_kul: "ardic" };
export function nobetSave(s: GameState): NobetSave { const n = (s.nobet ??= { best: {}, runs: 0 }); n.best ??= {}; n.runs ??= 0; return n; }

/* ---------- nöbet içi yükseltmeler (kırıntı ile) ---------- */
export type StatId = "dmg" | "rate" | "hp" | "regen" | "range";
export const STAT_NAMES: Record<StatId, string> = { dmg: "Hasar", rate: "Atış hızı", hp: "Can", regen: "Yenilenme", range: "Menzil" };
export const upgradeCost = (lvl: number) => Math.round(3 * Math.pow(1.32, lvl) + lvl);

/* ---------- kartlar (defter sayfaları) ---------- */
export interface Card { id: string; name: string; desc: string; max: number; need?: (s: GameState) => boolean; bow?: boolean; spell?: boolean; forSpell?: string }   // forSpell: o büyü elinde olmadan çıkmaz
export const CARDS: Card[] = [
  { id: "cift", name: "Çift ok", desc: "Her atışta bir ok daha, yakındaki ikinci düşmana.", max: 3, bow: true },
  { id: "delici", name: "Delici uç", desc: "Ok ilk düşmanı delip arkasındakine de geçer.", max: 2, bow: true },
  { id: "ates", name: "Ateşli ok", desc: "Vurduğun düşman birkaç saniye yanar.", max: 3, need: s => s.knownElements.includes("el_ates"), bow: true },
  { id: "zincir", name: "Zincir şimşek", desc: "Her beşinci atış yakındaki üç düşmana sıçrar.", max: 3, need: s => s.knownElements.includes("el_simsek"), bow: true },
  { id: "buz", name: "Ayaz halkası", desc: "Kuleye yakın düşmanlar yavaşlar.", max: 3, need: s => s.knownElements.includes("el_ayaz") },
  { id: "kazik", name: "Kazık halkası", desc: "Kuleye dayanan düşman her saniye hasar alır.", max: 3 },
  { id: "kopek", name: "Karabaş", desc: "Karabaş daha sert ısırır, daha uzağı kollar.", max: 3, need: s => !!s.pet },
  { id: "kritik", name: "Zayıf nokta", desc: "Kritik şansı +%8, kritik hasarı artar.", max: 3 },
  { id: "kan", name: "Kurt postu", desc: "Her öldürdüğün düşman bir parça can verir.", max: 3 },
  { id: "kese", name: "Dolu kese", desc: "Düşenlerden %30 daha çok kırıntı.", max: 3 },
  { id: "diken", name: "Dikenli sur", desc: "Sura vuran, vurduğunun yarısını geri yer.", max: 2 },
  { id: "restorasyon", name: "Restorasyon", desc: "Kule yenilenmesi +%25.", max: 4 },
  { id: "sans", name: "Şans", desc: "Kritik şansı +%5.", max: 3 },
  { id: "gorus", name: "Görüş", desc: "Menzil +%8.", max: 3, bow: true },
  { id: "ofke", name: "Öfke", desc: "Hasar +%8.", max: 4 },
  { id: "hiz_hasar", name: "Hasar için hız", desc: "Atış hızı +%15, hasar −%4.", max: 3 },
  { id: "hasar_hiz", name: "Hız için hasar", desc: "Hasar +%15, atış hızı −%4.", max: 3 },
  // büyüye özel: yalnız o büyü elindeyse çıkar
  { id: "top_guc", name: "Kızgın top", desc: "Ateş topu %25 daha çok vurur.", max: 3, forSpell: "ates_topu" },
  { id: "top_alan", name: "Geniş patlama", desc: "Ateş topunun alanı %15 büyür.", max: 3, forSpell: "ates_topu" },
  { id: "top_hiz", name: "Çabuk top", desc: "Ateş topu %20 daha çabuk dolar.", max: 3, forSpell: "ates_topu" },
  { id: "duvar_uzun", name: "Uzun şerit", desc: "Ateş duvarı %20 daha uzun çizilir.", max: 3, forSpell: "sy_el_ates_duvar" },
  { id: "duvar_kor", name: "Kor şerit", desc: "Ateş duvarı %25 daha çok yakar ve bir saniye daha uzun kalır.", max: 3, forSpell: "sy_el_ates_duvar" },
  { id: "duvar_hiz", name: "Çabuk duvar", desc: "Ateş duvarı %20 daha çabuk dolar.", max: 3, forSpell: "sy_el_ates_duvar" },
  { id: "nefes", name: "Derin nefes", desc: "Bütün büyüler %20 daha çabuk dolar.", max: 3, spell: true },
];

/* ---------- durum ---------- */
export interface NFoe { wet?: number; id: number; def: string; x: number; y: number; hp: number; max: number; speed: number; dmg: number; cd: number; r: number; boss: boolean; burn: number; burnMul?: number; slow: number; root: number; stun: number; peck: number; human: boolean; reward: number }
export interface Shot { x: number; y: number; tx: number; ty: number; target: number; dmg: number; crit: boolean; pierce: number; burn: boolean; hit: number[] }
export type NFx =
  | { k: "hit"; x: number; y: number; dmg: number; crit: boolean } | { k: "die"; x: number; y: number; coins: number; boss: boolean }
  | { k: "hurt"; dmg: number } | { k: "zap"; pts: [number, number][] } | { k: "wave"; n: number; boss: boolean } | { k: "card" } | { k: "reward"; wave: number; loot: Loot } | { k: "spell"; id: SpellId; kind: SpellKind; x: number; y: number; r: number; x2?: number; y2?: number; hits: number[]; pts?: [number, number][]; from?: [number, number]; wall?: boolean } | { k: "bite"; x: number; y: number }
  | { k: "melee"; x: number; y: number } | { k: "trap"; x: number; y: number; type: string; r: number } | { k: "barbreak"; x: number; y: number } | { k: "combo"; tag: string; x: number; y: number };
export interface Nobet {
  site: NobetSite; phase: "play" | "card" | "over"; time: number; wave: number; waveLeft: number; spawnT: number; breakT: number;
  hp: number; maxHp: number; regen: number; dmg: number; rate: number; range: number; crit: number;
  lv: Record<StatId, number>; rerolls: number; coins: number; cards: Record<string, number>; offer: string[];
  page: number; pageNeed: number; fireCd: number; shotsFired: number;
  spells: Record<SpellId, NSpell>;
  bow: boolean; melee: number; meleeCd: number; meleeFx: number;      // yay varsa uzaktan atar; yanına gelene eldeki silahla vurur
  prep: boolean; bars: Bar[]; traps: Trap[]; petBond: number;          // hazırlık: yapılar kurulur, "başla" denince dalgalar gelir
  helpers: { id: string; name: string; role: string; cd: number; dmg: number; a: number }[];
  pet?: { x: number; y: number; hx: number; hy: number; cd: number; lv: number; wx: number; wy: number; wt: number }; // wx/wy: boşta gezindiği nokta
  loot: Loot; rewarded: number; lines: NLine[]; foes: NFoe[]; shots: Shot[]; fx: NFx[]; nextId: number; seed: number; rng: Rng;
  stats: { kills: number; shots: number; bosses: number; dmgTaken: number; coins: number; cards: number; skills: number; bossDefs?: string[] };
}

export interface Bar { id: number; x: number; y: number; a: number; len: number; hp: number; max: number }
export interface Trap { id: number; x: number; y: number; type: string; armed: boolean }
export const BAR_LEN = 12;
const lvA = (s: GameState, a: string) => s.attrs[a]?.level ?? 10;
export function createNobet(cfg: Config, s: GameState, site: NobetSite, seed: number): Nobet {
  const pm = (_id: string) => 0;   // kalıcı güçlenme yok: her şey karakterden
  const hp = Math.round(maxHp(cfg, s) + 10);
  const dmg = 6 + lvA(s, "okculuk") / 4 + lvA(s, "ust_govde") / 10;
  const rng = new Rng(seed);
  return {
    site, phase: "play", time: 0, wave: 0, waveLeft: 0, spawnT: 0, breakT: 1.5,
    hp, maxHp: hp, regen: 0.3, dmg: dmg, rate: (0.9 + lvA(s, "refleks") / 80) * (1 + pm("cabuk") * 0.05), range: (30 + lvA(s, "gorus") / 8) * (s.pet?.id === "sahin" && (s.pet.bond ?? 0) >= 10 ? 1.1 : 1), crit: 0.05 + lvA(s, "okculuk") / 400 + pm("keskin") * 0.02 + (s.pet?.id === "sahin" && (s.pet.bond ?? 0) >= 75 ? 0.1 : 0),
    bow: hasBow(s), melee: (weaponSet(cfg, s).dmg + lvA(s, "ust_govde") / 10) * (1 + pm("guc") * 0.08), meleeCd: 0, meleeFx: 0,
    prep: owned(s, "kazik_barikat") + trapsOwned(s).reduce((a, x) => a + x.n, 0) > 0, bars: [], traps: [], petBond: s.pet?.bond ?? 0,
    lv: { dmg: 0, rate: 0, hp: 0, regen: 0, range: 0 }, rerolls: 2, coins: 8 + pm("miras") * 6, cards: {}, offer: [],
    page: 0, pageNeed: 6, fireCd: 0, shotsFired: 0,
    spells: startSpells(cfg, s), helpers: partyHeroes(s).map((h, i) => ({ id: h.id, name: heroDef(h.id)!.name, role: heroDef(h.id)!.role, cd: 0.6 + i * 0.4, dmg: (heroStats(h).dmg[0] + heroStats(h).dmg[1]) / 2, a: Math.PI * (0.62 + i * 0.28) })), pet: s.pet ? { x: TOWER.x, y: TOWER.y + 16, hx: TOWER.x, hy: TOWER.y + 16, cd: 0, lv: 1, wx: TOWER.x, wy: TOWER.y + 16, wt: 0 } : undefined,
    loot: { money: 0, items: {} }, rewarded: 0, lines: [], foes: [], shots: [], fx: [], nextId: 1, seed, rng,
    stats: { kills: 0, shots: 0, bosses: 0, dmgTaken: 0, coins: 0, cards: 0, skills: 0 },
  };
}

/* ---------- oyuncu eylemleri ---------- */
export function statValue(n: Nobet, id: StatId): number { return id === "dmg" ? n.dmg : id === "rate" ? n.rate : id === "hp" ? n.maxHp : id === "regen" ? n.regen : n.range; }
export function buyUpgrade(n: Nobet, id: StatId): boolean {
  const c = upgradeCost(n.lv[id]); if (n.coins < c || n.phase === "over") return false;
  n.coins -= c; n.lv[id]++;
  if (id === "dmg") { n.dmg *= 1.12; n.melee *= 1.12; }
  else if (id === "rate") n.rate *= 1.08;
  else if (id === "hp") { const add = Math.round(n.maxHp * 0.12); n.maxHp += add; n.hp += add; }
  else if (id === "regen") n.regen += 0.25 + n.regen * 0.1;
  else n.range = Math.min(58, n.range + 2.2);
  return true;
}
export function availableCards(s: GameState, n: Nobet): Card[] { return CARDS.filter(c => (n.cards[c.id] ?? 0) < c.max && (!c.need || c.need(s)) && (!c.bow || n.bow) && (!c.spell || Object.keys(n.spells).length > 0) && (!c.forSpell || !!n.spells[c.forSpell])); }
function offerCards(s: GameState, n: Nobet) {
  const pool = availableCards(s, n).map(c => c.id); const out: string[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(n.rng.next() * pool.length), 1)[0]);
  if (!out.length) return;
  n.offer = out; n.phase = "card"; n.fx.push({ k: "card" });
}
/** Sayfa tekrar çevir: seçenekleri yeniler (nöbet başına iki hak). */
export function rerollCards(s: GameState, n: Nobet): boolean {
  if (n.phase !== "card" || n.rerolls <= 0) return false;
  const old = n.offer; const pool = availableCards(s, n).map(c => c.id).filter(id => !old.includes(id)); const out: string[] = [];
  const rest = availableCards(s, n).map(c => c.id).filter(id => old.includes(id));
  const all = pool.length >= 3 ? pool : [...pool, ...rest];
  while (out.length < 3 && all.length) out.push(all.splice(Math.floor(n.rng.next() * all.length), 1)[0]);
  if (!out.length) return false;
  n.rerolls--; n.offer = out; return true;
}
/** Beklemeden sıradaki dalgayı çağır: kısa bir ödül verir. */
export const canCallWave = (n: Nobet) => n.phase === "play" && !n.prep && n.waveLeft <= 0 && n.foes.length === 0 && n.wave > 0;
export function callWave(n: Nobet): boolean {
  if (!canCallWave(n) || n.breakT <= 0.05) return false;
  n.coins += 2 + n.wave; n.stats.coins += 2 + n.wave; n.breakT = 0; return true;
}
/** Çantadaki yiyecek kuleye can olur. */
export const SUPPLIES: Record<string, number> = { ekmek: 0.3, peynir: 0.35, elma: 0.15 };
export function useSupply(s: GameState, n: Nobet, id: string): boolean {
  const k = SUPPLIES[id]; if (!k || (s.inventory[id] ?? 0) <= 0 || n.phase !== "play" || n.hp >= n.maxHp) return false;
  s.inventory[id]--; if (s.inventory[id] <= 0) delete s.inventory[id]; n.hp = Math.min(n.maxHp, n.hp + n.maxHp * k); return true;
}
export function pickCard(s: GameState, n: Nobet, id: string): boolean {
  if (n.phase !== "card" || !n.offer.includes(id)) return false;
  n.cards[id] = (n.cards[id] ?? 0) + 1; n.offer = []; n.phase = "play"; n.stats.cards++;
  if (id === "kritik") n.crit += 0.08;
  if (id === "restorasyon") n.regen *= 1.25;
  if (id === "sans") n.crit += 0.05;
  if (id === "gorus") n.range = Math.min(58, n.range * 1.08);
  if (id === "ofke") { n.dmg *= 1.08; n.melee *= 1.08; }
  if (id === "hiz_hasar") { n.rate *= 1.15; n.dmg *= 0.96; n.melee *= 0.96; }
  if (id === "hasar_hiz") { n.dmg *= 1.15; n.melee *= 1.15; n.rate *= 0.96; }
  if (id === "nefes") for (const sp of Object.values(n.spells)) sp!.max *= 0.8;
  const sp = (k: string) => n.spells[k];
  if (id === "top_guc" && sp("ates_topu")) sp("ates_topu").mul *= 1.25;
  if (id === "top_alan" && sp("ates_topu")) sp("ates_topu").r *= 1.15;
  if (id === "top_hiz" && sp("ates_topu")) sp("ates_topu").max *= 0.8;
  if (id === "duvar_uzun" && sp("sy_el_ates_duvar")) sp("sy_el_ates_duvar").len = (sp("sy_el_ates_duvar").len ?? wallLen("sy_el_ates_duvar")) * 1.2;
  if (id === "duvar_kor" && sp("sy_el_ates_duvar")) { sp("sy_el_ates_duvar").mul *= 1.25; sp("sy_el_ates_duvar").dur = (sp("sy_el_ates_duvar").dur ?? 7) + 1; }
  if (id === "duvar_hiz" && sp("sy_el_ates_duvar")) sp("sy_el_ates_duvar").max *= 0.8;
  if (id === "kopek" && n.pet) n.pet.lv++;
  return true;
}
/** Karabaş'ın bekleyeceği yer: kuleden çok uzağa gidemez. */
export function placePet(n: Nobet, x: number, y: number): boolean {
  if (!n.pet) return false;
  const dx = x - TOWER.x, dy = y - TOWER.y, d = Math.hypot(dx, dy) || 1; const k = Math.min(1, 34 / d);
  n.pet.hx = TOWER.x + dx * k; n.pet.hy = TOWER.y + dy * k; n.pet.wx = n.pet.hx; n.pet.wy = n.pet.hy; n.pet.wt = 1; return true;
}
export const petGuard = (n: Nobet) => 16 + (n.pet?.lv ?? 1) * 3 + (n.petBond >= 50 ? 8 : 0);
/* ---------- büyüler: yalnızca gerçekten bildiklerin ---------- */
export type SpellKind = "simsek" | "ates" | "buz" | "camur" | "sarmasik" | "karga" | "kilic";
export type SpellId = string;
export interface NSpell { id: string; kind: SpellKind; name: string; cd: number; max: number; mul: number; r: number; len?: number; dur?: number; bolt?: BoltStyle | null }   // bolt: şimşek büyüsü zincir mi (elden) yıldırım mı (gökten); engine/spellfx.ts
/** Yere çizilen şerit (ateş duvarı, buz ve taş duvarı): süresi dolana kadar üstünden geçenleri etkiler. */
export interface NLine { id: number; x1: number; y1: number; x2: number; y2: number; t: number; max: number; kind: "ates" | "buz" | "yavas"; mul: number; hit: number[] }
/** Nöbette karşılığı olan büyüler (config kimliği → etki). Diğer büyüler nöbette kullanılamaz. */
export const SPELL_KIND: Record<string, { kind: SpellKind; mul: number; r: number; cd: number }> = {
  ates_topu: { kind: "ates", mul: 3, r: 12, cd: 9 }, magma_akintisi: { kind: "ates", mul: 4.5, r: 16, cd: 16 },
  buz_duvari: { kind: "buz", mul: 0.8, r: 16, cd: 15 }, camur_tuzagi: { kind: "camur", mul: 0.4, r: 17, cd: 12 },
  simsek_zinciri: { kind: "simsek", mul: 3.5, r: 14, cd: 18 }, elektrik_golu: { kind: "simsek", mul: 2.2, r: 12, cd: 12 }, yildirim_firtinasi: { kind: "simsek", mul: 5.5, r: 26, cd: 30 },
  sarmasik: { kind: "sarmasik", mul: 0.6, r: 18, cd: 14 }, karga_surusu: { kind: "karga", mul: 0.5, r: 26, cd: 20 }, yer_kiliclari: { kind: "kilic", mul: 4, r: 5, cd: 16 },
};
/** Nöbete hangi büyülerle girilir: defterinde sayfası olan, ustalığı yeten, nöbette karşılığı olanlar. */
function startSpells(cfg: Config, s: GameState): Nobet["spells"] {
  const out: Nobet["spells"] = {};
  for (const o of spellOptions(cfg, { ...s, mana: 999 } as GameState)) {
    if (!o.ok) continue; const info = SPELL_KIND[o.spell.id] ?? scavSpellInfo(cfg, o.spell.id); if (!info) continue;
    const m = o.spell.mastery ? s.attrs[o.spell.mastery]?.level ?? 0 : 0;
    out[o.spell.id] = { id: o.spell.id, kind: info.kind, name: o.spell.name, cd: 3 + Object.keys(out).length * 1.5, max: info.cd * Math.max(0.6, 1 - m / 120), mul: info.mul * (1 + m / 100), r: info.r, bolt: boltStyle(cfg, o.spell.id) };
  }
  return out;
}
function crowdCenter(n: Nobet, r: number) {
  let best = n.foes[0], bc = -1;
  for (const f of n.foes) { const c = n.foes.filter(g => Math.hypot(g.x - f.x, g.y - f.y) < r).length + (f.boss ? 1 : 0); if (c > bc) { bc = c; best = f; } }
  return best;
}
/** Büyüyü hazır mı: dolmuş ve nöbet sürüyor. */
/** Nöbet sırasında yeni keşfedilen (ya da girişte listede olmayan) bir büyüyü ekle. */
export function addNobetSpell(cfg: Config, s: GameState, n: Nobet, id: string): boolean {
  if (n.spells[id]) return true;
  const o = spellOptions(cfg, { ...s, mana: 999 } as GameState).find(x => x.spell.id === id && x.ok); if (!o) return false;
  const info = SPELL_KIND[id] ?? scavSpellInfo(cfg, id); if (!info) return false;
  const m = o.spell.mastery ? s.attrs[o.spell.mastery]?.level ?? 0 : 0;
  n.spells[id] = { id, kind: info.kind, name: o.spell.name, cd: 0, max: info.cd * Math.max(0.6, 1 - m / 120), mul: info.mul * (1 + m / 100), r: info.r, bolt: boltStyle(cfg, id) };
  return true;
}
export const spellReady = (n: Nobet, id: SpellId) => !!n.spells[id] && n.spells[id].cd <= 0 && n.phase === "play" && !n.prep;
/**
 * Büyü yapar. Hedef verilirse oraya düşer (kılıçlar: kuleden o yöne doğru yükselir);
 * verilmezse kalabalığın ortasını kendisi bulur.
 */
/** Nöbette büyü nasıl uygulanır: duvar yere çizilir, kılıçlar bir yöne, top ve zincir kuleden ileri atılır, gerisi noktaya dokunarak. */
export type NobetAim = SiegeAim | "dir";
export function nobetAim(n: Nobet, id: SpellId): NobetAim { return n.spells[id]?.kind === "kilic" ? "dir" : spellAim(id); }
/** Kuleden ileri atılan büyünün varacağı yer: parmağın gösterdiği yöne, menzil kadar. */
export function throwLanding(tx: number, ty: number): { x: number; y: number } {
  const dx = tx - TOWER.x, dy = ty - (TOWER.y - 6), d = Math.hypot(dx, dy) || 1; const k = Math.min(1, THROW_RANGE / d);
  return { x: TOWER.x + dx * k, y: TOWER.y - 6 + dy * k };
}
export function useSpell(n: Nobet, id: SpellId, tx?: number, ty?: number): boolean {
  const sp = n.spells[id]; if (!sp || sp.cd > 0 || n.phase !== "play" || n.prep) return false;
  if (tx === undefined && !n.foes.length) return false;
  let from: [number, number] | undefined;
  if (tx !== undefined && ty !== undefined && nobetAim(n, id) === "throw") { const l = throwLanding(tx, ty); tx = l.x; ty = l.y; from = [TOWER.x, TOWER.y - 6]; }
  const R = sp.r; const c = tx !== undefined && ty !== undefined ? { x: tx, y: ty } : crowdCenter(n, R); const hits: number[] = [];
  const inR = (f: NFoe, r = R) => Math.hypot(f.x - c.x, f.y - c.y) < r;
  let x2: number | undefined, y2: number | undefined, fx0 = c.x, fy0 = c.y;
  const pts: [number, number][] = [];
  if (sp.kind === "simsek") {
    // zincir şimşek: hedefe en yakın düşmandan başlar, ondan en yakın üçüne atlar; yıldırım: alandaki herkese üstten düşer
    let list: NFoe[];
    if (sp.bolt === "chain") {
      const first = [...n.foes].filter(f => inR(f, R * 1.3)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      list = first ? [first, ...n.foes.filter(f => f !== first && Math.hypot(f.x - first.x, f.y - first.y) < 24).sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y)).slice(0, 3)] : [];
    } else list = n.foes.filter(f => inR(f));
    for (const f of list) { pts.push([f.x, f.y]); hits.push(f.id); f.slow = Math.max(f.slow, 1.5); spellHit(n, f, "simsek", n.dmg * sp.mul); }
    if (!pts.length) pts.push([c.x, c.y]);
  } else if (sp.kind === "ates") {
    for (const f of [...n.foes]) if (inR(f)) { hits.push(f.id); const wasWet = (f.wet ?? 0) > 0; spellHit(n, f, "ates", n.dmg * sp.mul); if (!wasWet) f.burn = Math.max(f.burn, 3.5); }
  } else if (sp.kind === "buz") {
    for (const f of n.foes) if (inR(f)) { hits.push(f.id); f.root = Math.max(f.root, f.boss ? 1.5 : 3.5); f.slow = Math.max(f.slow, 4); spellHit(n, f, "buz", n.dmg * sp.mul); }
  } else if (sp.kind === "camur") {
    for (const f of n.foes) if (inR(f)) { hits.push(f.id); f.slow = Math.max(f.slow, 5); spellHit(n, f, "camur", n.dmg * sp.mul); }
  } else if (sp.kind === "sarmasik") {
    for (const f of n.foes) if (inR(f)) { hits.push(f.id); f.root = Math.max(f.root, f.boss ? 1.5 : 3.5); hurt(n, f, n.dmg * sp.mul, false); }
  } else if (sp.kind === "karga") {
    // kargalar: en çok altı düşmana saldırır; gagalanan saldıramaz ve yavaş yavaş can kaybeder
    for (const f of n.foes.filter(q => inR(q)).slice(0, 6)) { hits.push(f.id); f.peck = Math.max(f.peck, 4); }
  } else {
    // yerden kılıçlar: kuleden hedefe doğru bir hat; üstündeki her şey havaya fırlar
    const a = Math.atan2(c.y - TOWER.y, c.x - TOWER.x); const L = 48;
    const x1 = TOWER.x + Math.cos(a) * 8, y1 = TOWER.y + Math.sin(a) * 8; x2 = TOWER.x + Math.cos(a) * L; y2 = TOWER.y + Math.sin(a) * L; fx0 = x1; fy0 = y1;
    for (const f of [...n.foes]) {
      const vx = x2 - x1, vy = y2 - y1; const u = Math.max(0, Math.min(1, ((f.x - x1) * vx + (f.y - y1) * vy) / (vx * vx + vy * vy)));
      if (Math.hypot(f.x - (x1 + vx * u), f.y - (y1 + vy * u)) < 5 + f.r) { hits.push(f.id); f.stun = Math.max(f.stun, 1.4); hurt(n, f, n.dmg * sp.mul, true); }
    }
  }
  // sekme: ateş ve buz topu çarptığı yerden bir kez sekip en yakın ikinci düşmana vurur
  if (bounces(sp.kind) && hits.length) {
    const nxt = n.foes.filter(f => !hits.includes(f.id) && Math.hypot(f.x - c.x, f.y - c.y) < R + BOUNCE_RANGE).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    if (nxt) { hits.push(nxt.id); n.fx.push({ k: "combo", tag: "Sekti!", x: nxt.x, y: nxt.y }); if (sp.kind === "ates") nxt.burn = Math.max(nxt.burn, 2); else nxt.slow = Math.max(nxt.slow, 2.5); spellHit(n, nxt, sp.kind, n.dmg * sp.mul * BOUNCE_MUL); }
  }
  n.fx.push({ k: "spell", id, kind: sp.kind, x: fx0, y: fy0, r: sp.kind === "kilic" ? 5 : R, x2, y2, hits, pts, from });
  sp.cd = sp.max; n.stats.skills++;
  return true;
}
/** Yere çizilen duvar (ateş duvarı, buz ve taş duvarı): patlamaz; çizilen şerit süresince üstünden geçeni etkiler.
 * Ateş duvarı geçeni tutuşturur ve o yanmaya devam eder; buz dondurur; taş yavaşlatır. */
export function useWall(n: Nobet, id: SpellId, x1: number, y1: number, x2: number, y2: number): { ok: boolean; reason?: string } {
  const sp = n.spells[id]; if (!sp || sp.cd > 0 || n.phase !== "play" || n.prep) return { ok: false, reason: "Büyü hazır değil" };
  let L = Math.hypot(x2 - x1, y2 - y1); if (L < 4) return { ok: false, reason: "Daha uzun çiz" };
  const max = sp.len ?? wallLen(id); if (L > max) { const k = max / L; x2 = x1 + (x2 - x1) * k; y2 = y1 + (y2 - y1) * k; L = max; }
  const vx = x2 - x1, vy = y2 - y1; const u = Math.max(0, Math.min(1, ((TOWER.x - x1) * vx + (TOWER.y - y1) * vy) / (vx * vx + vy * vy)));
  if (Math.hypot(TOWER.x - (x1 + vx * u), TOWER.y - (y1 + vy * u)) < TOWER.r + 3) return { ok: false, reason: "Kendi üstüne kuramazsın" };
  const fire = !!SPELL_FX[id]?.ignite || sp.kind === "ates"; const kind: NLine["kind"] = fire ? "ates" : sp.kind === "buz" ? "buz" : "yavas";
  const dur = sp.dur ?? 7;
  n.lines.push({ id: n.nextId++, x1, y1, x2, y2, t: dur, max: dur, kind, mul: sp.mul, hit: [] });
  n.fx.push({ k: "spell", id, kind: sp.kind, x: x1, y: y1, r: 0, x2, y2, hits: [], wall: true });
  sp.cd = sp.max; n.stats.skills++;
  return { ok: true };
}
const segDistN = (px: number, py: number, l: { x1: number; y1: number; x2: number; y2: number }) => {
  const vx = l.x2 - l.x1, vy = l.y2 - l.y1; const u = Math.max(0, Math.min(1, ((px - l.x1) * vx + (py - l.y1) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - (l.x1 + vx * u), py - (l.y1 + vy * u));
};
/** Şeritlerin etkisi: ateş tutuşturur (yanma sürer), buz dondurur, taş yavaşlatır; her düşman bir şeride ilk girişte bir darbe alır. */
function stepLines(n: Nobet, dt: number) {
  for (const l of n.lines) {
    l.t -= dt;
    for (const f of n.foes) {
      if (f.hp <= 0 || segDistN(f.x, f.y, l) > f.r + 1.5) continue;
      if (!l.hit.includes(f.id)) { l.hit.push(f.id); hurt(n, f, n.dmg * l.mul * (l.kind === "ates" ? 0.6 : 0.35), false); if (f.hp <= 0) continue; }
      if (l.kind === "ates") { f.burn = Math.max(f.burn, 3.5); f.burnMul = Math.max(f.burnMul ?? 1, 2.5 * l.mul); }
      else if (l.kind === "buz") { f.root = Math.max(f.root, f.boss ? 0.8 : 1.6); f.slow = Math.max(f.slow, 3); }
      else f.slow = Math.max(f.slow, 3.5);
    }
  }
  n.lines = n.lines.filter(l => l.t > 0);
}

/* ---------- yapılar: hazırladığın barikat ve tuzaklar ---------- */
export interface StructLeft { barikat: number; traps: { id: string; n: number }[] }
export function structLeft(s: GameState, n: Nobet): StructLeft {
  return { barikat: owned(s, "kazik_barikat") - n.bars.length, traps: trapsOwned(s).map(t => ({ id: t.id, n: t.n - n.traps.filter(x => x.type === t.id).length })) };
}
/** Kurulum: nöbet başlamadan ya da dalgalar arası, ortada düşman yokken. */
export const canPlaceNow = (n: Nobet) => n.phase === "play" && (n.prep || (n.foes.length === 0 && n.waveLeft === 0));
const clampPos = (x: number, y: number) => { const dx = x - TOWER.x, dy = y - TOWER.y, d = Math.hypot(dx, dy) || 1; const k = Math.max(TOWER.r + 7, Math.min(46, d)) / d; return { x: TOWER.x + dx * k, y: TOWER.y + dy * k }; };
export function placeBar(s: GameState, n: Nobet, x: number, y: number): boolean {
  if (!canPlaceNow(n) || structLeft(s, n).barikat <= 0) return false;
  const p = clampPos(x, y); const a = Math.atan2(p.y - TOWER.y, p.x - TOWER.x) + Math.PI / 2; const max = 45 * barricadeMul(s);
  n.bars.push({ id: n.nextId++, x: p.x, y: p.y, a, len: BAR_LEN, hp: max, max }); return true;
}
export function placeTrap(s: GameState, n: Nobet, type: string, x: number, y: number): boolean {
  if (!canPlaceNow(n) || (structLeft(s, n).traps.find(t => t.id === type)?.n ?? 0) <= 0) return false;
  const p = clampPos(x, y); n.traps.push({ id: n.nextId++, x: p.x, y: p.y, type, armed: true }); return true;
}
/** Kurulu bir yapıyı geri al (yakındaki en yakın). */
export function pickUp(n: Nobet, x: number, y: number): boolean {
  if (!canPlaceNow(n)) return false;
  const near = (px: number, py: number) => Math.hypot(px - x, py - y);
  const b = n.bars.map(q => ({ q, d: near(q.x, q.y) })).sort((a, c) => a.d - c.d)[0]; const t = n.traps.map(q => ({ q, d: near(q.x, q.y) })).sort((a, c) => a.d - c.d)[0];
  if (b && b.d < 7 && (!t || b.d <= t.d)) { n.bars = n.bars.filter(q => q !== b.q); return true; }
  if (t && t.d < 5) { n.traps = n.traps.filter(q => q !== t.q); return true; }
  return false;
}
export function startWaves(n: Nobet) { n.prep = false; }
const segDist = (px: number, py: number, b: Bar) => {
  const ax = b.x - Math.cos(b.a) * b.len / 2, ay = b.y - Math.sin(b.a) * b.len / 2, bx = b.x + Math.cos(b.a) * b.len / 2, by = b.y + Math.sin(b.a) * b.len / 2;
  const vx = bx - ax, vy = by - ay, u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - (ax + vx * u), py - (ay + vy * u));
};
/** Eski adı: ilk büyü. */
export const useSkill = (n: Nobet) => { const id = Object.keys(n.spells)[0]; return id ? useSpell(n, id) : false; };

/* ---------- dalgalar ---------- */
export const isBossWave = (w: number) => w % 5 === 0;
/** Dalga ilerledikçe düşmanlar hızlanır ve sertleşir (1. dalgaya göre çarpan). */
export function waveScale(w: number): { speed: number; power: number; hp: number } {
  return { speed: 1 + Math.min(1, (w - 1) * 0.035), power: 1 + (w - 1) * 0.15, hp: Math.pow(1.16, w - 1) };
}
/** Beş dalgada bir ödül: yerin kesesinden para ve bir eşya; ileri dalgalarda biraz daha çok. */
export interface Loot { money: number; items: Record<string, number> }
export function milestoneReward(site: NobetSite, w: number, rng: Rng): Loot {
  const tier = Math.floor(w / 5);
  const items: Record<string, number> = {}; const it = site.purse.items[Math.floor(rng.next() * site.purse.items.length)];
  items[it] = it === "ok" ? 3 + tier : 1 + Math.floor((tier - 1) / 2);
  // kese dalgayla belirgin büyür: nöbet uzun dayanana bir para kaynağıdır
  return { money: Math.round(site.purse.money * tier * (1 + tier * 0.15)), items };
}
export function waveSize(w: number) { return isBossWave(w) ? 3 + Math.floor(w / 2) : 4 + Math.floor(w * 1.3); }
function spawn(n: Nobet) {
  const w = n.wave; const boss = isBossWave(w) && n.waveLeft === waveSize(w);
  const def = boss ? n.site.boss : n.site.foes[Math.floor(n.rng.next() * n.site.foes.length)];
  const d = ENEMIES[def]; const human = d.species === "insan";
  const k = Math.pow(1.16, w - 1);
  const { speed: spM, power } = waveScale(w);
  const a = n.rng.next() * Math.PI * 2; const R = 78;
  const hp = d.hp * 0.55 * k * (boss ? 4 : 1);
  n.foes.push({ id: n.nextId++, def, x: TOWER.x + Math.cos(a) * R, y: TOWER.y + Math.sin(a) * R, hp, max: hp,
    speed: (human ? 5 : 7.5) * (d.move / (human ? 3 : 4)) * (boss ? 0.75 : 1) * spM,
    dmg: ((d.damage[0] + d.damage[1]) / 2) * 0.35 * power * (boss ? 1.8 : 1), cd: 0.5, r: boss ? 4.5 : human ? 3.2 : 3, boss, burn: 0, slow: 0, root: 0, stun: 0, peck: 0, human,
    reward: Math.round((1 + w * 0.25) * (boss ? 12 : 1) * (human ? 1.3 : 1)) });
  n.waveLeft--;
}
/** Büyü vuruşu: birleşik tepki (iletken, buhar, çatlama) ve ıslatma. Kural engine/spellfx.ts'te, dört sahnede aynı. */
function spellHit(n: Nobet, f: NFoe, kind: string, dmg: number) {
  const c = combo(kind, { wet: (f.wet ?? 0) > 0, burn: f.burn > 0 });
  if (c?.quench) { f.burn = 0; f.wet = 0; }
  if (wets(kind)) f.wet = WET_SECS;
  if (c) n.fx.push({ k: "combo", tag: c.tag, x: f.x, y: f.y });
  hurt(n, f, dmg * (c?.mul ?? 1), false);
}
function hurt(n: Nobet, f: NFoe, dmg: number, crit: boolean, quiet = false) {
  if (f.hp <= 0) return;
  f.hp -= dmg; if (!quiet) n.fx.push({ k: "hit", x: f.x, y: f.y, dmg: Math.round(dmg), crit });
  if (f.hp > 0) return;
  const coins = Math.round(f.reward * (1 + (n.cards.kese ?? 0) * 0.3));
  n.coins += coins; n.stats.coins += coins; n.stats.kills++; if (f.boss) { n.stats.bosses++; (n.stats.bossDefs ??= []).push(f.def); }
  n.fx.push({ k: "die", x: f.x, y: f.y, coins, boss: f.boss });
  if (n.cards.kan) n.hp = Math.min(n.maxHp, n.hp + n.cards.kan * 0.6 + (f.boss ? 10 : 0));
  n.foes = n.foes.filter(g => g !== f);
  n.page += f.boss ? 4 : 1;
}

/* ---------- zaman ---------- */
export function stepNobet(s: GameState, n: Nobet, dt: number) {
  if (n.phase !== "play") return;
  if (n.prep) return;                                  // kurulum bitmeden dalgalar gelmez
  dt = Math.min(dt, 0.05); n.time += dt;
  n.hp = Math.min(n.maxHp, n.hp + n.regen * dt);
  for (const sp of Object.values(n.spells)) sp.cd = Math.max(0, sp.cd - dt);
  // dalga
  if (n.waveLeft <= 0 && !n.foes.length) {
    if (n.wave > 0 && isBossWave(n.wave) && n.rewarded < n.wave) {
      const r = milestoneReward(n.site, n.wave, n.rng); n.loot.money += r.money;
      for (const [k, v] of Object.entries(r.items)) n.loot.items[k] = (n.loot.items[k] ?? 0) + v;
      n.fx.push({ k: "reward", wave: n.wave, loot: r }); n.rewarded = n.wave;
    }
    if ((n.breakT -= dt) <= 0) { n.wave++; n.waveLeft = waveSize(n.wave); n.spawnT = 0; n.breakT = 2; n.fx.push({ k: "wave", n: n.wave, boss: isBossWave(n.wave) });
      for (const b of n.bars) b.hp = Math.min(b.max, b.hp + b.max * 0.5);       // dalga arasında barikatlar onarılır, tuzaklar yeniden kurulur
      for (const q of n.traps) q.armed = true; }
  } else if (n.waveLeft > 0 && (n.spawnT -= dt) <= 0) { spawn(n); n.spawnT = Math.max(0.25, 1.3 - n.wave * 0.04) * (0.6 + n.rng.next() * 0.8); }
  stepLines(n, dt);
  // düşmanlar
  const ice = n.cards.buz ?? 0, stake = n.cards.kazik ?? 0;
  for (const f of [...n.foes]) {
    if (f.burn > 0) { f.burn -= dt; hurt(n, f, n.dmg * 0.25 * (n.cards.ates ?? 1) * (f.burnMul ?? 1) * dt, false, true); if (f.burn <= 0) f.burnMul = 1; if (f.hp <= 0) continue; }
    f.slow = Math.max(0, f.slow - dt); f.root = Math.max(0, f.root - dt); if (f.wet) f.wet = Math.max(0, f.wet - dt);
    if (f.peck > 0) { f.peck -= dt; hurt(n, f, n.dmg * 0.5 * dt, false, true); if (f.hp <= 0) continue; }
    if (f.stun > 0) { f.stun -= dt; continue; }
    const dx = TOWER.x - f.x, dy = TOWER.y - f.y, d = Math.hypot(dx, dy);
    let sp = f.speed * (f.slow > 0 ? 0.35 : 1);
    if (ice && d < 22) sp *= 1 - 0.18 * ice;
    if (d > TOWER.r + f.r) {
      if (f.root > 0) continue;
      const nx = f.x + dx / d * sp * dt, ny = f.y + dy / d * sp * dt;
      // barikat yolu keser: düşman durup barikata vurur
      const bl = n.bars.find(b => segDist(nx, ny, b) < f.r * 0.7 + 1.4 && segDist(nx, ny, b) <= segDist(f.x, f.y, b));
      if (bl) { bl.hp -= f.dmg * 0.9 * dt; if (bl.hp <= 0) { n.bars = n.bars.filter(q => q !== bl); n.fx.push({ k: "barbreak", x: bl.x, y: bl.y }); } continue; }
      f.x = nx; f.y = ny;
      // tuzak: yakınına gelen basar
      const tr = n.traps.find(q => q.armed && Math.hypot(q.x - f.x, q.y - f.y) < 3.2);
      if (tr) {
        tr.armed = false; const te = trapEffect(s, tr.type); const power = te.dmg * (1 + (n.wave - 1) * 0.12) * 1.6;
        n.fx.push({ k: "trap", x: tr.x, y: tr.y, type: tr.type, r: te.fire ? 8 : 5 });
        for (const g of [...n.foes]) if (Math.hypot(g.x - tr.x, g.y - tr.y) < (te.fire ? 8 : 5)) { hurt(n, g, power, false); g.slow = Math.max(g.slow, te.slow * 1.4); if (tr.type !== "ilmik_tuzagi") g.root = Math.max(g.root, g.boss ? 0.6 : te.slow * 0.5); if (te.fire) g.burn = Math.max(g.burn, 3.5); }
      }
      continue;
    }
    if (f.peck > 0) continue; // kargalar gözünü oyarken saldıramaz
    if (stake) { hurt(n, f, n.dmg * 0.35 * stake * dt, false, true); if (f.hp <= 0) continue; }
    if ((f.cd -= dt) <= 0) {
      f.cd = f.human ? 1.4 : 1.1; n.hp -= f.dmg; n.stats.dmgTaken += f.dmg; n.fx.push({ k: "hurt", dmg: Math.round(f.dmg) });
      if (n.cards.diken) hurt(n, f, f.dmg * 0.5 * n.cards.diken, false);
      if (n.hp <= 0) { n.hp = 0; n.phase = "over"; return; }
    }
  }
  // köpek: yerinde bekler; kolladığı alana bir düşman girerse koşup ısırır, sonra yerine döner
  if (n.pet) {
    const pt = n.pet; pt.cd -= dt; const G = petGuard(n); const pm = petMul(s);
    const t = n.foes.filter(f => Math.hypot(f.x - pt.hx, f.y - pt.hy) < G).sort((a, b) => Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y))[0];
    // boştayken alanının içinde rastgele gezinir; arada bir durup koklanır
    if (!t && ((pt.wt -= dt) <= 0 || Math.hypot(pt.wx - pt.x, pt.wy - pt.y) < 0.6)) {
      if (pt.wt <= 0) { const a = n.rng.next() * Math.PI * 2, r = Math.sqrt(n.rng.next()) * G * 0.75; pt.wx = pt.hx + Math.cos(a) * r; pt.wy = pt.hy + Math.sin(a) * r; pt.wt = 1.5 + n.rng.next() * 2.5; }
    }
    const [gx, gy] = t ? [t.x, t.y] : [pt.wx, pt.wy];
    const dx = gx - pt.x, dy = gy - pt.y, d = Math.hypot(dx, dy);
    const reach = t ? t.r + 2 : 0.5;
    if (d > reach + 0.05) { const k = Math.min(d - reach, (t ? 20 : 7) * dt) / d; pt.x += dx * k; pt.y += dy * k; }
    else if (t && pt.cd <= 0) {
      pt.cd = 1.1 - pt.lv * 0.12; hurt(n, t, n.dmg * (0.45 + pt.lv * 0.3) * pm, false); t.slow = Math.max(t.slow, 0.8);
      n.fx.push({ k: "bite", x: t.x, y: t.y });
    }
  }
  // adamlar kuleden destek verir: atıcılar vurur, şifacı kuleyi onarır
  for (const h of n.helpers) {
    h.cd -= dt; if (h.cd > 0) continue;
    if (h.role === "sifaci" || h.role === "usta") { n.hp = Math.min(n.maxHp, n.hp + (h.role === "sifaci" ? 2.5 : 1.5)); h.cd = 2; continue; }
    const t = n.foes.filter(f => Math.hypot(f.x - TOWER.x, f.y - TOWER.y) <= n.range * (h.role === "okcu" || h.role === "izci" ? 1 : 0.55)).sort((a, b) => Math.hypot(a.x - TOWER.x, a.y - TOWER.y) - Math.hypot(b.x - TOWER.x, b.y - TOWER.y))[0];
    if (!t) { h.cd = 0.3; continue; }
    hurt(n, t, h.dmg * 0.9, false); h.cd = h.role === "okcu" ? 1.15 : 1.0;
  }
  // yakın dövüş: kuleye dayananı eldeki silahla vurursun (yay olsun olmasın)
  n.meleeCd -= dt; n.meleeFx = Math.max(0, n.meleeFx - dt);
  if (n.meleeCd <= 0) {
    const adj = n.foes.filter(f => Math.hypot(f.x - TOWER.x, f.y - TOWER.y) <= TOWER.r + f.r + 1.6).sort((a, b) => Math.hypot(a.x - TOWER.x, a.y - TOWER.y) - Math.hypot(b.x - TOWER.x, b.y - TOWER.y))[0];
    if (adj) { const crit = n.rng.next() < n.crit; hurt(n, adj, n.melee * (crit ? 1.8 + (n.cards.kritik ?? 0) * 0.25 : 1) * (0.9 + n.rng.next() * 0.2), crit); n.fx.push({ k: "melee", x: adj.x, y: adj.y }); n.meleeFx = 0.25; n.meleeCd = 0.9 / Math.max(0.8, n.rate * 0.9); }
    else n.meleeCd = 0.15;
  }
  // atış (yalnız yay varsa)
  n.fireCd -= dt;
  const inRange = n.foes.filter(f => Math.hypot(f.x - TOWER.x, f.y - TOWER.y) <= n.range).sort((a, b) => Math.hypot(a.x - TOWER.x, a.y - TOWER.y) - Math.hypot(b.x - TOWER.x, b.y - TOWER.y));
  if (n.bow && n.fireCd <= 0 && inRange.length) {
    n.fireCd = 1 / n.rate; n.shotsFired++; n.stats.shots++;
    const targets = inRange.slice(0, 1 + (n.cards.cift ?? 0));
    for (const t of targets) {
      const crit = n.rng.next() < n.crit; const dmg = n.dmg * (crit ? 1.8 + (n.cards.kritik ?? 0) * 0.25 : 1) * (0.9 + n.rng.next() * 0.2);
      n.shots.push({ x: TOWER.x, y: TOWER.y - 6, tx: t.x, ty: t.y, target: t.id, dmg, crit, pierce: n.cards.delici ?? 0, burn: !!n.cards.ates, hit: [] });
    }
    if (n.cards.zincir && n.shotsFired % 5 === 0) {
      const chain = inRange.slice(0, 2 + n.cards.zincir); const pts: [number, number][] = [[TOWER.x, TOWER.y - 6]];
      for (const f of chain) { pts.push([f.x, f.y]); hurt(n, f, n.dmg * 0.9, false); }
      n.fx.push({ k: "zap", pts });
    }
  }
  // oklar
  for (const sh of [...n.shots]) {
    const t = n.foes.find(f => f.id === sh.target); if (t) { sh.tx = t.x; sh.ty = t.y; }
    const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy); const sp = 150 * dt;
    if (d > sp) { sh.x += dx / d * sp; sh.y += dy / d * sp; continue; }
    sh.x = sh.tx; sh.y = sh.ty;
    const victim = t ?? n.foes.find(f => !sh.hit.includes(f.id) && Math.hypot(f.x - sh.x, f.y - sh.y) < f.r + 1);
    if (victim) { hurt(n, victim, sh.dmg, sh.crit); if (sh.burn) victim.burn = 2.5; sh.hit.push(victim.id); }
    if (sh.pierce > 0 && victim) {
      const next = n.foes.find(f => !sh.hit.includes(f.id) && Math.hypot(f.x - sh.x, f.y - sh.y) < 16);
      if (next) { sh.pierce--; sh.target = next.id; sh.dmg *= 0.75; continue; }
    }
    n.shots = n.shots.filter(x => x !== sh);
  }
  // defter sayfası doldu mu
  const need = n.pageNeed;
  if (n.page >= need) { n.page -= need; n.pageNeed = Math.round(n.pageNeed * 1.35 + 2); offerCards(s, n); }
}

/** Nöbet bitince: rekor, kese, gerçek kullanım gelişimi, zaman ve yorgunluk. */
export interface NobetResult { gains: GainReport; wave: number; best: boolean; prev: number; minutes: number; loot: Loot; dropped: Record<string, number>; notes: string[] }
export function finishNobet(cfg: Config, s: GameState, n: Nobet): NobetResult {
  const save = nobetSave(s);
  const wave = Math.max(0, n.wave - (n.waveLeft > 0 || n.foes.length ? 1 : 0)); // tamamlanan dalga
  save.runs++;
  s.money += n.loot.money; const dropped: Record<string, number> = {};
  for (const [k, v] of Object.entries(n.loot.items)) { const d = addItem(cfg, s, k, v); if (d) dropped[k] = d; }
  const prev = save.best[n.site.place] ?? 0; const best = wave > prev; if (best) save.best[n.site.place] = wave;
  // uzun dayanan daha çok gelişir ama giderek azalan bir hızla (5. dalgada 60 atış karşılığı, 20.de 120, 30.da ~147)
  const gains = realUse(cfg, s, "okculuk_idman", Math.min(n.stats.shots, Math.round(60 * Math.sqrt(Math.max(1, wave) / 5))), 0.05);
  applyGain(cfg, s, "odak", 0.1 + wave * 0.04, gains); applyGain(cfg, s, "taktik", 0.05 + n.stats.cards * 0.05, gains);
  applyGain(cfg, s, "stres", 0.2 + wave * 0.03, gains); if (n.stats.skills) applyGain(cfg, s, "simsek_buyu", n.stats.skills * 0.03, gains);
  const notes: string[] = [];
  // liderler: öldürdüğün her lider, o düşmanın zayıf noktalarından birini Gözlemler'e yazdırır (güç bilgiden gelir)
  s.journal ??= {};
  for (const def of n.stats.bossDefs ?? []) {
    const d = ENEMIES[def]; if (!d) continue; const key = d.anatomyOf ?? def; const seen = (s.journal[key] ??= []);
    const wp = d.weakPoints.find(w => !seen.includes(w.id)); if (!wp) continue;
    seen.push(wp.id); notes.push(`${d.name} düşerken bir yeri açık kaldı: ${wp.name}. Gözlemler'e yazdın.`);
  }
  // rekor eşikleri: bir kulede ilk kez 10, 20, 30. dalgayı geçmek ün getirir (güç değil, tanınırlık ve güven)
  const region = NOBET_REGION[n.site.place] ?? "taspinar"; const fame = (save.fame ??= {}); const had = fame[n.site.place] ?? 0;
  for (const t of [10, 20, 30]) if (wave >= t && had < t) {
    addRep(s, region, "taninirlik", t / 5); addRep(s, region, "guven", t / 10); fame[n.site.place] = t;
    notes.push(`"${n.site.name} ${t} dalga tuttu" diye anlatıyorlar: tanınırlık +${t / 5}, güven +${t / 10}.`);
  }
  const minutes = 30 + wave * 6;
  s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - 10 - Math.min(20, wave)); s.satiety = Math.max(0, s.satiety - 6);
  return { gains, wave, best, prev, minutes, loot: n.loot, dropped, notes };
}
export const NOBET_ENERGY = 20;
export function canStartNobet(s: GameState, place: string): { ok: boolean; reason?: string } {
  const site = nobetSite(place); if (!site) return { ok: false, reason: "Burada nöbet tutulmaz" };
  const lock = site.unlock(s); if (lock) return { ok: false, reason: lock };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (s.energy < NOBET_ENERGY) return { ok: false, reason: "Nöbet için çok yorgunsun" };
  if (DAY_MINUTES - s.minute < 60) return { ok: false, reason: "Çok geç; önce uyu" };
  return { ok: true };
}
