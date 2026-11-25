// Gerçekçi gelişim: yaptığın şeyde gelişirsin, özellikler birbirini besler,
// getiri azalır, fiziksel kazanç dinlenirken işlenir, kullanılmayan beceri körelir.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log, minutesLeft, repOf } from "./state";
import { teacherOf } from "../content/world";

/** Fiziksel kategori kazançları uykuda işlenir. */
export const DEFERRED_CATEGORIES = new Set(["fiziksel"]);
const LOW_ENERGY = 25;

export interface GainReport { [attrId: string]: number }

/** Ham kazancı bir özelliğe uygular (azalan getiri dahil). Gerçekleşen kazancı döner. */
export function applyGain(cfg: Config, s: GameState, attrId: string, raw: number, report: GainReport, depth = 0): number {
  const a = cfg.attr.get(attrId); const st = s.attrs[attrId];
  if (!a || !st || raw === 0) return 0;
  const max = a.max ?? 100;
  const effective = st.level + st.pending;
  const room = Math.max(0, 1 - effective / max);
  const g = Math.min(max - effective, raw * (a.learnRate ?? 1) * Math.pow(room, a.diminish ?? 1));
  if (g <= 0) return 0;
  if (DEFERRED_CATEGORIES.has(a.cat ?? "")) st.pending += g; else { st.level += g; st.peak = Math.max(st.peak, st.level); }
  st.lastUsedDay = s.day;
  report[attrId] = (report[attrId] ?? 0) + g;
  // özellikler arası aktarım: tek adım
  if (depth === 0) for (const t of a.transfers) applyGain(cfg, s, t.to, g * t.w, report, 1);
  return g;
}

export type ActivityCheck = { ok: true; fee: number } | { ok: false; reason: string };

export function canDoActivity(cfg: Config, s: GameState, actId: string): ActivityCheck {
  const act = cfg.act.get(actId);
  if (!act) return { ok: false, reason: "Bilinmeyen aktivite" };
  const dur = act.duration ?? 60;
  if (dur > minutesLeft(s)) return { ok: false, reason: "Bugün buna vakit kalmadı" };
  const fat = act.fatigue ?? 0;
  if (fat > 0 && s.energy < Math.min(fat, 10)) return { ok: false, reason: "Çok yorgunsun" };
  let fee = 0;
  if (act.kind === "ders") {
    const t = teacherOf(actId);
    if (!t) return { ok: false, reason: "Bu bölgede öğretmen yok" };
    const need = act.teacherRep ?? 0;
    const have = repOf(s, s.region, "taninirlik");
    if (have < need) return { ok: false, reason: `${t.name} seni tanımıyor (tanınırlık ${Math.floor(have)}/${need})` };
    fee = t.fee ?? 0;
    if (s.money < fee) return { ok: false, reason: `Ders ücreti ${fee} bakır` };
  }
  if (act.kind === "kullanim") return { ok: false, reason: "Bu, gerçek durumda kendiliğinden gelişir" };
  return { ok: true, fee };
}

export interface ActivityResult { gains: GainReport; minutes: number; energy: number; tired: boolean; fee: number }

/** Bir oturum aktivite/ders yapar. */
export function doActivity(cfg: Config, s: GameState, actId: string, mult = 1): ActivityResult | { error: string } {
  const chk = canDoActivity(cfg, s, actId);
  if (!chk.ok) return { error: chk.reason };
  const act = cfg.act.get(actId)!;
  const tired = s.energy < LOW_ENERGY;
  const eff = mult * (tired ? 0.6 : 1) * (s.satiety < 15 ? 0.7 : 1);
  const report: GainReport = {};
  for (const g of act.gains) applyGain(cfg, s, g.attribute, g.w * eff, report);
  const minutes = act.duration ?? 60, energy = act.fatigue ?? 0;
  s.minute = Math.min(DAY_MINUTES, s.minute + minutes);
  s.energy = Math.max(0, Math.min(100, s.energy - energy));
  s.satiety = Math.max(0, s.satiety - minutes / 60 * 4 - Math.max(0, energy) * 0.3);
  s.money -= chk.fee;
  log(s, `${act.name}: ${summarize(cfg, report)}`, "gain");
  return { gains: report, minutes, energy, tired, fee: chk.fee };
}

/** Savaş gibi gerçek kullanım: aktivitenin realUse çarpanıyla, tekrar sayısı kadar. */
export function realUse(cfg: Config, s: GameState, actId: string, reps: number, scale = 1): GainReport {
  const act = cfg.act.get(actId); const report: GainReport = {};
  if (!act) return report;
  const m = (act.realUse ?? 1) * scale;
  for (let i = 0; i < reps; i++) for (const g of act.gains) applyGain(cfg, s, g.attribute, g.w * m, report);
  return report;
}

export function summarize(cfg: Config, r: GainReport, limit = 3): string {
  const parts = Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([id, v]) => `${cfg.attr.get(id)?.name ?? id} +${v < 0.1 ? v.toFixed(2) : v.toFixed(1)}`);
  return parts.join(", ") || "belirgin bir gelişme yok";
}

export interface SleepReport { applied: GainReport; decayed: GainReport; recovery: number; energy: number }

/** Günü bitirir: dinlenme kazancı işlenir, körelme uygulanır, enerji yenilenir. */
export function sleep(cfg: Config, s: GameState): SleepReport {
  const recovery = s.satiety >= 40 ? 1 : s.satiety >= 15 ? 0.75 : 0.45;
  const applied: GainReport = {}, decayed: GainReport = {};
  for (const [id, st] of Object.entries(s.attrs)) {
    if (st.pending > 0) {
      const g = st.pending * recovery;
      st.level += g; st.peak = Math.max(st.peak, st.level); st.pending = 0;
      applied[id] = g;
    }
    const a = cfg.attr.get(id);
    const idle = s.day - st.lastUsedDay;
    if (a && idle >= 2 && (a.decayRate ?? 0) > 0) {
      const floor = st.peak * (a.decayFloor ?? 60) / 100;
      const d = Math.min(a.decayRate ?? 0, Math.max(0, st.level - floor));
      if (d > 0) { st.level -= d; decayed[id] = d; }
    }
  }
  const energy = s.satiety >= 40 ? 100 : s.satiety >= 15 ? 85 : 65;
  s.energy = energy;
  s.satiety = Math.max(0, s.satiety - 30);
  s.day += 1; s.minute = 0;
  const parts = summarize(cfg, applied);
  log(s, recovery < 1 ? `Aç uyudun; kasların yarım dinlendi. ${parts}` : `İyi uyudun. Gece işlenen: ${parts}`, recovery < 1 ? "warn" : "gain");
  return { applied, decayed, recovery, energy };
}

export function eat(s: GameState, itemId: string, satiety: number) {
  if (!s.inventory[itemId]) return false;
  s.inventory[itemId] -= 1; if (s.inventory[itemId] <= 0) delete s.inventory[itemId];
  s.satiety = Math.min(100, s.satiety + satiety);
  s.minute = Math.min(DAY_MINUTES, s.minute + 15);
  return true;
}
