// Kuşatma savunması (gerçek zamanlı): ortadasın, düşmanlar dalga dalga dört yandan gelir.
// Savaştan önce barikat kurar, köpeğini konumlandırırsın. Savaşta okla (çek-bırak) ve dolma süreli
// büyülerle vurursun; yanına gelene yakın dövüşte otomatik vurursun. Dalgalar arasında dinlenirsin.
// Saf simülasyon: step(dt) zamanı ilerletir; çizim ve dokunma arayüzdedir (DOM yok).
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { applyGain, realUse, type GainReport } from "./progression";
import { maxHp } from "./combat";
import { maxMana } from "./derived";
import { spellOptions, SPELL_FX } from "./magic";
import { spellSequence } from "./synthesis";
import { Rng } from "./rng";
import { ENEMIES, GAME_ITEMS, CONFIG_WEAPON_DAMAGE } from "../content/world";
import { weaponSet, totalArmor, hasBow } from "./gear";
import { config } from "./config";
import { barricadeCount, barricadeMul } from "./engineering";
import { petMul } from "./pet";
import { partyHeroes, heroOf, heroDef, heroStats } from "./estate";

export const ARENA = { w: 100, h: 140 };
const CX = ARENA.w / 2, CY = ARENA.h / 2;
export const PLAYER_R = 4, MELEE_R = 8.5, BARRICADE_MAX_LEN = 22;

export interface SiegeWave { foes: { def: string; count: number }[]; interval: number }
export interface SiegeDef { id: string; name: string; waves: SiegeWave[]; ground: "cayir" | "kar" | "tas" }

export interface Barricade { id: number; x1: number; y1: number; x2: number; y2: number; hp: number; max: number; kind: "kazik" | "buz" }
export interface Foe { id: number; def: string; x: number; y: number; hp: number; max: number; speed: number; dmg: [number, number]; atkCd: number; slowT: number; stunT: number; burnT: number; side: number; r: number; human: boolean; flee?: boolean }
export interface Zone { x: number; y: number; r: number; kind: "ates" | "camur"; t: number }
export interface Arrow { x: number; y: number; vx: number; vy: number; dmg: number; crit: boolean; life: number }
export type SiegeFx =
  | { k: "hit"; x: number; y: number; dmg: number; crit?: boolean; by: "ok" | "kilic" | "buyu" | "kopek" | "ates" }
  | { k: "hurt"; dmg: number } | { k: "die"; x: number; y: number } | { k: "bar"; id: number; broken: boolean }
  | { k: "cast"; spell: string; x: number; y: number; r: number; chain?: [number, number][]; fire?: boolean; from?: [number, number]; line?: [number, number, number, number] } | { k: "shoot" } | { k: "wave"; n: number };

export interface Siege {
  def: SiegeDef; phase: "build" | "fight" | "rest" | "won" | "lost"; time: number; wave: number;
  hp: number; maxHp: number; mana: number; maxMana: number; meleeCd: number; bowCd: number;
  budget: number; barricades: Barricade[]; foes: Foe[]; zones: Zone[]; arrows: Arrow[];
  pet?: { x: number; y: number; px: number; py: number; hp: number; max: number; cd: number; down?: boolean };
  helpers: { id: string; name: string; role: string; x: number; y: number; cd: number; dmg: [number, number]; range: number }[];
  queue: { def: string; at: number; side: number }[];
  spellCd: Record<string, number>; seed: number; nextId: number; fx: SiegeFx[]; waveKills: number;
  stats: { kills: number; shots: number; arrowHits: number; melee: number; casts: number; castMastery: Record<string, number>; built: number; dmgTaken: number; petHits: number };
}

