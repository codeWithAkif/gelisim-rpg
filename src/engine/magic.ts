// Büyü: fizik kurallarına dayanır. Büyüyü yapabilmek için elementin defter sayfasını bilmek,
// ustalığın yetmesi ve mana gerekir. Odak dağılırsa büyü bozulur. Ortam elementi güçlendirir ya da
// zayıflatır (yağmurda ateş sönük, kuru otta yangın büyür).
import type { Config, Spell } from "./config";
import type { GameState } from "./state";
import { effectiveAttr, envPct } from "./derived";
import { type Battle, type Unit, type XY, player, enemies, dist, neighbors, unitAt, ctxAt, moraleCheck, detect } from "./combat";
import { Rng } from "./rng";
import { ENEMIES, TERRAIN, type Terrain } from "../content/world";
import { RELIC_SPELLS } from "../content/spells";
import { synthSpells } from "../content/synthesis";
import { hasRelic } from "./relics";
import { combo, wets, bounces, fxKind, BOUNCE_MUL, BOUNCE_HEX } from "./spellfx";

/** Büyülerin fiziksel sonuçları (config'deki "Fiziksel etki" metninin oyun karşılığı). */
export const SPELL_FX: Record<string, { ignite?: boolean; wall?: number; slow?: number; blind?: number; chain?: boolean; mud?: boolean; root?: number; stun?: number }> = {
  ates_topu: { ignite: true },
  magma_akintisi: { ignite: true, slow: 2 },
  buz_duvari: { wall: 4 },
  buhar_perdesi: { blind: 2 },
  sis_ortusu: { blind: 3 },
  simsek_zinciri: { chain: true },
  elektrik_golu: { chain: true, slow: 1 },
  camur_tuzagi: { mud: true, slow: 3 },
  yildirim_firtinasi: { chain: true },
  sarmasik: { root: 2 },
  karga_surusu: { blind: 2 },
  yer_kiliclari: { stun: 1 },
};
// sentezden çıkan büyülerin etkileri
Object.assign(SPELL_FX, synthSpells().fx);
const IGNITE: Partial<Record<Terrain, number>> = { uzun_ot: 90, agac: 80, cayir: 45 };

/** Bir kaynağın (element ya da birleşim) dayandığı temel elementler. */
export function baseElements(cfg: Config, id: string, seen = new Set<string>()): string[] {
  if (cfg.element.has(id)) return [id];
  const c = cfg.combo.get(id); if (!c || seen.has(id)) return [];
  seen.add(id);
  return [...new Set(c.ingredients.flatMap(i => baseElements(cfg, i.id, seen)))];
}
export const hexRange = (sp: Spell) => Math.max(1, Math.round((sp.range ?? 5) / 5));
export const hexArea = (sp: Spell) => Math.floor((sp.area ?? 0) / 5);
const mastery = (cfg: Config, s: GameState, sp: Spell) => sp.mastery ? (s.attrs[sp.mastery]?.level ?? 0) : 0;

export interface SpellOption { spell: Spell; known: boolean; ok: boolean; reason?: string }
/** Defterde sayfası olan elementlere dayanan büyüler; yapılabilir olanlar ok. */
export function spellOptions(cfg: Config, s: GameState): SpellOption[] {
  return cfg.data.spells.map(sp => {
    const els = sp.sources.flatMap(src => baseElements(cfg, src.id));
    const relic = RELIC_SPELLS[sp.id];
    // sentez büyüleri ancak keşfedilince bilinir (deney ya da savaşta çizerek); fırlatma hava sayfası ister
    const synth = sp.id.startsWith("sy_");
    const known = relic ? hasRelic(s, relic) : els.length > 0 && els.every(e => s.knownElements.includes(e))
      && (!synth || ((s.spellbook ?? []).includes(sp.id) && (!sp.id.endsWith("_firlat") || s.knownElements.includes("el_hava"))));
    if (!known) return { spell: sp, known, ok: false, reason: relic ? "Kadim eşyası bulunmadı" : "Defterinde gereken sayfa yok" };
    const m = mastery(cfg, s, sp), need = sp.minMastery ?? 0;
    if (m < need) return { spell: sp, known, ok: false, reason: `${cfg.attr.get(sp.mastery ?? "")?.name ?? "Ustalık"} ${m.toFixed(1)}/${need}` };
    if (s.mana < (sp.manaCost ?? 0)) return { spell: sp, known, ok: false, reason: `Mana yetmiyor (${Math.floor(s.mana)}/${sp.manaCost})` };
    return { spell: sp, known, ok: true };
  }).filter(o => o.known);
}

/** Büyünün elementlerine ortamın yaptığı yüzde etkisi. */
function spellEnvPct(cfg: Config, s: GameState, b: Battle, sp: Spell): number {
  const ctx = ctxAt(cfg, s, b, player(b));
  const els = new Set(sp.sources.flatMap(src => [src.id, ...baseElements(cfg, src.id)]));
  let p = envPct(cfg, ctx, sp.id);
  for (const e of els) p += envPct(cfg, ctx, e);
  return p;
}

