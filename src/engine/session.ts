// Gerçek zamanlı çalışma oturumları, sıkıştırılmış: 1 gerçek saniye = oyunda 1 dakika.
// Oyunda 1 saat çalışma (gerçekte 1 dk) bir tam oturumun kazancını verir.
// Oturum sürerken başka bir şey yapılamaz; uygulama kapansa da süre işler.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log, minutesLeft, repOf } from "./state";
import { applyGain, summarize, DEFERRED_CATEGORIES, type GainReport } from "./progression";
import { maxHp } from "./combat";
import { teacherOf, CRAFTS } from "../content/world";
import { craftById, craftCheck, completeCraft, removeItem, addItem } from "./inventory";
import { activityPlace, place } from "./travel";
import { sessionBoost, sessionRounds } from "./timing";

/** Zaman sıkıştırması: oyun süresi / gerçek süre. */
export const TIME_SCALE = 60;
/** ms: oyundaki süre. Gerçekte ms / TIME_SCALE beklenir. */
export interface SessionOption { id: string; label: string; ms: number }
export const SESSION_OPTIONS: SessionOption[] = [
  { id: "10m", label: "10 dk", ms: 600_000 },
  { id: "30m", label: "30 dk", ms: 1_800_000 },
  { id: "1h", label: "1 saat", ms: 3_600_000 },
  { id: "3h", label: "3 saat", ms: 10_800_000 },
  { id: "5h", label: "5 saat", ms: 18_000_000 },
];
/** durMs gerçek bekleme süresi, gameMs oyundaki karşılığı. */
export interface Session { kind: "act" | "craft"; id: string; startMs: number; durMs: number; gameMs?: number; label: string; fee?: number; scores?: number[] }
/** Oturumun mini oyun verimi (×1 ile ×2 arası). */
export function boostOf(ss: Session): number { return ss.kind === "act" ? sessionBoost(ss.scores, ss.gameMs ?? ss.durMs) : 1; }
/** Oynanabilecek kalan odak turu. */
export function roundsLeft(ss: Session): number { return Math.max(0, sessionRounds(ss.gameMs ?? ss.durMs) - (ss.scores?.length ?? 0)); }
/** Mini oyun sonucunu oturuma yazar (0–1). */
export function recordPlay(s: GameState, score: number): boolean {
  const ss = s.session; if (!ss || ss.kind !== "act" || roundsLeft(ss) <= 0) return false;
  (ss.scores ??= []).push(Math.max(0, Math.min(1, score))); return true;
}
const gameOf = (ss: Session, realMs: number) => realMs * ((ss.gameMs ?? ss.durMs) / ss.durMs);

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
    if (ms < 1_800_000) return { ok: false, reason: "Öğretmen yarım saatten kısa ders vermez", ...base };
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
  s.session = { kind: "act", id: actId, startMs: now, durMs: ms / TIME_SCALE, gameMs: ms, label: cfg.act.get(actId)!.name, fee: p.fee };
  return p;
}
export function startCraft(cfg: Config, s: GameState, craftId: string, now: number): { ok: boolean; reason?: string } {
  const c = craftById(craftId); if (!c) return { ok: false, reason: "Bilinmeyen iş" };
  if (s.session) return { ok: false, reason: "Zaten bir işle uğraşıyorsun" };
  if (s.journey) return { ok: false, reason: "Yoldasın" };
  if (c.minutes > minutesLeft(s)) return { ok: false, reason: "Hava kararmadan bitmez" };
  const chk = craftCheck(cfg, s, c); if (!chk.ok) return chk;
  for (const [id, n] of Object.entries(c.needs)) removeItem(s, id, n); // malzemeler ayrılır
  s.session = { kind: "craft", id: craftId, startMs: now, durMs: c.minutes * 60_000 / TIME_SCALE, gameMs: c.minutes * 60_000, label: c.id };
  return { ok: true };
}

export function sessionProgress(s: GameState, now: number): number {
  if (!s.session) return 0;
  return Math.max(0, Math.min(1, (now - s.session.startMs) / s.session.durMs));
}

/** Bir saatlik kazancı parça parça uygular: yoruldukça verim düşer. */
function applyHours(cfg: Config, s: GameState, actId: string, hours: number, report: GainReport, boost = 1) {
  const act = cfg.act.get(actId)!; const perHour = 60 / (act.duration ?? 60);
  const hurt = wounded(cfg, s);
  let left = hours;
  while (left > 1e-9) {
    const h = Math.min(0.25, left); left -= h;
    const eff = (s.energy < LOW_ENERGY ? 0.6 : 1) * (s.satiety < 15 ? 0.7 : 1) * boost;
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

export interface SessionResult { label: string; gains: GainReport; minutes: number; early: boolean; kind: "act" | "craft"; product?: string; dropped?: number; wounded: boolean; boost?: number }
/** Oturumu bitirir (süre dolduysa tamamı, yarıda bırakıldıysa geçen kısmı). */
export function finishSession(cfg: Config, s: GameState, now: number, early = false): SessionResult | null {
  const ss = s.session; if (!ss) return null;
  const done = Math.min(ss.durMs, Math.max(0, now - ss.startMs));
  const complete = done >= ss.durMs;
  if (!complete && !early) return null;
  s.session = undefined;
  const report: GainReport = {};
  const hurt = wounded(cfg, s);
  const gameDone = gameOf(ss, done);
  if (ss.kind === "act") {
    const boost = boostOf(ss);
    applyHours(cfg, s, ss.id, gameDone / 3_600_000, report, boost);
    log(s, `${ss.label} (${fmtDur(gameDone)}${complete ? "" : ", yarıda"}${boost > 1.01 ? `, odak ×${boost.toFixed(1)}` : ""}): ${summarize(cfg, report)}`, "gain");
    return { label: ss.label, gains: report, minutes: gameDone / 60_000, early: !complete, kind: "act", wounded: hurt, boost };
  }
  const c = craftById(ss.id)!;
  if (!complete) {
    for (const [id, n] of Object.entries(c.needs)) addItem(cfg, s, id, n); // malzemeler geri
    s.minute = Math.min(DAY_MINUTES, s.minute + gameDone / 60_000);
    log(s, "El işini yarıda bıraktın; malzemeleri geri topladın.", "info");
    return { label: c.id, gains: report, minutes: gameDone / 60_000, early: true, kind: "craft", wounded: hurt };
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
