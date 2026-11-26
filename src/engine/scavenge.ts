// Harabe araması: çok katlı yıkık bir yapıda odaları gezip saklı şeyleri ararsın.
// Yan kesit görünüm: soldan sağa yürürsün, merdivenle kat değiştirirsin; arama noktasına dokununca ilerleme dolana kadar beklersin.
// Sayaç bitince baskın gelir (kurtlar, haydutlar); yayın ve okun varsa uzaktan, yoksa elindeki silahla vurursun.
// Bulduklarını çantana (sınırlı göz) koyarsın; "Çıkış"a ulaşırsan hepsi senin olur, ölürsen çanta gider.
// Saf simülasyon (DOM yok): stepScav(dt) zamanı ilerletir.
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { applyGain, realUse, type GainReport } from "./progression";
import { maxHp } from "./combat";
import { Rng } from "./rng";
import { ENEMIES } from "../content/world";
import { addItem, removeItem, capacity } from "./inventory";
import { weaponSet, hasBow, totalArmor, slotsFor } from "./gear";
import { spellOptions } from "./magic";
import { trapsOwned, trapEffect } from "./engineering";
import { petMul } from "./pet";
import { healOf, healPower } from "./healing";

/** Harabede büyü karşılıkları: büyü türü, hasar çarpanı, patlama yarıçapı. */
export type SpellKind = "simsek" | "ates" | "buz" | "camur" | "sarmasik" | "karga" | "kilic";
export const SPELL_KIND: Record<string, { kind: SpellKind; mul: number; r: number; cd: number }> = {
  ates_topu: { kind: "ates", mul: 3, r: 12, cd: 9 }, magma_akintisi: { kind: "ates", mul: 4.5, r: 16, cd: 16 },
  buz_duvari: { kind: "buz", mul: 0.8, r: 16, cd: 15 }, camur_tuzagi: { kind: "camur", mul: 0.4, r: 17, cd: 12 },
  simsek_zinciri: { kind: "simsek", mul: 3.5, r: 14, cd: 18 }, elektrik_golu: { kind: "simsek", mul: 2.2, r: 12, cd: 12 }, yildirim_firtinasi: { kind: "simsek", mul: 5.5, r: 26, cd: 30 },
  sarmasik: { kind: "sarmasik", mul: 0.6, r: 18, cd: 14 }, karga_surusu: { kind: "karga", mul: 0.5, r: 26, cd: 20 }, yer_kiliclari: { kind: "kilic", mul: 4, r: 5, cd: 16 },
};

export const SW = 700;                 // yapının genişliği (birim): yedi daire, her biri 100
export const ROOM_W = 100;
export const EXIT_X = 8;               // çıkış, zemin katın solunda
export const LADDER_XS = [550, 150];  // 0→1 ve 1→2 merdivenlerinin yeri
export const ladderX = (gap: number) => LADDER_XS[gap % 2];

interface LootEntry { item?: string; money?: [number, number]; weapon?: boolean; w: number; n?: [number, number] }
export interface ScavSite {
  place: string; name: string; desc: string; floors: number; foes: string[]; spotsPerFloor: number;
  names: string[]; loot: LootEntry[]; unlock: (s: GameState) => string | null;
}
const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
export const SCAV_SITES: ScavSite[] = [
  { place: "koru", name: "Yıkık avcı kulübesi", desc: "Korunun derinliğinde, çökmüş bir kulübe. İçinde eski avcıların bıraktıkları olabilir.", floors: 3, foes: ["kurt"], spotsPerFloor: 3,
    names: ["Sandık", "Yatak altı", "Raf", "Çuval", "Ocak yanı"],
    loot: [{ item: "sargi_bezi", w: 3 }, { item: "yara_merhemi", w: 1 }, { item: "deri", w: 4 }, { item: "ok", w: 4, n: [2, 4] }, { item: "ip", w: 3 }, { item: "kekik", w: 2, n: [1, 2] }, { item: "ekmek", w: 2 }, { money: [1, 3], w: 3 }, { item: "eski_sikke", w: 1 }, { weapon: true, w: 1 }],
    unlock: s => done(s, "kurt") ? null : "Önce Hasan'ın kurt derdine yardım et" },
  { place: "karacam_sarnic", name: "Sarnıç mahzeni", desc: "Nemli taş katlar, aşağıya inen merdivenler. Eski depolar boş değil.", floors: 4, foes: ["haydut", "kurt"], spotsPerFloor: 3,
    names: ["Fıçı", "Dolap", "Sandık", "Kasa", "Taş niş"],
    loot: [{ item: "sargi_bezi", w: 3 }, { item: "yara_merhemi", w: 2 }, { item: "demir_parca", w: 4, n: [1, 2] }, { item: "ok", w: 3, n: [2, 5] }, { item: "ip", w: 3 }, { item: "peynir", w: 2 }, { item: "deri", w: 2 }, { money: [2, 6], w: 4 }, { item: "eski_sikke", w: 2 }, { weapon: true, w: 1 }],
    unlock: s => done(s, "sarnic") ? null : "Önce Selim'in sarnıç işini bitir" },
  { place: "ardic_kul", name: "Yanık evler", desc: "Kül Yangını'ndan kalan beş katlı yıkık bir yapı. Isı hâlâ burada gibi.", floors: 5, foes: ["muhafiz", "haydut"], spotsPerFloor: 3,
    names: ["Kömürleşmiş sandık", "Dolap", "Yatak", "Kasa", "Soba dibi"],
    loot: [{ item: "sargi_bezi", w: 3 }, { item: "yara_merhemi", w: 2 }, { item: "demir_parca", w: 3, n: [1, 3] }, { item: "ok", w: 3, n: [3, 6] }, { item: "peynir", w: 2 }, { item: "ekmek", w: 2 }, { item: "deri", w: 2 }, { money: [4, 10], w: 5 }, { item: "eski_sikke", w: 2 }, { item: "kartal_tuyu", w: 1 }, { weapon: true, w: 1 }],
    unlock: s => done(s, "kul_ana") ? null : "Önce Kül Ana'yı dinle" },
];
export const scavSite = (place: string) => SCAV_SITES.find(x => x.place === place);
export const SCAV_ENERGY = 8;
export function canStartScav(s: GameState, place: string): { ok: boolean; reason?: string } {
  const site = scavSite(place); if (!site) return { ok: false, reason: "Burada aranacak harabe yok" };
  const lock = site.unlock(s); if (lock) return { ok: false, reason: lock };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (s.energy < SCAV_ENERGY + 6) return { ok: false, reason: "Çok yorgunsun" };
  if (DAY_MINUTES - s.minute < 60) return { ok: false, reason: "Çok geç; önce uyu" };
  return { ok: true };
}