/* ---------- kurulum ---------- */
/** Elindekilerin vuruşu (tek, çift ya da iki elli silah). */
/** Köpeğin kolladığı alan: bağ 50 olunca genişler. */
export const guardOf = (s: GameState) => s.pet?.id === "kopek" && s.pet.bond >= 50 ? 22 : 16;
export function weaponPower(s: GameState): number { return weaponSet(config, s).dmg; }
/** Kaç barikat kurabilirsin: iki geçici kazık + atölyede yaptıkların (engine/engineering.ts). */
export function barricadeBudget(s: GameState): number { return barricadeCount(s); }
export function createSiege(cfg: Config, s: GameState, def: SiegeDef, seed: number, called: string[] = []): Siege {
  const mh = maxHp(cfg, s);
  if (s.mana < 0) s.mana = maxMana(cfg, s);
  const sg: Siege = {
    def, phase: "build", time: 0, wave: 0, hp: Math.max(1, Math.min(mh, s.hp || mh)), maxHp: mh, mana: s.mana, maxMana: maxMana(cfg, s),
    meleeCd: 0, bowCd: 0, helpers: [], budget: barricadeBudget(s), barricades: [], foes: [], zones: [], arrows: [], queue: [],
    spellCd: {}, seed, nextId: 1, fx: [], waveKills: 0,
    stats: { kills: 0, shots: 0, arrowHits: 0, melee: 0, casts: 0, castMastery: {}, built: 0, dmgTaken: 0, petHits: 0 },
  };
  const hids = [...new Set([...partyHeroes(s).map(h => h.id), ...called])].slice(0, 4);
  hids.forEach((hid, i) => { const h = heroOf(s, hid), hd = heroDef(hid); if (!h || !hd) return; const st = heroStats(h); const a = Math.PI * (0.55 + i * 0.3);
    sg.helpers.push({ id: hid, name: hd.name, role: hd.role, x: CX + Math.cos(a) * 12, y: CY + Math.sin(a) * 12, cd: 0.5 + i * 0.3, dmg: st.dmg, range: hd.role === "okcu" ? 46 : hd.role === "izci" ? 36 : 13 }); });
  if (s.pet) { const max = 14 + Math.floor(s.pet.bond / 5); sg.pet = { x: CX + 8, y: CY + 4, px: CX + 8, py: CY + 4, hp: max, max, cd: 0 }; }
  return sg;
}
const segDist = (px: number, py: number, b: { x1: number; y1: number; x2: number; y2: number }) => {
  const vx = b.x2 - b.x1, vy = b.y2 - b.y1, L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - b.x1) * vx + (py - b.y1) * vy) / L2));
  return Math.hypot(px - (b.x1 + vx * t), py - (b.y1 + vy * t));
};
export function placeBarricade(s: GameState, sg: Siege, x1: number, y1: number, x2: number, y2: number, kind: Barricade["kind"] = "kazik"): { ok: boolean; reason?: string } {
  if (kind === "kazik" && sg.budget <= 0) return { ok: false, reason: "Kazığın kalmadı" };
  let L = Math.hypot(x2 - x1, y2 - y1); if (L < 4) return { ok: false, reason: "Daha uzun çek" };
  if (L > BARRICADE_MAX_LEN) { const k = BARRICADE_MAX_LEN / L; x2 = x1 + (x2 - x1) * k; y2 = y1 + (y2 - y1) * k; L = BARRICADE_MAX_LEN; }
  const b = { x1, y1, x2, y2 };
  if (segDist(CX, CY, b) < PLAYER_R + 3) return { ok: false, reason: "Kendi üstüne kuramazsın" };
  const max = kind === "buz" ? 40 : (26 + ((s.attrs.ust_govde?.level ?? 10) - 10) * 0.8 + ((s.attrs.el_becerisi?.level ?? 10) - 10) * 0.6) * barricadeMul(s);
  sg.barricades.push({ id: sg.nextId++, ...b, hp: max, max, kind });
  if (kind === "kazik") { sg.budget--; sg.stats.built++; }
  return { ok: true };
}
export function removeBarricade(sg: Siege, id: number) {
  const i = sg.barricades.findIndex(b => b.id === id); if (i < 0 || sg.phase === "fight") return;
  if (sg.barricades[i].kind === "kazik") sg.budget++; sg.barricades.splice(i, 1);
}
export function placePet(sg: Siege, x: number, y: number) { if (!sg.pet || sg.phase === "fight") return; sg.pet.px = sg.pet.x = x; sg.pet.py = sg.pet.y = y; }

