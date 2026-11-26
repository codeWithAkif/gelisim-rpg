// Sistemlerin tanıtımı: bir sistem ilk kez açıldığında deftere bir kez "Yeni sayfa" olarak işlenir.
// Hikâye sayfalarıyla aynı anda gösterilir (arayüzde storyTick). DOM yok.
import type { GameState } from "./state";
import { MARKETS } from "../content/world";
import { diyarOpen, venturesOpen } from "./estate";
import { financeOpen } from "./finance";
import { olcerOpen } from "./olcer";

export interface Unlock { id: string; title: string; text: string; when: (s: GameState) => boolean }
export const UNLOCKS: Unlock[] = [
  { id: "pazar", title: "Pazar", when: s => !!MARKETS[s.location],
    text: "Burada alıp satabiliyorum. Çanta'daki Pazar sayfasında günün fiyatları yazıyor; aynı maldan çok satarsam fiyat düşüyor." },
  { id: "evcil", title: "Yol arkadaşı", when: s => !!s.pet,
    text: "Artık yalnız değilim. Karnını doyurup ilgilendikçe bağımız büyüyor; bağ büyüdükçe yeni şeyler yapıyor. Defter'deki Evcil sayfasında yazıyor." },
  { id: "olcer", title: "Annemin işi", when: olcerOpen,
    text: "Isı kaybolmaz, bir yere gider. Annem bunu ölçerdi. Köy meydanındaki pınar donmuş; ısıyı ölçüp yerinden taşıyabilirim. Harita'da meydanın kartında yazıyor." },
  { id: "diyar", title: "Adım duyuldu", when: diyarOpen,
    text: "Köyde artık beni tanıyorlar. Bir ev kurabilir, yanımda gezecek bir adam tutabilirim. Diyar sayfası açıldı." },
  { id: "ortaklik", title: "Ortaklık", when: financeOpen,
    text: "Karaçam'da para da çalışıyor. Birine para koyup her gece payımı alabilirim; ama yol, kış ve haydut parayı da yiyebilir." },
  { id: "isletme", title: "İşletme ve görev panosu", when: s => venturesOpen(s) && diyarOpen(s),
    text: "Şehirde iş büyük. Bir işletme kurup adamlarımdan birine verebilir, tekrar eden işleri görev panosundan onlara bırakabilirim." },
];
const key = (id: string) => "acildi_" + id;
export const isUnlocked = (s: GameState, id: string) => s.story.flags[key(id)] !== undefined;

/** Yeni açılan sistemleri işaretler ve döner (her biri yalnız bir kez). */
export function newUnlocks(s: GameState): Unlock[] {
  const out: Unlock[] = [];
  for (const u of UNLOCKS) if (!isUnlocked(s, u.id) && u.when(s)) { s.story.flags[key(u.id)] = s.day; out.push(u); }
  return out;
}