export function areaHexes(b: Battle, sp: Spell, tx: number, ty: number): [number, number][] {
  const r = hexArea(sp); const out: [number, number][] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (dist(x, y, tx, ty) <= r) out.push([x, y]);
  return out;
}

export interface SpellPreview { inRange: boolean; hit: number; fizzle: number; dmg: [number, number]; envPct: number; targets: Unit[] }
export function previewSpell(cfg: Config, s: GameState, b: Battle, spellId: string, tx: number, ty: number): SpellPreview {
  const sp = cfg.spell.get(spellId)!; const p = player(b);
  const m = mastery(cfg, s, sp); const ctx = ctxAt(cfg, s, b, p);
  const inRange = dist(p.x, p.y, tx, ty) <= hexRange(sp) && !(tx === p.x && ty === p.y);
  const area = areaHexes(b, sp, tx, ty);
  const targets = enemies(b).filter(e => area.some(([x, y]) => x === e.x && y === e.y));
  const single = hexArea(sp) === 0;
  const ev = targets[0] ? ENEMIES[targets[0].def!].evasion : 0;
  const unaware = targets[0] && !targets[0].alert ? 15 : 0;
  const hit = single ? Math.max(15, Math.min(97, 70 + effectiveAttr(cfg, s, "mekansal", ctx) * 0.4 + m * 0.4 - ev * 0.5 + unaware)) : 100;
  const adjacent = enemies(b).some(e => dist(e.x, e.y, p.x, p.y) === 1);
  const fizzle = Math.max(0, Math.min(80, ((sp.focusNeed ?? 10) - effectiveAttr(cfg, s, "odak", ctx) - m * 0.3) * 2.5 + (adjacent ? 15 : 0) + (s.energy < 25 ? 10 : 0)));
  const ep = spellEnvPct(cfg, s, b, sp);
  const base = (sp.damage ?? 0) * (0.55 + m / 50) * Math.max(0, 1 + ep / 100);
  return { inRange, hit, fizzle, dmg: [Math.round(base * 0.85), Math.round(base * 1.15)], envPct: ep, targets };
}

