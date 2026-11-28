// Av: hikâyeden bağımsız, istediğin zaman çıkıp yabanda dövüşmek (altıgen savaş, barikat ya da gizlenme).
// Yalnız vahşi yerlerde; her sefer biraz zaman ve enerji alır, deri ve savaş gelişimi verir.
export interface Hunt { title: string; foes: string[]; map: string; text: string }
export const HUNTS: Record<string, Hunt> = {
  yayla: { title: "Yayla kurtları", foes: ["kurt"], map: "mera", text: "Hasan'ın otlaklarının kıyısında bir kurt dolanıyor." },
  koru: { title: "Koru sürüsü", foes: ["kurt", "kurt"], map: "patika", text: "Meşelerin arasında bir kurt çifti izini bırakıyor." },
};
export const HUNT_MINUTES = 30, HUNT_ENERGY = 10, HUNT_MIN_ENERGY = 25;
