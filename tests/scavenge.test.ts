// Harabe araması: joystick, 3 aşamalı arama, merdiven, baskın, seçim, tuzak/köpek/büyü, bulunan silah, çıkış/ölüm.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { grantRelic } from "../src/engine/relics";
import { createScav, stepScav, setInput, beginSearch, nearSpot, placeTrap, castSpell, leave, atExit, finishScav, scavSite, scavTraits, canStartScav, loadoutOptions, bagUsed, trapsInHand, ladderAt, FOUND_WEAPONS, SPOT_STAGES, type Scav, type SFoe } from "../src/engine/scavenge";
import { maxHp } from "../src/engine/combat";

const fresh = () => { const s = newGame(cfg, 4); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "koru"; s.energy = 90; return s; };
const run = (n: Scav, sec: number) => { for (let t = 0; t < sec / 0.05 && n.phase === "play"; t++) stepScav(n, 0.05); };
const foe = (x: number, o: Partial<SFoe> = {}): SFoe => ({ id: 9, def: "kurt", x, floor: 0, hp: 500, max: 500, speed: 0, dmg: 0, cd: 9, human: false, climbT: 0, toFloor: 0, hitT: 0, root: 0, slow: 0, burn: 0, ...o });
const walkTo = (n: Scav, x: number) => { for (let t = 0; t < 1500 && Math.abs(n.px - x) > 1.5; t++) { setInput(n, x > n.px ? 1 : -1, 0); stepScav(n, 0.05); } setInput(n, 0, 0); };

test("yer kilitleri ve koşullar: harabeye ancak oradayken, kilidi açıkken ve dinçken girilir", () => {
  const s = newGame(cfg, 4); s.location = "koru"; expect(canStartScav(s, "koru_kulube").ok).toBe(false);
  s.quests.kurt = { status: "bitti", count: 1 }; s.energy = 90; expect(canStartScav(s, "koru_kulube").ok).toBe(true);
  expect(canStartScav(s, "koru_kule").ok).toBe(false);                       // önce kurtların izi
  s.location = "yayla"; expect(canStartScav(s, "koru_kulube").ok).toBe(false);
  s.location = "koru"; s.energy = 5; expect(canStartScav(s, "koru_kulube").ok).toBe(false);
  expect(canStartScav(s, "yok_boyle").ok).toBe(false);
});

test("joystickle yürünür; her kutu 3 kez aranır ve değerli çıkacaksa daha yavaştır", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 3, { kind: "yumruk" }); n.raidT = 999;
  const sp = n.spots.find(q => q.floor === 0)!; walkTo(n, sp.x); expect(nearSpot(n)?.id).toBe(sp.id);
  expect(beginSearch(n)).toBe(true); run(n, 0.5); expect(sp.stage).toBe(0); run(n, 20);
  expect(sp.done).toBe(true); expect(sp.stages.length).toBe(SPOT_STAGES); expect(n.searched).toBe(1);
  // süre: boş/basit şey hızlı, silah yavaş
  const total = sp.stages.reduce((a, x) => a + x.time, 0); expect(total).toBeGreaterThan(2.5);
  expect(Math.max(...n.spots.flatMap(q => q.stages.map(x => x.time)))).toBeGreaterThan(Math.min(...n.spots.flatMap(q => q.stages.map(x => x.time))));
});

test("merdivende yavaş yavaş çıkılır, birden değil", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 3, { kind: "yumruk" }); n.raidT = 999;
  walkTo(n, ladderAt(500, 0)); setInput(n, 0, -1); run(n, 0.5); expect(n.py).toBeGreaterThan(0); expect(n.py).toBeLessThan(1); expect(n.climbing).toBe(true);
  run(n, 4); expect(n.py).toBe(1); expect(n.floor).toBe(1); expect(n.climbing).toBe(false);
});

test("fark edilmeden baskın gelmez; bekçi uyanınca uluma ve 40 sn sonra baskın, sonra 10 sn bekleme", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 4, { kind: "yumruk" }); n.hp = n.maxHp = 99999;
  const g = n.foes[0]; n.foes = [g]; g.floor = 3;                               // uzakta uyusun
  run(n, 120); expect(n.wave).toBe(0); expect(n.alerted).toBe(false);
  g.floor = n.floor; g.x = n.px + 30; n.fx = []; run(n, 0.1);
  expect(n.alerted).toBe(true); expect(n.fx.some(f => f.k === "alarm" && !f.human)).toBe(true);
  n.foes = []; run(n, 39); expect(n.wave).toBe(0); run(n, 2); expect(n.wave).toBe(1); expect(n.raidHold).toBeGreaterThan(8);
  const r0 = n.raidT; run(n, 9); expect(n.raidT).toBe(r0);                     // bekleme sırasında sayaç sabit
});