/* ---------- dalga ---------- */
export function startWave(sg: Siege) {
  if (sg.phase !== "build" && sg.phase !== "rest") return;
  const w = sg.def.waves[sg.wave]; if (!w) return;
  const rng = new Rng(sg.seed + sg.wave * 977); let at = 1.2;
  for (const f of w.foes) for (let i = 0; i < f.count; i++) { sg.queue.push({ def: f.def, at, side: rng.int(0, 3) }); at += w.interval * (0.6 + rng.next() * 0.8); }
  sg.queue.sort((a, b) => a.at - b.at); sg.time = 0; sg.waveKills = 0; sg.phase = "fight"; sg.fx.push({ k: "wave", n: sg.wave + 1 });
}
function spawn(sg: Siege, def: string, side: number, rng: Rng) {
  const d = ENEMIES[def]; const u = rng.next();
  const [x, y] = side === 0 ? [u * ARENA.w, -4] : side === 1 ? [ARENA.w + 4, u * ARENA.h] : side === 2 ? [u * ARENA.w, ARENA.h + 4] : [-4, u * ARENA.h];
  const human = d.species === "insan";
  const speed = (human ? 6 : 10) * (d.move / (human ? 3 : 4)) * (d.scale ? 0.8 : 1);
  sg.foes.push({ id: sg.nextId++, def, x, y, hp: d.hp, max: d.hp, speed, dmg: d.damage, atkCd: 0.6, slowT: 0, stunT: 0, burnT: 0, side: rng.next() < 0.5 ? -1 : 1, r: d.scale ? 4.2 : 3.2, human });
}

/* ---------- oyuncu eylemleri ---------- */
export const BOW_COOLDOWN = 0.7;
export function canShoot(s: GameState, sg: Siege): string | null {
  if (sg.phase !== "fight") return "Savaş başlamadı";
  if (!hasBow(s)) return "Yayın yok";
  if (!(s.inventory.ok ?? 0)) return "Okun kalmadı";
  if (sg.bowCd > 0) return "Yay geriliyor";
  return null;
}
/** angle: atış yönü (radyan), power 0–1: ne kadar gerildi. */
export function shoot(s: GameState, sg: Siege, angle: number, power: number): boolean {
  if (canShoot(s, sg)) return false;
  const okc = s.attrs.okculuk?.level ?? 0; const rng = new Rng(sg.seed + sg.stats.shots * 31);
  s.inventory.ok -= 1; if (!s.inventory.ok) delete s.inventory.ok;
  const p = Math.max(0.25, Math.min(1, power)); const sp = 70 + 70 * p;
  // isabet sapması: okçuluk düştükçe ok savrulur
  const wob = (rng.next() - 0.5) * Math.max(0.02, 0.22 - okc * 0.006);
  const crit = rng.chance(4 + okc * 0.6);
  const dmg = Math.round((4 + okc / 8 + p * 5) * (crit ? 1.8 : 1));
  sg.arrows.push({ x: CX, y: CY, vx: Math.cos(angle + wob) * sp, vy: Math.sin(angle + wob) * sp, dmg, crit, life: (0.6 + p * 0.5) * (s.pet?.id === "sahin" && s.pet.bond >= 10 ? 1.2 : 1) });   // şahin gözcülüğü: menzil uzar
  sg.bowCd = BOW_COOLDOWN; sg.stats.shots++; sg.fx.push({ k: "shoot" });
  return true;
}
export interface SiegeSpell { id: string; name: string; cd: number; mana: number; r: number; dmg: number; ok: boolean; reason?: string; left: number }
export function siegeSpells(cfg: Config, s: GameState, sg: Siege): SiegeSpell[] {
  return spellOptions(cfg, { ...s, mana: 999 } as GameState).filter(o => o.ok).map(o => {
    const sp = o.spell; const m = sp.mastery ? s.attrs[sp.mastery]?.level ?? 0 : 0;
    const cd = Math.max(2.5, 3 + (sp.castTime ?? 1) * 2.2 - m / 12); const mana = sp.manaCost ?? 0;
    const left = sg.spellCd[sp.id] ?? 0;
    const reason = left > 0 ? "Doluyor" : sg.mana < mana ? "Mana yok" : undefined;
    return { id: sp.id, name: sp.name, cd, mana, r: 6 + (sp.area ?? 0) * 4, dmg: Math.round((sp.damage ?? 10) * (0.45 + m / 60)), ok: !reason && sg.phase === "fight", reason, left };
  });
}
/** Büyü nasıl uygulanır: duvar haritaya çizilir; top, fırlatma ve zincir kahramandan ileri atılır; gerisi noktaya. */
export type SiegeAim = "wall" | "throw" | "at";
export function spellAim(id: string): SiegeAim {
  if (SPELL_FX[id]?.wall) return "wall";
  const f = spellSequence(id)?.form;
  return f === "top" || f === "firlat" || f === "zincir" ? "throw" : "at";
}
/** Atılan büyünün en uzak varacağı yer (arena birimi). */
export const THROW_RANGE = 62;
/** Duvar büyüsünün en uzun boyu: duvar gücüyle uzar. */
export const wallLen = (id: string) => 14 + (SPELL_FX[id]?.wall ?? 3) * 3;

