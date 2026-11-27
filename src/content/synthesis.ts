// Büyü sentezi: madde × biçim. "Büyü dua değil, hesap." Bir büyünün gücü maddenin fiziğinden gelir.
// Madde: annenin elementleri ve birleşimleri (birleşimler config'de; dördü burada, editörde karşılığı yok).
// Biçim: çizilen son rün. Hücre başına ya kitaptaki bir büyü (config) ya da kuraldan üretilen bir büyü düşer.
// Kurallar engine/synthesis.ts içinde; burası saf veri ve üretici.
import type { Spell } from "../engine/config";

export type FormId = "top" | "duvar" | "akinti" | "zincir" | "perde" | "firlat";
export interface Form { id: FormId; name: string; rune: string; suffix: string; desc: string; cost: number; diff: number }
export const FORMS: Form[] = [
  { id: "top", name: "Top", rune: "Daire", suffix: "topu", desc: "Tek hedefe vurur.", cost: 0, diff: 0 },
  { id: "duvar", name: "Duvar", rune: "Yatay çizgi", suffix: "duvarı", desc: "Önüne engel kurar.", cost: 4, diff: 4 },
  { id: "akinti", name: "Akıntı", rune: "Köşe", suffix: "akıntısı", desc: "Yere yayılır; alan ve yavaşlatma.", cost: 5, diff: 6 },
  { id: "zincir", name: "Zincir", rune: "Sekiz", suffix: "zinciri", desc: "Hedeften hedefe sıçrar.", cost: 5, diff: 8 },
  { id: "perde", name: "Perde", rune: "Dikey çizgi", suffix: "perdesi", desc: "Görüşü kapatır.", cost: 4, diff: 4 },
  { id: "firlat", name: "Fırlatma", rune: "Çatı", suffix: "yağmuru", desc: "Havaya atar; geç düşer, sert vurur. Hava sayfası gerekir.", cost: 8, diff: 12 },
];
export const form = (id: string) => FORMS.find(f => f.id === id);

/** Maddenin fiziği: ısı (-1 soğuk … 1 sıcak), kütle, iletkenlik, yayılma, katılık (0–1). */
export interface Matter { id: string; name: string; els: string[]; mastery: string; heat: number; mass: number; conduct: number; spread: number; solid: number }
const M = (id: string, name: string, els: string[], mastery: string, heat: number, mass: number, conduct: number, spread: number, solid: number): Matter =>
  ({ id, name, els: [...els].sort(), mastery, heat, mass, conduct, spread, solid });
export const MATTERS: Matter[] = [
  M("el_ates", "Ateş", ["el_ates"], "ates", 1, 0.1, 0, 0.3, 0),
  M("el_su", "Su", ["el_su"], "su_buyu", 0, 0.5, 0.3, 0.6, 0),
  M("el_toprak", "Kaya", ["el_toprak"], "toprak_buyu", 0, 1, 0, 0.1, 1),
  M("el_hava", "Rüzgâr", ["el_hava"], "hava_buyu", 0, 0, 0, 1, 0),
  M("el_ayaz", "Ayaz", ["el_ayaz"], "ayaz_buyu", -1, 0.1, 0, 0.5, 0),
  M("el_simsek", "Şimşek", ["el_simsek"], "simsek_buyu", 0.3, 0, 1, 0.2, 0),
  // config birleşimleri
  M("magma", "Magma", ["el_ates", "el_toprak"], "toprak_buyu", 1, 0.9, 0.1, 0.4, 0.3),
  M("buhar", "Buhar", ["el_ates", "el_su"], "su_buyu", 0.5, 0.1, 0.2, 0.9, 0),
  M("c_buz", "Buz", ["el_su", "el_ayaz"], "ayaz_buyu", -0.8, 0.8, 0.1, 0.1, 1),
  M("c_camur", "Çamur", ["el_su", "el_toprak"], "toprak_buyu", 0, 0.7, 0.2, 0.5, 0.4),
  M("kum_firtinasi", "Kum", ["el_hava", "el_toprak"], "hava_buyu", 0, 0.6, 0, 0.9, 0.2),
  M("yangin_kasirgasi", "Alev", ["el_ates", "el_hava"], "hava_buyu", 0.9, 0.2, 0, 0.8, 0),
  M("plazma", "Plazma", ["el_ates", "el_simsek"], "simsek_buyu", 1, 0.2, 0.8, 0.3, 0),
  M("elektrikli_su", "Elektrikli su", ["el_simsek", "el_su"], "simsek_buyu", 0.2, 0.5, 1, 0.6, 0),
  M("obsidyen", "Obsidyen", ["el_ates", "el_su", "el_toprak"], "toprak_buyu", 0.2, 1, 0, 0, 1),
  M("c_sis", "Sis", ["el_ates", "el_su", "el_ayaz"], "su_buyu", -0.3, 0.1, 0.1, 1, 0),
  M("firtina", "Fırtına", ["el_hava", "el_simsek", "el_su"], "hava_buyu", 0, 0.3, 0.7, 1, 0),
  // yeni birleşimler (editörde yok)
  M("tipi", "Tipi", ["el_hava", "el_ayaz"], "ayaz_buyu", -0.9, 0.2, 0, 1, 0),
  M("saganak", "Sağanak", ["el_hava", "el_su"], "su_buyu", 0, 0.4, 0.4, 0.8, 0),
  M("don", "Donmuş toprak", ["el_toprak", "el_ayaz"], "ayaz_buyu", -0.7, 0.9, 0, 0.1, 1),
  M("miknatis", "Mıknatıs taşı", ["el_toprak", "el_simsek"], "simsek_buyu", 0.1, 0.9, 0.9, 0.1, 0.8),
];
export const matter = (id: string) => MATTERS.find(m => m.id === id);
/** Birleşmeyen ikililer ve nedeni (gerisi "kimse dengeleyemez"). */
export const CLASHES: Record<string, string> = {
  "el_ates|el_ayaz": "Isıyla ayaz birbirini yer; avucunda yalnız ıslak bir soğukluk kalır.",
};

