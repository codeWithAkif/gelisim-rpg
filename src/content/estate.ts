// Diyar: ev, işletmeler, adamlar (işçi ve kahramanlar), görev panosu, rütbeler.
// Veri burada; kurallar engine/estate.ts içinde.
import { GAME_ITEMS, ENEMIES } from "./world";

/* ---------- rütbe ---------- */
export interface RankDef { id: number; name: string; at: number; unlocks: string }
export const RANKS: RankDef[] = [
  { id: 0, name: "Yabancı", at: 0, unlocks: "Henüz kimse seni tanımıyor." },
  { id: 1, name: "Köy dostu", at: 10, unlocks: "Ev satın alabilirsin; bir adam tutabilirsin." },
  { id: 2, name: "Taşpınar'ın adamı", at: 28, unlocks: "İşletme kurabilirsin; iki adam tutabilirsin." },
  { id: 3, name: "Vadi ağası", at: 55, unlocks: "Evi büyütebilirsin; üç adam; ağır işler." },
  { id: 4, name: "Bölgenin sözü geçeni", at: 95, unlocks: "Dört adam; büyük işletmeler; kule nöbetini devredebilirsin." },
  { id: 5, name: "Diyar efendisi", at: 150, unlocks: "Beş adam. Sözün her yerde geçiyor." },
];

/* ---------- ev ---------- */
export interface HouseLevel { name: string; cost: { money: number; items: Record<string, number> }; pets: number; rooms: number; bed: number; desc: string }
export const HOUSES: HouseLevel[] = [
  { name: "Köy evi", cost: { money: 90, items: { odun: 8, ip: 4 } }, pets: 1, rooms: 1, bed: 1.1, desc: "Tek odalı, sobalı. Kendi yatağın, evde bir hayvan." },
  { name: "Taş ev", cost: { money: 200, items: { odun: 12, deri: 4, demir_parca: 3 } }, pets: 2, rooms: 2, bed: 1.2, desc: "İki oda ve ahır köşesi. Daha iyi dinlenirsin; iki hayvan, iki adam odası." },
  { name: "Çiftlik evi", cost: { money: 420, items: { odun: 20, deri: 8, demir_parca: 8 } }, pets: 3, rooms: 4, bed: 1.3, desc: "Avlulu, ahırlı bir çiftlik. Üç hayvan, dört adam." },
];
export const HOME_PLACES = ["koy_meydani", "karacam", "ayaz_mutfak"];

/* ---------- işletmeler ---------- */
export interface VentureDef { id: string; name: string; desc: string; minRank: number; cost: { money: number; items: Record<string, number> }; makes: string; per: number; need: string; upkeep: number }
export const VENTURES: VentureDef[] = [
  { id: "odunluk", name: "Odunluk", desc: "Kütük kesip istif eder. Odun hep lazım.", minRank: 2, cost: { money: 40, items: { odun: 4, ip: 2 } }, makes: "odun", per: 2, need: "isci", upkeep: 1 },
  { id: "agil", name: "Ağıl", desc: "Keçi ve koyun; peynir ve deri.", minRank: 2, cost: { money: 70, items: { odun: 6, ip: 3 } }, makes: "peynir", per: 1.4, need: "isci", upkeep: 2 },
  { id: "tarla", name: "Tarla", desc: "Dağ eteğinde otlar ve ekin; yiyecek.", minRank: 2, cost: { money: 60, items: { odun: 3, ip: 2 } }, makes: "ekmek", per: 1.6, need: "isci", upkeep: 1 },
  { id: "demirci", name: "Demirci tezgâhı", desc: "Kemal'in tezgâhından demir parçası.", minRank: 3, cost: { money: 130, items: { odun: 6, demir_parca: 4 } }, makes: "demir_parca", per: 1.1, need: "usta", upkeep: 3 },
];

