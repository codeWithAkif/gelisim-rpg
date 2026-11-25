// Kadim eşyalar: nadir bulunan, bulununca güçte ani sıçrama yaratan eşyalar.
// Etkileri kalıcıdır ve doğrudan seviyeye eklenir (çalışmanın azalan getirisi işlemez).
export interface Relic { id: string; name: string; desc: string; boosts: Record<string, number>; source: string; journal?: string[] }
export const RELICS: Record<string, Relic> = {
  kor_tasi: {
    id: "kor_tasi", name: "Kadim kor taşı", source: "Akyele'nin ini",
    desc: "Yumruk büyüklüğünde, içinde hiç sönmeyen bir kor. Elinde tutunca nefesin ısınıyor. Annenin defterinde aynı taşın çizimi var.",
    boosts: { ates: 4, mana: 3, nefes: 1 },
  },
  akyele_disi: {
    id: "akyele_disi", name: "Akyele'nin dişi", source: "Akyele'nin ini",
    desc: "Sürü başının köpek dişi. Onu yakından görmek kurtların nasıl hareket ettiğini, nereden kırılgan olduklarını gösterdi.",
    boosts: { anatomi_hayvan: 4, analiz: 2 }, journal: ["kurt:boyun", "kurt:burun", "kurt:arka_bacak"],
  },
  olcer_pusulasi: {
    id: "olcer_pusulasi", name: "Ölçer pusulası", source: "Keşif",
    desc: "Çamurun içinde pirinç bir pusula. İğnesi kuzeyi değil, ısının çekildiği yeri gösteriyor. Kapağının içinde annenin işareti.",
    boosts: { mekansal: 4, gorus: 2, odak: 1 },
  },
};
