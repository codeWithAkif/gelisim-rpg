// Evcil hayvan türleri: kim ne iş görür, nereden alınır. Köpek hikâyeden (Hasan), diğerleri yavru olarak alınır.
// Savaşta kullanılan istatistikler ENEMIES içine de eklenir (müttefik birim olarak).
import { ENEMIES } from "./world";

export interface PetType {
  id: string; species: string; defaultName: string; role: string; desc: string;
  likes: string[];                          // en çok sevdiği yiyecekler
  price: number; shop?: string;             // yavru: nerede ve kaç bakır
  perks: { bond: number; text: string }[];  // bağ seviyesiyle açılan yetenekler
}
export const PET_TYPES: Record<string, PetType> = {
  kopek: { id: "kopek", species: "Çoban köpeği", defaultName: "Karabaş", role: "Dövüşçü", price: 0,
    desc: "Cesur ve sadık. Savaşta koşup ısırır, gece kampını korur, burnuyla iz bulur.", likes: ["ekmek", "peynir"],
    perks: [{ bond: 0, text: "Savaşta kurda koşar ve ısırır" }, { bond: 10, text: "Kokuyla bulunan şeyleri daha sık bulur" }, { bond: 30, text: "Isırığı sertleşir" }, { bond: 50, text: "Kuşatmada daha geniş alanı kollar" }, { bond: 75, text: "Her gün fazladan bir bulgu getirir" }] },
  kedi: { id: "kedi", species: "Han kedisi", defaultName: "Pamuk", role: "Gölge", price: 25, shop: "karacam_han",
    desc: "Sessiz ve dikkatli. Gizlenirken seni ele vermez, etrafı ararken küçük şeyleri fark eder.", likes: ["peynir"],
    perks: [{ bond: 0, text: "Gizlenirken kuşku daha yavaş dolar" }, { bond: 10, text: "Etrafı ararken bulma şansı artar" }, { bond: 30, text: "Gece pusuları önceden sezer" }, { bond: 50, text: "Fareleri kovar: işletmelerin üretimi %10 artar" }, { bond: 75, text: "Gizlenmede kuşku iyice yavaşlar" }] },
  sahin: { id: "sahin", species: "Dağ şahini", defaultName: "Ayaz", role: "Gözcü", price: 60, shop: "ayaz_gecit",
    desc: "Yukarıdan görür. Araziyi senin yerine tarar, kuşatmada okunun menzilini uzatır.", likes: ["et"],
    perks: [{ bond: 0, text: "Arazi keşfi vakit almaz" }, { bond: 10, text: "Kuşatmada ok menzili uzar" }, { bond: 30, text: "Rüzgârı senin yerine okur" }, { bond: 50, text: "Yolculukta pusuları önceden haber verir" }, { bond: 75, text: "Uzak bir hedefe oku kılavuzlar: kritik şansı artar" }] },
};
// savaş birimleri
ENEMIES.kedi = { ...ENEMIES.kopek, id: "kedi", name: "Pamuk", hp: 10, damage: [1, 3], accuracy: 60, evasion: 30, scale: 0.6, tint: "sepia(.5) saturate(1.2) brightness(1.2)", desc: "Han kedisi." };
ENEMIES.sahin = { ...ENEMIES.kopek, id: "sahin", name: "Ayaz", hp: 8, damage: [2, 4], accuracy: 65, evasion: 40, scale: 0.55, tint: "sepia(.3) saturate(.9) brightness(.9)", desc: "Dağ şahini." };