/* ---------- vücudun harabedeki karşılığı ---------- */
// Harabede ayrı kart ya da güçlenme yok: hız, arama, dayanma, büyü hepsi karakterin özelliklerinden gelir.
// Gelişim harabede kazanılmaz, harabede sınanır. 10 başlangıç seviyesidir; her 30 puan bir basamak (en çok 3).
export const step = (lv: number) => Math.max(0, Math.min(3, (lv - 10) / 30));
/** Odak bu seviyelere gelince harabede büyü üst üste 2, sonra 3 kez salınır. */
export const SCAV_SHOTS_AT = [55, 85];
export interface ScavTraits {
  walk: number; climb: number; search: number; melee: number; hp: number; bagCap: number; ammoCap: number;
  firstRaid: number; spellCd: number; spellPow: number; spellShots: number;
}
export interface TraitLine { name: string; from: string; value: string }
const avgLv = (s: GameState, ids: string[]) => ids.reduce((a, id) => a + (s.attrs[id]?.level ?? 0), 0) / ids.length;
/** Karakterin özelliklerinden harabe çarpanları (saf). */
export function scavTraits(cfg: Config, s: GameState): ScavTraits {
  const t = (...ids: string[]) => step(avgLv(s, ids));
  const od = s.attrs.odak?.level ?? 0;
  return {
    walk: 1 + t("bacak", "esneklik") * 0.12,
    climb: 1 + t("kavrama", "esneklik") * 0.12,
    search: Math.pow(0.75, t("el_becerisi", "analiz")),
    melee: 1 + t("kilic", "ust_govde") * 0.15,
    hp: 1 + t("agri", "core") * 0.15,
    bagCap: Math.max(8, capacity(cfg, s)),
    ammoCap: Math.round(12 + t("okculuk") * 6),
    firstRaid: 40 + Math.round(t("isitme", "cevresel") * 10),
    spellCd: Math.pow(0.8, t("nefes")),
    spellPow: 1 + t("mana") * 0.3,
    spellShots: 1 + SCAV_SHOTS_AT.filter(v => od >= v).length,
  };
}
/** Başlamadan önce gösterilen özet: hangi özellik neyi değiştiriyor. */
export function traitLines(cfg: Config, s: GameState, withSpell: boolean, withBow: boolean): TraitLine[] {
  const tr = scavTraits(cfg, s); const pct = (m: number) => Math.round(Math.abs(m - 1) * 100) === 0 ? "temel" : `${m >= 1 ? "+" : "−"}${Math.round(Math.abs(m - 1) * 100)}%`;
  const out: TraitLine[] = [
    { name: "Yürüyüş", from: "Bacak kası, esneklik", value: pct(tr.walk) },
    { name: "Tırmanma", from: "Kavrama gücü, esneklik", value: pct(tr.climb) },
    { name: "Arama süresi", from: "El becerisi, analiz", value: pct(tr.search) },
    { name: "Vuruş", from: "Kılıç ustalığı, üst gövde", value: pct(tr.melee) },
    { name: "Dayanma", from: "Ağrı toleransı, gövde", value: pct(tr.hp) },
    { name: "Çanta", from: "Kuşandığın çanta", value: `${tr.bagCap} göz` },
    { name: "İlk baskın", from: "İşitme, çevresel farkındalık", value: `${tr.firstRaid} sn` },
  ];
  if (withBow) out.push({ name: "Sadak", from: "Okçuluk", value: `en çok ${tr.ammoCap} ok` });
  if (withSpell) out.push({ name: "Büyü dolumu", from: "Nefes kapasitesi", value: pct(tr.spellCd) },
    { name: "Büyü gücü", from: "Mana", value: pct(tr.spellPow) }, { name: "Üst üste büyü", from: "Odak", value: `${tr.spellShots}` });
  return out;
}

/* ---------- bulunan silahlar ---------- */
export interface FoundWeapon { id: string; name: string; kind: "melee" | "bow"; dmg: number; parts: string[] }
export const FOUND_WEAPONS: FoundWeapon[] = [
  { id: "pasli_kilic", name: "Paslı kılıç", kind: "melee", dmg: 9, parts: ["demir_parca"] },
  { id: "eski_mizrak", name: "Eski mızrak", kind: "melee", dmg: 8, parts: ["odun", "demir_parca"] },
  { id: "civili_sopa", name: "Çivili sopa", kind: "melee", dmg: 7, parts: ["odun", "demir_parca"] },
  { id: "kemik_balta", name: "Kemik saplı balta", kind: "melee", dmg: 11, parts: ["demir_parca", "odun"] },
  { id: "avci_yayi", name: "Eski avcı yayı", kind: "bow", dmg: 9, parts: ["odun", "ip"] },
  { id: "kisa_yay", name: "Kısa kompozit yay", kind: "bow", dmg: 12, parts: ["odun", "ip", "deri"] },
];

/* ---------- başlangıç seçimi: yalnız TEK şey götürürsün ---------- */
export type LoadKind = "yumruk" | "melee" | "bow" | "dog" | "trap" | "spell";
export interface Loadout { kind: LoadKind; id?: string }
export interface LoadOption { kind: LoadKind; id?: string; label: string; note: string }
export const hasBowItem = (s: GameState) => !!s.equipped.bow || Object.keys(s.inventory).some(id => (s.inventory[id] ?? 0) > 0 && slotsFor(id).includes("bow"));
export function loadoutOptions(cfg: Config, s: GameState): LoadOption[] {
  const out: LoadOption[] = [];
  const ids = new Set<string>(); if (s.equipped.weapon) ids.add(s.equipped.weapon);
  for (const id of Object.keys(s.inventory)) if ((s.inventory[id] ?? 0) > 0 && slotsFor(id).includes("weapon")) ids.add(id);
  for (const id of ids) { const d = weaponSet(cfg, { ...s, equipped: { weapon: id } } as GameState); out.push({ kind: "melee", id, label: d.name, note: `yakın dövüş · vuruş ${+d.dmg.toFixed(1)}${s.equipped.weapon === id ? " · elinde" : ""}` }); }
  if (hasBowItem(s)) { const ok = Math.min(12, s.inventory.ok ?? 0); out.push({ kind: "bow", label: "Yay", note: ok ? `uzaktan · ${ok} ok` : "okun yok; kutulardan ok bulursan atarsın" }); }
  if (s.pet) out.push({ kind: "dog", label: s.pet.name, note: "arada koşup düşmanla dövüşür" });
  for (const tp of trapsOwned(s)) out.push({ kind: "trap", id: tp.id, label: `Tuzak: ${tp.id.replace(/_/g, " ")}`, note: `${Math.min(3, tp.n)} tane taşırsın; tetiklenince dolana kadar bekler` });
  for (const o of spellOptions(cfg, { ...s, mana: 999 } as GameState)) if (o.ok && SPELL_KIND[o.spell.id]) out.push({ kind: "spell", id: o.spell.id, label: o.spell.name, note: "büyü; her kullanımdan sonra dolması gerekir" });
  return out;
}
export function defaultLoadout(cfg: Config, s: GameState): Loadout {
  const o = loadoutOptions(cfg, s); const eq = o.find(x => x.kind === "melee" && x.id === s.equipped.weapon) ?? o.find(x => x.kind === "bow") ?? o[0];
  return eq ? { kind: eq.kind, id: eq.id } : { kind: "yumruk" };
}

