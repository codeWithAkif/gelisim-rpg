// Eşikler: bir özellik belli bir seviyeye gelince açılan somut şey. Yeni kural yok; oyunda zaten var
// olan kapılar (zayıf noktalar, el işi, yapılar, büyüler, harabede üst üste büyü) tek listede toplanır,
// böylece oyuncuya "Artık …" diye söylenebilir ve Vücut sayfasında sıradaki eşik gösterilebilir. DOM yok.
import type { Config } from "./config";
import type { GameState } from "./state";
import { ENEMIES, CRAFTS } from "../content/world";
import { STRUCTURES } from "../content/engineering";
import { itemInfo } from "./inventory";
import { spellOptions } from "./magic";
import { SCAV_SHOTS_AT } from "./scavenge";

export interface Threshold {
  id: string;
  need: Record<string, number>;       // hepsi tutmalı
  text: string;                       // "Artık …" cümlesinin devamı
  visible: (s: GameState) => boolean; // oyuncunun henüz bilemeyeceği şeyler gizli kalır
}

let cache: Threshold[] | undefined;
/** Bütün eşikler (bir kez kurulur). */
export function allThresholds(cfg: Config): Threshold[] {
  if (cache) return cache;
  const out: Threshold[] = [];
  const always = () => true;
  // zayıf noktalar: aynı anatomiyi paylaşanlar bir kez (insan: haydut, muhafız...; kurt: kurt, kar kurdu)
  const seen = new Set<string>();
  for (const e of Object.values(ENEMIES)) for (const w of e.weakPoints ?? []) {
    const who = e.species === "insan" ? "insan" : e.anatomyOf ?? e.id; const key = `${who}:${w.id}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ id: `zayif_${who}_${w.id}`, need: w.need, visible: always,
      text: `${who === "insan" ? "bir insanın" : `bir ${who === "kurt" ? "kurdun" : e.name.toLowerCase()}`} zayıf noktasını savaşta fark edebilirsin: ${w.name.toLowerCase()}` });
  }
  for (const c of CRAFTS) if (Object.keys(c.skill).length)
    out.push({ id: `elisi_${c.id}`, need: c.skill, visible: always, text: `kendin yapabilirsin: ${itemInfo(cfg, c.product).name}` });
  for (const d of STRUCTURES) if (Object.keys(d.skill).length)
    out.push({ id: `yapi_${d.id}`, need: d.skill, visible: s => !d.needsElement || s.knownElements.includes(d.needsElement), text: `kurabilirsin: ${d.name}` });
  for (const sp of cfg.data.spells) if (sp.mastery && (sp.minMastery ?? 0) > 0)
    out.push({ id: `buyu_${sp.id}`, need: { [sp.mastery]: sp.minMastery! }, text: `${sp.name} büyüsünü yapabilirsin`,
      visible: s => spellOptions(cfg, { ...s, mana: 999 } as GameState).some(o => o.spell.id === sp.id) });
  SCAV_SHOTS_AT.forEach((lv, i) => out.push({ id: `harabe_buyu_${i + 2}`, need: { odak: lv }, visible: s => s.knownElements.length > 0,
    text: `harabede büyüyü üst üste ${i + 2} kez salarsın` }));
  return (cache = out);
}

export const met = (s: GameState, t: Threshold) => Object.entries(t.need).every(([a, v]) => (s.attrs[a]?.level ?? 0) >= v);
const flag = (id: string) => "esik_" + id;

/**
 * Yeni aşılan eşikleri işaretler ve döner. Bir kayıtta ilk çağrıldığında o an aşılmış olanları
 * sessizce işaretler (eski kayıt ya da yeni oyun bir yığın bildirimle açılmasın).
 */
export function crossedThresholds(cfg: Config, s: GameState): Threshold[] {
  const first = s.story.flags.esik_kuruldu === undefined;
  if (first) s.story.flags.esik_kuruldu = s.day;
  const out: Threshold[] = [];
  for (const t of allThresholds(cfg)) {
    if (s.story.flags[flag(t.id)] !== undefined || !met(s, t)) continue;
    s.story.flags[flag(t.id)] = s.day;
    if (!first && t.visible(s)) out.push(t);
  }
  return out;
}

/** Bu özellik için sıradaki (henüz tutmayan, görünür) eşik: en düşük seviye isteyen. */
export function nextThreshold(cfg: Config, s: GameState, attr: string): { t: Threshold; at: number } | null {
  let best: { t: Threshold; at: number } | null = null;
  for (const t of allThresholds(cfg)) {
    const v = t.need[attr]; if (v === undefined || met(s, t) || !t.visible(s)) continue;
    if ((s.attrs[attr]?.level ?? 0) >= v) continue;   // bu özellik yetiyor, eksik olan başkası
    if (!best || v < best.at) best = { t, at: v };
  }
  return best;
}

/** Vücut sayfasında her zaman görünen ana özellikler (büyü yalnız bir sayfa bilinince). */
export const CORE_ATTRS = ["ust_govde", "bacak", "kardiyo", "refleks", "gorus", "cevresel", "odak", "analiz", "hitabet", "kilic", "okculuk", "mana"];
/**
 * Bir özellik görünür mü: ana özelliklerden biri, ya da çalışılmış (başlangıçtan +0,5), ya da bu gece
 * işlenecek bir kazancı var, ya da yakında bir şey açacak (görünür eşiği var). Gerisi katlanır.
 */
export function attrShown(cfg: Config, s: GameState, id: string): boolean {
  const a = cfg.attr.get(id); const st = s.attrs[id]; if (!a || !st) return false;
  if (a.cat === "buyu" && !s.knownElements.length) return false;
  if (CORE_ATTRS.includes(id)) return true;
  if (st.level - (a.base ?? 0) >= 0.5 || st.pending > 0.01) return true;
  return !!nextThreshold(cfg, s, id);
}
