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
