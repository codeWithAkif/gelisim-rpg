// Yolculuk: yerler arası en kısa yol, süre ve yorgunluk. Yürümek bacağı ve dayanıklılığı geliştirir.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log, minutesLeft } from "./state";
import { applyGain, type GainReport } from "./progression";
import { PLACES, ROADS, NPC_PLACE, ACTIVITY_PLACES, type Place } from "../content/map";
import { teacherOf } from "../content/world";
import { markSeen, isSeen } from "./explore";

export const place = (id: string) => PLACES.find(p => p.id === id);
export const here = (s: GameState): Place => place(s.location) ?? PLACES[0];
const len = (pts: [number, number][]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
/** Harita birimi → dakika (yayladan meydana yaklaşık bir saat). */
const MIN_PER_UNIT = 0.36;

export function isOpen(p: Place) { return p.region !== "uzak"; }

/** En kısa yol: yer sırası ve çizilecek noktalar. */
export function route(from: string, to: string): { places: string[]; pts: [number, number][]; length: number } | null {
  const dist = new Map<string, number>([[from, 0]]); const prev = new Map<string, { via: string; road: (typeof ROADS)[number]; rev: boolean }>();
  const open = new Set(PLACES.filter(isOpen).map(p => p.id)); open.add(from); open.add(to);
  const q = [from]; const done = new Set<string>();
  while (q.length) {
    q.sort((a, b) => dist.get(a)! - dist.get(b)!); const cur = q.shift()!; if (done.has(cur)) continue; done.add(cur);
    if (cur === to) break;
    for (const r of ROADS) {
      const next = r.a === cur ? r.b : r.b === cur ? r.a : null;
      if (!next || !open.has(next) || done.has(next)) continue;
      const d = dist.get(cur)! + len(r.pts);
      if (d < (dist.get(next) ?? Infinity)) { dist.set(next, d); prev.set(next, { via: cur, road: r, rev: r.b === cur }); q.push(next); }
    }
  }
  if (!dist.has(to)) return null;
  const places = [to]; const pts: [number, number][] = [];
  let k = to;
  while (k !== from) { const p = prev.get(k)!; const seg = p.rev ? [...p.road.pts].reverse() : p.road.pts; pts.unshift(...seg.slice(1)); places.unshift(p.via); k = p.via; }
  pts.unshift(place(from) ? [place(from)!.x, place(from)!.y] : [0, 0]);
  return { places, pts, length: dist.get(to)! };
}

export interface TravelPlan { ok: boolean; reason?: string; minutes: number; energy: number; pts: [number, number][] }
export function planTravel(cfg: Config, s: GameState, to: string): TravelPlan {
  const p = place(to);
  if (!p) return { ok: false, reason: "Böyle bir yer yok", minutes: 0, energy: 0, pts: [] };
  if (!isOpen(p)) return { ok: false, reason: `${p.chapter ?? "İleride"} açılacak`, minutes: 0, energy: 0, pts: [] };
  if (to === s.location) return { ok: false, reason: "Zaten buradasın", minutes: 0, energy: 0, pts: [] };
  if (!isSeen(s, to)) return { ok: false, reason: "Henüz bilmediğin bir yer", minutes: 0, energy: 0, pts: [] };
  const r = route(s.location, to); if (!r) return { ok: false, reason: "Oraya yol yok", minutes: 0, energy: 0, pts: [] };
  const speed = 1 + ((s.attrs.bacak?.level ?? 10) - 10) / 80 + ((s.attrs.kardiyo?.level ?? 10) - 10) / 160;
  const minutes = Math.max(5, Math.round(r.length * MIN_PER_UNIT / speed));
  const energy = Math.round(minutes / 60 * 5 * 10) / 10;
  if (s.session) return { ok: false, reason: "Çalışırken yola çıkamazsın", minutes, energy, pts: r.pts };
  if (s.journey) return { ok: false, reason: "Zaten yoldasın", minutes, energy, pts: r.pts };
  if (minutes > minutesLeft(s)) return { ok: false, reason: "Hava kararmadan varamazsın", minutes, energy, pts: r.pts };
  if (energy > s.energy) return { ok: false, reason: "Yürüyecek gücün yok", minutes, energy, pts: r.pts };
  return { ok: true, minutes, energy, pts: r.pts };
}

export function travel(cfg: Config, s: GameState, to: string): { gains: GainReport; minutes: number } | null {
  const p = planTravel(cfg, s, to); if (!p.ok) return null;
  const h = p.minutes / 60; const gains: GainReport = {};
  applyGain(cfg, s, "bacak", 0.15 * h, gains); applyGain(cfg, s, "kardiyo", 0.1 * h, gains); applyGain(cfg, s, "mekansal", 0.05 * h, gains);
  s.minute = Math.min(DAY_MINUTES, s.minute + p.minutes);
  s.energy = Math.max(0, s.energy - p.energy); s.satiety = Math.max(0, s.satiety - h * 4);
  s.location = to; markSeen(s, to);
  log(s, `Vardın: ${place(to)!.name} (${p.minutes} dk yol).`, "info");
  return { gains, minutes: p.minutes };
}

/** Bir çalışma bu yerde yapılabilir mi? Değilse nereye gitmeli. */
export function activityPlace(actId: string): string[] | null {
  const t = teacherOf(actId);
  if (t) return [NPC_PLACE[t.id]];
  return ACTIVITY_PLACES[actId] ?? null;
}
export function npcHere(s: GameState, npcId: string) { return NPC_PLACE[npcId] === s.location; }
export function peopleAt(placeId: string) { return Object.entries(NPC_PLACE).filter(([, p]) => p === placeId).map(([n]) => n); }
