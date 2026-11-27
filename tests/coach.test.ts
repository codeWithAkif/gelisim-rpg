// İlk savaşta Hasan'ın dersi: adımlar oyuncunun yaptıklarıyla ilerler.
import { test, expect } from "vitest";
import { coachNext, coachLine, coachLearned, type CoachStep, type CoachEvent } from "../src/engine/coach";

test("ders sırayla ilerler: tamam → kurda dokun → yanına yürü → saldır → kaç → anladım", () => {
  let st: CoachStep = "giris";
  const go = (ev: CoachEvent) => { st = coachNext(st, ev, true); return st; };
  expect(go("saldir")).toBe("giris");          // sırası gelmeyen olay bir şey değiştirmez
  expect(go("tamam")).toBe("sec");
  expect(go("sec")).toBe("yuru");
  expect(go("yanında")).toBe("vur");
  expect(go("tur_bitti")).toBe("vur");
  expect(go("saldir")).toBe("kac");
  expect(coachLearned(st)).toBe(false);
  expect(go("kacis")).toBe("son");
  expect(coachLearned(st)).toBe(true);
  expect(go("tamam")).toBe("bitti");
  expect(coachLine(st, true)).toBeNull();
});

test("zaten kurdun yanındaysan yürüme adımı atlanır; oyunlar kapalıysa kaçma anlatılmaz", () => {
  expect(coachNext("sec", "yanında", true)).toBe("vur");
  expect(coachNext("kac", "tur_bitti", false)).toBe("son");
  expect(coachNext("kac", "tur_bitti", true)).toBe("kac");
  expect(coachLine("vur", false)!.text).not.toMatch(/açık/);
  expect(coachLine("kac", true)!.text).toMatch(/yana/);
});

test("Zehra'nın büyü dersi: aç → çiz → hedef → anladım; sönerse ya da vazgeçerse başa döner", async () => {
  const { spellCoachNext, spellCoachLine } = await import("../src/engine/coach");
  expect(spellCoachNext("ac", "acildi")).toBe("ciz");
  expect(spellCoachNext("ciz", "sondu")).toBe("ac");
  expect(spellCoachNext("ciz", "cizildi")).toBe("hedef");
  expect(spellCoachNext("hedef", "yapti")).toBe("son");
  expect(spellCoachNext("son", "tamam")).toBe("bitti");
  expect(spellCoachLine("ciz")!.text).toMatch(/Alev, sonra Hilal/);
});

test("Selim'in kervan öğüdü o an yapılacak tek şeyi söyler; öğütler kısa", async () => {
  const { caravanTip } = await import("../src/engine/coach");
  const { GUIDES } = await import("../src/content/guides");
  const base = { carts: 1, freeCarts: 1, dests: 1, to: "karacam", units: 4, heroes: 1, guards: 1 };
  expect(caravanTip({ ...base, carts: 0 })).toMatch(/araba al/);
  expect(caravanTip({ ...base, to: undefined })).toMatch(/Nereye/);
  expect(caravanTip({ ...base, units: 0 })).toMatch(/Yük ekle/);
  expect(caravanTip({ ...base, guards: 0 })).toMatch(/İzci/);
  expect(caravanTip(base)).toMatch(/Yola çıkar/);
  for (const g of Object.values(GUIDES)) { expect(g.steps.length).toBeGreaterThanOrEqual(3); for (const t of g.steps) expect(t.length).toBeLessThan(170); }
});
