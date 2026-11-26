// Sistem tanıtımları: her sistem açıldığı an bir kez "Yeni sayfa" olur.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { newUnlocks, isUnlocked } from "../src/engine/unlocks";

test("yeni oyunda hiçbir sistem tanıtılmaz; pazar varınca bir kez tanıtılır", () => {
  const s = newGame(cfg, 1);
  expect(newUnlocks(s)).toEqual([]);
  s.location = "koy_meydani";
  expect(newUnlocks(s).map(u => u.id)).toEqual(["pazar"]); expect(isUnlocked(s, "pazar")).toBe(true);
  expect(newUnlocks(s)).toEqual([]);                       // ikinci kez gelmez
  s.location = "yayla"; expect(isUnlocked(s, "pazar")).toBe(true);
});

test("evcil, Diyar, ortaklık ve işletme kendi anlarında açılır", () => {
  const s = newGame(cfg, 1);
  s.pet = { id: "kopek", name: "Karabaş", bond: 0 } as typeof s.pet;
  expect(newUnlocks(s).map(u => u.id)).toEqual(["evcil"]);
  s.rep = { taspinar: { taninirlik: 40, guven: 20 } };
  expect(newUnlocks(s).map(u => u.id)).toEqual(["diyar"]);
  s.story.reached.push("k_varis");
  expect(newUnlocks(s).map(u => u.id)).toEqual(["ortaklik", "isletme"]);
});