test("baskın gelir; yaysız yumrukla bile vurulur", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 5, { kind: "yumruk" }); expect(n.bow).toBe(false);
  n.alerted = true; n.raidT = 0.1; run(n, 1); expect(n.wave).toBe(1); expect(n.foes.length).toBeGreaterThan(0);
  n.foes = [foe(n.px + 4, { hp: 30, max: 30 })]; run(n, 10); expect(n.foes.length === 0 || n.foes[0].hp < 30).toBe(true);
});

test("seçim tek şeydir: yay seçilirse oklarla, silah seçilirse onunla", () => {
  const s = fresh(); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; s.inventory.ok = 10; s.equipped.weapon = "el_yapimi_bicak"; s.inventory.el_yapimi_bicak = 1;
  const opts = loadoutOptions(cfg, s); expect(opts.some(o => o.kind === "bow")).toBe(true); expect(opts.some(o => o.kind === "melee" && o.id === "el_yapimi_bicak")).toBe(true);
  const b = createScav(cfg, s, scavSite("koru_kule")!, 6, { kind: "bow" }); expect(b.bow).toBe(true); expect(b.ammo).toBe(10); b.raidT = 999;
  b.foes = [foe(b.px + 40)]; run(b, 3); expect(b.shots).toBeGreaterThan(0);
  const m = createScav(cfg, s, scavSite("koru_kule")!, 6, { kind: "melee", id: "el_yapimi_bicak" }); expect(m.bow).toBe(false); expect(m.melee).toBeGreaterThan(createScav(cfg, s, scavSite("koru_kule")!, 6, { kind: "yumruk" }).melee);
});

test("tuzak tetiklenince dolana kadar bekler, sonra yeniden kurulur", () => {
  const s = fresh(); s.yapi = { kazik_cukuru: { n: 2, lv: 1 } };
  const n = createScav(cfg, s, scavSite("koru_kule")!, 7, { kind: "trap", id: "kazik_cukuru" }); n.raidT = 999; expect(trapsInHand(n)).toBe(2);
  walkTo(n, 60); expect(placeTrap(n)).toBe(true); expect(trapsInHand(n)).toBe(1);
  n.foes = [foe(60)]; run(n, 0.2); expect(n.foes[0].hp).toBeLessThan(500); expect(n.traps[0].state).toBe("cool");
  n.foes = []; expect(placeTrap(n)).toBe(true); expect(placeTrap(n)).toBe(false);
  run(n, 26); expect(n.traps[0].state).toBe("hand"); expect(trapsInHand(n)).toBe(1);
});

test("köpek arada çıkıp düşmanla dövüşür ve geri döner", () => {
  const s = fresh(); s.pet = { id: "kopek", name: "Karabaş", bond: 40 };
  const n = createScav(cfg, s, scavSite("koru_kule")!, 8, { kind: "dog" }); n.raidT = 999; expect(n.dog).toBeTruthy();
  n.foes = [foe(n.px + 60, { hp: 80, max: 80 })]; n.dog!.t = 0.1; run(n, 1); expect(n.dog!.state).toBe("av");
  run(n, 8); expect(n.foes.length === 0 || n.foes[0].hp < 80).toBe(true);
  n.foes = []; run(n, 12); expect(["don", "yanda"]).toContain(n.dog!.state);
});

test("yalnız seçilen büyü kullanılır ve dolması beklenir", () => {
  const s = fresh(); s.knownElements = ["el_ates"]; s.mana = 100; for (const r of ["ardic_koku"]) grantRelic(cfg, s, r, {});
  const sp = loadoutOptions(cfg, s).find(o => o.kind === "spell"); if (!sp) return;
  const n = createScav(cfg, s, scavSite("koru_kule")!, 9, { kind: "spell", id: sp.id }); n.raidT = 999; expect(n.spell).toBeTruthy(); n.spell!.cd = 0;
  n.foes = [foe(n.px + 60)]; expect(castSpell(n)).toBe(true); expect(n.spellQ.length).toBe(1); run(n, 1.5); expect(n.foes[0].hp).toBeLessThan(500); expect(castSpell(n)).toBe(false);
});

