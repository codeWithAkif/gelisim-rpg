// Ekranı kaplayan katman sınıfları (.battle, .intro, .modal-bg) başka öğelere sızmasın.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, log } from "../src/engine/state";
import { defterScreen } from "../src/ui/screens";

test("Defter notları tam ekran katman sınıfı almaz", () => {
  const s = newGame(cfg, 1);
  for (const k of ["battle", "gain", "warn", "quest", "info"] as const) log(s, "deneme " + k, k);
  const html = defterScreen(cfg, s);
  const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/));
  for (const bad of ["battle", "intro", "modal-bg", "plan"]) expect(classes).not.toContain(bad);
});
