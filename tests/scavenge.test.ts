// Harabe araması: joystick, 3 aşamalı arama, merdiven, baskın, seçim, tuzak/köpek/büyü, bulunan silah, çıkış/ölüm.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { grantRelic } from "../src/engine/relics";
import { createScav, stepScav, setInput, beginSearch, nearSpot, placeTrap, castSpell, leave, atExit, finishScav, pickScavCard, rerollScav, scavSite, canStartScav, loadoutOptions, bagUsed, trapsInHand, LADDER_XS, FOUND_WEAPONS, SPOT_STAGES, type Scav, type SFoe } from "../src/engine/scavenge";

const fresh = () => { const s = newGame(cfg, 4); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "koru"; s.energy = 90; return s; };
const run = (n: Scav, sec: number) => { for (let t = 0; t < sec / 0.05 && n.phase === "play"; t++) stepScav(n, 0.05); };
const foe = (x: number, o: Partial<SFoe> = {}): SFoe => ({ id: 9, def: "kurt", x, floor: 0, hp: 500, max: 500, speed: 0, dmg: 0, cd: 9, human: false, climbT: 0, toFloor: 0, hitT: 0, root: 0, slow: 0, burn: 0, ...o });
const walkTo = (n: Scav, x: number) => { for (let t = 0; t < 400 && Math.abs(n.px - x) > 1.5; t++) { setInput(n, x > n.px ? 1 : -1, 0); stepScav(n, 0.05); } setInput(n, 0, 0); };

test("yer kilitleri ve koşullar", () => {
  const s = newGame(cfg, 4); expect(canStartScav(s, "koru").ok).toBe(false);
  s.quests.kurt = { status: "bitti", count: 1 }; s.energy = 90; expect(canStartScav(s, "koru").ok).toBe(true);
  s.energy = 5; expect(canStartScav(s, "koru").ok).toBe(false); expect(canStartScav(s, "yayla").ok).toBe(false);
});

test("joystickle yürünür; her kutu 3 kez aranır ve değerli çıkacaksa daha yavaştır", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 3, { kind: "yumruk" }); n.raidT = 999;
  const sp = n.spots.find(q => q.floor === 0)!; walkTo(n, sp.x); expect(nearSpot(n)?.id).toBe(sp.id);
  expect(beginSearch(n)).toBe(true); run(n, 0.5); expect(sp.stage).toBe(0); run(n, 20);
  expect(sp.done).toBe(true); expect(sp.stages.length).toBe(SPOT_STAGES); expect(n.searched).toBe(1);
  // süre: boş/basit şey hızlı, silah yavaş
  const total = sp.stages.reduce((a, x) => a + x.time, 0); expect(total).toBeGreaterThan(2.5);
  expect(Math.max(...n.spots.flatMap(q => q.stages.map(x => x.time)))).toBeGreaterThan(Math.min(...n.spots.flatMap(q => q.stages.map(x => x.time))));
});

test("merdivende yavaş yavaş çıkılır, birden değil", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 3, { kind: "yumruk" }); n.raidT = 999;
  walkTo(n, LADDER_XS[0]); setInput(n, 0, -1); run(n, 0.5); expect(n.py).toBeGreaterThan(0); expect(n.py).toBeLessThan(1); expect(n.climbing).toBe(true);
  run(n, 4); expect(n.py).toBe(1); expect(n.floor).toBe(1); expect(n.climbing).toBe(false);
});

test("ilk baskın en geç 15 sn sonra gelir", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 4, { kind: "yumruk" }); run(n, 16); expect(n.wave).toBeGreaterThanOrEqual(1);
  const t0 = n.wave; run(n, 16); expect(n.wave).toBeGreaterThan(t0);
});

test("baskın gelir; yaysız yumrukla bile vurulur", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 5, { kind: "yumruk" }); expect(n.bow).toBe(false);
  n.raidT = 0.1; run(n, 1); expect(n.wave).toBe(1); expect(n.foes.length).toBeGreaterThan(0);
  n.foes = [foe(n.px + 4, { hp: 30, max: 30 })]; run(n, 10); expect(n.foes.length === 0 || n.foes[0].hp < 30).toBe(true);
});