/* ---------- durum ---------- */
export interface Stage { kind: "empty" | "item" | "money" | "weapon" | "key"; key?: number; item?: string; n?: number; money?: number; weapon?: string; time: number }
export interface Spot { vault?: boolean; id: number; x: number; floor: number; name: string; stages: Stage[]; stage: number; prog: number; done: boolean }
export interface SFoe { idle?: boolean; id: number; def: string; x: number; floor: number; hp: number; max: number; speed: number; dmg: number; cd: number; human: boolean; climbT: number; toFloor: number; hitT: number; root: number; slow: number; burn: number }
export type SFx =
  | { k: "loot"; text: string; x: number; floor: number } | { k: "full"; x: number; floor: number } | { k: "hit"; x: number; floor: number; dmg: number; crit: boolean }
  | { k: "hurt"; dmg: number } | { k: "raid"; n: number } | { k: "shot"; from: number; to: number; floor: number } | { k: "die"; x: number; floor: number }
  | { k: "spot"; x: number; floor: number } | { k: "trap"; x: number; floor: number } | { k: "dodge"; x: number; floor: number } | { k: "key"; x: number; floor: number } | { k: "unlock"; x: number; floor: number } | { k: "locked"; x: number; floor: number } | { k: "cast"; kind: SpellKind; x: number; floor: number } | { k: "spell"; kind: SpellKind; x: number; floor: number; r: number } | { k: "weapon"; name: string; x: number; floor: number } | { k: "bite"; x: number; floor: number };
export interface Lock { floor: number; x: number; side: "R" | "L"; key: number; open: boolean }
export interface GItem { id: number; item: string; x: number; floor: number }
export interface Proj { id: number; kind: SpellKind; x: number; floor: number; dir: 1 | -1; left: number; base: number; r: number }
export interface TrapSlot { id: string; state: "hand" | "placed" | "cool"; x: number; floor: number; t: number }
export interface Dog { x: number; floor: number; state: "yanda" | "av" | "don"; t: number; cd: number; moving: boolean; face: 1 | -1; lag: number }
export interface Scav {
  site: ScavSite; seed: number; rng: Rng; time: number; phase: "play" | "over"; result?: "exit" | "dead"; load: Loadout;
  px: number; py: number; floor: number; face: 1 | -1; moving: boolean; climbing: boolean; input: { dx: number; dy: number }; hp: number; maxHp: number;
  spots: Spot[]; searchId: number; searchWait: number; foes: SFoe[]; nextId: number; wave: number; raidT: number; raidHold: number; spellQ: { t: number; dir: 1 | -1; floor: number }[];
  bag: Record<string, number>; bagCap: number; money: number; ammo: number; ammoStart: number; bow: boolean; dmg: number; melee: number; rate: number; atkCd: number; atkFx: number; weaponName: string;
  foundWeapons: string[]; weaponId: string; castT: number; foundT: number; armor: number; tr: ScavTraits; searched: number; shots: number; kills: number; found: number; fx: SFx[];
  ground: GItem[]; gid: number; proj: Proj[]; locks: Lock[]; keys: number[]; traps: TrapSlot[]; trapFx: Record<string, { dmg: number; slow: number; fire: boolean }>; dog?: Dog; dogBond: number; dogMul: number; spell?: { id: string; kind: SpellKind; name: string; cd: number; max: number; mul: number; r: number };
}
const bagCount = (n: Scav) => Object.values(n.bag).reduce((a, b) => a + b, 0);
export const bagUsed = bagCount;
/** Bir katta şu an girilebilen aralık (kilitli oda kapalıyken dışarıda kalır). */
export function freeRange(n: { locks: Lock[] }, floor: number): [number, number] {
  let lo = 0, hi = SW; const lk = n.locks.find(l => l.floor === floor && !l.open);
  if (lk) { if (lk.side === "R") hi = lk.x - 3; else lo = lk.x + 3; } return [lo, hi];
}
/** Çantadan bir tane yere at (yer açar; eşya orada durur). */
export function dropBag(n: Scav, id: string): boolean { if (!n.bag[id]) return false; n.bag[id]--; if (n.bag[id] <= 0) delete n.bag[id]; n.ground.push({ id: n.gid++, item: id, x: n.px, floor: n.floor }); return true; }
/** Yakındaki (±8) yerdeki eşyalar, en yakın önce. */
export const groundNear = (n: Scav): GItem[] => n.climbing ? [] : n.ground.filter(g => g.floor === n.floor && Math.abs(g.x - n.px) <= 8).sort((a, b) => Math.abs(a.x - n.px) - Math.abs(b.x - n.px));
export const nearGround = (n: Scav): GItem | undefined => groundNear(n)[0];
/** Yerdekini çantaya al (yer varsa); id verilmezse en yakını. */
export function pickGround(n: Scav, gid?: number): "ok" | "full" | "none" {
  const g = gid ? groundNear(n).find(q => q.id === gid) : nearGround(n); if (!g) return "none"; if (bagCount(n) >= n.bagCap) return "full";
  n.ground = n.ground.filter(q => q !== g); n.bag[g.item] = (n.bag[g.item] ?? 0) + 1; return "ok";
}
export const speedOf = (n: Scav) => 32 * n.tr.walk;
export const CLIMB_SPEED = 0.5;      // kat/sn
export const SPOT_STAGES = 3;
/** Çıkacak şey basitse hızlı, değerliyse yavaş aranır. */
function stageTime(e: LootEntry | null, money?: number): number {
  if (!e) return 0.9; if (e.weapon) return 4.6; if (e.money) return (money ?? 0) <= 3 ? 1.2 : 2.2;
  return e.w >= 4 ? 1.3 : e.w >= 3 ? 1.9 : e.w >= 2 ? 2.7 : 4.0;
}
function rollStage(site: ScavSite, rng: Rng): Stage {
  if (rng.chance(12)) return { kind: "empty", time: stageTime(null) };
  const total = site.loot.reduce((a, e) => a + e.w, 0); let q = rng.next() * total; let pick = site.loot[0];
  for (const e of site.loot) { q -= e.w; if (q <= 0) { pick = e; break; } }
  if (pick.weapon) return { kind: "weapon", weapon: FOUND_WEAPONS[rng.int(0, FOUND_WEAPONS.length - 1)].id, time: stageTime(pick) };
  if (pick.money) { const m = rng.int(pick.money[0], pick.money[1]); return { kind: "money", money: m, time: stageTime(pick, m) }; }
  return { kind: "item", item: pick.item, n: pick.n ? rng.int(pick.n[0], pick.n[1]) : 1, time: stageTime(pick) };
}
export const searchMul = (n: Scav) => n.tr.search;
export const stageSeconds = (n: Scav, sp: Spot) => sp.stages[sp.stage] ? sp.stages[sp.stage].time * searchMul(n) : 0;