/* ---------- adamlar ---------- */
export type HeroRole = "savasci" | "okcu" | "sifaci" | "isci" | "izci" | "usta";
export const ROLE_NAMES: Record<HeroRole, string> = { savasci: "Savaşçı", okcu: "Okçu", sifaci: "Şifacı", isci: "İşçi", izci: "İzci", usta: "Usta" };
export interface HeroDef { id: string; name: string; role: HeroRole; place: string; minRank: number; hire: number; wage: number; bio: string; power: number }
export const HEROES: HeroDef[] = [
  { id: "bora", name: "Demirhan Bora", role: "savasci", place: "koy_meydani", minRank: 1, hire: 30, wage: 2, power: 4, bio: "Eski bir sınır nöbetçisi. Az konuşur, iyi vurur." },
  { id: "kirpi", name: "Kirpi Ali", role: "isci", place: "koy_meydani", minRank: 1, hire: 12, wage: 1, power: 2, bio: "Oduncu çırağı. İş buldukça yorulmaz." },
  { id: "selvi", name: "Selvi", role: "sifaci", place: "karacam_han", minRank: 2, hire: 45, wage: 3, power: 3, bio: "Hanın şifacısı. Yarayı çabuk kapatır." },
  { id: "tilki", name: "Tilki Mehmet", role: "izci", place: "karacam_han", minRank: 2, hire: 40, wage: 3, power: 3, bio: "Yol ve iz bilir. Kervan işlerinde değerli." },
  { id: "ozan", name: "Yaycı Ozan", role: "okcu", place: "karacam", minRank: 2, hire: 55, wage: 3, power: 5, bio: "Av yayında usta. Uzaktan keser." },
  { id: "dilsiz", name: "Dilsiz Usta Cemal", role: "usta", place: "karacam", minRank: 3, hire: 90, wage: 4, power: 4, bio: "Demir ve ahşapta eli ustadır. Yapı kurar." },
  { id: "kar", name: "Kar Sevda", role: "okcu", place: "ayaz_mutfak", minRank: 3, hire: 75, wage: 4, power: 6, bio: "Ayazkale'de büyüdü; soğukta nişan bozulmaz." },
  { id: "demir", name: "Yedi Elli Hasan", role: "savasci", place: "ayaz_mutfak", minRank: 3, hire: 110, wage: 5, power: 8, bio: "Zırhlı ve ağır. Kapıyı tek başına tutar." },
];
export const heroDef = (id: string) => HEROES.find(h => h.id === id);

/* ---------- görev panosu ---------- */
export interface JobDef { id: string; name: string; desc: string; role: HeroRole[]; diff: number; days: number; money: number; items: Record<string, number>; needsQuest?: string; minRank: number }
export const JOBS: JobDef[] = [
  { id: "j_devriye", name: "Meraya devriye", desc: "Hasan'ın sürüsünü kurtlardan koru.", role: ["savasci", "okcu"], diff: 10, days: 1, money: 2, items: { deri: 1 }, needsQuest: "devriye", minRank: 1 },
  { id: "j_otlak", name: "Ot ve kök toplama", desc: "Yamaçlarda şifalı otlar topla.", role: ["isci", "izci", "sifaci"], diff: 6, days: 1, money: 0, items: { kekik: 3, nane: 2 }, minRank: 1 },
  { id: "j_odun", name: "Odun kesme", desc: "Kuru ağaç kes, kütük taşı.", role: ["isci", "savasci"], diff: 8, days: 1, money: 0, items: { odun: 5 }, minRank: 1 },
  { id: "j_agil", name: "Ağıl nöbeti", desc: "Gece ağılı kurtlardan koru.", role: ["savasci", "okcu"], diff: 18, days: 1, money: 3, items: { deri: 1, peynir: 1 }, needsQuest: "agil_gecesi", minRank: 2 },
  { id: "j_kervan", name: "Kervana eşlik", desc: "Karaçam yolunda bir kervanı güdür.", role: ["savasci", "okcu", "izci"], diff: 22, days: 2, money: 14, items: { ok: 4 }, needsQuest: "kervan", minRank: 2 },
  { id: "j_han", name: "Han kapısı", desc: "Gece hanı haydutlardan koru.", role: ["savasci", "okcu"], diff: 26, days: 1, money: 14, items: { ok: 6 }, needsQuest: "han_gecesi", minRank: 2 },
  { id: "j_demir", name: "Hurda demir arama", desc: "Eski kervan yolunda demir parçası topla.", role: ["izci", "usta", "isci"], diff: 14, days: 1, money: 0, items: { demir_parca: 3 }, minRank: 2 },
  { id: "j_mutfak", name: "Mutfak kapısı", desc: "Kale mutfağını gece baskınlarından koru.", role: ["savasci", "okcu"], diff: 34, days: 1, money: 10, items: { ekmek: 2 }, needsQuest: "mutfak_kapisi", minRank: 3 },
];
export const jobDef = (id: string) => JOBS.find(j => j.id === id);
// yeni haritada çıkacak eşyaların tanımı yoksa sessiz geç
void GAME_ITEMS;

// savaşta müttefik birim olarak kullanılan adam tanımları (görünüm: renk süzgeciyle kahraman pozu)
const TINTS: Record<HeroRole, string> = { savasci: "sepia(.4) saturate(1.5) hue-rotate(-15deg) brightness(.9)", okcu: "sepia(.3) saturate(1.2) hue-rotate(60deg) brightness(.95)", sifaci: "sepia(.2) saturate(.8) hue-rotate(120deg) brightness(1.15)", isci: "sepia(.5) saturate(1) brightness(.95)", izci: "sepia(.3) saturate(1.1) hue-rotate(20deg) brightness(.85)", usta: "sepia(.3) saturate(.9) hue-rotate(190deg) brightness(.9)" };
for (const r of Object.keys(ROLE_NAMES) as HeroRole[]) ENEMIES["h_" + r] = { ...ENEMIES.haydut, id: "h_" + r, name: ROLE_NAMES[r], hp: 28, damage: [3, 6], tint: TINTS[r], desc: ROLE_NAMES[r] };
