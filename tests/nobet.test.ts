// Nöbet: kule kendiliğinden vurur, kırıntıyla güçlenir, kart seçilir; dalgalar zorlaşır, iz kalır.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { Rng } from "../src/engine/rng";
import { waveScale, milestoneReward, createNobet, stepNobet, buyUpgrade, pickCard, useSkill, finishNobet, buyPerm, upgradeCost, nobetSite, canStartNobet, nobetSave, type Nobet, type StatId } from "../src/engine/nobet";

function play(s: GameState, seed: number, bot: "bos" | "akilli", limit = 900): Nobet {
  const n = createNobet(cfg, s, nobetSite("yayla")!, seed);
  const order: StatId[] = ["dmg", "rate", "hp", "regen", "dmg", "range"]; let k = 0;
  for (let t = 0; t < limit / 0.05 && n.phase !== "over"; t++) {
    if (n.phase === "card") pickCard(s, n, n.offer[0]);
    if (bot === "akilli") { while (buyUpgrade(n, order[k % order.length])) k++; useSkill(n); }
    stepNobet(s, n, 0.05);
  }
  return n;
}
const fresh = () => { const s = newGame(cfg, 4); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "yayla"; return s; };

test("hiç güçlenmeyen erken düşer; akıllı oynayan çok daha ileri gider", () => {
  const w0: number[] = [], w1: number[] = [];
  for (let i = 1; i <= 6; i++) { w0.push(play(fresh(), i, "bos").wave); w1.push(play(fresh(), i, "akilli").wave); }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log("dalga: boş", avg(w0), "akıllı", avg(w1), w1);
  expect(avg(w0)).toBeLessThan(avg(w1));
  expect(avg(w1)).toBeGreaterThanOrEqual(6); expect(avg(w1)).toBeLessThan(40);
});

test("kalıcı güçlenme ileri götürür; iz harcanır", () => {
  const s = fresh(); nobetSave(s).iz = 2000;
  for (let i = 0; i < 8; i++) for (const p of ["guc", "dayanik", "cabuk"]) buyPerm(s, p);
  expect(nobetSave(s).iz).toBeLessThan(2000);
  let a = 0, b = 0;
  for (let i = 1; i <= 5; i++) { a += play(fresh(), i, "akilli").wave; const t = fresh(); t.nobet = JSON.parse(JSON.stringify(s.nobet)); b += play(t, i, "akilli").wave; }
  console.log("kalıcı:", a / 5, "→", b / 5);
  expect(b).toBeGreaterThan(a);
});

test("yükseltme fiyatı artar; nöbet bitince iz, rekor ve gelişim kalır", () => {
  expect(upgradeCost(5)).toBeGreaterThan(upgradeCost(0));
  const s = fresh(); const n = play(s, 2, "akilli");
  const r = finishNobet(cfg, s, n);
  expect(r.iz).toBeGreaterThan(0); expect(nobetSave(s).best.yayla).toBe(r.wave); expect(Object.keys(r.gains).length).toBeGreaterThan(0);
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