test("kutudan silah çıkar, kullanılır; çıkışta yalnız parçası cebe girer", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 10, { kind: "yumruk" }); n.raidT = 999; const sp = n.spots[0];
  sp.stages = [{ kind: "weapon", weapon: "kemik_balta", time: 0.5 }, { kind: "empty", time: 0.3 }, { kind: "empty", time: 0.3 }];
  walkTo(n, sp.x); const m0 = n.melee; beginSearch(n); run(n, 5);
  expect(n.melee).toBeGreaterThan(m0); expect(n.weaponName).toBe("Kemik saplı balta");
  walkTo(n, 8); expect(atExit(n)).toBe(true); leave(n); const r = finishScav(cfg, s, n);
  expect(r.result).toBe("exit"); const w = FOUND_WEAPONS.find(x => x.id === "kemik_balta")!; expect(w.parts.some(p => (s.inventory[p] ?? 0) > 0)).toBe(true);
  expect(s.inventory.kemik_balta).toBeUndefined();
});

test("çıkışta kazanç cebe girer, ölünce çanta gider; çanta dolunca fazlası alınmaz", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 11, { kind: "yumruk" }); n.raidT = 999; const m0 = s.money;
  n.bag = { deri: 2 }; n.money = 6; walkTo(n, 60); walkTo(n, 6); expect(leave(n)).toBe(true);
  const r = finishScav(cfg, s, n); expect(r.result).toBe("exit"); expect(s.inventory.deri).toBeGreaterThanOrEqual(2); expect(s.money).toBe(m0 + 6);
  const s2 = fresh(); const d = createScav(cfg, s2, scavSite("koru_kule")!, 12, { kind: "yumruk" }); d.bag = { deri: 3 }; d.money = 10; d.hp = 0.1; d.raidT = 999;
  d.foes = [foe(d.px + 1, { hp: 999, max: 999, dmg: 50, cd: 0 })]; run(d, 3); expect(d.result).toBe("dead");
  finishScav(cfg, s2, d); expect(s2.inventory.deri ?? 0).toBe(0); expect(s2.hp).toBeGreaterThan(0);
  const c = createScav(cfg, s, scavSite("koru_kule")!, 13, { kind: "yumruk" }); c.bag = { deri: c.bagCap * 5 }; expect(bagUsed(c)).toBe(c.bagCap);
  void ({} as GameState);
});

test("çanta doluyken bulunan eşya yere düşer; yer açılınca alınır; atılan eşya yerde kalır", async () => {
  const { dropBag, nearGround, pickGround } = await import("../src/engine/scavenge");
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 21, { kind: "yumruk" }); n.raidT = 999; const sp = n.spots[0];
  n.bag = { deri: n.bagCap * 5 }; sp.stages = [{ kind: "item", item: "ip", n: 2, time: 0.4 }, { kind: "empty", time: 0.2 }, { kind: "empty", time: 0.2 }];
  walkTo(n, sp.x); beginSearch(n); run(n, 3);
  expect(n.ground.filter(g => g.item === "ip").length).toBe(2); expect(bagUsed(n)).toBe(n.bagCap);
  expect(nearGround(n)?.item).toBe("ip"); expect(pickGround(n)).toBe("full");
  for (let i = 0; i < 5; i++) expect(dropBag(n, "deri")).toBe(true); const ipG = n.ground.find(g => g.item === "ip")!; expect(pickGround(n, ipG.id)).toBe("ok"); expect(n.bag.ip).toBe(1); expect(bagUsed(n)).toBe(n.bagCap);
  walkTo(n, 8); leave(n); const r = finishScav(cfg, s, n); expect(r.items.deri).toBe(n.bagCap * 5 - 5); expect(r.items.ip).toBe(1);
});

test("kilitli oda anahtarsız açılmaz, anahtarla açılır; anahtar başka katta saklıdır", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 31, { kind: "yumruk" }); n.raidT = 999;
  const lk = n.locks.find(l => l.floor === 0)!; expect(lk.open).toBe(false);
  const keySpot = n.spots.find(q => q.stages.some(x => x.kind === "key" && x.key === 0))!; expect(keySpot.floor).toBe(1); expect(keySpot.vault).toBeFalsy();
  for (let t = 0; t < 600; t++) { setInput(n, 1, 0); stepScav(n, 0.05); } setInput(n, 0, 0);
  expect(n.px).toBeLessThan(lk.x); expect(lk.open).toBe(false);
  n.keys.push(0); for (let t = 0; t < 200; t++) { setInput(n, 1, 0); stepScav(n, 0.05); } expect(lk.open).toBe(true); expect(n.px).toBeGreaterThan(lk.x); expect(n.keys.length).toBe(0);
  expect(n.spots.some(q => q.vault && q.floor === 0)).toBe(true);
});

