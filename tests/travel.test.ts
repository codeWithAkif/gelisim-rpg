import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { route, planTravel, travel } from "../src/engine/travel";
import { planSession } from "../src/engine/session";

test("oyun yaylada başlar; köye yürümek zaman alır, bacağı geliştirir", () => {
  const s = newGame(cfg, 1);
  expect(s.location).toBe("yayla");
  const r = route("yayla", "koy_meydani")!;
  expect(r.places[0]).toBe("yayla"); expect(r.places.at(-1)).toBe("koy_meydani");
  const p = planTravel(cfg, s, "koy_meydani");
  expect(p.ok).toBe(true); expect(p.minutes).toBeGreaterThan(40); expect(p.minutes).toBeLessThan(90);
  const m0 = s.minute; const t = travel(cfg, s, "koy_meydani")!;
  expect(s.location).toBe("koy_meydani"); expect(s.minute).toBe(m0 + t.minutes);
  expect(s.attrs.bacak.pending).toBeGreaterThan(0);
});
test("uzak yerler kilitli; çalışmalar yerinde yapılır", () => {
  const s = newGame(cfg, 1);
  expect(planTravel(cfg, s, "karacam").ok).toBe(false);
  expect(planSession(cfg, s, "yuzme", 60_000).ok).toBe(false); // yaylada yüzülmez
  s.location = "dere";
  expect(planSession(cfg, s, "yuzme", 60_000).ok).toBe(true);
});
