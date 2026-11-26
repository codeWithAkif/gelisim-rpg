// Kadim çağrılar: element sayfasıyla değil, kadim bir eşyayı bulunca öğrenilen büyüler.
// Editörde karşılıkları yok; config'e buradan eklenir. Kaynak element yalnızca çizilecek işareti
// ve ortam etkisini belirler; büyüyü bilmek için eşya gerekir (RELIC_SPELLS).
import type { Spell } from "../engine/config";

export const EXTRA_SPELLS: Spell[] = [
  { id: "sarmasik", name: "Sarmaşık bağı", mastery: "toprak_buyu", minMastery: 0, manaCost: 10, castTime: 1.5, range: 20, area: 5, damage: 4, duration: 0, focusNeed: 12,
    effect: "Yerden sarmaşıklar fışkırır; hedefi yere bağlar, bir süre kıpırdayamaz.", sources: [{ id: "el_toprak", amount: 1 }] },
  { id: "karga_surusu", name: "Karga sürüsü", mastery: "hava_buyu", minMastery: 0, manaCost: 14, castTime: 2, range: 30, area: 5, damage: 10, duration: 0, focusNeed: 15,
    effect: "Kara bir sürü çağırırsın; gözlerini gagalar, saldırıları boşa gider.", sources: [{ id: "el_hava", amount: 1 }] },
  { id: "yer_kiliclari", name: "Yerden yükselen kılıçlar", mastery: "toprak_buyu", minMastery: 3, manaCost: 18, castTime: 2, range: 15, area: 5, damage: 22, duration: 0, focusNeed: 20,
    effect: "Toprak demir gibi sertleşip kılıç olur; vurduğunu havaya fırlatır, sersemletir.", sources: [{ id: "el_toprak", amount: 1 }] },
];
/** Büyü → onu öğreten kadim eşya. */
export const RELIC_SPELLS: Record<string, string> = { sarmasik: "ardic_koku", karga_surusu: "kara_tuy", yer_kiliclari: "pasli_kabza" };
