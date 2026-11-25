// Gerçek zamanlı çalışma oturumları: 1 gerçek saat = oyunda 1 saat = bir tam oturumun kazancı.
// Oturum sürerken başka bir şey yapılamaz; uygulama kapansa da süre işler.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log, minutesLeft, repOf } from "./state";
import { applyGain, summarize, DEFERRED_CATEGORIES, type GainReport } from "./progression";
import { maxHp } from "./combat";
import { teacherOf, CRAFTS } from "../content/world";
import { craftById, craftCheck, completeCraft, removeItem, addItem } from "./inventory";
import { activityPlace, place } from "./travel";

export interface SessionOption { id: string; label: string; ms: number }
export const SESSION_OPTIONS: SessionOption[] = [
  { id: "10s", label: "10 sn", ms: 10_000 },
  { id: "1m", label: "1 dk", ms: 60_000 },
  { id: "5m", label: "5 dk", ms: 300_000 },
  { id: "1h", label: "1 saat", ms: 3_600_000 },
  { id: "5h", label: "5 saat", ms: 18_000_000 },
];
export interface Session { kind: "act" | "craft"; id: string; startMs: number; durMs: number; label: string; fee?: number }

const LOW_ENERGY = 25;
/** Yaralıyken bedensel çalışma daha az verir, daha çok yorar. */
export function wounded(cfg: Config, s: GameState) { const m = maxHp(cfg, s); return (s.hp || m) < m * 0.5; }

export interface SessionPlan { ok: boolean; reason?: string; energy: number; minutes: number; fee: number }
export function planSession(cfg: Config, s: GameState, actId: string, ms: number): SessionPlan {
  const act = cfg.act.get(actId); const minutes = ms / 60_000; const hours = ms / 3_600_000;
  if (!act) return { ok: false, reason: "Bilinmeyen çalışma", energy: 0, minutes, fee: 0 };
  const physical = act.gains.some(g => DEFERRED_CATEGORIES.has(cfg.attr.get(g.attribute)?.cat ?? ""));
  const energy = Math.max(0, (act.fatigue ?? 0) * (60 / (act.duration ?? 60)) * hours * (physical && wounded(cfg, s) ? 1.3 : 1));
  let fee = 0;
  const base = { energy, minutes, fee };
  if (s.session) return { ok: false, reason: "Zaten çalışıyorsun", ...base };
  if (s.journey) return { ok: false, reason: "Yoldasın", ...base };
  const where = activityPlace(actId);
  if (where && !where.includes(s.location)) return { ok: false, reason: `Burada olmaz: ${where.map(w => place(w)?.name ?? w).join(" ya da ")}`, ...base };
  if (minutes > minutesLeft(s)) return { ok: false, reason: "Hava kararmadan bitmez", ...base };
  const el = act.params?.element;
  if (typeof el === "string" && !s.knownElements.includes(el)) return { ok: false, reason: "Defterinde bu sayfa yok", ...base };
  if (act.kind === "kullanim") return { ok: false, reason: "Gerçek durumda kendiliğinden gelişir", ...base };
  if (act.kind === "ders") {
    const t = teacherOf(actId);
    if (!t) return { ok: false, reason: "Bu bölgede öğretmen yok", ...base };
    const need = act.teacherRep ?? 0, have = repOf(s, s.region, "taninirlik");
    if (have < need) return { ok: false, reason: `${t.name} seni tanımıyor (tanınırlık ${Math.floor(have)}/${need})`, ...base };
    if (ms < 60_000) return { ok: false, reason: "Öğretmen bu kadar kısa ders vermez", ...base };
    fee = (t.fee ?? 0) * Math.max(1, Math.ceil(hours));
    if (s.money < fee) return { ok: false, reason: `Ders ücreti ${fee} bakır`, energy, minutes, fee };
  }
  // ağır bedensel çalışma: sürdürülebilecek süre dayanıklılığa bağlı
  const perHourFat = (act.fatigue ?? 0) * (60 / (act.duration ?? 60));
  if (physical && perHourFat >= 10) {
    const maxH = 0.5 + (s.attrs.kardiyo?.level ?? 0) / 10;
    if (hours > maxH) return { ok: false, reason: `Dayanıklılığın en çok ${maxH.toFixed(1).replace(".0", "")} saate yetiyor`, energy, minutes, fee };
  }
  if (energy > s.energy + 0.5) return { ok: false, reason: `Bu kadar dayanamazsın: ${Math.ceil(energy)} enerji gerekir`, energy, minutes, fee };
  return { ok: true, energy, minutes, fee };
}

