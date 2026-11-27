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

test("ortam: her yerde gece ve gündüz en az bir kayıt çalar; planlanan her kaydın dosyası var (ocak seçimi bekliyor)", async () => {
  const { ambientPlan, playableLayers } = await import("../src/engine/soundscape");
  const { readdirSync } = await import("node:fs");
  const have = new Set(readdirSync("src/assets/ses").filter(f => f.startsWith("ortam_")).map(f => f.replace(/^ortam_|\.ogg$/g, "")));
  for (const p of PLACES) for (const night of [false, true]) for (const road of [false, true]) {
    const plan = ambientPlan(scapeOf(p, road), night);
    expect(playableLayers(plan, have).length, `${p.id} gece=${night} yol=${road}`).toBeGreaterThan(0);
    for (const l of plan.layers) if (l.id !== "ocak") expect(have.has(l.id), l.id).toBe(true);
  }
  expect(have.has("baykus_1") && have.has("baykus_2")).toBe(true);
});

test("ortam: gece açıkta cırcır, gündüz yaylada koyun çanları; Ayazkale'de rüzgâr yerine kar fırtınası; baykuş yalnız gece koruda ve yaylada", async () => {
  const { ambientPlan } = await import("../src/engine/soundscape");
  const ids = (k: Parameters<typeof ambientPlan>[0], n: boolean) => ambientPlan(k, n).layers.map(l => l.id);
  expect(ids(scapeOf(at("yayla")), false)).toContain("koyun"); expect(ids(scapeOf(at("yayla")), true)).toContain("gece");
  expect(ids(scapeOf(at("karacam")), false)).toContain("carsi"); expect(ids(scapeOf(at("karacam")), true)).not.toContain("carsi");
  expect(ids(scapeOf(at("ayaz_mutfak")), false)).not.toContain("ruzgar");
  expect(ambientPlan(scapeOf(at("koru")), true).owls).toBe(true); expect(ambientPlan(scapeOf(at("koru")), false).owls).toBe(false);
  expect(ambientPlan(scapeOf(at("karacam")), true).owls).toBe(false);
});
