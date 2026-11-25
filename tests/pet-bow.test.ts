// Evcil köpek ve ok: köpek savaşta yardım eder ve aramada iz bulur; ok menzilli, ok tüketir.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { createBattle, player, enemies, allies, playerAttack, enemyTurn, dist, previewShot, playerShoot, finishBattle } from "../src/engine/combat";
import { findChance, searchInfo } from "../src/engine/explore";
import { attackTimingMods } from "../src/engine/timing";
import { completeQuest } from "../src/engine/quests";

const rate = (prep: (s: GameState) => void, n = 200) => {
  let w = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = newGame(cfg, seed); prep(s);
    const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], seed * 31);
    for (let g = 0; b.phase === "player" && g < 80; g++) {
      const p = player(b); const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
      if (dist(p.x, p.y, e.x, e.y) === 1) playerAttack(cfg, s, b, e);
      if (b.phase === "player") enemyTurn(cfg, s, b);
    }
    if (b.phase === "won") w++;
  }
  return w / n;
};

test("köpek görevle gelir, savaşta yanında olur ve kazanma şansını artırır", () => {
  const s = newGame(cfg, 1); s.quests.kopek = { status: "aktif" };
  completeQuest(cfg, s, "kopek");
  expect(s.pet?.name).toBe("Karabaş");
  const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], 5);
  expect(allies(b)).toHaveLength(1);
  const alone = rate(() => {}), withDog = rate(s => { s.pet = { id: "kopek", name: "Karabaş", bond: 30 }; });
  expect(withDog).toBeGreaterThan(alone + 0.08);
  expect(withDog).toBeLessThan(0.97);
});

test("bağ savaşla ve aramayla büyür; köpek aramada yardım eder", () => {
  const s = newGame(cfg, 2); const c0 = findChance(s, "koku"), left0 = searchInfo(s, "dere").left;
  s.pet = { id: "kopek", name: "Karabaş", bond: 5 };
  expect(findChance(s, "koku")).toBeGreaterThan(c0 + 10);
  expect(searchInfo(s, "dere").left).toBe(left0 + 1);
  const b = createBattle(cfg, s, "mera", ["kurt"], 3);
  for (let g = 0; b.phase === "player" && g < 60; g++) enemyTurn(cfg, s, b);
  finishBattle(cfg, s, b);
  expect(s.pet.bond).toBeGreaterThan(5);
});

test("ok: menzilde atılır, ok tüketir, yay yoksa olmaz; kafaya isabet yıkıcı", () => {
  const s = newGame(cfg, 4); const b = createBattle(cfg, s, "mera", ["kurt"], 9);
  const p = player(b); const e = enemies(b)[0]; e.x = p.x; e.y = p.y - 3;
  expect(previewShot(cfg, s, b, e).reason).toBe("Yayın yok");
  s.inventory.av_yayi = 1; expect(previewShot(cfg, s, b, e).reason).toBe("Okun kalmadı");
  s.inventory.ok = 3;
  const pv = previewShot(cfg, s, b, e); expect(pv.ok).toBe(true);
  e.y = p.y - 7; if (e.y >= 0) expect(previewShot(cfg, s, b, e).ok).toBe(false); e.y = p.y - 3;
  const hp = e.hp; const r = playerShoot(cfg, s, b, e, 1.25)!;
  expect(s.inventory.ok).toBe(2); expect(r.hit).toBe(true); expect(e.hp).toBeLessThan(hp);
  expect(attackTimingMods(1.25).crit).toBeGreaterThan(attackTimingMods(1).crit * 2);
  const b2 = createBattle(cfg, s, "mera", ["kurt"], 9); const e2 = enemies(b2)[0]; e2.x = player(b2).x; e2.y = player(b2).y - 2;
  expect(playerShoot(cfg, s, b2, e2, 0)!.hit).toBe(false);   // ıskalanan çekiş
});