export function startSession(cfg: Config, s: GameState, actId: string, ms: number, now: number): SessionPlan {
  const p = planSession(cfg, s, actId, ms); if (!p.ok) return p;
  s.money -= p.fee;
  s.session = { kind: "act", id: actId, startMs: now, durMs: ms, label: cfg.act.get(actId)!.name, fee: p.fee };
  return p;
}
export function startCraft(cfg: Config, s: GameState, craftId: string, now: number): { ok: boolean; reason?: string } {
  const c = craftById(craftId); if (!c) return { ok: false, reason: "Bilinmeyen iş" };
  if (s.session) return { ok: false, reason: "Zaten bir işle uğraşıyorsun" };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (c.minutes > minutesLeft(s)) return { ok: false, reason: "Hava kararmadan bitmez" };
  const chk = craftCheck(cfg, s, c); if (!chk.ok) return chk;
  for (const [id, n] of Object.entries(c.needs)) removeItem(s, id, n); // malzemeler ayrılır
  s.session = { kind: "craft", id: craftId, startMs: now, durMs: c.minutes * 60_000, label: c.id };
  return { ok: true };
}

export function sessionProgress(s: GameState, now: number): number {
  if (!s.session) return 0;
  return Math.max(0, Math.min(1, (now - s.session.startMs) / s.session.durMs));
}

/** Bir saatlik kazancı parça parça uygular: yoruldukça verim düşer. */
function applyHours(cfg: Config, s: GameState, actId: string, hours: number, report: GainReport) {
  const act = cfg.act.get(actId)!; const perHour = 60 / (act.duration ?? 60);
  const hurt = wounded(cfg, s);
  let left = hours;
  while (left > 1e-9) {
    const h = Math.min(0.25, left); left -= h;
    const eff = (s.energy < LOW_ENERGY ? 0.6 : 1) * (s.satiety < 15 ? 0.7 : 1);
    for (const g of act.gains) {
      const physical = DEFERRED_CATEGORIES.has(cfg.attr.get(g.attribute)?.cat ?? "");
      applyGain(cfg, s, g.attribute, g.w * eff * perHour * h * (physical && hurt ? 0.6 : 1), report);
    }
    const fat = (act.fatigue ?? 0) * perHour * h * (hurt ? 1.3 : 1);
    s.energy = Math.max(0, Math.min(100, s.energy - fat));
    s.satiety = Math.max(0, s.satiety - h * 4 - Math.max(0, fat) * 0.3);
    s.minute = Math.min(DAY_MINUTES, s.minute + h * 60);
  }
}

export interface SessionResult { label: string; gains: GainReport; minutes: number; early: boolean; kind: "act" | "craft"; product?: string; dropped?: number; wounded: boolean }
/** Oturumu bitirir (süre dolduysa tamamı, yarıda bırakıldıysa geçen kısmı). */
export function finishSession(cfg: Config, s: GameState, now: number, early = false): SessionResult | null {
  const ss = s.session; if (!ss) return null;
  const done = Math.min(ss.durMs, Math.max(0, now - ss.startMs));
  const complete = done >= ss.durMs;
  if (!complete && !early) return null;
  s.session = undefined;
  const report: GainReport = {};
  const hurt = wounded(cfg, s);
  if (ss.kind === "act") {
    applyHours(cfg, s, ss.id, done / 3_600_000, report);
    log(s, `${ss.label} (${fmtDur(done)}${complete ? "" : ", yarıda"}): ${summarize(cfg, report)}`, "gain");
    return { label: ss.label, gains: report, minutes: done / 60_000, early: !complete, kind: "act", wounded: hurt };
  }
  const c = craftById(ss.id)!;
  if (!complete) {
    for (const [id, n] of Object.entries(c.needs)) addItem(cfg, s, id, n); // malzemeler geri
    s.minute = Math.min(DAY_MINUTES, s.minute + done / 60_000);
    log(s, "El işini yarıda bıraktın; malzemeleri geri topladın.", "info");
    return { label: c.id, gains: report, minutes: done / 60_000, early: true, kind: "craft", wounded: hurt };
  }
  s.minute = Math.min(DAY_MINUTES, s.minute + c.minutes);
  s.energy = Math.max(0, s.energy - 5);
  const r = completeCraft(cfg, s, c, report);
  return { label: c.id, gains: report, minutes: c.minutes, early: false, kind: "craft", product: c.product, dropped: r.dropped, wounded: hurt };
}

export function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m} dk ${r} sn` : `${m} dk`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h} sa ${mm} dk` : `${h} saat`;
}
export { CRAFTS };
