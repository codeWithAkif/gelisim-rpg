// Eşikler: oyunda var olan kapılar tek listede; aşılınca bir kez "Artık …" olur.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { allThresholds, crossedThresholds, nextThreshold, met } from "../src/engine/thresholds";
import { discoverable } from "../src/engine/combat";

test("katalog var olan kapılardan kurulur: zayıf nokta, el işi, yapı, büyü", () => {
  const ids = allThresholds(cfg).map(t => t.id);
  expect(ids).toContain("zayif_insan_diz"); expect(ids).toContain("zayif_kurt_burun");
  expect(ids.some(i => i.startsWith("elisi_"))).toBe(true); expect(ids.some(i => i.startsWith("yapi_"))).toBe(true);
  expect(ids.some(i => i.startsWith("buyu_"))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
});

test("ilk çağrı sessiz; sonra aşılan eşik bir kez döner ve savaştaki zayıf noktayla aynı kuralı izler", () => {
  const s = newGame(cfg, 2);
  expect(crossedThresholds(cfg, s)).toEqual([]);
  const burun = allThresholds(cfg).find(t => t.id === "zayif_kurt_burun")!;
  expect(met(s, burun)).toBe(false);
  s.attrs.anatomi_hayvan.level = 8;
  const got = crossedThresholds(cfg, s).map(t => t.id);
  expect(got).toContain("zayif_kurt_burun");
  expect(discoverable(cfg, s, "kurt").some(w => w.id === "burun")).toBe(true);
  expect(crossedThresholds(cfg, s)).toEqual([]);
});

test("sıradaki eşik: en yakın görünür kapı; bilinmeyen büyü gösterilmez", () => {
  const s = newGame(cfg, 2);
  const n = nextThreshold(cfg, s, "anatomi_hayvan")!; expect(n.at).toBe(3); expect(n.t.id).toBe("zayif_kurt_boyun");
  expect(nextThreshold(cfg, s, "toprak_buyu")).toBeNull();
});

test("Vücut'ta ana özellikler görünür, gerisi katlanır; çalışılan özellik görünür olur", async () => {
  const { attrShown, CORE_ATTRS } = await import("../src/engine/thresholds");
  const s = newGame(cfg, 2);
  const shown = cfg.data.attributes.filter(a => attrShown(cfg, s, a.id)).map(a => a.id);
  expect(shown.length).toBeLessThanOrEqual(18); expect(shown.length).toBeLessThan(cfg.data.attributes.length / 2 + 2);
  for (const id of CORE_ATTRS.filter(i => i !== "mana")) expect(shown).toContain(id);
  expect(attrShown(cfg, s, "aldatma")).toBe(false);
  s.attrs.aldatma.level += 1; expect(attrShown(cfg, s, "aldatma")).toBe(true);
});