/** Bedeli öde (mana, dolma süresi); büyü hazır değilse null. */
function pay(cfg: Config, s: GameState, sg: Siege, id: string): SiegeSpell | null {
  const sp = siegeSpells(cfg, s, sg).find(q => q.id === id); if (!sp?.ok) return null;
  const def = cfg.spell.get(id)!;
  sg.mana -= sp.mana; sg.spellCd[id] = sp.cd; sg.stats.casts++;
  if (def.mastery) sg.stats.castMastery[def.mastery] = (sg.stats.castMastery[def.mastery] ?? 0) + 1;
  return sp;
}
/** Kahramandan ileri atılan büyü: parmağın gösterdiği yere (menzil kadar) düşer. */
export function castThrow(cfg: Config, s: GameState, sg: Siege, id: string, tx: number, ty: number): boolean {
  const dx = tx - CX, dy = ty - CY, L = Math.hypot(dx, dy); if (L < 3) return false;
  const k = Math.min(1, THROW_RANGE / L);
  return cast(cfg, s, sg, id, CX + dx * k, CY + dy * k, true);
}
/** Haritaya çizilen duvar: ateş duvarı yanan bir şerittir (geçen tutuşur, hayvan kaçar); buz ve taş engel kurar. */
export function castWall(cfg: Config, s: GameState, sg: Siege, id: string, x1: number, y1: number, x2: number, y2: number): { ok: boolean; reason?: string } {
  let L = Math.hypot(x2 - x1, y2 - y1); if (L < 4) return { ok: false, reason: "Daha uzun çiz" };
  const max = wallLen(id); if (L > max) { const k = max / L; x2 = x1 + (x2 - x1) * k; y2 = y1 + (y2 - y1) * k; L = max; }
  if (segDist(CX, CY, { x1, y1, x2, y2 }) < PLAYER_R + 2) return { ok: false, reason: "Kendi üstüne kuramazsın" };
  const fx = SPELL_FX[id] ?? {};
  const sp = pay(cfg, s, sg, id); if (!sp) return { ok: false, reason: "Büyü hazır değil" };
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  sg.fx.push({ k: "cast", spell: id, x: mx, y: my, r: L / 2, fire: !!fx.ignite, line: [x1, y1, x2, y2] });
  if (fx.ignite) {
    // yanan şerit: boyunca alev alanları; şeridin üstündeki düşman hemen tutuşur
    const n = Math.max(2, Math.round(L / 3));
    for (let i = 0; i <= n; i++) sg.zones.push({ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n, r: 3.2, kind: "ates", t: 7 });
    for (const f of sg.foes) if (f.hp > 0 && segDist(f.x, f.y, { x1, y1, x2, y2 }) < f.r + 2) { damage(sg, f, Math.round(sp.dmg * 0.6), "buyu"); f.burnT = 3; if (!f.human) f.flee = true; }
    return { ok: true };
  }
  sg.barricades.push({ id: sg.nextId++, x1, y1, x2, y2, hp: 30 + (fx.wall ?? 3) * 6, max: 30 + (fx.wall ?? 3) * 6, kind: "buz" });
  return { ok: true };
}

