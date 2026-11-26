// Kadim çağrılar (sarmaşık, karga sürüsü, yerden kılıçlar) ve nöbette bekleyen Karabaş.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { spellOptions, castSpell } from "../src/engine/magic";
import { grantRelic } from "../src/engine/relics";
import { createBattle, enemies } from "../src/engine/combat";
import { createNobet, stepNobet, useSpell, pickCard, placePet, nobetSite, TOWER } from "../src/engine/nobet";

const withRelics = () => { const s = newGame(cfg, 6); s.mana = 100; for (const r of ["ardic_koku", "kara_tuy", "pasli_kabza"]) grantRelic(cfg, s, r, {}); return s; };

test("kadim çağrılar eşyası bulununca öğrenilir", () => {
  const s = newGame(cfg, 6); s.mana = 100;
  expect(spellOptions(cfg, s).some(o => o.spell.id === "sarmasik")).toBe(false);
  const t = withRelics(); const ids = spellOptions(cfg, t).filter(o => o.ok).map(o => o.spell.id);
  expect(ids).toEqual(expect.arrayContaining(["sarmasik", "karga_surusu"]));
});

test("savaşta sarmaşık yere bağlar, kılıçlar sersemletir", () => {
  const s = withRelics(); s.attrs.toprak_buyu = { level: 10, pending: 0, peak: 10, lastUsedDay: 0 }; s.attrs.odak = { level: 60, pending: 0, peak: 60, lastUsedDay: 0 };
  const b = createBattle(cfg, s, "mera", ["kurt"], 3); const e = enemies(b)[0]; const p = b.units[0];
  e.x = p.x; e.y = p.y - 2;
  castSpell(cfg, s, b, "sarmasik", e.x, e.y, 1);
  expect(e.rooted ?? 0).toBeGreaterThan(0);
  const b2 = createBattle(cfg, s, "mera", ["kurt"], 4); const e2 = enemies(b2)[0]; const p2 = b2.units[0]; e2.x = p2.x; e2.y = p2.y - 2; e2.hp = 999;
  castSpell(cfg, s, b2, "yer_kiliclari", e2.x, e2.y, 1);
  expect(e2.stunned ?? 0).toBeGreaterThan(0);
});

test("nöbette Karabaş yerinde bekler, kolladığı yere gireni kovalar", () => {
  const s = newGame(cfg, 6); s.pet = { id: "kopek", name: "Karabaş", bond: 20 };
  const n = createNobet(cfg, s, nobetSite("yayla")!, 1); n.breakT = 999;
  placePet(n, TOWER.x + 20, TOWER.y);
  for (let i = 0; i < 60; i++) stepNobet(s, n, 0.05);
  expect(Math.hypot(n.pet!.x - n.pet!.hx, n.pet!.y - n.pet!.hy)).toBeLessThan(1);   // durur, dönmez
  n.foes.push({ id: 99, def: "kurt", x: n.pet!.hx + 10, y: n.pet!.hy, hp: 50, max: 50, speed: 0, dmg: 1, cd: 1, r: 3, boss: false, burn: 0, slow: 0, root: 0, stun: 0, peck: 0, human: false, reward: 1 });
  for (let i = 0; i < 30; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBeLessThan(50);
});

test("nöbet büyüleri: sarmaşık durdurur, karga saldırtmaz, kılıçlar sersemletir; kartla öğrenilir", () => {
  const s = newGame(cfg, 6); const n = createNobet(cfg, s, nobetSite("yayla")!, 2); n.breakT = 999;
  expect(n.spells.sarmasik).toBeUndefined();
  n.phase = "card"; n.offer = ["b_sarmasik", "b_karga", "b_kilic"]; pickCard(s, n, "b_sarmasik");
  n.phase = "card"; n.offer = ["b_karga"]; pickCard(s, n, "b_karga"); n.phase = "card"; n.offer = ["b_kilic"]; pickCard(s, n, "b_kilic");
  const foe = (id: number, x: number) => ({ id, def: "kurt", x, y: TOWER.y, hp: 500, max: 500, speed: 8, dmg: 5, cd: 0, r: 3, boss: false, burn: 0, slow: 0, root: 0, stun: 0, peck: 0, human: false, reward: 1 });
  n.foes = [foe(1, TOWER.x + 30)]; expect(useSpell(n, "sarmasik")).toBe(true);
  const x0 = n.foes[0].x; stepNobet(s, n, 0.05); expect(n.foes[0].x).toBe(x0);
  n.foes = [foe(2, TOWER.x + TOWER.r + 3)]; const hp0 = n.hp; useSpell(n, "karga");
  for (let i = 0; i < 20; i++) stepNobet(s, n, 0.05); expect(n.hp).toBeGreaterThanOrEqual(hp0);
  n.foes = [foe(3, TOWER.x + 25)]; expect(useSpell(n, "kilic")).toBe(true); expect(n.foes[0].stun).toBeGreaterThan(0);
  expect(useSpell(n, "kilic")).toBe(false); // doluyor
});
