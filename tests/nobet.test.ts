// Nöbet: kule kendiliğinden vurur, kırıntıyla güçlenir, kart seçilir; dalgalar zorlaşır. Güçlenmeler o nöbette kalır; rekor kalıcı.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { Rng } from "../src/engine/rng";
import { waveScale, milestoneReward, createNobet, stepNobet, buyUpgrade, pickCard, useSpell, startWaves, finishNobet, upgradeCost, canCallWave, callWave, useSupply, rerollCards, nobetSite, canStartNobet, nobetSave, type Nobet, type StatId } from "../src/engine/nobet";

function play(s: GameState, seed: number, bot: "bos" | "akilli", limit = 900): Nobet {
  const n = createNobet(cfg, s, nobetSite("yayla")!, seed);
  const order: StatId[] = ["dmg", "rate", "hp", "regen", "dmg", "range"]; let k = 0;
  for (let t = 0; t < limit / 0.05 && n.phase !== "over"; t++) {
    if (n.phase === "card") pickCard(s, n, n.offer[0]);
    if (bot === "akilli") { while (buyUpgrade(n, order[k % order.length])) k++; for (const id of Object.keys(n.spells)) useSpell(n, id, 40, 40); }
    stepNobet(s, n, 0.05);
  }
  return n;
}
const fresh = () => { const s = newGame(cfg, 4); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "yayla"; s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1; return s; };

test("hiç güçlenmeyen erken düşer; akıllı oynayan çok daha ileri gider", () => {
  const w0: number[] = [], w1: number[] = [];
  for (let i = 1; i <= 6; i++) { w0.push(play(fresh(), i, "bos").wave); w1.push(play(fresh(), i, "akilli").wave); }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log("dalga: boş", avg(w0), "akıllı", avg(w1), w1);
  expect(avg(w0)).toBeLessThan(avg(w1));
  expect(avg(w1)).toBeGreaterThanOrEqual(6); expect(avg(w1)).toBeLessThan(40);
});

test("kalıcı güçlenme yok: önceki nöbetin kartları ve yükseltmeleri sonrakine geçmez; güç karakterden gelir", () => {
  const s = fresh(); const n1 = play(s, 3, "akilli"); finishNobet(cfg, s, n1);
  const n2 = createNobet(cfg, s, nobetSite("yayla")!, 9);
  expect(Object.keys(n2.cards)).toHaveLength(0); expect(Object.values(n2.lv).every(v => v === 0)).toBe(true);
  expect(Object.keys(nobetSave(s))).toEqual(expect.arrayContaining(["best", "runs"])); expect((nobetSave(s) as unknown as Record<string, unknown>).iz).toBeUndefined();
  // karakter gelişince nöbet de uzar
  let a = 0, b = 0;
  for (let i = 1; i <= 5; i++) { a += play(fresh(), i, "akilli").wave; const t = fresh(); for (const k of ["okculuk", "refleks", "ust_govde", "gorus"]) t.attrs[k].level += 25; b += play(t, i, "akilli").wave; }
  console.log("gelişim:", a / 5, "→", b / 5);
  expect(b).toBeGreaterThan(a);
});

test("yükseltme fiyatı artar; nöbet bitince rekor ve gelişim kalır", () => {
  expect(upgradeCost(5)).toBeGreaterThan(upgradeCost(0));
  const s = fresh(); const n = play(s, 2, "akilli");
  const r = finishNobet(cfg, s, n);
  expect(r.best).toBe(true); expect(nobetSave(s).best.yayla).toBe(r.wave); expect(nobetSave(s).runs).toBe(1); expect(Object.keys(r.gains).length).toBeGreaterThan(0);
});

test("kilitli yerde ve yorgunken nöbet tutulmaz", () => {
  const s = newGame(cfg, 4); expect(canStartNobet(s, "yayla").ok).toBe(false);
  s.quests.kurt = { status: "bitti", count: 1 }; s.energy = 90; expect(canStartNobet(s, "yayla").ok).toBe(true);
  s.energy = 5; expect(canStartNobet(s, "yayla").ok).toBe(false);
});