export interface Fx { ignite?: boolean; wall?: number; slow?: number; blind?: number; chain?: boolean; mud?: boolean; root?: number; stun?: number }
/** Biçimin maddeye uymadığı durum: neden söner. null: uyar. */
export function formMismatch(m: Matter, f: FormId): string | null {
  if (f === "duvar" && !(m.solid >= 0.5 || m.heat >= 0.9 || m.mass >= 0.6)) return `${m.name} duvar olmaz; dağılıp gider.`;
  if (f === "zincir" && m.conduct < 0.5) return `Zincir ancak iletken bir maddeyle kurulur; ${m.name.toLowerCase()} sıçramaz.`;
  if (f === "perde" && m.spread < 0.6) return `Perde için havada asılı kalan bir şey gerekir; ${m.name.toLowerCase()} yere düşer.`;
  if (f === "akinti" && !(m.mass >= 0.4 || m.spread >= 0.8)) return `${m.name} yere yayılmaz; akacak bir şey yok.`;
  if (f === "firlat" && m.mass < 0.4) return `Havaya fırlatacak ağırlık yok; ${m.name.toLowerCase()} rüzgârda dağılır.`;
  return null;
}

/** Kitaptaki büyüler (config) tabloda kendi hücresine oturur: o hücrede kendi adı ve değerleri geçer. */
export const BOOK_CELLS: Record<string, string> = {
  "el_ates|top": "ates_topu", "magma|akinti": "magma_akintisi", "c_buz|duvar": "buz_duvari", "buhar|perde": "buhar_perdesi",
  "el_simsek|zincir": "simsek_zinciri", "elektrikli_su|akinti": "elektrik_golu", "c_camur|akinti": "camur_tuzagi",
  "obsidyen|top": "obsidyen_hancer", "c_sis|perde": "sis_ortusu", "firtina|zincir": "yildirim_firtinasi",
};
/** İmza büyüler: kuraldan çıkar ama elle ad ve söz verilir (bazısı özel etkiyle). */
export const SIGNATURES: Record<string, { name: string; effect: string; fx?: Fx }> = {
  "magma|firlat": { name: "Meteor", effect: "Erimiş kaya göğe fırlar, ateş gibi düşer. Çarptığı yer tutuşur, yakınındakiler sersemler.", fx: { ignite: true, stun: 1 } },
  "el_toprak|firlat": { name: "Kaya yağmuru", effect: "Toprak sökülür, havaya kalkar, taş taş iner." },
  "c_buz|firlat": { name: "Dolu", effect: "Ceviz iriliğinde buz taneleri; vurduğunu yavaşlatır." },
  "obsidyen|firlat": { name: "Cam yağmuru", effect: "Kara cam kıymıkları gökten keskin keskin yağar." },
  "don|duvar": { name: "Donmuş sur", effect: "Topraktan buz kaplı bir sur yükselir; kolay yıkılmaz.", fx: { wall: 5 } },
  "el_toprak|duvar": { name: "Taş duvar", effect: "Yerden omuz boyu taş yükselir." },
  "el_ates|duvar": { name: "Ateş duvarı", effect: "Bir sıra alev; geçen yanar, kurtlar yaklaşamaz." },
  "tipi|perde": { name: "Kar körlüğü", effect: "Bembeyaz bir tipi; göz gözü görmez, soğuk iliğe işler.", fx: { blind: 3, slow: 1 } },
  "tipi|akinti": { name: "Tipi", effect: "Yerden savrulan kar; ayaklar donar, adımlar ağırlaşır." },
  "yangin_kasirgasi|perde": { name: "Duman perdesi", effect: "Kara, sıcak bir duman; nefes keser, göz yakar." },
  "yangin_kasirgasi|akinti": { name: "Alev seli", effect: "Rüzgârla yayılan alev; otu ve ağacı yalar geçer." },
  "plazma|top": { name: "Yıldırım küresi", effect: "Avuçta cızırdayan beyaz bir küre; değdiği yer kararır." },
  "plazma|zincir": { name: "Akkor zincir", effect: "Hedeften hedefe atlayan beyaz ateş." },
  "miknatis|zincir": { name: "Mıknatıs zinciri", effect: "Demir taşıyanı demir taşıyana bağlar; zırhlıya daha çok işler." },
  "el_su|akinti": { name: "Sel", effect: "Bir anda yükselen su; ayaklarını yerden keser.", fx: { slow: 2, mud: true } },
  "el_hava|top": { name: "Rüzgâr yumruğu", effect: "Sıkıştırılmış hava; vurduğunu geri iter." },
  "el_hava|akinti": { name: "Savuran rüzgâr", effect: "Yerde dönen rüzgâr; toz kaldırır, adım şaşırtır." },
  "el_ayaz|top": { name: "Ayaz dokunuşu", effect: "Değdiği yeri bir anda dondurur." },
  "saganak|perde": { name: "Sağanak perdesi", effect: "Bir anda bastıran yağmur; alevi söndürür, göz görmez." },
  "kum_firtinasi|perde": { name: "Kum perdesi", effect: "Gözlere dolan kum; kör eder, nefes daraltır." },
  "c_buz|top": { name: "Buz mızrağı", effect: "Sivri bir buz; saplandığı yer donar." },
  "el_simsek|top": { name: "Şimşek oku", effect: "Tek, kör edici bir çakım." },
};