export function createScav(cfg: Config, s: GameState, site: ScavSite, seed: number, load: Loadout = defaultLoadout(cfg, s)): Scav {
  const rng = new Rng(seed); const spots: Spot[] = []; let id = 1; const locks: Lock[] = [];
  for (let f = 0; f < site.floors; f++) { const side = f % 2 === 0 ? "R" : "L"; locks.push({ floor: f, side, x: side === "R" ? SW - ROOM_W : ROOM_W, key: f, open: false }); }
  const vaultSpan = (f: number): [number, number] => locks[f].side === "R" ? [locks[f].x + 18, SW - 18] : [18, locks[f].x - 18];
  const freeSpan = (f: number): [number, number] => locks[f].side === "R" ? [24, locks[f].x - 20] : [locks[f].x + 20, SW - 24];
  const place = (f: number, span: [number, number], count: number, vault: boolean) => {
    const xs: number[] = [];
    for (let k = 0; k < count; k++) {
      let x = 0; for (let t = 0; t < 40; t++) { x = span[0] + rng.next() * (span[1] - span[0]); if (xs.every(q => Math.abs(q - x) > 34) && LADDER_XS.every(l => Math.abs(l - x) > 22)) break; }
      xs.push(x);
      const roll = () => { const a = rollStage(site, rng); if (!vault) return a; const b = rollStage(site, rng); return b.time > a.time ? b : a; };
      spots.push({ id: id++, x, floor: f, vault, name: site.names[rng.int(0, site.names.length - 1)], stages: Array.from({ length: SPOT_STAGES }, () => roll()), stage: 0, prog: 0, done: false });
    }
  };
  for (let f = 0; f < site.floors; f++) { place(f, freeSpan(f), site.spotsPerFloor + 2, false); place(f, vaultSpan(f), 3, true); }
  // her kilitli odanın anahtarı başka bir katta, normal bir kutunun içinde saklıdır
  for (let f = 0; f < site.floors; f++) {
    const kf = (f + 1) % site.floors; const cands = spots.filter(q => q.floor === kf && !q.vault); const sp = cands[rng.int(0, cands.length - 1)]; sp.stages[rng.int(0, SPOT_STAGES - 1)] = { kind: "key", key: f, time: 3.2 };
  }
  const tr = scavTraits(cfg, s); const mh = maxHp(cfg, s); const lv = (a: string) => s.attrs[a]?.level ?? 0; const fist = 2 + lv("ust_govde") / 10;
  let melee = fist, weaponName = "Yumruk", bow = false, ammo = 0; const traps: TrapSlot[] = []; let dog: Dog | undefined; let spell: Scav["spell"];
  if (load.kind === "melee" && load.id) { const d = weaponSet(cfg, { ...s, equipped: { weapon: load.id } } as GameState); melee = (d.dmg + lv("ust_govde") / 10) * tr.melee; weaponName = d.name; }
  if (load.kind === "bow") { bow = true; ammo = Math.min(tr.ammoCap, s.inventory.ok ?? 0); weaponName = "Yay"; }
  if (load.kind === "dog" && s.pet) dog = { x: EXIT_X + 10, floor: 0, state: "yanda", t: 12, cd: 0, moving: false, face: 1, lag: 0 };
  if (load.kind === "trap" && load.id) { const own = trapsOwned(s).find(x => x.id === load.id); for (let i = 0; i < Math.min(3, own?.n ?? 0); i++) traps.push({ id: load.id, state: "hand", x: 0, floor: 0, t: 0 }); }
  if (load.kind === "spell" && load.id) { const o = spellOptions(cfg, { ...s, mana: 999 } as GameState).find(x => x.spell.id === load.id && x.ok); const info = SPELL_KIND[load.id];
    if (o && info) { const m = o.spell.mastery ? s.attrs[o.spell.mastery]?.level ?? 0 : 0; spell = { id: load.id, kind: info.kind, name: o.spell.name, cd: 4, max: 5 * Math.max(0.8, 1 - m / 300), mul: info.mul * (1 + m / 100), r: info.r }; } }
  // bazı odalarda düşmanlar bekler: yaklaşınca uyanıp saldırırlar (kilitli odada daha güçlüler)
  const guards: SFoe[] = []; let gid2 = 1;
  for (let f = 0; f < site.floors; f++) {
    const lk = locks[f]; const spans: [number, number, boolean][] = [[freeSpan(f)[0], freeSpan(f)[1], false], [vaultSpan(f)[0], vaultSpan(f)[1], true]];
    for (const [lo, hi, vault] of spans) {
      const cnt = vault ? 1 + (f >= 2 ? 1 : 0) : (f === 0 ? 1 : 1 + (rng.chance(40) ? 1 : 0));
      for (let k = 0; k < cnt; k++) {
        let x = lo + rng.next() * (hi - lo); if (f === 0 && !vault && x < 130) x = Math.min(hi, 130 + rng.next() * 60);   // girişin hemen yanında bekçi olmaz
        const def = site.foes[rng.int(0, site.foes.length - 1)]; const d = ENEMIES[def]; const sc = 1 + f * 0.12 + (vault ? 0.2 : 0);
        guards.push({ idle: true, id: gid2++, def, x, floor: f, hp: d.hp * sc * 1.35, max: d.hp * sc * 1.35, speed: 9 + (d.move ?? 4) * 1.5 + rng.next() * 2.5, dmg: (d.damage[0] + d.damage[1]) / 2 * sc * 0.7, cd: 1.2, human: d.species === "insan", climbT: 0, toFloor: f, hitT: 0, root: 0, slow: 0, burn: 0 });
      }
    }
    void lk;
  }
  return {
    site, seed, rng, time: 0, phase: "play", load, px: EXIT_X + 6, py: 0, floor: 0, face: 1, moving: false, climbing: false, input: { dx: 0, dy: 0 }, hp: Math.max(1, Math.round((s.hp || mh) * 1.4 * tr.hp)), maxHp: Math.round(mh * 1.4 * tr.hp),
    spots, searchId: 0, searchWait: 0, foes: guards, nextId: gid2, wave: 0, raidT: tr.firstRaid, raidHold: 0, spellQ: [], bag: {}, bagCap: tr.bagCap, money: 0, ammo, ammoStart: ammo, bow, dmg: 6 + lv("okculuk") / 4 + lv("ust_govde") / 10, melee, rate: 0.9 + lv("refleks") / 80,
    atkCd: 0, atkFx: 0, weaponName, foundWeapons: [], weaponId: "", castT: 0, foundT: 0, armor: totalArmor(s), tr, searched: 0, shots: 0, kills: 0, found: 0, fx: [],
    ground: [], gid: 1, proj: [], locks, keys: [], traps, trapFx: Object.fromEntries(trapsOwned(s).map(x => [x.id, trapEffect(s, x.id)])), dog, dogBond: s.pet?.bond ?? 0, dogMul: petMul(s), spell,
  };
}