test("dalgalar hızlanır ve sertleşir", () => {
  expect(waveScale(10).speed).toBeGreaterThan(waveScale(1).speed);
  expect(waveScale(10).power).toBeGreaterThan(waveScale(5).power);
  expect(waveScale(1).speed).toBe(1);
});

test("her beş dalgada ödül; köyde köy kadar, nöbet bitince cebe girer", () => {
  const s = fresh(); const money0 = s.money;
  const n = play(s, 2, "akilli");
  expect(n.wave).toBeGreaterThan(5);
  expect(n.loot.money).toBeGreaterThanOrEqual(3);
  const r = finishNobet(cfg, s, n);
  expect(s.money - money0).toBe(r.loot.money);
  const yayla = milestoneReward(nobetSite("yayla")!, 5, new Rng(1)), sehir = milestoneReward(nobetSite("ardic_kul")!, 5, new Rng(1));
  expect(sehir.money).toBeGreaterThan(yayla.money);
  expect(milestoneReward(nobetSite("yayla")!, 15, new Rng(1)).money).toBeGreaterThan(yayla.money);
});

test("sayfa çevirme, erken dalga çağırma ve yiyecekle kule iyileştirme", () => {
  const s = fresh(); s.inventory.ekmek = 2;
  const n = createNobet(cfg, s, nobetSite("yayla")!, 5); n.prep = false; n.wave = 1; n.waveLeft = 0; n.foes = []; n.breakT = 5; n.coins = 0;
  expect(canCallWave(n)).toBe(true); expect(callWave(n)).toBe(true); expect(n.coins).toBeGreaterThan(0); expect(n.breakT).toBe(0);
  n.hp = n.maxHp * 0.4; expect(useSupply(s, n, "ekmek")).toBe(true); expect(n.hp).toBeGreaterThan(n.maxHp * 0.6); expect(s.inventory.ekmek).toBe(1);
  n.phase = "card"; n.offer = ["cift", "buz", "kazik"]; const old = [...n.offer];
  expect(rerollCards(s, n)).toBe(true); expect(n.rerolls).toBe(1); expect(n.offer.length).toBeGreaterThan(0); expect(n.offer.some(x => !old.includes(x))).toBe(true);
  const dmg0 = n.dmg; n.offer = ["ofke"]; pickCard(s, n, "ofke"); expect(n.dmg).toBeGreaterThan(dmg0);
});

test("uzun dayanmak karşılığını verir: gelişim dalgayla azalan hızda büyür, kese büyür, lider gözlem yazdırır, eşikler ün getirir", async () => {
  const { ENEMIES } = await import("../src/content/world");
  const { repOf } = await import("../src/engine/state");
  const run = (w: number, bosses: string[] = []) => {
    const s = fresh(); const n = createNobet(cfg, s, nobetSite("yayla")!, 1);
    n.wave = w + 1; n.waveLeft = 1; n.stats.shots = 20 + w * 12; n.stats.bossDefs = bosses;
    for (let k = 5; k <= w; k += 5) { const l = milestoneReward(n.site, k, new Rng(k)); n.loot.money += l.money; }
    return { s, r: finishNobet(cfg, s, n) };
  };
  const g5 = run(5).r.gains.okculuk!, g20 = run(20).r.gains.okculuk!, g30 = run(30).r.gains.okculuk!;
  console.log("okçuluk 5/20/30:", g5.toFixed(2), g20.toFixed(2), g30.toFixed(2));
  expect(g20).toBeGreaterThan(g5 * 1.5); expect(g30).toBeGreaterThan(g20);
  expect(g30 - g20).toBeLessThan(g20 - g5);                       // azalan hız
  // kese: 30 dalga, 5 dalgadan çok daha fazla para
  expect(run(30).r.loot.money).toBeGreaterThan(run(5).r.loot.money * 15);
  // lider: Akyele kurdun zayıf noktalarından birini açar
  const { s, r } = run(10, ["akyele"]);
  expect(s.journal.kurt?.length).toBe(1); expect(r.notes.some(t => /Gözlemler/.test(t))).toBe(true);
  expect(ENEMIES.kurt.weakPoints.map(w => w.id)).toContain(s.journal.kurt![0]);
  // eşik: 10. dalga ün getirir, bir kez
  expect(repOf(s, "taspinar", "taninirlik")).toBeGreaterThanOrEqual(2);
  const before = repOf(s, "taspinar", "taninirlik");
  const n2 = createNobet(cfg, s, nobetSite("yayla")!, 2); n2.wave = 12; n2.waveLeft = 1; finishNobet(cfg, s, n2);
  expect(repOf(s, "taspinar", "taninirlik")).toBe(before);
});

