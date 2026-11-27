// Mühendislik: kalıcı yapılar (barikat, tuzak, ileride kuşatma silahları). Bir kez yapılır, tükenmez;
// sökülünce malzemesinin çoğu geri gelir; türün seviyesi atölyede geliştirilir ve bütün parçalara işler.
// Yeni bir yapı türü eklemek için buraya bir satır yeterli (etkisi engine/engineering.ts'te).
import { GAME_ITEMS, MARKETS } from "./world";

export type StructKind = "barikat" | "tuzak" | "silah";
export interface StructureDef {
  id: string; name: string; kind: StructKind; desc: string;
  cost: Record<string, number>; minutes: number; energy: number;
  skill: Record<string, number>;            // yapmak için gereken özellikler
  needsElement?: string; maxLv: number; icon: string;
  /** seviye l → l+1 için malzeme */
  upCost: (lv: number) => Record<string, number>;
  /** Her seviyenin etkisini anlatan kısa metin. */
  effect: (lv: number) => string;
}
export const STRUCTURES: StructureDef[] = [
  { id: "kazik_barikat", name: "Kazık barikatı", kind: "barikat", icon: "barikat", maxLv: 5, minutes: 120, energy: 8,
    desc: "Sivri kazıklardan sökülüp kurulabilen çit. Kuşatmada düşmanı yavaşlatır, yönünü değiştirir.",
    cost: { odun: 6, ip: 3, demir_parca: 1 }, skill: { el_becerisi: 11 },
    upCost: lv => ({ odun: 3 + lv * 2, ip: 1 + lv, demir_parca: lv >= 2 ? lv - 1 : 0 }),
    effect: lv => `dayanıklılık +%${Math.round((lv - 1) * 30)}` },
  { id: "ilmik_tuzagi", name: "İlmik tuzağı", kind: "tuzak", icon: "ilmik", maxLv: 5, minutes: 90, energy: 6,
    desc: "Gizli bir ilmik; basan topallar ve yaralanır.",
    cost: { ip: 3, demir_parca: 1 }, skill: { el_becerisi: 12 },
    upCost: lv => ({ ip: 2 + lv, demir_parca: lv }),
    effect: lv => `hasar ${4 + lv * 2} · yavaşlama ${lv >= 3 ? 3 : 2} tur` },
  { id: "kazik_cukuru", name: "Kazık çukuru", kind: "tuzak", icon: "cukur", maxLv: 5, minutes: 150, energy: 10,
    desc: "Üstü örtülü çukurun dibinde sivri kazıklar. Ağır vurur, uzun süre yerinde tutar.",
    cost: { odun: 4, demir_parca: 2, ip: 1 }, skill: { el_becerisi: 15, ust_govde: 10 },
    upCost: lv => ({ odun: 2 + lv, demir_parca: 1 + lv }),
    effect: lv => `hasar ${8 + lv * 3} · yavaşlama ${lv >= 4 ? 4 : 3} tur` },
  { id: "ates_tuzagi", name: "Ateş tuzağı", kind: "tuzak", icon: "ates", maxLv: 5, minutes: 120, energy: 8, needsElement: "el_ates",
    desc: "Basınca alev patlar; ot ve yaprak tutuşur, kurtlar ürkerek kaçar.",
    cost: { demir_parca: 2, ip: 2, odun: 2 }, skill: { el_becerisi: 14 },
    upCost: lv => ({ demir_parca: 1 + lv, kekik: 1 }),
    effect: lv => `hasar ${6 + lv * 2} · yangın çıkarır` },
];
export const structure = (id: string) => STRUCTURES.find(x => x.id === id);

// yeni malzemeler
GAME_ITEMS.odun = { id: "odun", name: "Odun", slot: "Malzeme", stack: 10, price: 2, desc: "Kuru, düz kütük. Kazık, çit ve çerçeve için." };
GAME_ITEMS.demir_parca = { id: "demir_parca", name: "Demir parçası", slot: "Malzeme", stack: 10, price: 6, desc: "Kemal'in atığından kalan çivi ve demir parçaları. Mekanizma ve uç yapımı için." };
MARKETS.koy_meydani.items.push("odun");
MARKETS.karacam.items.push("odun", "demir_parca");
// Taşpınar'da demir Kemal'in tezgâhından alınır (tuzak, kazık, ev için gereken demir parçası)
MARKETS.demirhane = { name: "Kemal'in tezgâhı", items: ["demir_parca", "odun"] };
MARKETS.ardic_kul.items.push("demir_parca");