/** Büyüyü yapar. Mana bozulsa da yarısı harcanır; deneme ustalığı yine geliştirir. */
/** quality: işaret çiziminin kalitesi (0–1); verilmezse çizim oynanmamış sayılır. */
export function castSpell(cfg: Config, s: GameState, b: Battle, spellId: string, tx: number, ty: number, quality?: number): string | null {
  const sp = cfg.spell.get(spellId); const p = player(b);
  if (!sp || b.phase !== "player" || p.acted) return null;
  const opt = spellOptions(cfg, s).find(o => o.spell.id === spellId);
  if (!opt?.ok) return null;
  const pv = previewSpell(cfg, s, b, spellId, tx, ty);
  if (!pv.inRange) return null;
  const rng = new Rng(b.seed); const fx = SPELL_FX[sp.id] ?? {};
  p.acted = true; if ((sp.castTime ?? 1) > 2) p.moveLeft = 0;
  b.stats.casts++; if (sp.mastery) b.stats.castMastery[sp.mastery] = (b.stats.castMastery[sp.mastery] ?? 0) + 1;
  s.energy = Math.max(0, s.energy - 3);
  let text: string;
  const hits: { uid: string; dmg: number }[] = [];
  const from: XY = [p.x, p.y];
  // işaret kötü çizildiyse büyü dağılır; iyi çizim odak kaymasını da azaltır
  const fizzle = quality === undefined ? rng.chance(pv.fizzle) : quality < 0.3 || rng.chance(pv.fizzle * (1 - quality));
  const power = quality === undefined ? 1 : 0.8 + 0.4 * quality;
  if (fizzle) {
    b.events.push({ k: "cast", spell: sp.id, from, to: [tx, ty], fizzle: true, hits });
    s.mana = Math.max(0, s.mana - Math.ceil((sp.manaCost ?? 0) / 2));
    text = `${sp.name} elinde dağıldı; odağın kaydı.`;
  } else {
    s.mana = Math.max(0, s.mana - (sp.manaCost ?? 0));
    const parts: string[] = [];
    const single = hexArea(sp) === 0;
    b.events.push({ k: "cast", spell: sp.id, from, to: [tx, ty], fizzle: false, hits }); // hits aşağıda dolar
    // birleşik tepkiler ve sekme: kural engine/spellfx.ts'te, dört sahnede aynı
    const kind = fxKind(fx); const rain = b.weather === "yagmur";
    const wetTile = (e: Unit) => ["su", "camur"].includes(b.tiles[e.y][e.x]);
    const cmb = (e: Unit) => combo(kind, { wet: (e.wet ?? 0) > 0 || wetTile(e) || (kind === "simsek" && rain), burn: !!b.fire[e.x + "," + e.y] });
    const strikes = [...pv.targets];
    if (bounces(kind) && pv.targets[0]) {
      const nxt = enemies(b).filter(o => !pv.targets.includes(o) && dist(o.x, o.y, pv.targets[0].x, pv.targets[0].y) <= BOUNCE_HEX).sort((a, c) => dist(a.x, a.y, pv.targets[0].x, pv.targets[0].y) - dist(c.x, c.y, pv.targets[0].x, pv.targets[0].y))[0];
      if (nxt) { const dm = Math.round(rng.int(pv.dmg[0], pv.dmg[1]) * power * BOUNCE_MUL); nxt.hp = Math.max(0, nxt.hp - dm); parts.push(`Sekti! ${nxt.name} ${dm} hasar aldı.`); hits.push({ uid: nxt.uid, dmg: dm }); if (fx.slow) nxt.slowed = Math.max(nxt.slowed, fx.slow); if (wets(kind)) nxt.wet = 3; }
    }
    for (const e of strikes) {
      if (single && !rng.chance(pv.hit)) { parts.push(`${e.name} son anda sıçradı.`); continue; }
      const cb = cmb(e); if (cb) parts.push(`${cb.tag}`);
      if (wets(kind)) e.wet = 3;
      const dmg = Math.round(rng.int(pv.dmg[0], pv.dmg[1]) * power * (cb?.mul ?? 1));
      if (dmg > 0) { e.hp = Math.max(0, e.hp - dmg); parts.push(`${e.name} ${dmg} hasar aldı.`); hits.push({ uid: e.uid, dmg }); }
      if (fx.slow) e.slowed = Math.max(e.slowed, fx.slow);
      if (fx.blind) e.blind = Math.max(e.blind ?? 0, fx.blind);
      if (fx.root) { e.rooted = Math.max(e.rooted ?? 0, fx.root); parts.push(`${e.name} sarmaşıklara dolandı.`); }
      if (fx.stun && e.hp > 0) { e.stunned = Math.max(e.stunned ?? 0, fx.stun); parts.push(`${e.name} havaya savruldu, sersemledi.`); }
      if (fx.ignite && b.weather !== "yagmur" && !(cb?.quench) && ENEMIES[e.def!]?.species === "hayvan") e.scared = true; // kurtlar ateşten korkar; yağmurda alev cılız
      if (fx.chain) {
        const wet = b.weather === "yagmur" || ["su", "camur"].includes(b.tiles[e.y][e.x]);
        for (const o of enemies(b)) if (o !== e && dist(o.x, o.y, e.x, e.y) === 1) {
          const cd = Math.round(dmg * (wet ? 0.8 : 0.5)); o.hp = Math.max(0, o.hp - cd); parts.push(`Şimşek ${o.name}'e atladı: ${cd}.`);
          parts.push(moraleCheck(b, o).trim());
        }
      }
      const m = moraleCheck(b, e); if (m) parts.push(m.trim());
    }
    for (const [x, y] of areaHexes(b, sp, tx, ty)) {
      const k = x + "," + y;
      if (fx.ignite && b.weather !== "yagmur" && rng.chance(IGNITE[b.tiles[y][x]] ?? 0)) { b.fire[k] = 3; b.events.push({ k: "ignite", at: [x, y] }); parts.push(`${TERRAIN[b.tiles[y][x]].name} tutuştu.`); }
      if (fx.mud && !TERRAIN[b.tiles[y][x]].blocks) b.tiles[y][x] = "camur";
    }
    if (fx.wall) {
      const spots = [[tx, ty] as [number, number], ...neighbors(b, tx, ty)].filter(([x, y]) => !unitAt(b, x, y) && !TERRAIN[b.tiles[y][x]].blocks).slice(0, 3);
      spots.forEach(([x, y]) => { b.walls[x + "," + y] = fx.wall!; });
      parts.push("Önünde buzdan bir duvar yükseldi.");
    }
    if (b.weather === "yagmur" && fx.ignite) parts.push("Yağmur alevi bastırıyor.");
    text = `${sp.name}! ${parts.filter(Boolean).join(" ") || "Boşluğa çarptı."}`;
  }
  b.seed = rng.seed; b.log.unshift(text);
  detect(b, true);
  if (player(b).hp <= 0) b.phase = "lost"; else if (enemies(b).length === 0) b.phase = "won";
  return text;
}

/** Çizilen dizi bir büyü etmediyse: tur gider, biraz mana yanar (ezber zorlasın). */
export function failedCast(s: GameState, b: Battle, reason: string): string {
  const p = player(b); if (b.phase !== "player" || p.acted) return "";
  p.acted = true; s.mana = Math.max(0, s.mana - 3); b.stats.casts++;
  const text = `Büyü söndü. ${reason}`; b.log.unshift(text); return text;
}