/* ---------- büyüler nöbette: barikat savaşıyla aynı kural ---------- */
function withFire(seed = 5) {
  const s = fresh(); s.knownElements = ["el_ates"]; s.attrs.ates.level = 20; s.mana = 99;
  return { s, n: createNobet(cfg, s, nobetSite("yayla")!, seed) };
}
const wolf = (n: Nobet, x: number, y: number, hp = 200) => { n.foes.push({ id: n.nextId++, def: "kurt", x, y, hp, max: hp, speed: 0, dmg: 0, cd: 9, r: 3, boss: false, burn: 0, slow: 0, root: 0, stun: 0, peck: 0, human: false, reward: 1 }); return n.foes[n.foes.length - 1]; };

test("kartlar bildiğin büyülere göre süzülür: şimşek ya da ayaz sayfan yoksa zincir şimşek ve ayaz halkası çıkmaz", async () => {
  const { availableCards } = await import("../src/engine/nobet");
  const { s, n } = withFire();
  const ids = () => availableCards(s, n).map(c => c.id);
  expect(ids()).toContain("ates"); expect(ids()).not.toContain("zincir"); expect(ids()).not.toContain("buz");
  s.knownElements.push("el_simsek", "el_ayaz");
  expect(ids()).toContain("zincir"); expect(ids()).toContain("buz");
});

test("ateş topu ve ateş duvarı kartları yalnız o büyü elindeyse çıkar ve gerçekten güçlendirir", async () => {
  const { availableCards, addNobetSpell } = await import("../src/engine/nobet");
  const { discover } = await import("../src/engine/synthesis");
  const { s, n } = withFire();
  const has = (id: string) => availableCards(s, n).some(c => c.id === id);
  expect(has("top_guc")).toBe(true); expect(has("duvar_kor")).toBe(false);          // ateş topu var, ateş duvarı henüz yok
  discover(s, "sy_el_ates_duvar"); expect(addNobetSpell(cfg, s, n, "sy_el_ates_duvar")).toBe(true);
  expect(has("duvar_kor")).toBe(true); expect(has("duvar_uzun")).toBe(true); expect(has("duvar_hiz")).toBe(true);
  const pick = (id: string) => { n.phase = "card"; n.offer = [id]; pickCard(s, n, id); };
  const top = { ...n.spells.ates_topu }, duv = { ...n.spells.sy_el_ates_duvar };
  pick("top_guc"); pick("top_alan"); pick("top_hiz");
  expect(n.spells.ates_topu.mul).toBeCloseTo(top.mul * 1.25, 5); expect(n.spells.ates_topu.r).toBeCloseTo(top.r * 1.15, 5); expect(n.spells.ates_topu.max).toBeCloseTo(top.max * 0.8, 5);
  pick("duvar_uzun"); pick("duvar_kor"); pick("duvar_hiz");
  expect(n.spells.sy_el_ates_duvar.len!).toBeGreaterThan(20); expect(n.spells.sy_el_ates_duvar.mul).toBeCloseTo(duv.mul * 1.25, 5);
  expect(n.spells.sy_el_ates_duvar.dur).toBe(8); expect(n.spells.sy_el_ates_duvar.max).toBeCloseTo(duv.max * 0.8, 5);
});