/* ---------- komutlar ---------- */
export function setInput(n: Scav, dx: number, dy: number) { n.input = { dx: Math.max(-1, Math.min(1, dx)), dy: Math.max(-1, Math.min(1, dy)) }; }
export const atExit = (n: Scav) => !n.climbing && n.floor === 0 && n.px <= EXIT_X + 3;
export function leave(n: Scav): boolean { if (!atExit(n) || n.phase === "over") return false; n.phase = "over"; n.result = "exit"; return true; }
/** Yakındaki (±8 birim) bitmemiş arama noktası. */
export function nearSpot(n: Scav): Spot | undefined {
  if (n.climbing) return undefined;
  return n.spots.filter(q => !q.done && q.floor === n.floor && Math.abs(q.x - n.px) <= 8).sort((a, b) => Math.abs(a.x - n.px) - Math.abs(b.x - n.px))[0];
}
export function beginSearch(n: Scav): boolean { const sp = nearSpot(n); if (!sp || n.phase !== "play") return false; n.searchId = sp.id; n.searchWait = 0; return true; }
export function placeTrap(n: Scav): boolean {
  const tr = n.traps.find(q => q.state === "hand"); if (!tr || n.phase !== "play" || n.climbing) return false;
  tr.state = "placed"; tr.x = n.px; tr.floor = n.floor; return true;
}
export const trapsInHand = (n: Scav) => n.traps.filter(q => q.state === "hand").length;
export const TRAP_RECHARGE = 25;
/** Nişan: dx yön, dy dikey (merdiven açıklığında bir üst/alt kata). Dönen: hedef kat ve yön. */
export function aimTarget(n: Scav, aim?: { dx: number; dy: number }): { floor: number; dir: 1 | -1 } {
  const lowF = n.climbing ? Math.floor(n.py) : n.floor; const highF = n.climbing ? Math.ceil(n.py) : n.floor;
  let floor = n.floor;
  if (aim && Math.abs(aim.dy) > 0.5) {
    const up = aim.dy < 0; const gap = up ? (n.climbing ? lowF : n.floor) : (n.climbing ? lowF : n.floor - 1);
    if (gap >= 0 && gap < n.site.floors - 1 && (n.climbing || Math.abs(n.px - ladderX(gap)) <= 9)) floor = up ? (n.climbing ? highF : n.floor + 1) : (n.climbing ? lowF : n.floor - 1);
  } else if (n.climbing) floor = Math.round(n.py);
  let dir: 1 | -1 = n.face;
  if (aim && Math.abs(aim.dx) > 0.25) dir = aim.dx > 0 ? 1 : -1;
  else { const near = n.foes.filter(f => f.floor === floor && f.climbT <= 0 && Math.abs(f.x - n.px) <= 140).sort((a, b) => Math.abs(a.x - n.px) - Math.abs(b.x - n.px))[0]; if (near) dir = near.x > n.px ? 1 : -1; }
  return { floor, dir };
}
/** Büyü: nişan aldığın yöne (merdiven açıklığında alt/üst kata da) bir top fırlatır; çarpınca patlar. */
export function castSpell(n: Scav, aim?: { dx: number; dy: number }): boolean {
  const sp = n.spell; if (!sp || sp.cd > 0 || n.phase !== "play") return false;
  const { floor, dir } = aimTarget(n, aim); n.face = dir; n.searchId = 0; n.searchWait = 1.2;
  sp.cd = sp.max * n.tr.spellCd; n.castT = 0.6;
  // odaklı biri büyüyü üst üste 2-3 kez salar
  for (let i = 0; i < n.tr.spellShots; i++) n.spellQ.push({ t: i * 0.32, dir, floor });
  n.fx.push({ k: "cast", kind: sp.kind, x: n.px, floor }); return true;
}
const spellMul = (n: Scav) => n.tr.spellPow;
function launchSpell(n: Scav, q: { dir: 1 | -1; floor: number }) {
  const sp = n.spell; if (!sp) return; const wide = n.tr.spellShots >= 3 ? 1.3 : 1;
  n.proj.push({ id: n.gid++, kind: sp.kind, x: n.px + q.dir * 5, floor: q.floor, dir: q.dir, left: 150, base: n.dmg * sp.mul * 0.5 * spellMul(n), r: sp.r * 0.9 * spellMul(n) * wide });
}
/** Elle ok atışı: nişan aldığın yönde/katta ilk düşmana vurur. */
export function shootArrow(n: Scav, aim?: { dx: number; dy: number }): boolean {
  if (!n.bow || n.ammo <= 0 || n.atkCd > 0 || n.phase !== "play") return false;
  const { floor, dir } = aimTarget(n, aim); n.face = dir; n.searchId = 0; n.searchWait = 1.5; n.ammo--; n.shots++; n.atkCd = 1 / n.rate; n.atkFx = 0.25;
  const tgt = n.foes.filter(f => f.floor === floor && f.climbT <= 0 && (f.x - n.px) * dir > 0 && Math.abs(f.x - n.px) <= 90).sort((a, b) => Math.abs(a.x - n.px) - Math.abs(b.x - n.px))[0];
  n.fx.push({ k: "shot", from: n.px, to: tgt ? tgt.x : n.px + dir * 90, floor });
  if (tgt) { const crit = n.rng.chance(8); hurtFoe(n, tgt, n.dmg * (crit ? 1.8 : 1) * (0.9 + n.rng.next() * 0.2), crit); }
  return true;
}
function explode(n: Scav, pj: Proj) {
  const hits = n.foes.filter(f => f.floor === pj.floor && f.climbT <= 0 && Math.abs(f.x - pj.x) <= pj.r + 4);
  for (const f of hits) {
    if (pj.kind === "ates") f.burn = Math.max(f.burn, 4);
    if (pj.kind === "buz" || pj.kind === "sarmasik") f.root = Math.max(f.root, 3.5);
    if (pj.kind === "camur") f.slow = Math.max(f.slow, 5);
    if (pj.kind === "karga") f.root = Math.max(f.root, 2.5);
    if (pj.kind === "kilic") f.root = Math.max(f.root, 2);
    hurtFoe(n, f, pj.base, false);
  }
  n.fx.push({ k: "spell", kind: pj.kind, x: pj.x, floor: pj.floor, r: pj.r * 2 });
}

