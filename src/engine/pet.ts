// Evcil hayvan: yaşar, acıkır, keyfi değişir; bakım bağı büyütür, bağ yetenek açar.
// Bir seferde tek hayvan yanında gezer; evin varsa diğerleri evde yaşar. DOM yok.
import type { Config } from "./config";
import { type GameState, DAY_MINUTES, log } from "./state";
import { removeItem, itemInfo } from "./inventory";
import { PET_TYPES, type PetType } from "../content/pets";

export interface Pet { id: string; name: string; bond: number; satiety?: number; mood?: number; energy?: number; care?: { day: number; pet: number; play: number; fed: number } }
export { PET_TYPES };
export const petType = (id: string): PetType => PET_TYPES[id] ?? PET_TYPES.kopek;

/** Eski kayıtlarda eksik alanları doldurur. */
export function fill(p: Pet): Required<Pet> {
  p.satiety ??= 70; p.mood ??= 70; p.energy ??= 90; p.care ??= { day: 0, pet: 0, play: 0, fed: 0 };
  return p as Required<Pet>;
}
export function companion(s: GameState): Required<Pet> | undefined { return s.pet ? fill(s.pet) : undefined; }
export const homePets = (s: GameState): Pet[] => (s.homePets ??= []);
/** Evde kaç hayvan barınabilir: ev yoksa 0. */
export function homeSlots(s: GameState): number { const h = s.estate?.house ?? 0; return h > 0 ? h : 0; }
const careOf = (p: Required<Pet>, day: number) => { if (p.care.day !== day) p.care = { day, pet: 0, play: 0, fed: 0 }; return p.care; };

/** Tokluk ve keyfe göre etkinlik çarpanı: tok ve mutlu → 1.1, aç ve kederli → 0.5. */
export function petMul(s: GameState): number {
  const p = s.pet; if (!p) return 1; const f = fill(p);
  return Math.max(0.5, Math.min(1.1, 0.5 + f.satiety / 250 + f.mood / 250 + Math.min(0.1, f.bond / 1000)));
}
export const moodWord = (p: Pet) => { const f = fill(p); return f.satiety < 20 ? "aç" : f.mood < 30 ? "kederli" : f.mood < 55 ? "durgun" : f.mood < 80 ? "keyifli" : "neşeli"; };
export function perksOf(p: Pet) { const t = petType(p.id); return t.perks.map(x => ({ ...x, on: p.bond >= x.bond })); }
/** Şu an ne yapıyor: saat, tokluk, keyfe göre. */
export function doing(s: GameState, p: Pet): string {
  const f = fill(p); const h = 6 + s.minute / 60; const t = petType(p.id);
  if (f.satiety < 20) return `${p.name} karnı gurulduyor; çevrede yiyecek arıyor.`;
  if (h >= 21 || f.energy < 20) return `${p.name} ayaklarının dibinde kıvrılmış, uyuyor.`;
  if (f.mood >= 80) return t.id === "sahin" ? `${p.name} kanatlarını açıp gökyüzüne bakıyor.` : t.id === "kedi" ? `${p.name} güneşte gerinip mırıldanıyor.` : `${p.name} kuyruğunu sallayarak etrafında dönüyor.`;
  if (h < 8) return `${p.name} uykulu gözlerle esniyor.`;
  return t.id === "sahin" ? `${p.name} yüksek bir dala tüneyip etrafı süzüyor.` : t.id === "kedi" ? `${p.name} köşede tüylerini yalıyor.` : `${p.name} yanında oyalanıyor, kokulara burnunu daldırıyor.`;
}

/** Geceyi geçirir: acıkır, enerjisi dolar; bakılmayan hayvan kederlenir, uzun aç kalanın bağı çözülür. Raporu döner. */
export function tickPets(s: GameState): string[] {
  const out: string[] = [];
  const all: { p: Pet; home: boolean }[] = [...(s.pet ? [{ p: s.pet, home: false }] : []), ...homePets(s).map(p => ({ p, home: true }))];
  for (const { p, home } of all) {
    const f = fill(p);
    f.satiety = Math.max(0, f.satiety - (home ? 18 : 28));
    const cared = f.care.day === s.day && (f.care.pet + f.care.play > 0);
    f.mood = Math.max(0, Math.min(100, f.mood + (f.satiety < 20 ? -14 : 4) + (cared ? 6 : -3)));
    f.energy = 100; if (!home) { f.energy = 100; }
    if (f.satiety <= 0) { f.bond = Math.max(0, f.bond - 1); out.push(`${p.name} aç kaldı; sana küsüyor (bağ −1).`); }
    else if (f.satiety < 25) out.push(`${p.name} acıkmış; ona yiyecek ver.`);
  }
  return out;
}

