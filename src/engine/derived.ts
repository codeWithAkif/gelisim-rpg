// Türetilmiş değerler (kritik, kaçınma, isabet…) = taban + Σ katsayı × özellik,
// sonra ekipman bonusu, sonra ortam yüzdesi. Anatomi bilgisi hedefin türüne göre seçilir.
import type { Config } from "./config";
import type { GameState } from "./state";

export interface Context {
  envIds?: string[];                 // o an etkili ortam etkenleri (hava, ışık, zemin)
  targetSpecies?: "hayvan" | "insan";
  equipped?: string[];               // takılı config eşyaları
}

const ANATOMY_FOR: Record<string, string> = { hayvan: "anatomi_hayvan", insan: "anatomi_insan" };

/** Bir hedefe ortamın yaptığı toplam yüzde değişim. */
export function envPct(cfg: Config, ctx: Context, target: string): number {
  let p = 0;
  for (const id of ctx.envIds ?? []) for (const m of cfg.env.get(id)?.modifiersPct ?? []) if (m.target === target) p += m.w;
  return p;
}
function itemBonus(cfg: Config, ctx: Context, target: string): number {
  let b = 0;
  for (const id of ctx.equipped ?? []) for (const m of cfg.item.get(id)?.bonuses ?? []) if (m.target === target) b += m.w;
  return b;
}

/** Bir özelliğin bu bağlamdaki etkin değeri. */
export function effectiveAttr(cfg: Config, s: GameState, id: string, ctx: Context = {}): number {
  const lv = s.attrs[id]?.level ?? 0;
  return Math.max(0, (lv + itemBonus(cfg, ctx, id)) * (1 + envPct(cfg, ctx, id) / 100));
}

export interface DerivedBreakdown { value: number; base: number; terms: { name: string; amount: number }[]; envPct: number; items: number }

export function derived(cfg: Config, s: GameState, id: string, ctx: Context = {}): DerivedBreakdown {
  const d = cfg.der.get(id);
  if (!d) return { value: 0, base: 0, terms: [], envPct: 0, items: 0 };
  const terms: { name: string; amount: number }[] = [];
  let v = d.base ?? 0;
  for (const t of d.terms) {
    let attr = t.attribute;
    if (attr.startsWith("anatomi_") && ctx.targetSpecies) attr = ANATOMY_FOR[ctx.targetSpecies] ?? attr;
    const amount = t.w * effectiveAttr(cfg, s, attr, ctx);
    v += amount;
    terms.push({ name: cfg.attr.get(attr)?.name ?? attr, amount });
  }
  const items = itemBonus(cfg, ctx, id);
  v += items;
  const ep = envPct(cfg, ctx, id);
  v *= 1 + ep / 100;
  v = Math.max(d.min ?? -Infinity, Math.min(d.max ?? Infinity, v));
  return { value: v, base: d.base ?? 0, terms, envPct: ep, items };
}
