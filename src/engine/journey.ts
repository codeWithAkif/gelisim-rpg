// Yolculuk haritada gerçek zamanlı ama sıkıştırılmış ilerler: oyunda 1 saatlik yol ≈ 10 sn.
// Oyun saati yolun gerçek süresi kadar ilerler. Yolda sürprizler çıkar; bir sürpriz gelince
// yolculuk durur, oyuncu seçince devam eder. Uygulama kapalıyken de ilerler.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, addRep, hourOf, isNight, log } from "./state";
import { applyGain, type GainReport } from "./progression";
import { planTravel, place, route, arrive } from "./travel";
import { addItem } from "./inventory";
import { Rng } from "./rng";
import { ROADS } from "../content/map";
import { TRAVEL_EVENTS, type TravelEventDef } from "../content/travel-events";

export interface JourneyEvent { id: string; at: number; done?: boolean }
/** Oyundaki bir dakika yolun haritada kaç milisaniye sürdüğü (60 dk ≈ 10 sn). */
export const MS_PER_GAME_MIN = 170;
const realMs = (min: number) => Math.max(3000, min * MS_PER_GAME_MIN);
export interface Journey {
  from: string; to: string; pts: [number, number][];
  startMs: number; durMs: number; pausedAt?: number; pausedMs: number;
  minutes: number; energy: number; spentMin: number;   // spentMin: geri dönüşten önce yürünen
  events: JourneyEvent[]; seed: number; back?: boolean;
}

function hasPatika(from: string, to: string, s?: GameState): boolean {
  const r = route(from, to, s); if (!r) return false;
  for (let i = 1; i < r.places.length; i++) {
    const a = r.places[i - 1], b = r.places[i];
    if (ROADS.some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.kind === "patika")) return true;
  }
  return false;
}
function eligible(s: GameState, def: TravelEventDef, patika: boolean, minutes: number): boolean {
  const w = def.when; if (!w) return true;
  if (w.patika && !patika) return false;
  if (w.minMinutes && minutes < w.minMinutes) return false;
  if (w.night && hourOf(s) < 19) return false;
  return true;
}

export function startJourney(cfg: Config, s: GameState, to: string, now: number): { ok: boolean; reason?: string } {
  if (s.journey) return { ok: false, reason: "Zaten yoldasın" };
  const p = planTravel(cfg, s, to); if (!p.ok) return { ok: false, reason: p.reason };
  const rng = new Rng((now ^ (s.seed * 31)) | 0);
  const patika = hasPatika(s.location, to, s);
  const pool = TRAVEL_EVENTS.filter(d => eligible(s, d, patika, p.minutes));
  const events: JourneyEvent[] = [];
  // gece yollar tehlikeli: sürpriz daha sık, kurtlar daha çok
  const night = isNight(s);
  // kedi (bağ 30) gece pusularını sezer, şahin (bağ 50) yoldaki tehlikeyi önceden haber verir
  const pet = s.pet, pb = pet?.bond ?? 0; const petCut = (pet?.id === "kedi" && pb >= 30 && night ? 0.7 : 1) * (pet?.id === "sahin" && pb >= 50 ? 0.7 : 1);
  const chance = Math.min(night ? 95 : 85, p.minutes / 60 * 70 * (night ? 1.6 : 1)) * petCut;
  const wt = (d: TravelEventDef) => d.weight * (night && ["kurt", "iz", "suru"].includes(d.id) ? 3 : 1);
  const pick = () => { const total = pool.reduce((a, d) => a + wt(d), 0); let r = rng.next() * total; for (const d of pool) { r -= wt(d); if (r <= 0) return d; } return pool[0]; };
  if (pool.length && rng.chance(chance)) events.push({ id: pick().id, at: 0.2 + rng.next() * 0.3 });
  if (pool.length && events.length && rng.chance(chance * 0.4)) { const d = pick(); if (d.id !== events[0].id) events.push({ id: d.id, at: 0.55 + rng.next() * 0.3 }); }
  s.journey = { from: s.location, to, pts: p.pts, startMs: now, durMs: realMs(p.minutes), pausedMs: 0, minutes: p.minutes, energy: p.energy, spentMin: 0, events, seed: rng.seed };
  log(s, `Yola çıktın: ${place(to)!.name} (${p.minutes} dk).`, "info");
  return { ok: true };
}