test("seçim tek şeydir: yay seçilirse oklarla, silah seçilirse onunla", () => {
  const s = fresh(); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; s.inventory.ok = 10; s.equipped.weapon = "el_yapimi_bicak"; s.inventory.el_yapimi_bicak = 1;
  const opts = loadoutOptions(cfg, s); expect(opts.some(o => o.kind === "bow")).toBe(true); expect(opts.some(o => o.kind === "melee" && o.id === "el_yapimi_bicak")).toBe(true);
  const b = createScav(cfg, s, scavSite("koru")!, 6, { kind: "bow" }); expect(b.bow).toBe(true); expect(b.ammo).toBe(10); b.raidT = 999;
  b.foes = [foe(b.px + 40)]; run(b, 3); expect(b.shots).toBeGreaterThan(0);
  const m = createScav(cfg, s, scavSite("koru")!, 6, { kind: "melee", id: "el_yapimi_bicak" }); expect(m.bow).toBe(false); expect(m.melee).toBeGreaterThan(createScav(cfg, s, scavSite("koru")!, 6, { kind: "yumruk" }).melee);
});

test("tuzak tetiklenince dolana kadar bekler, sonra yeniden kurulur", () => {
  const s = fresh(); s.yapi = { kazik_cukuru: { n: 2, lv: 1 } };
  const n = createScav(cfg, s, scavSite("koru")!, 7, { kind: "trap", id: "kazik_cukuru" }); n.raidT = 999; expect(trapsInHand(n)).toBe(2);
  walkTo(n, 60); expect(placeTrap(n)).toBe(true); expect(trapsInHand(n)).toBe(1);
  n.foes = [foe(60)]; run(n, 0.2); expect(n.foes[0].hp).toBeLessThan(500); expect(n.traps[0].state).toBe("cool");
  n.foes = []; expect(placeTrap(n)).toBe(true); expect(placeTrap(n)).toBe(false);
  run(n, 26); expect(n.traps[0].state).toBe("hand"); expect(trapsInHand(n)).toBe(1);
});

test("köpek arada çıkıp düşmanla dövüşür ve geri döner", () => {
  const s = fresh(); s.pet = { id: "kopek", name: "Karabaş", bond: 40 };
  const n = createScav(cfg, s, scavSite("koru")!, 8, { kind: "dog" }); n.raidT = 999; expect(n.dog).toBeTruthy();
  n.foes = [foe(n.px + 60, { hp: 80, max: 80 })]; n.dog!.t = 0.1; run(n, 1); expect(n.dog!.state).toBe("av");
  run(n, 8); expect(n.foes.length === 0 || n.foes[0].hp < 80).toBe(true);
  n.foes = []; run(n, 12); expect(["don", "yanda"]).toContain(n.dog!.state);
});

test("yalnız seçilen büyü kullanılır ve dolması beklenir", () => {
  const s = fresh(); s.knownElements = ["el_ates"]; s.mana = 100; for (const r of ["ardic_koku"]) grantRelic(cfg, s, r, {});
  const sp = loadoutOptions(cfg, s).find(o => o.kind === "spell"); if (!sp) return;
  const n = createScav(cfg, s, scavSite("koru")!, 9, { kind: "spell", id: sp.id }); n.raidT = 999; expect(n.spell).toBeTruthy(); n.spell!.cd = 0;
  n.foes = [foe(n.px + 60)]; expect(castSpell(n)).toBe(true); expect(n.proj.length).toBe(1); run(n, 1.5); expect(n.foes[0].hp).toBeLessThan(500); expect(castSpell(n)).toBe(false);
});

