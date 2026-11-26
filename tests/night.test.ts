// Gece: gün 04:00'e kadar sürer; gece işi daha çok kazandırır; kurtlar her seferinde başka yerden çıkar.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, isNight, DAY_MINUTES } from "../src/engine/state";
import { enemySpots } from "../src/engine/combat";
import { completeQuest } from "../src/engine/quests";
import { MAPS, MAP_CHARS, TERRAIN } from "../src/content/world";

test("gece 20:00'de başlar, gün gece yarısını geçer", () => {
  const s = newGame(cfg, 1); s.minute = 13 * 60; expect(isNight(s)).toBe(false);
  s.minute = 15 * 60; expect(isNight(s)).toBe(true);
  expect(DAY_MINUTES).toBeGreaterThan(18 * 60);
});

test("merada kurtlar her seferinde başka yerden çıkar, üst üste binmez, geçilmez yere konmaz", () => {
  const m = MAPS.mera; const seen = new Set<string>();
  for (let seed = 1; seed < 40; seed++) {
    const sp = enemySpots("mera", 4, seed);
    expect(new Set(sp.map(p => p.join())).size).toBe(4);
    for (const [x, y] of sp) expect(TERRAIN[MAP_CHARS[m.rows[y][x]] ?? "cayir"].blocks).toBeFalsy();
    seen.add(sp[0].join());
  }
  expect(seen.size).toBeGreaterThan(5);
});

test("gece işi daha çok para getirir", () => {
  const a = newGame(cfg, 1); const b = newGame(cfg, 1);
  const r1 = completeQuest(cfg, a, "devriye", { night: false, extraFoes: 0 });
  const r2 = completeQuest(cfg, b, "devriye", { night: true, extraFoes: 1 });
  expect(r2.money).toBeGreaterThan(r1.money); expect(r2.bonus).toBeTruthy();
});