test("ateş topu kuleden ileri atılır: varacağı yer menzil kadar, kule noktası çıkış", async () => {
  const { nobetAim, throwLanding, TOWER } = await import("../src/engine/nobet");
  const { THROW_RANGE } = await import("../src/engine/siege");
  const { n } = withFire();
  expect(nobetAim(n, "ates_topu")).toBe("throw");
  const far = throwLanding(TOWER.x, TOWER.y - 500); expect(Math.hypot(far.x - TOWER.x, far.y - (TOWER.y - 6))).toBeCloseTo(THROW_RANGE, 3);
  n.spells.ates_topu.cd = 0; const w = wolf(n, TOWER.x, TOWER.y - THROW_RANGE + 2);
  expect(useSpell(n, "ates_topu", TOWER.x, TOWER.y - 500)).toBe(true);        // çok uzağı gösterdi: menzilin ucuna düşer ve vurur
  const fx = n.fx.filter(e => e.k === "spell").pop() as { from?: [number, number]; y: number };
  expect(fx.from).toEqual([TOWER.x, TOWER.y - 6]); expect(w.hp).toBeLessThan(200); expect(w.burn).toBeGreaterThan(0);
});

test("ateş duvarı patlamaz: çizilen şerit yanar; içinden geçen tutuşur ve çıktıktan sonra da yanmaya devam eder", async () => {
  const { nobetAim, useWall, addNobetSpell, TOWER } = await import("../src/engine/nobet");
  const { discover } = await import("../src/engine/synthesis");
  const { s, n } = withFire();
  discover(s, "sy_el_ates_duvar"); addNobetSpell(cfg, s, n, "sy_el_ates_duvar");
  expect(nobetAim(n, "sy_el_ates_duvar")).toBe("wall");
  n.spells.sy_el_ates_duvar.cd = 0;
  const w = wolf(n, TOWER.x, TOWER.y - 30);
  expect(useWall(n, "sy_el_ates_duvar", TOWER.x - 10, TOWER.y - 30, TOWER.x + 10, TOWER.y - 30).ok).toBe(true);
  const fx = n.fx.filter(e => e.k === "spell").pop() as { wall?: boolean; hits: number[] };
  expect(fx.wall).toBe(true); expect(fx.hits).toHaveLength(0);                   // patlama yok
  expect(n.lines).toHaveLength(1); expect(w.hp).toBe(200);                       // henüz kimse geçmedi
  stepNobet(s, n, 0.05); expect(w.burn).toBeGreaterThan(3); expect(w.burnMul!).toBeGreaterThan(2); const first = w.hp; expect(first).toBeLessThan(200);
  w.y = TOWER.y - 60;                                                            // şeritten çıktı
  for (let i = 0; i < 60; i++) stepNobet(s, n, 0.05);                            // ~3 sn (motor adımı en çok 0,05 sn)
  expect(first - w.hp).toBeGreaterThanOrEqual(8);                                // yanma hasarı sürdü
  n.spells.sy_el_ates_duvar.cd = 0; expect(useWall(n, "sy_el_ates_duvar", TOWER.x, TOWER.y, TOWER.x + 12, TOWER.y).ok).toBe(false);   // kule üstüne kurulmaz
  expect(useWall(n, "sy_el_ates_duvar", 10, 10, 11, 10).ok).toBe(false);        // çok kısa
  for (let i = 0; i < 200; i++) { if (n.phase === "card") pickCard(s, n, n.offer[0]); stepNobet(s, n, 0.05); }   // kurt yanıp ölürse kart ekranı oyunu durdurur
  expect(n.lines).toHaveLength(0);                                               // süre doldu
});