test("merdiven açıklığında alt/üst kata nişan alınıp ok ve büyü atılır", async () => {
  const { shootArrow, aimTarget, castSpell } = await import("../src/engine/scavenge");
  const s = fresh(); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; s.inventory.ok = 10;
  const n = createScav(cfg, s, scavSite("koru_kule")!, 32, { kind: "bow" }); n.raidT = 999; n.foes = []; walkTo(n, ladderAt(500, 0));
  expect(aimTarget(n, { dx: 1, dy: -1 }).floor).toBe(1); expect(aimTarget(n, { dx: 1, dy: 0 }).floor).toBe(0);
  n.foes = [foe(ladderAt(500, 0) + 30, { floor: 1 })]; expect(shootArrow(n, { dx: 1, dy: -1 })).toBe(true); expect(n.foes[0].hp).toBeLessThan(500);
  setInput(n, 0, -1); run(n, 1); expect(n.climbing).toBe(true); n.atkCd = 0; expect(shootArrow(n, { dx: 1, dy: 0 })).toBe(true); void castSpell;
});

test("kutunun yanında durunca kendiliğinden arar, hareketle durur; aşamalar arası ara vardır; aranırken ateş edilmez", () => {
  const s = fresh(); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; s.inventory.ok = 10;
  const n = createScav(cfg, s, scavSite("koru_kule")!, 41, { kind: "bow" }); n.raidT = 999; n.foes = []; const sp = n.spots.find(q => q.floor === 0)!;
  walkTo(n, sp.x); run(n, 0.3); expect(n.searchId).toBe(sp.id);
  n.foes = [foe(n.px + 30)]; run(n, 0.6); expect(n.shots).toBe(0);                       // aranırken vurmaz
  setInput(n, 1, 0); run(n, 0.2); expect(n.searchId).toBe(0); setInput(n, 0, 0);
  n.foes = []; walkTo(n, sp.x); run(n, 0.2);
  let sawGap = false; for (let t = 0; t < 400 && sp.stage < 2; t++) { stepScav(n, 0.05); if (n.searchWait > 0 && n.searchId === 0 && sp.stage >= 1) sawGap = true; }
  expect(sawGap).toBe(true);
});

test("baskın sayısı harabeye göre sınırlı; aralarda en az 24 sn; sonuncusu 'son' diye duyurulur", () => {
  const s = fresh(); const site = scavSite("koru_kule")!; const n = createScav(cfg, s, site, 42, { kind: "yumruk" }); n.hp = n.maxHp = 99999; n.foes = [];
  n.alerted = true; n.raidT = 40; const times: number[] = []; const lasts: boolean[] = [];
  let w = 0; for (let t = 0; t < 400 / 0.05; t++) { stepScav(n, 0.05); for (const f of n.fx) if (f.k === "raid") lasts.push(f.last); n.fx = []; if (n.wave > w) { w = n.wave; times.push(n.time); } }
  expect(times.length).toBe(site.raids); expect(lasts).toEqual([...Array(site.raids - 1).fill(false), true]);
  for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(23.9);
  const easy = scavSite("koru_kulube")!, hard = scavSite("koru_kosk")!;
  expect(easy.raids).toBeLessThan(hard.raids); expect(easy.guards).toBeLessThan(hard.guards); expect(easy.rooms * easy.floors).toBeLessThan(hard.rooms * hard.floors);
});

