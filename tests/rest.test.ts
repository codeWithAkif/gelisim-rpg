// Uyku ve dinlenme: konak güvenli ve dinlendirir; açıkta uyumak tehlikeli; dinlenmek enerji verir, acıktırır.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { sleepOptions, sleepAt, rest, campRisk } from "../src/engine/rest";

test("konak: misafir olunca açılır, güvenli ve daha dinlendirici", () => {
  const s = newGame(cfg, 1); s.location = "zehra_evi";
  expect(sleepOptions(s).find(o => o.kind === "lodging")?.ok).toBe(false);
  s.quests.annenin_izi = { status: "bitti", count: 1 };
  const o = sleepOptions(s).find(o => o.kind === "lodging")!; expect(o.ok).toBe(true); expect(o.risk).toBe(0);
  const r = sleepAt(cfg, s, "lodging"); expect("error" in r).toBe(false);
  const bed = s.energy;
  const t = newGame(cfg, 1); t.location = "zehra_evi"; sleepAt(cfg, t, "open");
  expect(bed).toBeGreaterThan(t.energy);
});

test("açıkta uyumak: zamanla başa bir şey gelir; köpek riski azaltır; çadır yoksa çadır kurulmaz", () => {
  let events = 0;
  for (let d = 0; d < 40; d++) { const s = newGame(cfg, 3); s.day = d + 1; s.location = "koru"; s.money = 20; const r = sleepAt(cfg, s, "open"); if (!("error" in r) && r.event) events++; }
  expect(events).toBeGreaterThan(3);
  const s = newGame(cfg, 3); s.location = "koru"; const r0 = campRisk(s); s.pet = { id: "kopek", name: "Karabaş", bond: 20 };
  expect(campRisk(s)).toBeLessThan(r0 * 0.6);
  expect(sleepOptions(s).find(o => o.kind === "tent")?.ok).toBe(false);
  s.inventory.cadir = 1; expect(sleepOptions(s).find(o => o.kind === "tent")?.ok).toBe(true);
});

test("dinlenmek: enerji artar, tokluk düşer, zaman geçer", () => {
  const s = newGame(cfg, 2); s.energy = 30; s.satiety = 60; const m = s.minute;
  const r = rest(cfg, s, 120); expect("error" in r).toBe(false);
  expect(s.energy).toBeGreaterThan(45); expect(s.satiety).toBeLessThan(50); expect(s.minute).toBe(m + 120);
  s.minute = 16 * 60 - 5; expect("error" in rest(cfg, s, 60)).toBe(true);
});
