// Karşılaşmalar: kaç düşman çıkar, gece ne değişir, hangi savaş şekilleriyle karşılanır.
// Her karşılaşmada (görev savaşı ya da yolda pusu) oyuncu nasıl savaşacağını seçer:
// göğüs göğüse (altıgen taktik savaş), barikat kur (dalga savunması), gizlen (sız, pusu kur ya da kaç).
import type { GameState } from "./state";
import { isNight } from "./state";
import { Rng } from "./rng";
import { ENEMIES } from "../content/world";
import type { SiegeDef } from "./siege";

export const isBoss = (id: string) => (ENEMIES[id]?.scale ?? 1) > 1;
export const isHuman = (id: string) => ENEMIES[id]?.species === "insan";

/** Karşılaşmanın tohumu: aynı gün aynı iş aynı sonucu verir (yeniden açınca değişmez); gece başkadır. */
export function encounterSeed(s: GameState, key: string): number {
  let h = (s.seed ^ (s.day * 2654435761) ^ ((s.quests[key]?.count ?? 0) * 40503) ^ (isNight(s) ? 0x9e37 : 0)) | 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

/**
 * Bu sefer kaç düşman çıkıyor. Lider (büyük düşman) hep oradadır; sürü/devriye sayısı oynar:
 * ilk seferinde en çok yazılan kadar, sonrakilerde bir eksik ya da bir fazla. Gece bir fazla gelir.
 */
export function rollFoes(s: GameState, ids: string[], key: string): string[] {
  const rng = new Rng(encounterSeed(s, key));
  const bosses = ids.filter(isBoss), regular = ids.filter(i => !isBoss(i));
  if (!regular.length) return [...ids];
  const first = (s.quests[key]?.count ?? 0) === 0;
  let n = regular.length + rng.int(-1, first ? 0 : 1);
  if (isNight(s)) n += 1;
  n = Math.max(1, Math.min(regular.length + 2, n));
  const out = Array.from({ length: n }, (_, i) => regular[i] ?? rng.pick(regular));
  return [...bosses, ...out];
}

/** Gece işinin ve fazladan düşmanın getirisi: daha çok para ve tanınırlık. */
export interface Bonus { night: boolean; extraFoes: number }
export function bonusOf(s: GameState, base: string[], actual: string[]): Bonus {
  return { night: isNight(s), extraFoes: Math.max(0, actual.length - base.length) };
}
export function bonusMoney(baseMoney: number, b: Bonus): number {
  return (b.night ? Math.max(2, Math.ceil(baseMoney * 0.6)) : 0) + b.extraFoes * 2;
}

/* ---------- savaş şekilleri ---------- */
export type Mode = "yakin" | "barikat" | "gizlen";
export type Context = "gorev" | "yol";
export interface ModeOption { id: Mode; name: string; desc: string; outcome: string; ok: boolean; reason?: string }
/**
 * Gizlenince ne olur: insan devriyesinden sızarsın (iş savaşsız biter), hayvana ya da lidere
 * gizlice yaklaşıp pusu kurarsın (savaş, onlar seni fark etmeden başlar). Yolda: sıyrılıp kaçarsın.
 */
export function stealthGoal(ids: string[], ctx: Context): "sizma" | "pusu" | "kacis" {
  if (ctx === "yol") return "kacis";
  return ids.every(isHuman) && !ids.some(isBoss) ? "sizma" : "pusu";
}
export function modeOptions(s: GameState, ids: string[], ctx: Context): ModeOption[] {
  const human = ids.some(isHuman); const goal = stealthGoal(ids, ctx);
  const tired = s.energy < 15 ? "Bu yorgunlukla olmaz; dinlen." : undefined;
  return [
    { id: "yakin", name: "Göğüs göğüse", desc: "Araziyi oku, nereden gireceğini seç, sırayla vuruş.", outcome: "Hepsini yenersen iş biter.", ok: !tired, reason: tired },
    { id: "barikat", name: "Barikat kur", desc: `Kazık çak, ${s.pet ? "köpeğini yerleştir, " : ""}dalga dalga gelenleri ok ve büyüyle karşıla.`,
      outcome: ctx === "yol" ? "Atlatırsan yoluna devam edersin." : "Dalgaları kırarsan iş biter. Barikat görünce yenileri de gelir.", ok: !tired, reason: tired },
    { id: "gizlen", name: goal === "kacis" ? "Gizlenip kaç" : goal === "sizma" ? "Gizlenip sız" : "Gizlenip pusu kur",
      desc: human ? "Muhafızların bakışından uzak dur; çalıların ardından, duvar diplerinden geç." : "Rüzgârın altından git; kurtlar gözden önce kokunu alır.",
      outcome: goal === "kacis" ? "Görünmeden geçersen savaş olmaz." : goal === "sizma" ? "Görünmeden içeri girersen iş savaşsız biter." : "Görünmeden yaklaşırsan savaş, onlar seni fark etmeden başlar.",
      ok: true },
  ];
}

/** Barikat savaşı: karşılaşmanın düşmanlarından dalgalar kurar. Barikat görünce sürüye yenileri katılır. */
export function siegeFromFoes(name: string, ids: string[], ground: SiegeDef["ground"]): SiegeDef {
  const bosses = ids.filter(isBoss), regular = ids.filter(i => !isBoss(i));
  const kinds = [...new Set(regular.length ? regular : ids)];
  const total = regular.length + 1;
  const waveCount = total <= 3 ? 2 : 3;
  const sizes = Array.from({ length: waveCount }, (_, i) => Math.floor(total / waveCount) + (i < total % waveCount ? 1 : 0)).reverse();
  let k = 0;
  const waves = sizes.map((n, w) => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const d = regular[k] ?? kinds[k % kinds.length]; k++; counts[d] = (counts[d] ?? 0) + 1; }
    if (w === waveCount - 1) for (const b of bosses) counts[b] = (counts[b] ?? 0) + 1;
    return { foes: Object.entries(counts).map(([def, count]) => ({ def, count })), interval: 2.8 - w * 0.45 };
  });
  return { id: "karsilasma", name, ground, waves };
}
export function groundOf(region: string, ids: string[]): SiegeDef["ground"] {
  if (region === "ayazkale" || ids.includes("kar_kurdu")) return "kar";
  return ids.some(isHuman) ? "tas" : "cayir";
}
