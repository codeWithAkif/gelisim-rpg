// Av: hikâyeden bağımsız, vahşi yerde istediğin zaman kurtlarla dövüşmek.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { placeActions } from "../src/engine/actions";
import { HUNTS } from "../src/content/hunt";
import { MAPS } from "../src/content/world";

test("av: vahşi yerlerde görünür; oradayken ve dinçken açık, uzaktayken ya da yorgunken kapalı; haritalar var", () => {
  for (const [id, h] of Object.entries(HUNTS)) { expect(MAPS[h.map]).toBeTruthy(); expect(h.foes.length).toBeGreaterThan(0); void id; }
  const s = newGame(cfg, 1); s.location = "koru"; s.energy = 90;
  const a = placeActions(cfg, s, "koru").find(x => x.act === "av")!; expect(a).toBeTruthy(); expect(a.disabled).toBeUndefined();
  s.energy = 10; expect(placeActions(cfg, s, "koru").find(x => x.act === "av")!.disabled).toBeTruthy();
  s.energy = 90; s.location = "yayla"; expect(placeActions(cfg, s, "koru").find(x => x.act === "av")!.disabled).toBe("Oraya git");
  expect(placeActions(cfg, s, "koy_meydani").some(x => x.act === "av")).toBe(false);          // köyde av yok
});
