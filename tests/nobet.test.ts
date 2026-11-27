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