/* ---------- arama, silah, baskın ---------- */
function applyStage(n: Scav, sp: Spot, st: Stage) {
  const at = { x: sp.x, floor: sp.floor };
  if (st.kind === "key") { n.keys.push(st.key!); n.fx.push({ k: "key", ...at }); return; }
  if (st.kind !== "empty") n.foundT = 0.7;
  if (st.kind === "empty") { n.fx.push({ k: "loot", text: "boş", ...at }); return; }
  if (st.kind === "money") { n.money += st.money ?? 0; n.fx.push({ k: "loot", text: `+${st.money} bakır`, ...at }); return; }
  if (st.kind === "weapon") {
    const w = FOUND_WEAPONS.find(x => x.id === st.weapon)!;
    if (w.kind === "melee") { if (w.dmg > n.melee) { n.melee = w.dmg * n.tr.melee; n.weaponName = w.name; n.weaponId = w.id; } }
    else if (!n.bow) { n.bow = true; n.dmg = Math.max(n.dmg, w.dmg); n.ammo += 6; n.weaponName = w.name; n.weaponId = w.id; }
    else n.dmg = Math.max(n.dmg, w.dmg);
    n.foundWeapons.push(w.id); n.fx.push({ k: "weapon", name: w.name, ...at }); return;
  }
  const c = st.n ?? 1; const id = st.item!;
  if (id === "ok" && n.bow) { n.ammo += c; n.fx.push({ k: "loot", text: `+${c} ok`, ...at }); n.found += c; return; }
  let got = 0; let spilled = 0; for (let i = 0; i < c; i++) { if (bagCount(n) >= n.bagCap) { n.ground.push({ id: n.gid++, item: id, x: sp.x + (spilled * 5 - 3), floor: sp.floor }); spilled++; continue; } n.bag[id] = (n.bag[id] ?? 0) + 1; got++; }
  if (spilled) n.fx.push({ k: "full", ...at });
  if (got) { n.found += got; n.fx.push({ k: "loot", text: `+${got} ${id}`, ...at }); }
}
export const danger = (n: Scav) => 5 + n.wave * 2;
function spawnRaid(n: Scav) {
  n.wave++; const count = Math.min(6, 1 + Math.floor(n.wave * 0.5)); const scale = 1 + n.wave * 0.14;
  for (let i = 0; i < count; i++) {
    const def = n.site.foes[n.rng.int(0, n.site.foes.length - 1)]; const d = ENEMIES[def];
    const floor = n.rng.chance(60) ? n.floor : n.rng.int(0, n.site.floors - 1); const [lo, hi] = freeRange(n, floor); const x = n.rng.chance(50) ? hi - 6 - n.rng.next() * 30 : lo + 10 + n.rng.next() * 30;
    n.foes.push({ id: n.nextId++, def, x, floor, hp: d.hp * scale * 1.35, max: d.hp * scale * 1.35, speed: 9 + (d.move ?? 4) * 1.5 + n.rng.next() * 2.5, dmg: (d.damage[0] + d.damage[1]) / 2 * scale * 0.7, cd: 1 + n.rng.next(), human: d.species === "insan", climbT: 0, toFloor: floor, hitT: 0, root: 0, slow: 0, burn: 0 });
  }
  n.raidHold = 10; n.raidT = Math.max(12, 15 - Math.floor(n.wave / 2)); n.fx.push({ k: "raid", n: count });
}
function hurtFoe(n: Scav, f: SFoe, dmg: number, crit: boolean, quiet = false) {
  f.idle = false; f.hp -= dmg; f.hitT = 0.2; if (!quiet) n.fx.push({ k: "hit", x: f.x, floor: f.floor, dmg: Math.round(dmg), crit });
  if (f.hp <= 0 && n.foes.includes(f)) { n.foes = n.foes.filter(q => q !== f); n.kills++; n.fx.push({ k: "die", x: f.x, floor: f.floor }); }
}

