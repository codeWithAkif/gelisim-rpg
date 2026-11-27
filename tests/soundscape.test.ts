// Ses haritası: her yerin bir ortam sesi var; müzik elde olan en uygun parçayı seçer, yoksa susar.
import { test, expect } from "vitest";
import { PLACES } from "../src/content/map";
import { scapeOf, musicCandidates, pickTrack, MOTIF, motifLength } from "../src/engine/soundscape";

const at = (id: string) => PLACES.find(p => p.id === id)!;

test("her yerin bir ortam sesi var; Taşpınar yerleri kendi sesini alır, yolda yol sesi", () => {
  for (const p of PLACES) expect(scapeOf(p).kind, p.id).toBeTruthy();
  expect(scapeOf(at("yayla")).kind).toBe("yayla"); expect(scapeOf(at("dere")).kind).toBe("dere");
  expect(scapeOf(at("koy_meydani")).kind).toBe("meydan"); expect(scapeOf(at("demirhane")).kind).toBe("ocak");
  expect(scapeOf(at("koru")).kind).toBe("koru");
  expect(scapeOf(at("yayla"), true).kind).toBe("yol"); expect(scapeOf(undefined).kind).toBe("yol");
});

test("Ayazkale'de her şeyin altında soğuk rüzgâr; dağ orada kar olur", () => {
  expect(scapeOf(at("ayaz_gecit"))).toEqual({ kind: "kar", cold: true });
  expect(scapeOf(at("ayaz_mutfak")).cold).toBe(true);
  expect(scapeOf(at("karacam")).kind).toBe("sehir"); expect(scapeOf(at("karacam")).cold).toBe(false);
});

test("müzik: önce bağlamın parçası, sonra gece parçası, sonra bölge; hiçbiri yoksa sessizlik", () => {
  expect(musicCandidates("taspinar", false)).toEqual(["muzik_taspinar"]);
  expect(musicCandidates("ardic", true, "savas")).toEqual(["muzik_savas", "muzik_ardic_gece", "muzik_ardic"]);
  expect(pickTrack(musicCandidates("ardic", true, "savas"), ["muzik_ardic"])).toBe("muzik_ardic");
  expect(pickTrack(musicCandidates("karacam", false, "olcer"), new Set(["muzik_olcer", "muzik_karacam"]))).toBe("muzik_olcer");
  expect(pickTrack(musicCandidates("taspinar", false), [])).toBeNull();
});

test("annenin ezgisi: notalar dizide, kısa olanı tamın başı", () => {
  for (const m of Object.values(MOTIF)) for (const x of m) { expect(x.n).toBeGreaterThanOrEqual(0); expect(x.n).toBeLessThan(6); expect(x.d).toBeGreaterThan(0); }
  expect(MOTIF.tam.slice(0, MOTIF.kisa.length)).toEqual(MOTIF.kisa);
  expect(motifLength(MOTIF.kisa, 0.36)).toBeCloseTo(1.8); expect(motifLength(MOTIF.tam, 0.42)).toBeLessThan(6);
});