export function cast(cfg: Config, s: GameState, sg: Siege, id: string, x: number, y: number, thrown = false): boolean {
  const sp = pay(cfg, s, sg, id); if (!sp) return false;
  const fx = SPELL_FX[id] ?? {};
  sg.fx.push({ k: "cast", spell: id, x, y, r: sp.r, ...(thrown ? { from: [CX, CY] as [number, number] } : {}) });
  if (fx.wall) {
    // buz duvarı: hedef noktada, merkeze dik bir duvar
    const a = Math.atan2(y - CY, x - CX) + Math.PI / 2; const L = 9;
    placeBarricade(s, sg, x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L, "buz");
    return true;
  }
  let hits = sg.foes.filter(f => Math.hypot(f.x - x, f.y - y) <= sp.r + f.r);
  if (fx.chain && hits.length) { const first = hits[0]; hits = [first, ...sg.foes.filter(f => f !== first).sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y)).slice(0, 3)]; }
  for (const f of hits) {
    damage(sg, f, sp.dmg, "buyu");
    if (fx.slow) f.slowT = Math.max(f.slowT, fx.slow * 1.2);
    if (fx.blind) f.stunT = Math.max(f.stunT, fx.blind * 0.8);
    if (fx.root) f.stunT = Math.max(f.stunT, fx.root * 1.4);   // sarmaşık: yerinden kıpırdayamaz
    if (fx.stun) f.stunT = Math.max(f.stunT, fx.stun * 1.2);
    if (fx.ignite) f.burnT = 3;
    if (fx.ignite && !f.human) f.flee = f.hp < f.max * 0.5;   // hayvanlar ateşten kaçar
  }
  const cf = sg.fx.find(e => e.k === "cast" && e.spell === id && e.x === x && e.y === y) as Extract<SiegeFx, { k: "cast" }> | undefined;
  if (cf) { cf.fire = !!fx.ignite; if (fx.chain || id.includes("simsek") || id.includes("yildirim")) cf.chain = hits.map(f => [f.x, f.y] as [number, number]); }
  if (fx.ignite) sg.zones.push({ x, y, r: sp.r * 0.8, kind: "ates", t: 4 });
  if (fx.mud) sg.zones.push({ x, y, r: sp.r, kind: "camur", t: 6 });
  return true;
}
function damage(sg: Siege, f: Foe, dmg: number, by: "ok" | "kilic" | "buyu" | "kopek" | "ates", crit = false) {
  f.hp -= dmg; sg.fx.push({ k: "hit", x: f.x, y: f.y, dmg, crit, by });
  if (f.hp <= 0 && f.hp + dmg > 0) { sg.fx.push({ k: "die", x: f.x, y: f.y }); sg.stats.kills++; sg.waveKills++; }
}

