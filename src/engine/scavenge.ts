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
import { addItem, removeItem } from "./inventory";
import { weaponSet, hasBow, totalArmor } from "./gear";

export const SW = 300;                 // yapının genişliği (birim)
export const EXIT_X = 8;               // çıkış, zemin katın solunda
export const LADDER_XS = [250, 50];    // 0→1 ve 1→2 merdivenlerinin yeri
export const ladderX = (gap: number) => LADDER_XS[gap % 2];

interface LootEntry { item?: string; money?: [number, number]; w: number; n?: [number, number] }
export interface ScavSite {
  place: string; name: string; desc: string; floors: number; foes: string[]; spotsPerFloor: number;
  names: string[]; loot: LootEntry[]; unlock: (s: GameState) => string | null;
}
const done = (s: GameState, q: string) => (s.quests[q]?.count ?? 0) > 0 || s.quests[q]?.status === "bitti";
export const SCAV_SITES: ScavSite[] = [
  { place: "koru", name: "Yıkık avcı kulübesi", desc: "Korunun derinliğinde, çökmüş bir kulübe. İçinde eski avcıların bıraktıkları olabilir.", floors: 2, foes: ["kurt"], spotsPerFloor: 3,
    names: ["Sandık", "Yatak altı", "Raf", "Çuval", "Ocak yanı"],
    loot: [{ item: "deri", w: 4 }, { item: "ok", w: 4, n: [2, 4] }, { item: "ip", w: 3 }, { item: "kekik", w: 2, n: [1, 2] }, { item: "ekmek", w: 2 }, { money: [1, 3], w: 3 }, { item: "eski_sikke", w: 1 }],
    unlock: s => done(s, "kurt") ? null : "Önce Hasan'ın kurt derdine yardım et" },
  { place: "karacam_sarnic", name: "Sarnıç mahzeni", desc: "Nemli taş katlar, aşağıya inen merdivenler. Eski depolar boş değil.", floors: 3, foes: ["haydut", "kurt"], spotsPerFloor: 3,
    names: ["Fıçı", "Dolap", "Sandık", "Kasa", "Taş niş"],
    loot: [{ item: "demir_parca", w: 4, n: [1, 2] }, { item: "ok", w: 3, n: [2, 5] }, { item: "ip", w: 3 }, { item: "peynir", w: 2 }, { item: "deri", w: 2 }, { money: [2, 6], w: 4 }, { item: "eski_sikke", w: 2 }],
    unlock: s => done(s, "sarnic") ? null : "Önce Selim'in sarnıç işini bitir" },
  { place: "ardic_kul", name: "Yanık evler", desc: "Kül Yangını'ndan kalan üç katlı yıkık bir ev. Isı hâlâ burada gibi.", floors: 3, foes: ["muhafiz", "haydut"], spotsPerFloor: 3,
    names: ["Kömürleşmiş sandık", "Dolap", "Yatak", "Kasa", "Soba dibi"],
    loot: [{ item: "demir_parca", w: 3, n: [1, 3] }, { item: "ok", w: 3, n: [3, 6] }, { item: "peynir", w: 2 }, { item: "ekmek", w: 2 }, { item: "deri", w: 2 }, { money: [4, 10], w: 5 }, { item: "eski_sikke", w: 2 }, { item: "kartal_tuyu", w: 1 }],
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

/* ---------- kartlar ---------- */
export interface SCard { id: string; name: string; desc: string; max: number; bow?: boolean }
export const SCARDS: SCard[] = [
  { id: "cevik_el", name: "Çevik el", desc: "Arama %25 daha çabuk biter.", max: 3 },
  { id: "genis_cep", name: "Geniş cep", desc: "Çantaya 3 göz daha.", max: 3 },
  { id: "dolu_sadak", name: "Dolu sadak", desc: "6 ok daha taşırsın.", max: 3, bow: true },
  { id: "keskin_el", name: "Keskin el", desc: "Vuruşların %15 daha sert.", max: 3 },
  { id: "demir_ten", name: "Demir ten", desc: "En çok can +%15, biraz iyileşirsin.", max: 3 },
  { id: "hafif_adim", name: "Hafif adım", desc: "Yürüme ve tırmanma %12 hızlı.", max: 3 },
  { id: "sans_eli", name: "Şans eli", desc: "Arama noktasından ikinci bir şey çıkma şansı +%20.", max: 3 },
  { id: "sessiz", name: "Sessiz ayak", desc: "Sıradaki baskın 10 sn gecikir (her seçişte).", max: 3 },
];

/* ---------- durum ---------- */
export interface Spot { id: number; x: number; floor: number; name: string; done: boolean; prog: number }
export interface SFoe { id: number; def: string; x: number; floor: number; hp: number; max: number; speed: number; dmg: number; cd: number; human: boolean; climbT: number; toFloor: number; hitT: number }
export type SFx =
  | { k: "loot"; text: string; x: number; floor: number } | { k: "full"; x: number; floor: number } | { k: "hit"; x: number; floor: number; dmg: number; crit: boolean }
  | { k: "hurt"; dmg: number } | { k: "raid"; n: number } | { k: "card" } | { k: "shot"; from: number; to: number; floor: number } | { k: "die"; x: number; floor: number } | { k: "spot"; x: number; floor: number };
export interface Target { x: number; floor: number; spot?: number; exit?: boolean }
export interface Scav {
  site: ScavSite; seed: number; rng: Rng; time: number; phase: "play" | "card" | "over"; result?: "exit" | "dead";
  px: number; floor: number; face: 1 | -1; hp: number; maxHp: number; target: Target | null; climb: { t: number; to: number } | null;
  spots: Spot[]; foes: SFoe[]; nextId: number; wave: number; raidT: number;
  bag: Record<string, number>; bagCap: number; money: number; ammo: number; ammoMax: number; bow: boolean; dmg: number; melee: number; rate: number; atkCd: number; atkFx: number;
  armor: number; cards: Record<string, number>; offer: string[]; rerolls: number; searched: number; nextCard: number; shots: number; kills: number; found: number; fx: SFx[]; searchT: number;
}
const bagCount = (n: Scav) => Object.values(n.bag).reduce((a, b) => a + b, 0);
export const bagUsed = bagCount;
export const speedOf = (n: Scav) => 22 * (1 + (n.cards.hafif_adim ?? 0) * 0.12);
export const searchTime = (n: Scav) => 2.6 * Math.pow(0.75, n.cards.cevik_el ?? 0);

export function createScav(cfg: Config, s: GameState, site: ScavSite, seed: number): Scav {
  const rng = new Rng(seed); const spots: Spot[] = []; let id = 1;
  for (let f = 0; f < site.floors; f++) {
    const xs: number[] = [];
    for (let k = 0; k < site.spotsPerFloor; k++) {
      let x = 0; for (let t = 0; t < 30; t++) { x = 30 + rng.next() * 240; if (xs.every(q => Math.abs(q - x) > 36) && LADDER_XS.every(l => Math.abs(l - x) > 22)) break; }
      xs.push(x); spots.push({ id: id++, x, floor: f, name: site.names[rng.int(0, site.names.length - 1)], done: false, prog: 0 });
    }
  }
  const mh = maxHp(cfg, s); const ws = weaponSet(cfg, s); const lv = (a: string) => s.attrs[a]?.level ?? 0; const bow = hasBow(s);
  const arrows = Math.min(12, s.inventory.ok ?? 0);
  return {
    site, seed, rng, time: 0, phase: "play", px: EXIT_X + 6, floor: 0, face: 1, hp: Math.max(1, s.hp || mh), maxHp: mh, target: null, climb: null, spots, foes: [], nextId: 1, wave: 0, raidT: 55,
    bag: {}, bagCap: 8, money: 0, ammo: bow ? arrows : 0, ammoMax: arrows, bow: bow && arrows > 0, dmg: 6 + lv("okculuk") / 4 + lv("ust_govde") / 10, melee: ws.dmg + lv("ust_govde") / 10, rate: 0.9 + lv("refleks") / 80,
    atkCd: 0, atkFx: 0, armor: totalArmor(s), cards: {}, offer: [], rerolls: 2, searched: 0, nextCard: 2, shots: 0, kills: 0, found: 0, fx: [], searchT: 0,
  };
}

/* ---------- komutlar ---------- */
/** Bir yere yürü (kat farklıysa önce merdivene). */
export function goTo(n: Scav, x: number, floor: number) { if (n.phase !== "play") return; n.target = { x: Math.max(0, Math.min(SW, x)), floor: Math.max(0, Math.min(n.site.floors - 1, floor)) }; }
export function goToSpot(n: Scav, id: number) { const sp = n.spots.find(q => q.id === id); if (!sp || sp.done || n.phase !== "play") return; n.target = { x: sp.x, floor: sp.floor, spot: id }; }
export function goToExit(n: Scav) { if (n.phase !== "play") return; n.target = { x: EXIT_X, floor: 0, exit: true }; }
export const atExit = (n: Scav) => n.floor === 0 && n.px <= EXIT_X + 3;

/** Çıkışta çıkarsın: bulduklarını götürürsün. */
export function leave(n: Scav): boolean { if (!atExit(n) || n.phase === "over") return false; n.phase = "over"; n.result = "exit"; return true; }

export function rerollScav(n: Scav): boolean {
  if (n.phase !== "card" || n.rerolls <= 0) return false;
  const old = n.offer; const all = cardsLeft(n); const fresh = all.filter(c => !old.includes(c)); const pool = fresh.length >= 3 ? fresh : all;
  const out: string[] = []; while (out.length < 3 && pool.length) out.push(pool.splice(n.rng.int(0, pool.length - 1), 1)[0]);
  if (!out.length) return false; n.rerolls--; n.offer = out; return true;
}
const cardsLeft = (n: Scav) => SCARDS.filter(c => (n.cards[c.id] ?? 0) < c.max && (!c.bow || n.bow)).map(c => c.id);
function offerCards(n: Scav) { const pool = cardsLeft(n); const out: string[] = []; while (out.length < 3 && pool.length) out.push(pool.splice(n.rng.int(0, pool.length - 1), 1)[0]); if (!out.length) return; n.offer = out; n.phase = "card"; n.fx.push({ k: "card" }); }
export function pickScavCard(n: Scav, id: string): boolean {
  if (n.phase !== "card" || !n.offer.includes(id)) return false;
  n.cards[id] = (n.cards[id] ?? 0) + 1; n.offer = []; n.phase = "play";
  if (id === "genis_cep") n.bagCap += 3;
  if (id === "dolu_sadak") { n.ammoMax += 6; n.ammo += 6; }
  if (id === "keskin_el") { n.dmg *= 1.15; n.melee *= 1.15; }
  if (id === "demir_ten") { const add = Math.round(n.maxHp * 0.15); n.maxHp += add; n.hp = Math.min(n.maxHp, n.hp + add + 4); }
  if (id === "sessiz") n.raidT += 10;
  return true;
}

/* ---------- arama ve baskın ---------- */
function rollLoot(n: Scav, sp: Spot) {
  const rolls = 1 + (n.rng.chance(Math.min(80, (n.cards.sans_eli ?? 0) * 20)) ? 1 : 0);
  let any = false;
  for (let r = 0; r < rolls; r++) {
    if (r === 0 && n.rng.chance(12)) continue;                                  // bazı yerler boş çıkar
    const total = n.site.loot.reduce((a, e) => a + e.w, 0); let q = n.rng.next() * total; let pick = n.site.loot[0];
    for (const e of n.site.loot) { q -= e.w; if (q <= 0) { pick = e; break; } }
    if (pick.money) { const m = n.rng.int(pick.money[0], pick.money[1]); n.money += m; n.fx.push({ k: "loot", text: `+${m} bakır`, x: sp.x, floor: sp.floor }); any = true; }
    else if (pick.item) {
      const c = pick.n ? n.rng.int(pick.n[0], pick.n[1]) : 1; let got = 0;
      for (let i = 0; i < c; i++) { if (bagCount(n) >= n.bagCap) { n.fx.push({ k: "full", x: sp.x, floor: sp.floor }); break; } n.bag[pick.item] = (n.bag[pick.item] ?? 0) + 1; got++; }
      if (got) { n.fx.push({ k: "loot", text: `+${got} ${pick.item}`, x: sp.x, floor: sp.floor }); any = true; n.found += got; }
    }
  }
  if (!any) n.fx.push({ k: "loot", text: "boş", x: sp.x, floor: sp.floor });
}
export const danger = (n: Scav) => 5 + n.wave * 2;
function spawnRaid(n: Scav) {
  n.wave++; const count = Math.min(9, 2 + Math.floor(n.wave * 0.9)); const scale = 1 + n.wave * 0.1;
  for (let i = 0; i < count; i++) {
    const def = n.site.foes[n.rng.int(0, n.site.foes.length - 1)]; const d = ENEMIES[def];
    const floor = n.rng.chance(60) ? n.floor : n.rng.int(0, n.site.floors - 1); const x = n.rng.chance(50) ? SW - 4 - n.rng.next() * 10 : 12 + n.rng.next() * 30;
    n.foes.push({ id: n.nextId++, def, x, floor, hp: d.hp * scale, max: d.hp * scale, speed: 8 + (d.move ?? 4) * 1.6 + n.rng.next() * 3, dmg: (d.damage[0] + d.damage[1]) / 2 * scale * 0.8, cd: 1 + n.rng.next(), human: d.species === "insan", climbT: 0, toFloor: floor, hitT: 0 });
  }
  n.raidT = Math.max(28, 52 - n.wave * 3); n.fx.push({ k: "raid", n: count });
}
function hurtFoe(n: Scav, f: SFoe, dmg: number, crit: boolean) {
  f.hp -= dmg; f.hitT = 0.2; n.fx.push({ k: "hit", x: f.x, floor: f.floor, dmg: Math.round(dmg), crit });
  if (f.hp <= 0) { n.foes = n.foes.filter(q => q !== f); n.kills++; n.fx.push({ k: "die", x: f.x, floor: f.floor }); }
}

/** Zamanı ilerlet. */
export function stepScav(n: Scav, dt: number) {
  if (n.phase !== "play") return; dt = Math.min(dt, 0.05); n.time += dt; n.atkFx = Math.max(0, n.atkFx - dt);
  // baskın sayacı
  n.raidT -= dt; if (n.raidT <= 0) spawnRaid(n);
  // oyuncu hareketi
  if (n.climb) { n.climb.t -= dt; if (n.climb.t <= 0) { n.floor = n.climb.to; n.climb = null; } }
  else if (n.target) {
    const t = n.target;
    if (t.floor !== n.floor) {
      const gap = t.floor > n.floor ? n.floor : n.floor - 1; const lx = ladderX(gap); const d = lx - n.px;
      if (Math.abs(d) > 1) { const st = Math.min(Math.abs(d), speedOf(n) * dt); n.px += Math.sign(d) * st; n.face = d > 0 ? 1 : -1; }
      else { n.px = lx; n.climb = { t: 1.1 / (1 + (n.cards.hafif_adim ?? 0) * 0.12), to: t.floor > n.floor ? n.floor + 1 : n.floor - 1 }; }
    } else {
      const d = t.x - n.px;
      if (Math.abs(d) > 1) { const st = Math.min(Math.abs(d), speedOf(n) * dt); n.px += Math.sign(d) * st; n.face = d > 0 ? 1 : -1; }
      else if (!t.spot && !t.exit) n.target = null;
    }
  }
  // arama
  const tsp = n.target?.spot ? n.spots.find(q => q.id === n.target!.spot) : undefined;
  if (tsp && !tsp.done && !n.climb && tsp.floor === n.floor && Math.abs(tsp.x - n.px) <= 2) {
    n.searchT = tsp.id; tsp.prog += dt / searchTime(n);
    if (tsp.prog >= 1) { tsp.done = true; tsp.prog = 1; n.searched++; n.target = null; n.searchT = 0; n.fx.push({ k: "spot", x: tsp.x, floor: tsp.floor }); rollLoot(n, tsp); if (n.searched >= n.nextCard) { n.nextCard += 3; offerCards(n); } }
  } else n.searchT = 0;
  // düşmanlar
  for (const f of [...n.foes]) {
    f.hitT = Math.max(0, f.hitT - dt); f.cd -= dt;
    if (f.climbT > 0) { f.climbT -= dt; if (f.climbT <= 0) f.floor = f.toFloor; continue; }
    const pf = n.climb ? n.climb.to : n.floor;
    if (f.floor !== pf) {
      const gap = pf > f.floor ? f.floor : f.floor - 1; const lx = ladderX(gap); const d = lx - f.x;
      if (Math.abs(d) > 1) f.x += Math.sign(d) * Math.min(Math.abs(d), f.speed * dt);
      else { f.x = lx; f.toFloor = pf > f.floor ? f.floor + 1 : f.floor - 1; f.climbT = 1.4; }
      continue;
    }
    const d = n.px - f.x;
    if (Math.abs(d) > 5.5) f.x += Math.sign(d) * Math.min(Math.abs(d) - 5, f.speed * dt);
    else if (f.cd <= 0 && !n.climb) { f.cd = 1.3; const dm = f.dmg * Math.max(0.35, 1 - n.armor / 40); n.hp -= dm; n.fx.push({ k: "hurt", dmg: Math.round(dm) }); }
  }
  if (n.hp <= 0) { n.hp = 0; n.phase = "over"; n.result = "dead"; return; }
  // oyuncu saldırısı
  n.atkCd -= dt;
  if (n.atkCd <= 0 && !n.climb) {
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
export interface ScavResult { result: "exit" | "dead"; items: Record<string, number>; lostItems: Record<string, number>; money: number; dropped: Record<string, number>; minutes: number; gains: GainReport; kills: number; waves: number; searched: number }
export function finishScav(cfg: Config, s: GameState, n: Scav): ScavResult {
  const dead = n.result === "dead"; const gains: GainReport = {};
  const items = dead ? {} : { ...n.bag }; const lostItems = dead ? { ...n.bag } : {}; const money = dead ? Math.floor(n.money / 2) : n.money;
  s.money += money; const dropped: Record<string, number> = {};
  for (const [k, v] of Object.entries(items)) { const d = addItem(cfg, s, k, v); if (d) dropped[k] = d; }
  if (n.shots) { removeItem(s, "ok", Math.min(n.shots, s.inventory.ok ?? 0)); Object.assign(gains, realUse(cfg, s, "okculuk_idman", Math.min(40, n.shots), 0.05)); }
  applyGain(cfg, s, "analiz", 0.05 + n.searched * 0.03, gains); applyGain(cfg, s, "gorus", 0.03 + n.searched * 0.02, gains); applyGain(cfg, s, "stres", 0.1 + n.wave * 0.04, gains);
  s.hp = dead ? Math.max(1, Math.round(n.maxHp * 0.2)) : Math.max(1, Math.round(n.hp));
  const minutes = Math.min(120, 20 + Math.round(n.time / 3)); s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - SCAV_ENERGY - Math.min(12, n.wave * 2)); s.satiety = Math.max(0, s.satiety - 5);
  return { result: n.result ?? "exit", items, lostItems, money, dropped, minutes, gains, kills: n.kills, waves: n.wave, searched: n.searched };
}
