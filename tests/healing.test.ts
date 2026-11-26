// Yara bakımı: ilk yardım her bakımı, simya yalnız otlardan yapılan merhemi güçlendirir.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { maxHp } from "../src/engine/combat";
import { healPower, healOf, useHeal } from "../src/engine/healing";

test("simya merhemi güçlendirir, sargı bezini değil; sargıda gerçek değer kullanılır", () => {
  const s = newGame(cfg, 2); if (s.attrs.ilk_yardim) s.attrs.ilk_yardim.level = 0;
  const m0 = healPower(cfg, s, "yara_merhemi"), b0 = healPower(cfg, s, "sargi_bezi");
  expect(m0).toBe(healOf(cfg, "yara_merhemi"));
  s.attrs.simya.level = 50;
  expect(healPower(cfg, s, "yara_merhemi")).toBeCloseTo(m0 * 1.5); expect(healPower(cfg, s, "sargi_bezi")).toBe(b0);
  s.hp = 1; s.inventory.yara_merhemi = 1; const r = useHeal(cfg, s, "yara_merhemi");
  expect(r.ok).toBe(true); expect(r.healed).toBe(Math.min(Math.round(m0 * 1.5), maxHp(cfg, s) - 1));
});