test("boşaltılan sandık bir daha aranmaz; ölünce çanta harabede kalır ve geri alınabilir; öldürülen bekçi dönmez", () => {
  const s = fresh(); s.quests.kurt_izi = { status: "bitti", count: 1 }; const site = scavSite("koru_kule")!;
  const a = createScav(cfg, s, site, 7, { kind: "yumruk" }); const b = createScav(cfg, s, site, 99, { kind: "yumruk" });
  expect(a.spots.map(p => [p.x, p.floor])).toEqual(b.spots.map(p => [p.x, p.floor]));   // yerleşim her girişte aynı
  a.spots[0].stage = SPOT_STAGES; a.spots[1].stage = 1; const g = a.foes[0]; g.hp = 0.1; a.foes = [g];
  g.floor = 0; g.x = a.px + 4; a.melee = 99; a.hp = a.maxHp = 9999; for (let i = 0; i < 200 && a.foes.length; i++) stepScav(a, 0.05);
  expect(a.killed).toContain(g.id);
  a.bag = { deri: 2 }; a.result = "dead"; a.phase = "over"; finishScav(cfg, s, a);
  const c = createScav(cfg, s, site, 5, { kind: "yumruk" });
  expect(c.spots[0].done).toBe(true); expect(c.spots[1].stage).toBe(1); expect(c.foes.some(f => f.id === g.id)).toBe(false);
  expect(c.ground.filter(x => x.item === "deri").length).toBe(2);
  const other = createScav(cfg, s, scavSite("koru_kulube")!, 5, { kind: "yumruk" }); expect(other.spots.every(p => !p.done)).toBe(true);   // harabeler ayrı
});

test("sargı bezi ve merhem canı doldurur (envanterde ve harabede)", async () => {
  const { useHeal } = await import("../src/engine/healing"); const { healRun } = await import("../src/engine/scavenge"); const { maxHp } = await import("../src/engine/combat");
  const s = fresh(); const mh = maxHp(cfg, s); s.hp = Math.round(mh * 0.3); s.inventory.sargi_bezi = 2; s.inventory.yara_merhemi = 1;
  const r = useHeal(cfg, s, "sargi_bezi"); expect(r.ok).toBe(true); expect(s.hp).toBeGreaterThan(Math.round(mh * 0.3)); expect(s.inventory.sargi_bezi).toBe(1);
  s.hp = mh; expect(useHeal(cfg, s, "yara_merhemi").ok).toBe(false); expect(useHeal(cfg, s, "ekmek").ok).toBe(false);
  const n = createScav(cfg, s, scavSite("koru_kule")!, 51, { kind: "yumruk" }); n.hp = 5; n.bag.sargi_bezi = 1; s.inventory.sargi_bezi = 1;
  expect(healRun(cfg, s, n, "sargi_bezi").ok).toBe(true); expect(n.hp).toBeGreaterThan(20); expect(n.bag.sargi_bezi).toBeUndefined(); expect(s.inventory.sargi_bezi).toBe(1);
  expect(healRun(cfg, s, n, "sargi_bezi").ok).toBe(true); expect(s.inventory.sargi_bezi).toBeUndefined();
});

test("ilk yardım becerisi yükseldikçe sargı daha çok can verir ve kullandıkça gelişir", async () => {
  const { useHeal, aidMul } = await import("../src/engine/healing"); const { maxHp } = await import("../src/engine/combat");
  const s = fresh(); expect(s.attrs.ilk_yardim).toBeTruthy(); const mh = maxHp(cfg, s);
  s.hp = 1; s.inventory.sargi_bezi = 3; const a = useHeal(cfg, s, "sargi_bezi"); const lv0 = s.attrs.ilk_yardim.level; expect(lv0).toBeGreaterThan(3);
  s.attrs.ilk_yardim.level = 50; expect(aidMul(s)).toBeCloseTo(2, 5); s.hp = 1; const b = useHeal(cfg, s, "sargi_bezi");
  expect(b.healed!).toBeGreaterThan(a.healed!); void mh;
});


test("bazı odalarda bekçi düşmanlar vardır: yaklaşınca uyanır, uzakta uyur; çifte büyü üst üste atar", async () => {
  const { castSpell: cs } = await import("../src/engine/scavenge");
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 61, { kind: "yumruk" }); n.raidT = 999;
  expect(n.foes.length).toBeGreaterThanOrEqual(3); expect(n.foes.every(f => f.idle)).toBe(true);
  expect(n.foes.filter(f => f.floor === 0 && !n.locks[0].open).every(f => f.x > 110 || f.x < 2000)).toBe(true);
  run(n, 3); expect(n.foes.every(f => f.idle)).toBe(true);                                   // giriş odası boş, uyuyanlar hareket etmez
  const g = n.foes.find(f => f.floor === 0)!; n.px = g.x - 30; run(n, 0.3); expect(g.idle).toBe(false);   // yaklaşınca uyanır
  const s2 = fresh(); s2.knownElements = ["el_ates"]; s2.mana = 100; const sp = loadoutOptions(cfg, s2).find(o => o.kind === "spell");
  if (sp) { const m = createScav(cfg, s2, scavSite("koru_kule")!, 62, { kind: "spell", id: sp.id }); m.spell!.cd = 0; m.tr.spellShots = 3; expect(m.spell!.max).toBeLessThanOrEqual(5); cs(m); expect(m.spellQ.length).toBe(3);
    m.raidT = 999; for (let i = 0; i < 40; i++) stepScav(m, 0.05); expect(m.proj.length + m.spellQ.length).toBeGreaterThan(0); }
});