export function journeyProgress(s: GameState, now: number): number {
  const j = s.journey; if (!j) return 0;
  const t = (j.pausedAt ?? now) - j.startMs - j.pausedMs;
  return Math.max(0, Math.min(1, t / j.durMs));
}
export function journeyLeftMs(s: GameState, now: number): number {
  const j = s.journey; if (!j) return 0;
  return Math.max(0, j.durMs - ((j.pausedAt ?? now) - j.startMs - j.pausedMs));
}
/** Haritadaki konum (yol üzerindeki nokta). */
export function journeyPoint(s: GameState, now: number): [number, number] {
  const j = s.journey!; const f = journeyProgress(s, now);
  const segs = j.pts.slice(1).map((p, i) => Math.hypot(p[0] - j.pts[i][0], p[1] - j.pts[i][1]));
  let d = f * segs.reduce((a, b) => a + b, 0); let i = 0;
  while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
  const a = j.pts[i], b = j.pts[i + 1] ?? a; const u = segs[i] ? d / segs[i] : 1;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
/** Sırası gelmiş, çözülmemiş sürpriz. */
export function dueEvent(s: GameState, now: number): { ev: JourneyEvent; def: TravelEventDef } | null {
  const j = s.journey; if (!j) return null;
  const f = journeyProgress(s, now);
  const ev = j.events.find(e => !e.done && e.at <= f);
  return ev ? { ev, def: TRAVEL_EVENTS.find(d => d.id === ev.id)! } : null;
}
export function pauseJourney(s: GameState, now: number) { const j = s.journey; if (j && j.pausedAt === undefined) { const f = journeyProgress(s, now); const ev = j.events.find(e => !e.done && e.at <= f); j.pausedAt = ev ? j.startMs + j.pausedMs + ev.at * j.durMs : now; } }
export function resumeJourney(s: GameState, now: number) { const j = s.journey; if (j && j.pausedAt !== undefined) { j.pausedMs += now - j.pausedAt; j.pausedAt = undefined; } }

export function canUseChoice(s: GameState, need?: string): boolean {
  if (need === "ates") return s.knownElements.includes("el_ates") && s.mana >= 8;
  return true;
}

export interface EventOutcome { text: string; gains: GainReport; battle?: boolean; foes?: string[] }
/** Seçimi uygular. Ek süre (dakika) yolculuğa gerçek zamanlı eklenir. */
export function resolveEvent(cfg: Config, s: GameState, choice: string, now: number): EventOutcome {
  const due = dueEvent(s, now) ?? (s.journey ? (() => { const ev = s.journey!.events.find(e => !e.done); return ev ? { ev, def: TRAVEL_EVENTS.find(d => d.id === ev.id)! } : null; })() : null);
  const gains: GainReport = {};
  if (!due || !s.journey) return { text: "", gains };
  const j = s.journey; const rng = new Rng(j.seed); due.ev.done = true;
  const extra = (min: number) => { j.durMs += min * MS_PER_GAME_MIN; j.minutes += min; };
  const lv = (a: string) => s.attrs[a]?.level ?? 0;
  let text = ""; let battle = false;
  const wolf = s.region === "ayazkale" ? "kar_kurdu" : "kurt";
  let foes: string[] = [wolf];
  switch (`${due.def.id}:${choice}`) {
    case "kenevir:topla": extra(15); text = addItem(cfg, s, "ip", 1) ? "Lifleri büktün ama çantanda yer yoktu." : "Lifleri büküp bir ip yaptın."; applyGain(cfg, s, "el_becerisi", 0.1, gains); break;
    case "elma:topla": extra(10); { const d = addItem(cfg, s, "elma", 2); text = d === 2 ? "Elmaları taşıyacak yerin yoktu." : `${2 - d} yaban elması topladın.`; } break;
    case "bakir:al": s.money += 3; text = "Üç bakırı cebine koydun."; break;
    case "bakir:teslim": addRep(s, "taspinar", "guven", 1); addRep(s, "taspinar", "onur", 0.5); text = "Bakırları ayırdın; muhtara bırakacaksın. Duyan güvenir."; break;
    case "kurt:savas": text = "Kurdun karşısına dikildin."; battle = true; break;
    case "suru:savas": text = "Sırtını bir kayaya verdin; sürü çember çiziyor."; battle = true; foes = [wolf, wolf, wolf]; break;
    case "suru:ates":
      if (canUseChoice(s, "ates")) { s.mana -= 8; applyGain(cfg, s, "ates", 0.4, gains); applyGain(cfg, s, "stres", 0.3, gains); text = "Alevi başının üstüne kaldırdın; gözler birer birer karanlığa çekildi."; }
      else { text = "Alev tutmadı; sürü üstüne geldi!"; battle = true; foes = [wolf, wolf, wolf]; }
      break;
    case "kurt:geri": {
      const ok = rng.chance(Math.min(90, 40 + lv("irade") * 1.2 + lv("stres") * 0.8));
      applyGain(cfg, s, "stres", 0.2, gains); applyGain(cfg, s, "irade", 0.15, gains);
      if (ok) { extra(15); text = "Gözünü ayırmadan geri çekildin; kurt peşine düşmedi. Dolambaçlı yoldan devam ettin."; }
      else { text = "Bir adım fazla hızlı attın; kurt üstüne atıldı!"; battle = true; }
      break;
    }
    case "kurt:ates":
      if (canUseChoice(s, "ates")) { s.mana -= 8; applyGain(cfg, s, "ates", 0.3, gains); text = "Avucunda alev büyüdü; kurt kuyruğunu kısıp kaçtı."; }
      else { text = "Alev tutmadı; kurt atıldı!"; battle = true; }
      break;
    case "yasli:yardim": extra(20); s.energy = Math.max(0, s.energy - 6); applyGain(cfg, s, "ust_govde", 0.15, gains); addRep(s, "taspinar", "taninirlik", 0.5); addRep(s, "taspinar", "guven", 0.5); text = "Odunu evine kadar taşıdın. 'Allah razı olsun evladım' dedi; köyde anlatacak."; break;
    case "satici:ip": if (s.money >= 1) { s.money -= 1; text = addItem(cfg, s, "ip", 1) ? "Çantanda yer yoktu." : "Bir ip aldın."; } else text = "Paran yetmedi."; break;
    case "satici:deri": if (s.money >= 2) { s.money -= 2; text = addItem(cfg, s, "deri", 1) ? "Çantanda yer yoktu." : "Bir deri aldın."; } else text = "Paran yetmedi."; break;
    case "iz:incele": extra(10); applyGain(cfg, s, "iz_surme", 0.3, gains); applyGain(cfg, s, "analiz", 0.2, gains); applyGain(cfg, s, "koku", 0.1, gains); text = "İki kurt, biri topal. Yönleri yaylaya doğru."; break;
    case "saganak:sigin": extra(20); text = "Ağacın altında sağanağın dinmesini bekledin."; break;
    case "saganak:devam": s.energy = Math.max(0, s.energy - 4); applyGain(cfg, s, "irade", 0.1, gains); text = "Sırılsıklam devam ettin; üşüdün ama vakit kaybetmedin."; break;
    case "tokez:devam":
      if (rng.chance(Math.min(92, 50 + lv("refleks") * 1.5))) { applyGain(cfg, s, "refleks", 0.1, gains); text = "Son anda dengeni buldun."; }
      else { s.hp = Math.max(1, (s.hp || 1) - 3); applyGain(cfg, s, "agri", 0.1, gains); text = "Bileğin burkuldu. Canın 3 azaldı."; }
      break;
    default: text = "Yoluna devam ettin.";
  }
  j.seed = rng.seed;
  log(s, `${due.def.title}: ${text}`, "info");
  return { text, gains, battle, foes: battle ? foes : undefined };
}

/** Varınca: süre, yorgunluk, yürüme kazancı ve konum. */
export function finishJourney(cfg: Config, s: GameState, now: number): { to: string; minutes: number; gains: GainReport } | null {
  const j = s.journey; if (!j || j.pausedAt !== undefined || journeyProgress(s, now) < 1 || dueEvent(s, now)) return null;
  const total = j.minutes + j.spentMin; const h = total / 60; const gains: GainReport = {};
  applyGain(cfg, s, "bacak", 0.15 * h, gains); applyGain(cfg, s, "kardiyo", 0.1 * h, gains); applyGain(cfg, s, "mekansal", 0.05 * h, gains);
  s.minute = Math.min(DAY_MINUTES, s.minute + total);
  s.energy = Math.max(0, s.energy - j.energy * (total / Math.max(1, j.minutes)) * (isNight(s) ? 1.25 : 1));
  s.satiety = Math.max(0, s.satiety - h * 4);
  s.journey = undefined; arrive(s, j.to);
  log(s, `Vardın: ${place(j.to)!.name} (${Math.round(total)} dk yol).`, "info");
  return { to: j.to, minutes: total, gains };
}

/** Geri dön: o ana kadar yürüdüğün yoldan, aynı sürede başladığın yere. */
export function turnBack(s: GameState, now: number): boolean {
  const j = s.journey; if (!j || j.back) return false;
  const f = journeyProgress(s, now); const elapsedMin = f * j.minutes;
  const here = journeyPoint(s, now);
  const segs = j.pts.slice(1).map((p, i) => Math.hypot(p[0] - j.pts[i][0], p[1] - j.pts[i][1]));
  let d = f * segs.reduce((a, b) => a + b, 0); let i = 0; while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
  const back: [number, number][] = [here, ...j.pts.slice(0, i + 1).reverse()];
  s.journey = { from: j.to, to: j.from, pts: back, startMs: now, durMs: Math.max(1500, elapsedMin * MS_PER_GAME_MIN), pausedMs: 0, minutes: Math.max(1 / 60, elapsedMin), energy: j.energy * f, spentMin: elapsedMin, events: [], seed: j.seed, back: true };
  return true;
}