/* ---------- zaman ---------- */
export function step(cfg: Config, s: GameState, sg: Siege, dt: number) {
  if (sg.phase !== "fight") return;
  dt = Math.min(dt, 0.1); sg.time += dt;
  const rng = new Rng(sg.seed + Math.floor(sg.time * 60));
  // doğanlar
  while (sg.queue.length && sg.queue[0].at <= sg.time) { const q = sg.queue.shift()!; spawn(sg, q.def, q.side, rng); }
  for (const k of Object.keys(sg.spellCd)) sg.spellCd[k] = Math.max(0, sg.spellCd[k] - dt);
  sg.bowCd = Math.max(0, sg.bowCd - dt); sg.meleeCd = Math.max(0, sg.meleeCd - dt);
  sg.mana = Math.min(sg.maxMana, sg.mana + dt * 0.35);
  // oklar
  for (const a of sg.arrows) {
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt; a.life -= dt;
    const hit = sg.foes.find(f => f.hp > 0 && segDist(f.x, f.y, { x1: a.x, y1: a.y, x2: nx, y2: ny }) < f.r + 0.8);
    if (hit) { damage(sg, hit, a.dmg, "ok", a.crit); sg.stats.arrowHits++; a.life = 0; hit.stunT = Math.max(hit.stunT, 0.25); }
    a.x = nx; a.y = ny;
  }
  sg.arrows = sg.arrows.filter(a => a.life > 0);
  // alanlar
  for (const z of sg.zones) {
    z.t -= dt;
    for (const f of sg.foes) if (f.hp > 0 && Math.hypot(f.x - z.x, f.y - z.y) < z.r) {
      if (z.kind === "ates") { f.burnT = Math.max(f.burnT, 1); } else f.slowT = Math.max(f.slowT, 0.4);
    }
  }
  sg.zones = sg.zones.filter(z => z.t > 0);
  // düşmanlar
  for (const f of sg.foes) {
    if (f.hp <= 0) continue;
    if (f.burnT > 0) { f.burnT -= dt; if (rng.chance(dt * 100 * 2)) damage(sg, f, 1, "ates"); }
    if (f.stunT > 0) { f.stunT -= dt; continue; }
    f.slowT = Math.max(0, f.slowT - dt); f.atkCd = Math.max(0, f.atkCd - dt);
    const sp = f.speed * (f.slowT > 0 ? 0.45 : 1);
    const dx = CX - f.x, dy = CY - f.y, L = Math.hypot(dx, dy) || 1;
    if (f.flee) { f.x -= dx / L * sp * 1.4 * dt; f.y -= dy / L * sp * 1.4 * dt; if (f.x < -10 || f.x > ARENA.w + 10 || f.y < -10 || f.y > ARENA.h + 10) { f.hp = 0; sg.stats.kills++; } continue; }
    // köpek önündeyse onunla dövüşür
    const pet = sg.pet && !sg.pet.down && Math.hypot(sg.pet.x - f.x, sg.pet.y - f.y) < f.r + 3.5 ? sg.pet : null;
    if (L <= PLAYER_R + f.r) {
      if (f.atkCd <= 0) {
        const d = ENEMIES[f.def]; const dodge = 8 + ((s.attrs.refleks?.level ?? 10) - 10) * 1.2;
        if (rng.chance(Math.max(15, d.accuracy - dodge))) { const dmg = Math.max(1, rng.int(f.dmg[0], f.dmg[1]) - armor(s)); sg.hp -= dmg; sg.stats.dmgTaken += dmg; sg.fx.push({ k: "hurt", dmg }); }
        f.atkCd = 1.9;
      }
      continue;
    }
    if (pet) {
      if (f.atkCd <= 0) { if (rng.chance(55)) { const dmg = rng.int(f.dmg[0], f.dmg[1]); pet.hp -= dmg; if (pet.hp <= 0) pet.down = true; } f.atkCd = 1.4; }
      continue;
    }
    let mx = dx / L * sp * dt, my = dy / L * sp * dt;
    const block = sg.barricades.find(b => b.hp > 0 && segDist(f.x + mx, f.y + my, b) < f.r);
    if (block) {
      if (!f.human && sg.def.ground !== "tas") {
        // kurtlar dolanır: barikat boyunca kayar
        const tx = block.x2 - block.x1, ty = block.y2 - block.y1, T = Math.hypot(tx, ty) || 1;
        mx = tx / T * sp * dt * f.side; my = ty / T * sp * dt * f.side;
        if (sg.barricades.some(b => b !== block && b.hp > 0 && segDist(f.x + mx, f.y + my, b) < f.r)) { f.side = -f.side; mx = my = 0; }
        if (f.atkCd <= 0 && rng.chance(25)) { block.hp -= rng.int(f.dmg[0], f.dmg[1]); f.atkCd = 1.2; }
      } else {
        // insanlar barikatı kırar
        if (f.atkCd <= 0) { block.hp -= rng.int(f.dmg[0], f.dmg[1]) + 2; f.atkCd = 1.1; }
        mx = my = 0;
      }
      if (block.hp <= 0) sg.fx.push({ k: "bar", id: block.id, broken: true });
    }
    f.x += mx; f.y += my;
  }
  sg.barricades = sg.barricades.filter(b => b.hp > 0);
  // köpek: noktasında bekler, yaklaşanı ısırır
  // adamlar: rollerine göre vurur, iyileştirir ya da barikatı onarır
  for (const h of sg.helpers) {
    h.cd -= dt; if (h.cd > 0) continue;
    if (h.role === "sifaci") { if (sg.hp < sg.maxHp) { sg.hp = Math.min(sg.maxHp, sg.hp + 2.5); h.cd = 2.2; sg.fx.push({ k: "hit", x: CX, y: CY - 6, dmg: -2, by: "kopek" } as SiegeFx); } else h.cd = 0.6; continue; }
    if (h.role === "usta") { const b = sg.barricades.filter(q => q.hp < q.max).sort((x, y) => x.hp / x.max - y.hp / y.max)[0]; if (b) b.hp = Math.min(b.max, b.hp + 5); h.cd = 1.0; continue; }
    const t = sg.foes.filter(f => Math.hypot(f.x - h.x, f.y - h.y) <= h.range + f.r).sort((x, y) => Math.hypot(x.x - h.x, x.y - h.y) - Math.hypot(y.x - h.x, y.y - h.y))[0];
    if (!t) { h.cd = 0.25; continue; }
    damage(sg, t, rng.int(h.dmg[0], h.dmg[1]), h.role === "okcu" || h.role === "izci" ? "ok" : "kilic"); h.cd = h.role === "okcu" ? 1.25 : 1.0;
  }
  if (sg.pet && !sg.pet.down) {
    const pt = sg.pet; pt.cd = Math.max(0, pt.cd - dt);
    const t = sg.foes.filter(f => f.hp > 0 && !f.flee && Math.hypot(f.x - pt.px, f.y - pt.py) < guardOf(s)).sort((a, b) => Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y))[0];
    const gx = t ? t.x : pt.px, gy = t ? t.y : pt.py; const d = Math.hypot(gx - pt.x, gy - pt.y);
    if (t && d < t.r + 3) { if (pt.cd <= 0) { const bond = s.pet?.bond ?? 0; damage(sg, t, Math.max(1, Math.round((2 + Math.floor(bond / 25) + rng.int(0, 2)) * petMul(s))), "kopek"); sg.stats.petHits++; t.slowT = Math.max(t.slowT, 0.6); pt.cd = 1; } }
    else if (d > 0.5) { const v = 14 * dt; pt.x += (gx - pt.x) / d * Math.min(v, d); pt.y += (gy - pt.y) / d * Math.min(v, d); }
  }
  // yakın dövüş: yanındakine otomatik vurursun
  if (sg.meleeCd <= 0) {
    const t = sg.foes.filter(f => f.hp > 0 && Math.hypot(f.x - CX, f.y - CY) <= MELEE_R + f.r).sort((a, b) => a.hp - b.hp)[0];
    if (t) {
      const sk = s.attrs.kilic?.level ?? 10; const crit = rng.chance(5 + sk * 0.4);
      const dmg = Math.round((weaponPower(s) + (s.attrs.ust_govde?.level ?? 10) / 8 + rng.int(0, 3)) * (crit ? 1.8 : 1));
      damage(sg, t, dmg, "kilic", crit); sg.stats.melee++; sg.meleeCd = Math.max(0.5, 1.0 - sk / 80);
    }
  }
  sg.foes = sg.foes.filter(f => f.hp > 0);
  // sürü morali: dalganın çoğu düşünce kalan hayvanlar kaçar
  const total = sg.def.waves[sg.wave]?.foes.reduce((a, f) => a + f.count, 0) ?? 0;
  if (!sg.queue.length && sg.waveKills >= total * 0.6) for (const f of sg.foes) if (!f.human && !f.flee) f.flee = true;
  if (sg.hp <= 0) { sg.hp = 0; sg.phase = "lost"; return; }
  if (!sg.queue.length && !sg.foes.length) {
    sg.wave++;
    sg.phase = sg.wave >= sg.def.waves.length ? "won" : "rest";
  }
}
function armor(s: GameState) { return totalArmor(s); }