test("harabede kart yok: hız, arama, dayanma ve büyü özelliklerden gelir", () => {
  const s = fresh(); const t0 = scavTraits(cfg, s);
  expect(t0.walk).toBe(1); expect(t0.search).toBe(1); expect(t0.spellShots).toBe(1); expect(t0.firstRaid).toBe(40);
  const n0 = createScav(cfg, s, scavSite("koru_kule")!, 31, { kind: "yumruk" });
  const s2 = fresh(); for (const a of ["bacak", "esneklik", "el_becerisi", "analiz", "agri", "core", "isitme", "cevresel", "odak"]) s2.attrs[a].level = 70;
  const t1 = scavTraits(cfg, s2); const n1 = createScav(cfg, s2, scavSite("koru_kule")!, 31, { kind: "yumruk" });
  expect(t1.walk).toBeCloseTo(1.24); expect(t1.search).toBeCloseTo(0.5625); expect(t1.spellShots).toBe(2); expect(t1.firstRaid).toBe(60);
  expect(n1.maxHp).toBeGreaterThan(n0.maxHp); expect(n1.raidT).toBe(60);
  // harabeden çıkınca can, gerçek en çok canı aşmaz
  n1.raidT = 999; walkTo(n1, 6); leave(n1); finishScav(cfg, s2, n1); expect(s2.hp).toBeLessThanOrEqual(maxHp(cfg, s2));
});

import { beginFortify, doorNear, DOOR_BASE, DOOR_MAX_LEVEL, doorMax } from "../src/engine/scavenge";
test("kapılar: geçince kapanır, düşman kırmaya çalışır; önünde durup 200'er güçlendirilir (en çok 2000)", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 3, { kind: "yumruk" }); n.raidT = 999;
  const d = n.doors.find(q => q.floor === 0)!;
  expect(d.state).toBe("open"); expect(d.hp).toBe(DOOR_BASE);
  walkTo(n, d.x - 2);                                           // kapının önüne gel
  expect(doorNear(n)).toBe(d);
  // güçlendir: seviye 2 = 400
  expect(beginFortify(n)).toBe("ok"); run(n, 5);
  expect(d.level).toBe(2); expect(d.hp).toBe(400); expect(doorMax(d)).toBe(2 * DOOR_BASE);
  // geçince kapanır
  walkTo(n, d.x + 8); expect(d.state).toBe("closed");
  // karşı taraftaki düşman kapıyı döver ama geçemez
  n.foes = [foe(d.x - 30, { speed: 20, dmg: 10, cd: 0 })];
  const hp0 = d.hp; run(n, 6); const f = n.foes[0];
  expect(f.x).toBeLessThan(d.x); expect(d.hp).toBeLessThan(hp0); expect(d.state).toBe("closed");
  // zayıf kapı kırılır, sonra düşman geçer
  d.hp = 5; run(n, 4); expect(d.state).toBe("broken"); run(n, 4); expect(n.foes.length ? n.foes[0].x : 999).toBeGreaterThan(d.x - 6);
});

test("kapı seviyesi 10'da biter (2000) ve kayıtta kalır", () => {
  const s = fresh(); const n = createScav(cfg, s, scavSite("koru_kule")!, 3, { kind: "yumruk" }); n.raidT = 999;
  const d = n.doors.find(q => q.floor === 0)!; walkTo(n, d.x - 2);
  for (let i = 0; i < 12; i++) { if (beginFortify(n) === "ok") run(n, 8); }
  expect(d.level).toBe(DOOR_MAX_LEVEL); expect(doorMax(d)).toBe(2000); expect(beginFortify(n)).toBe("max");
  leave(n); n.px = 8; n.floor = 0; n.phase = "play"; n.result = undefined; leave(n); finishScav(cfg, s, n);
  const n2 = createScav(cfg, s, scavSite("koru_kule")!, 4, { kind: "yumruk" });
  expect(n2.doors.find(q => q.floor === 0 && q.x === d.x)!.level).toBe(DOOR_MAX_LEVEL);
});
