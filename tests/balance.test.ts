// Denge koruması: başlangıç karakteri kurtlara karşı zorlanmalı, hazırlık fark yaratmalı.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { createBattle, player, enemies, playerAttack, enemyTurn, dist } from "../src/engine/combat";

/** Araziyi ve gözlemi kullanmayan saf oyuncu: bekler, yanına geleni vurur. */
function winRate(prep: (s: GameState) => void, n = 300): number {
  let w = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = newGame(cfg, seed); prep(s);
    const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], seed * 31);
    for (let g = 0; b.phase === "player" && g < 80; g++) {
      const p = player(b);
      const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
      if (dist(p.x, p.y, e.x, e.y) === 1) playerAttack(cfg, s, b, e);
      if (b.phase === "player") enemyTurn(cfg, s, b);
    }
    if (b.phase === "won") w++;
  }
  return w / n;
}

test("kurt dengesi", () => {
  const start = winRate(() => {});
  const geared = winRate(s => { s.equipped = { weapon: "el_yapimi_bicak", armor: "temiz_giysi" }; });
  const trained = winRate(s => { for (const k of ["kilic", "refleks", "kardiyo", "ust_govde"]) s.attrs[k].level += 15; });
  expect(start).toBeGreaterThan(0.25); expect(start).toBeLessThan(0.6);
  expect(geared).toBeGreaterThan(start + 0.15);
  expect(trained).toBeGreaterThan(start + 0.2);
});