/** Dalga arası: biraz can, mana; bir kazık daha; kırık barikatlar biraz onarılır. */
export function restBetween(s: GameState, sg: Siege) {
  if (sg.phase !== "rest") return;
  sg.hp = Math.min(sg.maxHp, sg.hp + Math.round(sg.maxHp * 0.2));
  sg.mana = Math.min(sg.maxMana, sg.mana + sg.maxMana * 0.25);
  for (const b of sg.barricades) b.hp = Math.min(b.max, b.hp + b.max * 0.35);
  sg.budget += 1;
  if (sg.pet) { sg.pet.down = false; sg.pet.hp = Math.min(sg.pet.max, Math.max(sg.pet.hp, 0) + sg.pet.max * 0.5); }
  void s;
}

/** Kuşatma bitince: gerçek kullanım gelişimi, yorgunluk, zaman, can. */
export function finishSiege(cfg: Config, s: GameState, sg: Siege): { gains: GainReport; minutes: number; won: boolean } {
  const gains = realUse(cfg, s, "kilic_dovus", sg.stats.melee, 0.12);
  if (sg.stats.shots) { const g = realUse(cfg, s, "okculuk_idman", sg.stats.shots, 0.12); for (const [k, v] of Object.entries(g)) gains[k] = (gains[k] ?? 0) + v; }
  for (const [attr, n] of Object.entries(sg.stats.castMastery)) applyGain(cfg, s, attr, n * 0.4, gains);
  if (sg.stats.casts) { applyGain(cfg, s, "odak", sg.stats.casts * 0.12, gains); applyGain(cfg, s, "mana", sg.stats.casts * 0.12, gains); }
  if (sg.stats.built) { applyGain(cfg, s, "el_becerisi", sg.stats.built * 0.2, gains); applyGain(cfg, s, "taktik", sg.stats.built * 0.12, gains); }
  if (sg.stats.dmgTaken) applyGain(cfg, s, "agri", sg.stats.dmgTaken * 0.02, gains);
  applyGain(cfg, s, "stres", 0.3 + sg.wave * 0.15, gains);
  const minutes = 30 + sg.wave * 20;
  s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, s.energy - 8 - sg.wave * 4); s.satiety = Math.max(0, s.satiety - 8);
  s.hp = sg.phase === "lost" ? 1 : Math.max(1, Math.round(sg.hp));
  s.mana = sg.mana;
  if (s.pet) s.pet.bond = Math.min(100, s.pet.bond + 1 + sg.stats.petHits * 0.3);
  return { gains, minutes, won: sg.phase === "won" };
}