/** Zamanı ilerlet. */
export function stepScav(n: Scav, dt: number) {
  if (n.phase !== "play") return; dt = Math.min(dt, 0.05); n.time += dt; n.atkFx = Math.max(0, n.atkFx - dt); n.castT = Math.max(0, n.castT - dt); n.foundT = Math.max(0, n.foundT - dt);
  if (n.raidHold > 0) n.raidHold = Math.max(0, n.raidHold - dt);       // baskından sonra 10 sn sayaç işlemez
  else { n.raidT -= dt; if (n.raidT <= 0) spawnRaid(n); }
  for (const q of [...n.spellQ]) { q.t -= dt; if (q.t <= 0) { n.spellQ = n.spellQ.filter(x => x !== q); launchSpell(n, q); } }
  if (n.spell) n.spell.cd = Math.max(0, n.spell.cd - dt);
  // yönlendirme
  const { dx, dy } = n.input; const moveIn = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2; n.moving = false;
  if (moveIn && n.searchId) n.searchId = 0;
  const onLadder = Math.abs(n.py - Math.round(n.py)) > 0.02;
  if (!n.searchId) {
    if (onLadder) {
      const gap = Math.floor(n.py); n.px = ladderX(gap);
      if (Math.abs(dy) > 0.25) n.py = Math.max(gap, Math.min(gap + 1, n.py - Math.sign(dy) * CLIMB_SPEED * dt * n.tr.climb));
      if (Math.abs(n.py - Math.round(n.py)) <= 0.02) n.py = Math.round(n.py);
    } else {
      if (Math.abs(dx) > 0.2) {
        const [lo, hi] = freeRange(n, n.floor); let nx = n.px + dx * speedOf(n) * dt; n.face = dx > 0 ? 1 : -1; n.moving = true;
        const lk = n.locks.find(l => l.floor === n.floor && !l.open && ((l.side === "R" && nx >= l.x - 3) || (l.side === "L" && nx <= l.x + 3)));
        if (lk) { const ki = n.keys.indexOf(lk.key); if (ki >= 0) { n.keys.splice(ki, 1); lk.open = true; n.fx.push({ k: "unlock", x: lk.x, floor: lk.floor }); } else { n.fx.push({ k: "locked", x: lk.x, floor: lk.floor }); nx = lk.side === "R" ? lk.x - 3 : lk.x + 3; } }
        n.px = Math.max(lo, Math.min(hi, nx));
      }
      if (Math.abs(dy) > 0.25) {
        const up = dy < 0; const gap = up ? n.floor : n.floor - 1;
        if (gap >= 0 && gap < n.site.floors - 1 && Math.abs(n.px - ladderX(gap)) <= 6) { n.px = ladderX(gap); n.py = n.floor + (up ? 0.04 : -0.04); }
      }
    }
  }
  n.climbing = Math.abs(n.py - Math.round(n.py)) > 0.02; n.floor = Math.round(n.py); if (n.climbing) n.moving = false;
  // arama: kutunun yanında durunca kendiliğinden başlar; hareket edince bırakılır; her aşama arasında kısa bir ara vardır
  n.searchWait = Math.max(0, n.searchWait - dt);
  if (!n.searchId && !moveIn && !n.climbing && n.searchWait <= 0 && nearSpot(n)) beginSearch(n);
  if (n.searchId) {
    const sp = n.spots.find(q => q.id === n.searchId);
    if (!sp || sp.done || n.climbing) n.searchId = 0;
    else {
      sp.prog += dt / Math.max(0.3, stageSeconds(n, sp));
      if (sp.prog >= 1) {
        const st = sp.stages[sp.stage]; sp.stage++; sp.prog = 0; n.searchId = 0; n.searchWait = 1.1; applyStage(n, sp, st); n.fx.push({ k: "spot", x: sp.x, floor: sp.floor });
        if (sp.stage >= SPOT_STAGES) { sp.done = true; n.searchId = 0; n.searched++; }
      }
    }
  }
  // büyü topları
  for (const pj of [...n.proj]) {
    const st = 95 * dt; pj.x += pj.dir * st; pj.left -= st;
    const hit = n.foes.some(f => f.floor === pj.floor && f.climbT <= 0 && Math.abs(f.x - pj.x) <= 5);
    if (hit || pj.left <= 0 || pj.x < 0 || pj.x > SW) { n.proj = n.proj.filter(q => q !== pj); explode(n, pj); }
  }
  // tuzaklar
  for (const tr of n.traps) {
    if (tr.state === "cool") { tr.t -= dt; if (tr.t <= 0) tr.state = "hand"; }
    else if (tr.state === "placed") {
      const hit = n.foes.find(f => f.floor === tr.floor && f.climbT <= 0 && Math.abs(f.x - tr.x) <= 7);
      if (hit) {
        const eff = n.trapFx[tr.id] ?? { dmg: 6, slow: 2, fire: false };
        for (const f of n.foes.filter(q => q.floor === tr.floor && Math.abs(q.x - tr.x) <= 12)) { hurtFoe(n, f, eff.dmg * (1 + n.wave * 0.1) * 1.6, false); f.root = Math.max(f.root, eff.slow); if (eff.fire) f.burn = Math.max(f.burn, 4); }
        n.fx.push({ k: "trap", x: tr.x, floor: tr.floor }); tr.state = "cool"; tr.t = TRAP_RECHARGE;
      }
    }
  }
  // düşmanlar
  const pf = n.floor; const exposed = !n.climbing || Math.abs(n.py - pf) < 0.3;
  for (const f of [...n.foes]) {
    f.hitT = Math.max(0, f.hitT - dt); f.cd -= dt; f.root = Math.max(0, f.root - dt); f.slow = Math.max(0, f.slow - dt);
    if (f.burn > 0) { f.burn -= dt; hurtFoe(n, f, n.dmg * 0.12 * dt, false, true); if (!n.foes.includes(f)) continue; }
    if (f.idle) { if (f.floor === n.floor && Math.abs(f.x - n.px) <= 48 && !n.climbing) f.idle = false; else continue; }   // bekçi: yaklaşınca uyanır
    if (f.climbT > 0) { f.climbT -= dt; if (f.climbT <= 0) f.floor = f.toFloor; continue; }
    if (f.root > 0) continue;
    const sp = f.speed * (f.slow > 0 ? 0.45 : 1);
    if (f.floor !== pf) {
      const gap = pf > f.floor ? f.floor : f.floor - 1; const lx = ladderX(gap); const d = lx - f.x;
      if (Math.abs(d) > 1) f.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      else { f.x = lx; f.toFloor = pf > f.floor ? f.floor + 1 : f.floor - 1; f.climbT = 1.6; }
      continue;
    }
    const d = n.px - f.x;
    if (Math.abs(d) > 5.5) { const [lo, hi] = freeRange(n, f.floor); f.x = Math.max(lo, Math.min(hi, f.x + Math.sign(d) * Math.min(Math.abs(d) - 5, sp * dt))); }
    else if (f.cd <= 0 && exposed) { f.cd = 1.5;
      if (n.moving && n.rng.chance(60)) { n.fx.push({ k: "dodge", x: n.px, floor: n.floor }); continue; }   // koşarken yanından sıyrılırsın
      const dm = f.dmg * Math.max(0.35, 1 - n.armor / 40); n.hp -= dm; n.fx.push({ k: "hurt", dmg: Math.round(dm) }); }
  }
  if (n.hp <= 0) { n.hp = 0; n.phase = "over"; n.result = "dead"; return; }
  // köpek: yanında durur, arada çıkıp düşmanla dövüşür
  const dg = n.dog;
  if (dg) {
    dg.moving = false; dg.cd -= dt; dg.t -= dt;
    if (dg.state === "yanda") {
      if (dg.floor !== n.floor && !n.climbing) { dg.lag += dt; if (dg.lag > 1.5) { dg.floor = n.floor; dg.x = n.px; dg.lag = 0; } } else dg.lag = 0;
      const want = n.px - n.face * 7; const d = want - dg.x; if (Math.abs(d) > 1.5 && dg.floor === n.floor) { dg.x += Math.sign(d) * Math.min(Math.abs(d), 26 * dt); dg.face = d > 0 ? 1 : -1; dg.moving = true; }
      if (dg.t <= 0) { const tgt = n.foes.find(f => f.floor === dg.floor); if (tgt) { dg.state = "av"; dg.t = 9; } else dg.t = 3; }
    } else if (dg.state === "av") {
      const tgt = n.foes.filter(f => f.floor === dg.floor && f.climbT <= 0).sort((a, b) => Math.abs(a.x - dg.x) - Math.abs(b.x - dg.x))[0];
      if (!tgt || dg.t <= 0) { dg.state = "don"; dg.t = 6; }
      else { const d = tgt.x - dg.x; dg.face = d > 0 ? 1 : -1;
        if (Math.abs(d) > 4) { dg.x += Math.sign(d) * Math.min(Math.abs(d) - 3, 30 * dt); dg.moving = true; }
        else if (dg.cd <= 0) { dg.cd = 0.9; hurtFoe(n, tgt, (3 + n.dogBond / 20) * n.dogMul * (1 + n.wave * 0.05), false); tgt.slow = Math.max(tgt.slow, 0.8); n.fx.push({ k: "bite", x: tgt.x, floor: tgt.floor }); } }
    } else {
      const d = n.px - dg.x; if (Math.abs(d) > 3 && dg.floor === n.floor) { dg.x += Math.sign(d) * Math.min(Math.abs(d), 28 * dt); dg.face = d > 0 ? 1 : -1; dg.moving = true; } else { dg.state = "yanda"; dg.t = 14; }
      if (dg.t <= 0) { dg.state = "yanda"; dg.t = 14; dg.floor = n.floor; dg.x = n.px; }
    }
  }
  // oyuncu saldırısı
  n.atkCd -= dt;
  if (n.atkCd <= 0 && !n.climbing && !n.searchId) {
    const same = n.foes.filter(f => f.floor === n.floor && f.climbT <= 0).sort((a, b) => Math.abs(a.x - n.px) - Math.abs(b.x - n.px));
    const t = same[0];
    if (t) {
      const dist = Math.abs(t.x - n.px); const crit = n.rng.chance(8);
      if (n.bow && n.ammo > 0 && dist <= 80) { n.ammo--; n.shots++; n.atkCd = 1 / n.rate; n.atkFx = 0.25; n.face = t.x > n.px ? 1 : -1; n.fx.push({ k: "shot", from: n.px, to: t.x, floor: n.floor }); hurtFoe(n, t, n.dmg * (crit ? 1.8 : 1) * (0.9 + n.rng.next() * 0.2), crit); }
      else if (dist <= 8) { n.atkCd = 0.85; n.atkFx = 0.25; n.face = t.x > n.px ? 1 : -1; hurtFoe(n, t, n.melee * (crit ? 1.8 : 1) * (0.9 + n.rng.next() * 0.2), crit); }
    }
  }
}