test("nöbette şimşek: zincir hedefe en yakından başlayıp en çok üç komşuya atlar, yıldırım alandaki herkese düşer", async () => {
  const { addNobetSpell, TOWER } = await import("../src/engine/nobet");
  const s = fresh(); s.knownElements = ["el_simsek", "el_hava", "el_su"]; s.attrs.simsek_buyu.level = 60; s.attrs.hava_buyu.level = 60; s.mana = 99;
  const n = createNobet(cfg, s, nobetSite("yayla")!, 7);
  expect(addNobetSpell(cfg, s, n, "simsek_zinciri")).toBe(true); expect(addNobetSpell(cfg, s, n, "yildirim_firtinasi")).toBe(true);
  expect(n.spells.simsek_zinciri.bolt).toBe("chain"); expect(n.spells.yildirim_firtinasi.bolt).toBe("sky");
  const cx = TOWER.x, cy = TOWER.y - 40;
  const ws = [wolf(n, cx, cy), wolf(n, cx + 8, cy), wolf(n, cx - 8, cy), wolf(n, cx, cy - 8), wolf(n, cx + 16, cy - 8)];   // 5 kurt, hepsi yakın
  n.spells.simsek_zinciri.cd = 0; expect(useSpell(n, "simsek_zinciri", cx, cy)).toBe(true);
  const hurtN = ws.filter(w => w.hp < 200).length; expect(hurtN).toBe(4);                // ilk + üç komşu; beşincisi zincire girmez
  const fx = n.fx.filter(e => e.k === "spell").pop() as { pts?: [number, number][] }; expect(fx.pts).toHaveLength(4);
  for (const w of ws) w.hp = 200; n.spells.yildirim_firtinasi.cd = 0;
  expect(useSpell(n, "yildirim_firtinasi", cx, cy)).toBe(true);
  expect(ws.filter(w => w.hp < 200).length).toBe(5);                                      // yıldırım alandaki herkese
});

test("büyü taktiği (nöbet): ıslak hedefe şimşek daha çok vurur, ıslağa ateş buhar olur, ateş topu ikinci düşmana sekip vurur", async () => {
  const { addNobetSpell, TOWER } = await import("../src/engine/nobet");
  const s = fresh(); s.knownElements = ["el_simsek", "el_hava", "el_su", "el_ates"]; for (const a of ["simsek_buyu", "hava_buyu", "ates"]) if (s.attrs[a]) s.attrs[a].level = 60; s.mana = 99;
  const n = createNobet(cfg, s, nobetSite("yayla")!, 7);
  expect(addNobetSpell(cfg, s, n, "simsek_zinciri")).toBe(true); expect(addNobetSpell(cfg, s, n, "ates_topu")).toBe(true);
  const cx = TOWER.x, cy = TOWER.y - 40;
  const dry = wolf(n, cx, cy), wet = wolf(n, cx + 60, cy); wet.wet = 5;   // uzak ikisi: zincir ilkine atlar
  n.spells.simsek_zinciri.cd = 0; useSpell(n, "simsek_zinciri", cx, cy); const dryHit = 200 - dry.hp;
  dry.hp = 200; n.spells.simsek_zinciri.cd = 0; useSpell(n, "simsek_zinciri", cx + 60, cy); const wetHit = 200 - wet.hp;
  expect(wetHit).toBeGreaterThan(dryHit * 1.5);
  wet.hp = 200; wet.burn = 3; wet.wet = 4; n.spells.ates_topu.cd = 0; useSpell(n, "ates_topu", cx + 60, cy); expect(wet.burn).toBe(0);   // buhar
  const a = wolf(n, cx, cy - 20), b2 = wolf(n, cx + 18, cy - 20); a.hp = b2.hp = 200; a.wet = b2.wet = 0; a.burn = b2.burn = 0;
  n.spells.ates_topu.cd = 0; useSpell(n, "ates_topu", cx, cy - 20); expect(b2.hp).toBeLessThan(200);                                      // sekme
});