const r = Math.round;
/** Bir hücrenin kuraldan üretilen büyüsü (madde ve biçim uyuyorsa). */
export function generateSpell(m: Matter, f: Form): { spell: Spell; fx: Fx } | null {
  if (formMismatch(m, f.id)) return null;
  const n = m.els.length;
  const P = 10 + 12 * Math.abs(m.heat) + 10 * m.mass + 8 * m.conduct + 4 * (n - 1);
  const mult: Record<FormId, number> = { top: 1, duvar: 0.25, akinti: 0.6, zincir: 0.75, perde: 0.15, firlat: 1.35 };
  const fx: Fx = {};
  if (m.heat >= 0.8) fx.ignite = true;
  if (m.heat <= -0.7) fx.slow = 1;
  let range = 25, area = 0, castTime = 1.5;
  if (f.id === "duvar") { fx.wall = 3 + (m.solid >= 0.9 ? 1 : 0); range = 15; castTime = 2; }
  if (f.id === "akinti") { area = 10; range = 15; castTime = 2; fx.slow = Math.max(fx.slow ?? 0, 2); if (m.id === "c_camur" || m.id === "el_su") fx.mud = true; }
  if (f.id === "zincir") { fx.chain = true; range = 20; }
  if (f.id === "perde") { area = m.spread >= 1 ? 15 : 10; range = 20; fx.blind = m.spread >= 1 ? 3 : 2; }
  if (f.id === "firlat") { area = 5; range = 35; castTime = 3; if (m.mass >= 0.8) fx.stun = 1; }
  const key = `${m.id}|${f.id}`; const sig = SIGNATURES[key];
  if (sig?.fx) Object.assign(fx, sig.fx);
  const damage = Math.min(45, r(P * mult[f.id]));
  const spell: Spell = {
    id: `sy_${m.id}_${f.id}`, name: sig?.name ?? `${m.name} ${f.suffix}`, mastery: m.mastery,
    minMastery: 3 + 6 * (n - 1) + f.diff, manaCost: r(5 + P * 0.35 + n * 2 + f.cost), castTime, range, area, damage, duration: 0,
    focusNeed: r(10 + 3 * n + f.diff / 2), effect: sig?.effect ?? `${m.name}, ${f.name.toLowerCase()} biçiminde. ${f.desc}`,
    sources: m.els.map(id => ({ id, amount: 1 })),
  };
  return { spell, fx };
}
/** Bütün hücrelerin üretilmiş büyüleri (kitaptaki büyülerin hücreleri hariç). */
export function synthSpells(): { spells: Spell[]; fx: Record<string, Fx> } {
  const spells: Spell[] = []; const fx: Record<string, Fx> = {};
  for (const m of MATTERS) for (const f of FORMS) {
    if (BOOK_CELLS[`${m.id}|${f.id}`]) continue;
    const g = generateSpell(m, f); if (!g) continue;
    spells.push(g.spell); fx[g.spell.id] = g.fx;
  }
  return { spells, fx };
}