export interface Act { ok: boolean; reason?: string; text?: string }
export function feed(cfg: Config, s: GameState, itemId: string): Act {
  const p = s.pet; if (!p) return { ok: false, reason: "Yanında evcil hayvan yok" };
  const it = itemInfo(cfg, itemId); if (it.kind !== "Yiyecek" || !(s.inventory[itemId] > 0)) return { ok: false, reason: "Bunu yiyemez" };
  const f = fill(p); if (f.satiety >= 95) return { ok: false, reason: `${p.name} tok` };
  removeItem(s, itemId, 1);
  const loved = petType(p.id).likes.includes(itemId);
  f.satiety = Math.min(100, f.satiety + (it.satiety ?? 20) * 0.8 + (loved ? 8 : 0)); f.mood = Math.min(100, f.mood + (loved ? 8 : 3));
  f.bond = Math.min(100, f.bond + (loved ? 0.4 : 0.15)); careOf(f, s.day).fed++;
  s.minute = Math.min(DAY_MINUTES, s.minute + 5);
  return { ok: true, text: loved ? `${p.name} iştahla yedi; gözleri parladı.` : `${p.name} yedi.` };
}
export function caress(s: GameState): Act {
  const p = s.pet; if (!p) return { ok: false, reason: "Yanında evcil hayvan yok" };
  const f = fill(p); const c = careOf(f, s.day);
  if (c.pet >= 4) return { ok: false, reason: `${p.name} bugün yeterince sevildi` };
  c.pet++; f.mood = Math.min(100, f.mood + 7); f.bond = Math.min(100, f.bond + 0.35); s.minute = Math.min(DAY_MINUTES, s.minute + 3);
  return { ok: true, text: `${p.name} elini yaladı.` };
}
export function play(s: GameState): Act {
  const p = s.pet; if (!p) return { ok: false, reason: "Yanında evcil hayvan yok" };
  const f = fill(p); const c = careOf(f, s.day);
  if (c.play >= 2) return { ok: false, reason: "Bugün yeterince oynadınız" };
  if (f.energy < 25) return { ok: false, reason: `${p.name} yorgun; dinlensin` };
  if (f.satiety < 15) return { ok: false, reason: `${p.name} aç; önce yedir` };
  if (s.energy < 12) return { ok: false, reason: "Sen çok yorgunsun" };
  c.play++; f.mood = Math.min(100, f.mood + 14); f.bond = Math.min(100, f.bond + 0.9); f.energy -= 25; f.satiety = Math.max(0, f.satiety - 6);
  s.minute = Math.min(DAY_MINUTES, s.minute + 30); s.energy = Math.max(0, s.energy - 3);
  return { ok: true, text: `${p.name} ile koştunuz; ikiniz de keyiflendiniz.` };
}
export function rename(s: GameState, name: string): Act {
  const n = name.trim().slice(0, 16); if (!s.pet || n.length < 2) return { ok: false, reason: "İsim en az 2 harf olmalı" };
  s.pet.name = n; return { ok: true };
}

/* ---------- yavru almak, ev, değiştirmek ---------- */
export function canAdopt(s: GameState, typeId: string, place = s.location): Act {
  const t = PET_TYPES[typeId]; if (!t || !t.shop) return { ok: false, reason: "Bu hayvan satılmaz" };
  if (t.shop !== place) return { ok: false, reason: "Yavru burada yok" };
  if (s.money < t.price) return { ok: false, reason: `${t.price} bakır gerekir` };
  if (!s.pet) return { ok: true };
  if (homePets(s).length < homeSlots(s)) return { ok: true };
  return { ok: false, reason: homeSlots(s) ? "Evin dolu" : "Bir seferde tek evcil hayvana bakabilirsin; bir evin olursa diğerleri orada yaşar" };
}
export function adopt(s: GameState, typeId: string): Act {
  const c = canAdopt(s, typeId); if (!c.ok) return c;
  const t = PET_TYPES[typeId]; s.money -= t.price;
  const p: Pet = { id: t.id, name: t.defaultName, bond: 3, satiety: 70, mood: 80, energy: 100 };
  if (!s.pet) { s.pet = p; log(s, `${p.name} artık yanında.`, "quest"); } else { homePets(s).push(p); log(s, `${p.name} evde yaşayacak.`, "quest"); }
  return { ok: true, text: `${p.name} (${t.species}) artık senin.` };
}
/** Evdeyken yanındakini evde bırakıp birini al; evin yoksa olmaz. */
export function swapWithHome(s: GameState, index: number): Act {
  if (!homeSlots(s)) return { ok: false, reason: "Evin yok" };
  if (s.location !== s.estate?.homePlace) return { ok: false, reason: "Değiştirmek için evinde olmalısın" };
  const h = homePets(s); const other = h[index]; if (!other) return { ok: false, reason: "Yok" };
  if (s.pet) h[index] = s.pet; else h.splice(index, 1);
  s.pet = other; return { ok: true, text: `${other.name} artık yanında.` };
}
export function sendHome(s: GameState): Act {
  if (!s.pet) return { ok: false, reason: "Yanında evcil hayvan yok" };
  if (!homeSlots(s)) return { ok: false, reason: "Evin yok" };
  if (s.location !== s.estate?.homePlace) return { ok: false, reason: "Evinde olmalısın" };
  if (homePets(s).length >= homeSlots(s)) return { ok: false, reason: "Evin dolu" };
  homePets(s).push(s.pet); s.pet = undefined; return { ok: true };
}
export function release(s: GameState): Act {
  if (!s.pet) return { ok: false, reason: "Yok" }; const n = s.pet.name; s.pet = undefined; log(s, `${n} doğaya salındı.`, "info"); return { ok: true };
}