/* ---------- bitiş ---------- */
export interface ScavResult { result: "exit" | "dead"; items: Record<string, number>; lostItems: Record<string, number>; money: number; dropped: Record<string, number>; minutes: number; gains: GainReport; kills: number; waves: number; searched: number; weaponParts: string[] }
export function finishScav(cfg: Config, s: GameState, n: Scav): ScavResult {
  const dead = n.result === "dead"; const gains: GainReport = {};
  const items = dead ? {} : { ...n.bag }; const lostItems = dead ? { ...n.bag } : {}; const money = dead ? Math.floor(n.money / 2) : n.money;
  s.money += money; const dropped: Record<string, number> = {};
  for (const [k, v] of Object.entries(items)) { const d = addItem(cfg, s, k, v); if (d) dropped[k] = d; }
  // oklar: taşıdıkların harcanır, kalan (bulunanlar dahil) çıkışta cebine döner
  if (n.bow || n.ammoStart) { const ok0 = s.inventory.ok ?? 0; const left = dead ? 0 : n.ammo; const nv = Math.max(0, ok0 - n.ammoStart + left); if (nv > 0) s.inventory.ok = nv; else delete s.inventory.ok; }
  if (n.shots) Object.assign(gains, realUse(cfg, s, "okculuk_idman", Math.min(40, n.shots), 0.05));
  // bulunan silahlar kalmaz; yalnız onu oluşturan parçalardan biri cebe girer
  const weaponParts: string[] = [];
  if (!dead) for (const id of n.foundWeapons) { const w = FOUND_WEAPONS.find(x => x.id === id)!; const part = w.parts[Math.floor(Math.abs(Math.sin(n.seed + id.length)) * w.parts.length) % w.parts.length]; if (!addItem(cfg, s, part, 1)) weaponParts.push(part); }
  applyGain(cfg, s, "analiz", 0.05 + n.searched * 0.03, gains); applyGain(cfg, s, "gorus", 0.03 + n.searched * 0.02, gains); applyGain(cfg, s, "stres", 0.1 + n.wave * 0.04, gains);
  const k = 1.4 * n.tr.hp; s.hp = dead ? Math.max(1, Math.round(n.maxHp / k * 0.2)) : Math.max(1, Math.min(maxHp(cfg, s), Math.round(n.hp / k)));   // harabede can 1,4 kat (dayanmayla daha çok) ölçeklidir
  const minutes = Math.min(120, 20 + Math.round(n.time / 3)); s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - SCAV_ENERGY - Math.min(12, n.wave * 2)); s.satiety = Math.max(0, s.satiety - 5);
  return { result: n.result ?? "exit", items, lostItems, money, dropped, minutes, gains, kills: n.kills, waves: n.wave, searched: n.searched, weaponParts };
}

/** Harabede yara sar: önce çantadan, yoksa cebinden; can 1,4 kat ölçeklidir. */
export function healRun(cfg: Config, s: GameState, n: Scav, id: string): { ok: boolean; healed?: number } {
  const h = healOf(cfg, id); if (!h || n.phase !== "play" || n.hp >= n.maxHp) return { ok: false };
  if (n.bag[id] > 0) { n.bag[id]--; if (n.bag[id] <= 0) delete n.bag[id]; }
  else if ((s.inventory[id] ?? 0) > 0) { s.inventory[id]--; if (s.inventory[id] <= 0) delete s.inventory[id]; }
  else return { ok: false };
  const before = n.hp; n.hp = Math.min(n.maxHp, n.hp + healPower(cfg, s, id) * 1.4 * n.tr.hp); const g: GainReport = {}; applyGain(cfg, s, "ilk_yardim", 0.3, g); return { ok: true, healed: Math.round(n.hp - before) };
}
export const healItemsAvailable = (s: GameState, n: Scav) => ["sargi_bezi", "yara_merhemi"].map(id => ({ id, n: (n.bag[id] ?? 0) + (s.inventory[id] ?? 0) })).filter(x => x.n > 0);
