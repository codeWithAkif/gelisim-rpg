// Sıradaki adım: her an tek bir öneri ve onu yapan tek düğme.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, DAY_MINUTES } from "../src/engine/state";
import { nextStep } from "../src/engine/actions";
import { acceptQuest } from "../src/engine/quests";

test("yeni oyunda: Hasan burada, işi üstlen; üstlenince gidilecek yer haritada gösterilir", () => {
  const s = newGame(cfg, 1);
  const a = nextStep(s)!; expect(a.act).toBe("accept"); expect(a.button).toBe("Üstlen");
  acceptQuest(s, a.id!);
  const b = nextStep(s)!; expect(b.act).toBe("show-place"); expect(b.id).not.toBe(s.location);
  s.location = b.id!; const c = nextStep(s)!; expect(["walk", "fight"]).toContain(c.act); expect(c.id).toBe(a.id);
});

test("gün bitince ya da bitkinken önce uyku önerilir", () => {
  const s = newGame(cfg, 1); s.minute = DAY_MINUTES;
  expect(nextStep(s)!.act).toBe("sleep");
  const t = newGame(cfg, 1); t.energy = 5; expect(nextStep(t)!.act).toBe("sleep");
});
