// Config editöründen gelen oyun config'inin tipleri ve hızlı erişim indeksleri.
import raw from "../config/oyun-config.json";
import { EXTRA_SPELLS } from "../content/spells";
import { synthSpells } from "../content/synthesis";
import { EXTRA_ATTRS } from "../content/attrs";

export interface Link { w: number }
export interface Attribute {
  id: string; name: string; cat?: string; base?: number; max?: number; learnRate?: number;
  diminish?: number; decayRate?: number; decayFloor?: number;   // decay*: editörden gelir, oyunda kullanılmaz (körelme kapalı)
  desc?: string;
  params?: Record<string, number | string>;
  transfers: { to: string; w: number }[];
  derivedTerms: { to: string; w: number }[];
}
export interface Activity {
  id: string; name: string; kind?: "aktivite" | "ders" | "kullanim"; duration?: number; fatigue?: number;
  realUse?: number; teacherRep?: number; requirement?: string; desc?: string;
  params?: Record<string, number | string>;
  gains: { attribute: string; w: number }[];
}
export interface Derived {
  id: string; name: string; unit?: string; base?: number; min?: number; max?: number; desc?: string;
  terms: { attribute: string; w: number }[];
}
export interface Environment {
  id: string; name: string; cat?: string; desc?: string;
  modifiersPct: { target: string; w: number }[];
}
export interface Item {
  id: string; name: string; slot?: string; weight?: number; durability?: number; familiarity?: number;
  value?: number; desc?: string; params?: Record<string, number | string>;
  bonuses: { target: string; w: number }[];
}
export interface Category { id: string; name: string; color?: string }
export interface Giver { id: string; name: string; wealth?: number; minRep?: number; basic?: string; important?: string; vital?: string }
export interface Importance { id: string; name: string; mult?: number; repGain?: number }
export interface RepDim { id: string; name: string; desc?: string; min?: number; max?: number }
export interface Element { id: string; name: string; color?: string; state?: string; temperature?: number; manaCost?: number; mastery?: string; desc?: string }
export interface Combo { id: string; name: string; color?: string; kind?: string; state?: string; temperature?: number; manaMult?: number; minMastery?: number; desc?: string; ingredients: { id: string; ratio: number }[]; manaTotal?: number }
export interface Spell { id: string; name: string; desc?: string; mastery?: string; minMastery?: number; manaCost?: number; castTime?: number; range?: number; area?: number; damage?: number; duration?: number; focusNeed?: number; effect?: string; sources: { id: string; amount: number }[] }

export interface GameConfig {
  attributeCategories: Category[]; environmentCategories: Category[];
  attributes: Attribute[]; activities: Activity[]; derived: Derived[]; environment: Environment[];
  elements: Element[]; combos: Combo[]; spells: Spell[]; items: Item[];
  reputation: { dimensions: RepDim[]; questImportance: Importance[]; givers: Giver[] };
}

export class Config {
  readonly data: GameConfig;
  readonly attr = new Map<string, Attribute>();
  readonly act = new Map<string, Activity>();
  readonly der = new Map<string, Derived>();
  readonly env = new Map<string, Environment>();
  readonly item = new Map<string, Item>();
  readonly cat = new Map<string, Category>();
  readonly spell = new Map<string, Spell>();
  readonly element = new Map<string, Element>();
  readonly combo = new Map<string, Combo>();
  constructor(data: GameConfig) {
    this.data = data;
    for (const a of data.attributes) this.attr.set(a.id, a);
    for (const a of data.activities) this.act.set(a.id, a);
    for (const d of data.derived) this.der.set(d.id, d);
    for (const e of data.environment) this.env.set(e.id, e);
    for (const i of data.items) this.item.set(i.id, i);
    for (const c of data.attributeCategories) this.cat.set(c.id, c);
    for (const x of data.spells) this.spell.set(x.id, x);
    for (const x of data.elements) this.element.set(x.id, x);
    for (const x of data.combos) this.combo.set(x.id, x);
  }
  giver(id: string) { return this.data.reputation.givers.find(g => g.id === id); }
  importance(id: string) { return this.data.reputation.questImportance.find(i => i.id === id); }
}

// editörde olmayan kadim çağrılar (src/content/spells.ts) config'e eklenir
const merged = raw as unknown as GameConfig;
export const config = new Config({ ...merged, attributes: [...merged.attributes, ...EXTRA_ATTRS.filter(x => !merged.attributes.some(y => y.id === x.id))], spells: [...merged.spells, ...EXTRA_SPELLS.filter(x => !merged.spells.some(y => y.id === x.id)), ...synthSpells().spells] });
