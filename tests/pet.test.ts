// Evcil hayvan: bakım, açlık, etkinlik, yavru almak, ev kuralı.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { feed, caress, play, tickPets, petMul, canAdopt, adopt, swapWithHome, sendHome, perksOf, release, homePets } from "../src/engine/pet";

const g = () => { const s = newGame(cfg, 3); s.pet = { id: "kopek", name: "Karabaş", bond: 20 }; s.inventory.ekmek = 3; s.inventory.peynir = 2; return s; };

test("besle: tokluk artar, sevdiği yiyecekte keyif ve bağ daha çok", () => {
  const s = g(); s.pet!.satiety = 30; s.pet!.mood = 50; const b0 = s.pet!.bond;
  expect(feed(cfg, s, "ekmek").ok).toBe(true); expect(s.pet!.satiety!).toBeGreaterThan(55); expect(s.inventory.ekmek).toBe(2); expect(s.pet!.bond).toBeGreaterThan(b0);
  expect(feed(cfg, s, "olmayan").ok).toBe(false);
  s.pet!.satiety = 99; expect(feed(cfg, s, "ekmek").ok).toBe(false);
});
test("sev ve oyna: günlük sınır; açken ve yorgunken oynamaz", () => {
  const s = g(); for (let i = 0; i < 4; i++) expect(caress(s).ok).toBe(true); expect(caress(s).ok).toBe(false);
  expect(play(s).ok).toBe(true); expect(play(s).ok).toBe(true); expect(play(s).ok).toBe(false);
  const t = g(); t.pet!.satiety = 5; expect(play(t).ok).toBe(false);
});
test("gece: acıkır; aç kalan küser; bakılan keyfi korur", () => {
  const s = g(); s.pet!.satiety = 50; s.day = 4; caress(s); tickPets(s); expect(s.pet!.satiety).toBe(22); expect(s.pet!.energy).toBe(100);
  s.pet!.satiety = 10; s.pet!.bond = 20; const lines = tickPets(s); expect(s.pet!.bond).toBe(19); expect(lines.join()).toMatch(/aç kaldı/);
});
test("etkinlik çarpanı: aç ve kederli hayvan yarım çalışır, tok ve mutlu tam", () => {
  const s = g(); s.pet!.satiety = 90; s.pet!.mood = 90; const hi = petMul(s);
  s.pet!.satiety = 0; s.pet!.mood = 0; const lo = petMul(s); expect(hi).toBeGreaterThan(1); expect(lo).toBeCloseTo(0.52, 1); expect(lo).toBeLessThan(0.6);
});
test("yavru: yoksa yanına gelir; varsa ev olmadan alınamaz, ev varsa evde yaşar", () => {
  const s = newGame(cfg, 3); s.money = 100; s.location = "karacam_han";
  expect(canAdopt(s, "kedi").ok).toBe(true); expect(adopt(s, "kedi").ok).toBe(true); expect(s.pet?.id).toBe("kedi"); expect(s.money).toBe(75);
  s.location = "ayaz_gecit"; expect(canAdopt(s, "sahin").ok).toBe(false); expect(canAdopt(s, "sahin").reason).toMatch(/tek evcil/);
  s.estate = { house: 1, homePlace: "koy_meydani" }; expect(canAdopt(s, "sahin").ok).toBe(true); adopt(s, "sahin"); expect(homePets(s).length).toBe(1);
  expect(canAdopt(s, "sahin").ok).toBe(false); // evin dolu
  s.location = "koy_meydani"; expect(swapWithHome(s, 0).ok).toBe(true); expect(s.pet?.id).toBe("sahin"); expect(homePets(s)[0].id).toBe("kedi");
  expect(sendHome(s).ok).toBe(false); // ev dolu
  expect(canAdopt(s, "kedi", "karacam_han").ok).toBe(false);
});
test("bağ yetenek açar; salıvermek hayvanı çıkarır", () => {
  const s = g(); const on = perksOf(s.pet!).filter(x => x.on).length; s.pet!.bond = 80; expect(perksOf(s.pet!).filter(x => x.on).length).toBeGreaterThan(on);
  release(s); expect(s.pet).toBeUndefined();
});