test("kutudan silah çıkar, kullanılır; çıkışta yalnız parçası cebe girer", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 10, { kind: "yumruk" }); n.raidT = 999; const sp = n.spots[0];
  sp.stages = [{ kind: "weapon", weapon: "kemik_balta", time: 0.5 }, { kind: "empty", time: 0.3 }, { kind: "empty", time: 0.3 }];
  walkTo(n, sp.x); const m0 = n.melee; beginSearch(n); run(n, 5);
  expect(n.melee).toBeGreaterThan(m0); expect(n.weaponName).toBe("Kemik saplı balta");
  walkTo(n, 8); expect(atExit(n)).toBe(true); leave(n); const r = finishScav(cfg, s, n);
  expect(r.result).toBe("exit"); const w = FOUND_WEAPONS.find(x => x.id === "kemik_balta")!; expect(w.parts.some(p => (s.inventory[p] ?? 0) > 0)).toBe(true);
  expect(s.inventory.kemik_balta).toBeUndefined();
});

test("çıkışta kazanç cebe girer, ölünce çanta gider; çanta dolunca fazlası alınmaz", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 11, { kind: "yumruk" }); n.raidT = 999; const m0 = s.money;
  n.bag = { deri: 2 }; n.money = 6; walkTo(n, 60); walkTo(n, 6); expect(leave(n)).toBe(true);
  const r = finishScav(cfg, s, n); expect(r.result).toBe("exit"); expect(s.inventory.deri).toBeGreaterThanOrEqual(2); expect(s.money).toBe(m0 + 6);
  const s2 = fresh(); const d = createScav(cfg, s2, scavSite("koru")!, 12, { kind: "yumruk" }); d.bag = { deri: 3 }; d.money = 10; d.hp = 0.1; d.raidT = 999;
  d.foes = [foe(d.px + 1, { hp: 999, max: 999, dmg: 50, cd: 0 })]; run(d, 3); expect(d.result).toBe("dead");
  finishScav(cfg, s2, d); expect(s2.inventory.deri ?? 0).toBe(0); expect(s2.hp).toBeGreaterThan(0);
  const c = createScav(cfg, s, scavSite("koru")!, 13, { kind: "yumruk" }); c.bag = { deri: c.bagCap }; expect(bagUsed(c)).toBe(c.bagCap);
  c.phase = "card"; c.offer = ["genis_cep", "cevik_el", "keskin_el"]; const old = [...c.offer]; expect(rerollScav(c)).toBe(true); expect(c.offer.some(x => !old.includes(x))).toBe(true);
  c.offer = ["genis_cep"]; const cap = c.bagCap; expect(pickScavCard(c, "genis_cep")).toBe(true); expect(c.bagCap).toBe(cap + 3);
  void ({} as GameState);
});

test("çanta doluyken bulunan eşya yere düşer; yer açılınca alınır; atılan eşya yerde kalır", async () => {
  const { dropBag, nearGround, pickGround } = await import("../src/engine/scavenge");
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru")!, 21, { kind: "yumruk" }); n.raidT = 999; const sp = n.spots[0];
  n.bag = { deri: n.bagCap }; sp.stages = [{ kind: "item", item: "ip", n: 2, time: 0.4 }, { kind: "empty", time: 0.2 }, { kind: "empty", time: 0.2 }];
  walkTo(n, sp.x); beginSearch(n); run(n, 3);
  expect(n.ground.filter(g => g.item === "ip").length).toBe(2); expect(bagUsed(n)).toBe(n.bagCap);
  expect(nearGround(n)?.item).toBe("ip"); expect(pickGround(n)).toBe("full");
  expect(dropBag(n, "deri")).toBe(true); const ipG = n.ground.find(g => g.item === "ip")!; expect(pickGround(n, ipG.id)).toBe("ok"); expect(n.bag.ip).toBe(1); expect(bagUsed(n)).toBe(n.bagCap);
  walkTo(n, 8); leave(n); const r = finishScav(cfg, s, n); expect(r.items.deri).toBe(n.bagCap - 1); expect(r.items.ip).toBe(1);
});
