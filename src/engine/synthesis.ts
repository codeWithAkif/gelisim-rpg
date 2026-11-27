// Büyü sentezi kuralları: çizilen element işaretlerinden madde, son işaretten biçim; ikisinden büyü.
// Keşif: yeni bir hücre ilk kez başarıyla yapılınca deftere yazılır (s.spellbook). Deney: savaş dışında,
// mana ve zaman harcayarak dener; söner (ipucu) ya da elinde patlar. DOM yok.
import type { Config } from "./config";
import type { GameState } from "./state";
import { DAY_MINUTES } from "./state";
import { MOTHER_PAGES, motherPage, type MotherPage } from "../content/mother-pages";
import { MATTERS, FORMS, CLASHES, BOOK_CELLS, formMismatch, generateSpell, matter, form, type Matter, type FormId } from "../content/synthesis";

export const elementName = (cfg: Config, id: string) => cfg.element.get(id)?.name ?? id;

/** Çizilen element işaretlerinden madde (sıra önemsiz). */
export function matterOf(els: string[]): { matter?: Matter; reason?: string } {
  if (!els.length) return { reason: "Önce maddenin işaretlerini çiz." };
  if (new Set(els).size !== els.length) return { reason: "Aynı işareti iki kez çizdin; madde koyulaşmaz, dağılır." };
  const key = [...els].sort().join("|");
  const m = MATTERS.find(x => x.els.join("|") === key); if (m) return { matter: m };
  if (els.length === 2 && CLASHES[key]) return { reason: CLASHES[key] };
  return { reason: els.length > 3 ? "Bu kadar işareti aynı anda tutamazsın." : "Bu karışımı kimse dengeleyemez; işaretler birbirini itiyor." };
}
/** Hücrenin büyüsü: kitaptaki büyü ya da kuraldan çıkan. */
export function cellSpellId(m: Matter, f: FormId): string | null {
  return BOOK_CELLS[`${m.id}|${f}`] ?? (generateSpell(m, form(f)!) ? `sy_${m.id}_${f}` : null);
}
/** Bir büyünün çizilecek dizisi: element işaretleri, en sonda biçim işareti. */
export function spellSequence(spellId: string): { els: string[]; form: FormId } | null {
  for (const [k, id] of Object.entries(BOOK_CELLS)) if (id === spellId) { const [mm, ff] = k.split("|"); return { els: matter(mm)!.els, form: ff as FormId }; }
  const m = /^sy_(.+)_(top|duvar|akinti|zincir|perde|firlat)$/.exec(spellId); if (!m) return null;
  const mt = matter(m[1]); return mt ? { els: mt.els, form: m[2] as FormId } : null;
}

export interface SynthResult { ok: boolean; spellId?: string; reason?: string; matter?: Matter; form?: FormId }
/** Dizinin anlamı: bilgi şartları dahil (ustalık ve mana büyüyü yaparken bakılır). */
export function synthesize(s: GameState, els: string[], f: FormId): SynthResult {
  const mo = matterOf(els); if (!mo.matter) return { ok: false, reason: mo.reason };
  const m = mo.matter;
  const missing = m.els.filter(e => !s.knownElements.includes(e));
  if (missing.length) return { ok: false, matter: m, form: f, reason: "Defterinde bu işaretin sayfası yok." };
  if (f === "firlat" && !s.knownElements.includes("el_hava")) return { ok: false, matter: m, form: f, reason: "Fırlatmak için havanın sayfası gerekir." };
  const mis = formMismatch(m, f); if (mis) return { ok: false, matter: m, form: f, reason: mis };
  const id = cellSpellId(m, f); if (!id) return { ok: false, matter: m, form: f, reason: "Bu biçim bu maddeyle olmuyor." };
  return { ok: true, spellId: id, matter: m, form: f };
}
/** Deftere yazar; yeni mi? */
export function discover(s: GameState, spellId: string): boolean {
  s.spellbook ??= []; if (s.spellbook.includes(spellId)) return false; s.spellbook.push(spellId); return true;
}
export const discovered = (s: GameState) => s.spellbook ?? [];

/* ---------- deney: savaş dışında bir diziyi denemek ---------- */
export const EXPERIMENT = { mana: 6, minutes: 10 };
export interface ExperimentResult { kind: "yeni" | "bilinen" | "soner" | "patladi"; text: string; spellId?: string; hp?: number }
export function experiment(cfg: Config, s: GameState, els: string[], f: FormId): ExperimentResult | { error: string } {
  if (!s.knownElements.length) return { error: "Defterinde büyü sayfası yok" };
  if (s.journey) return { error: "Yoldayken deney yapılmaz" };
  if (s.mana < EXPERIMENT.mana) return { error: `Mana yetmiyor (${Math.floor(s.mana)}/${EXPERIMENT.mana})` };
  if (s.minute + EXPERIMENT.minutes > DAY_MINUTES) return { error: "Gün bitiyor; önce uyu" };
  s.mana -= EXPERIMENT.mana; s.minute += EXPERIMENT.minutes;
  const r = synthesize(s, els, f);
  if (r.ok) {
    const fresh = discover(s, r.spellId!); const sp = cfg.spell.get(r.spellId!);
    return { kind: fresh ? "yeni" : "bilinen", spellId: r.spellId, text: fresh ? `${sp?.name ?? "Yeni bir büyü"}! Avucunda bir an durdu. Deftere yazdın.` : `${sp?.name ?? "Bu büyü"}: bunu zaten biliyorsun.` };
  }
  // birbirini iten işaretler ya da tutulamayan karışım elde patlar
  if (!r.matter) { const dmg = 3; s.hp = Math.max(1, (s.hp || 1) - dmg); return { kind: "patladi", hp: dmg, text: `${r.reason} İşaretler avucunda patladı (−${dmg} can).` }; }
  return { kind: "soner", text: `Söndü. ${r.reason}` };
}
/** Bütün geçerli hücrelerin sayısı (defterin "kaç büyü var" sayacı). */
export function cellCount(): number { let n = 0; for (const m of MATTERS) for (const f of FORMS) if (cellSpellId(m, f.id)) n++; return n; }

/* ---------- annenin deney sayfaları ---------- */
export const pageFound = (s: GameState, id: string) => s.story.flags["sayfa_" + id] !== undefined;
export const pageSolved = (s: GameState, p: MotherPage) => (s.spellbook ?? []).includes(p.spell);
/** Bu yerde alınabilecek sayfalar (hikâye o noktaya geldiyse, henüz alınmadıysa). */
export const pagesAt = (s: GameState, placeId: string) => MOTHER_PAGES.filter(p => p.place === placeId && s.story.reached.includes(p.after) && !pageFound(s, p.id));
/** Açılmış ama henüz alınmamış sayfalar (nerede olduklarını söylemek için). */
export const pagesWaiting = (s: GameState) => MOTHER_PAGES.filter(p => s.story.reached.includes(p.after) && !pageFound(s, p.id));
export function takePage(s: GameState, id: string): MotherPage | null {
  const p = motherPage(id); if (!p || pageFound(s, id) || s.location !== p.place || !s.story.reached.includes(p.after)) return null;
  s.story.flags["sayfa_" + id] = s.day; return p;
}
