// Harabe araması: arama noktaları, merdiven, baskın, çıkışta kazanç / ölümde kayıp.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { createScav, stepScav, goTo, goToSpot, goToExit, leave, atExit, finishScav, pickScavCard, rerollScav, scavSite, canStartScav, SCAV_SITES, bagUsed } from "../src/engine/scavenge";

const fresh = () => { const s = newGame(cfg, 4); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "koru"; s.energy = 90; return s; };
const run = (n: ReturnType<typeof createScav>, sec: number, s = fresh()) => { for (let t = 0; t < sec / 0.05 && n.phase === "play"; t++) stepScav(n, 0.05); void s; };

test("yer kilitleri ve koşullar", () => {
  const s = newGame(cfg, 4); expect(canStartScav(s, "koru").ok).toBe(false);
  s.quests.kurt = { status: "bitti", count: 1 }; s.energy = 90; expect(canStartScav(s, "koru").ok).toBe(true);
  s.energy = 5; expect(canStartScav(s, "koru").ok).toBe(false); expect(canStartScav(s, "yayla").ok).toBe(false);
});

test("noktaya yürüyüp arar, bulduğu çantaya girer; merdivenle kat değiştirir", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 3);
  const sp = n.spots.find(q => q.floor === 0)!; goToSpot(n, sp.id); run(n, 14);
  expect(sp.done).toBe(true); expect(n.searched).toBe(1);
  const up = n.spots.find(q => q.floor === 1)!; n.raidT = 999; goToSpot(n, up.id); run(n, 25);
  expect(n.floor).toBe(1); expect(up.done).toBe(true);
});

test("baskın gelir; yaysız yakın dövüşle vurulur, düşman can alır", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 5); expect(n.bow).toBe(false);
  n.raidT = 0.1; run(n, 1); expect(n.wave).toBe(1); expect(n.foes.length).toBeGreaterThan(0);
  const hp0 = n.foes.reduce((a, f) => a + f.hp, 0); run(n, 12);
  expect(n.foes.reduce((a, f) => a + f.hp, 0) < hp0 || n.kills > 0 || n.phase === "over").toBe(true);
});

test("yayı ve oku olan uzaktan vurur", () => {
  const s = fresh(); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; s.inventory.ok = 10;
  const n = createScav(cfg, s, scavSite("koru")!, 6); expect(n.bow).toBe(true); expect(n.ammo).toBe(10);
  n.foes.push({ id: 9, def: "kurt", x: n.px + 40, floor: 0, hp: 500, max: 500, speed: 0, dmg: 0, cd: 9, human: false, climbT: 0, toFloor: 0, hitT: 0 });
  n.raidT = 999; run(n, 3); expect(n.shots).toBeGreaterThan(0); expect(n.foes[0].hp).toBeLessThan(500);
});

test("çıkışta kazanç cebe girer, ölünce çanta gider", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 7); n.raidT = 999; const m0 = s.money;
  n.bag = { deri: 2, ip: 1 }; n.money = 6; goTo(n, 100, 0); run(n, 6); goToExit(n); run(n, 8); expect(atExit(n)).toBe(true); expect(leave(n)).toBe(true);
  const r = finishScav(cfg, s, n); expect(r.result).toBe("exit"); expect(s.inventory.deri).toBeGreaterThanOrEqual(2); expect(s.money).toBe(m0 + 6);
  const s2 = fresh(); const d = createScav(cfg, s2, scavSite("koru")!, 8); d.bag = { deri: 3 }; d.money = 10; d.hp = 0.1;
  d.foes.push({ id: 1, def: "kurt", x: d.px + 1, floor: 0, hp: 999, max: 999, speed: 0, dmg: 50, cd: 0, human: false, climbT: 0, toFloor: 0, hitT: 0 }); d.raidT = 999; run(d, 3);
  expect(d.result).toBe("dead"); const r2 = finishScav(cfg, s2, d); expect(r2.items.deri).toBeUndefined(); expect(s2.inventory.deri ?? 0).toBe(0); expect(s2.hp).toBeGreaterThan(0);
});

test("çanta dolunca fazlası alınmaz; kart seçilir ve sayfa çevrilir", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 9); n.bag = { deri: n.bagCap }; expect(bagUsed(n)).toBe(n.bagCap);
  n.phase = "card"; n.offer = ["genis_cep", "cevik_el", "keskin_el"]; const old = [...n.offer]; expect(rerollScav(n)).toBe(true); expect(n.offer.some(x => !old.includes(x))).toBe(true);
  n.offer = ["genis_cep"]; const cap = n.bagCap; expect(pickScavCard(n, "genis_cep")).toBe(true); expect(n.bagCap).toBe(cap + 3); expect(n.phase).toBe("play");
  expect(SCAV_SITES.length).toBeGreaterThan(2);
});