/* ---------- tekrar eden savunmalar ---------- */
// Eski "nöbet" burada yaşar: aynı gece görevi her tekrarda zorlaşır; sonsuz dalga ve ayrı güçlenme yok.
// Güç yalnızca karakterden gelir; tekrarlar yalnızca düşmanı artırır. times: o görevi kaç kez kazandığın.
export const SIEGE_LEADER: Record<string, string> = { agil: "akyele", han: "muhafiz", mutfak: "muhafiz" };
export const MAX_ESCALATION = 4;
export function escalate(def: SiegeDef, times: number): SiegeDef {
  const t = Math.max(0, Math.min(MAX_ESCALATION, Math.floor(times)));
  if (!t) return def;
  const k = 1 + t * 0.2;
  const waves: SiegeWave[] = def.waves.map(w => ({ interval: Math.max(1.2, w.interval * (1 - t * 0.06)), foes: w.foes.map(f => ({ def: f.def, count: Math.round(f.count * k) })) }));
  // ikinci tekrardan sonra bir dalga daha; üçüncüden sonra son dalgaya bir lider katılır
  if (t >= 2) { const lastW = waves[waves.length - 1]; waves.push({ interval: Math.max(1.2, lastW.interval * 0.9), foes: lastW.foes.map(f => ({ def: f.def, count: f.count + 1 })) }); }
  const leader = SIEGE_LEADER[def.id];
  if (t >= 3 && leader) waves[waves.length - 1].foes.push({ def: leader, count: 1 });
  return { ...def, name: `${def.name} · ${t + 1}. gece`, waves };
}

/* ---------- kuşatmalar ---------- */
export const SIEGES: Record<string, SiegeDef> = {
  agil: { id: "agil", name: "Ağıl gecesi", ground: "cayir", waves: [
    { foes: [{ def: "kurt", count: 3 }], interval: 3 },
    { foes: [{ def: "kurt", count: 4 }], interval: 2.4 },
    { foes: [{ def: "kurt", count: 6 }], interval: 1.8 },
  ] },
  han: { id: "han", name: "Hanın gecesi", ground: "tas", waves: [
    { foes: [{ def: "haydut", count: 3 }], interval: 3 },
    { foes: [{ def: "haydut", count: 4 }], interval: 2.4 },
    { foes: [{ def: "haydut", count: 3 }, { def: "muhafiz", count: 1 }], interval: 2.2 },
    { foes: [{ def: "haydut", count: 5 }, { def: "muhafiz", count: 2 }], interval: 1.8 },
  ] },
  mutfak: { id: "mutfak", name: "Mutfak kapısı", ground: "kar", waves: [
    { foes: [{ def: "kar_kurdu", count: 3 }], interval: 2.4 },
    { foes: [{ def: "muhafiz", count: 3 }], interval: 2.6 },
    { foes: [{ def: "kar_kurdu", count: 3 }, { def: "muhafiz", count: 3 }], interval: 1.8 },
  ] },
};
