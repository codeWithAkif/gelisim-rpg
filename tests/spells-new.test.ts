// Nöbette yalnız elde olanla oynanır: yay yoksa ok yok (yakın dövüş), büyüler bilinenlerle sınırlı; barikat ve tuzak kurulur.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { grantRelic } from "../src/engine/relics";
import { spellOptions } from "../src/engine/magic";
import { createNobet, stepNobet, useSpell, availableCards, placePet, petGuard, nobetSite, placeBar, placeTrap, pickUp, startWaves, canPlaceNow, TOWER } from "../src/engine/nobet";

const foe = (id: number, x: number, y = TOWER.y, hp = 500) => ({ id, def: "kurt", x, y, hp, max: hp, speed: 8, dmg: 5, cd: 0, r: 3, boss: false, burn: 0, slow: 0, root: 0, stun: 0, peck: 0, human: false, reward: 1 });
const grantStructure = (s: GameState, id: string, k: number) => { (s.yapi ??= {})[id] = { n: k, lv: 1 }; };
const site = () => nobetSite("yayla")!;

test("kadim çağrılar eşyası bulununca nöbet büyüsü olur; bilinmeyen çıkmaz", () => {
  const s = newGame(cfg, 6); s.mana = 100;
  const n0 = createNobet(cfg, s, site(), 1);
  expect(Object.values(n0.spells).some(x => x.kind === "sarmasik")).toBe(false);
  for (const r of ["ardic_koku", "kara_tuy", "pasli_kabza"]) grantRelic(cfg, s, r, {});
  const n = createNobet(cfg, s, site(), 1);
  const known = spellOptions(cfg, { ...s, mana: 999 }).filter(o => o.ok).map(o => o.spell.id);
  expect(Object.keys(n.spells).sort()).toEqual(known.sort());
  expect(Object.values(n.spells).map(x => x.kind)).toEqual(expect.arrayContaining(["sarmasik", "karga"]));
});

test("yay yoksa kule ok atmaz; yanına geleni elindeki silahla vurur; ok kartı çıkmaz", () => {
  const s = newGame(cfg, 6); s.equipped.bow = undefined as never; delete s.equipped.bow;
  const n = createNobet(cfg, s, site(), 2); n.prep = false; n.breakT = 999;
  expect(n.bow).toBe(false);
  expect(availableCards(s, n).some(c => ["cift", "delici", "ates-ok", "zincir"].includes(c.id))).toBe(false);
  n.foes = [foe(1, TOWER.x + 30, TOWER.y, 100)];
  for (let i = 0; i < 40; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBe(100);                       // menzilden vurulmaz
  n.foes = [foe(2, TOWER.x + TOWER.r + 2, TOWER.y, 100)]; n.foes[0].speed = 0;
  for (let i = 0; i < 60; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBeLessThan(100);               // yakın dövüş
});

test("yayı olan menzildekini vurur", () => {
  const s = newGame(cfg, 6); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1;
  const n = createNobet(cfg, s, site(), 2); n.prep = false; n.breakT = 999; expect(n.bow).toBe(true);
  n.foes = [foe(1, TOWER.x + 12, TOWER.y, 100)]; n.foes[0].speed = 0;
  for (let i = 0; i < 40; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBeLessThan(100);
});

test("sarmaşık/karga/kılıç: durdurur, saldırtmaz, sersemletir; işaretlenen yere düşer", () => {
  const s = newGame(cfg, 6); s.mana = 100; for (const r of ["ardic_koku", "kara_tuy", "pasli_kabza"]) grantRelic(cfg, s, r, {});
  s.attrs.toprak_buyu = { level: 10, pending: 0, peak: 10, lastUsedDay: 0 }; s.attrs.odak = { level: 60, pending: 0, peak: 60, lastUsedDay: 0 };
  const n = createNobet(cfg, s, site(), 2); n.prep = false; n.breakT = 999;
  for (const sp of Object.values(n.spells)) sp.cd = 0;
  const id = (k: string) => Object.keys(n.spells).find(i => n.spells[i].kind === k)!;
  n.foes = [foe(1, TOWER.x + 30)]; n.foes[0].speed = 8;
  expect(useSpell(n, id("sarmasik"), TOWER.x + 30, TOWER.y)).toBe(true); expect(n.foes[0].root).toBeGreaterThan(0);
  n.foes = [foe(3, TOWER.x + 25)]; expect(useSpell(n, id("kilic"), TOWER.x + 25, TOWER.y)).toBe(true); expect(n.foes[0].stun).toBeGreaterThan(0);
  expect(useSpell(n, id("kilic"), TOWER.x + 25, TOWER.y)).toBe(false);
});

test("hazır barikat ve tuzak kurulur, yoksa kurulamaz; hazırlıkta dalga gelmez", () => {
  const s = newGame(cfg, 6);
  grantStructure(s, "kazik_barikat", 1); grantStructure(s, "ilmik_tuzagi", 1);
  const n = createNobet(cfg, s, site(), 3); n.breakT = 999;
  expect(n.prep).toBe(true); expect(canPlaceNow(n)).toBe(true);
  expect(placeTrap(s, n, "ates_tuzagi", TOWER.x + 20, TOWER.y)).toBe(false);   // elde yok
  expect(placeTrap(s, n, "ilmik_tuzagi", TOWER.x + 20, TOWER.y)).toBe(true);
  expect(placeTrap(s, n, "ilmik_tuzagi", TOWER.x - 20, TOWER.y)).toBe(false);   // tek tane vardı
  expect(placeBar(s, n, TOWER.x + 14, TOWER.y)).toBe(true);
  for (let i = 0; i < 100; i++) stepNobet(s, n, 0.05);
  expect(n.wave).toBe(0); expect(n.foes.length).toBe(0);
  expect(pickUp(n, TOWER.x + 20, TOWER.y)).toBe(true); expect(n.traps.length).toBe(0);
  startWaves(n); expect(n.prep).toBe(false);
});

test("tuzak düşmanı tetikler, barikat yolu keser", () => {
  const s = newGame(cfg, 6); s.equipped.bow = "av_yayi"; s.inventory.av_yayi = 1;
  grantStructure(s, "kazik_cukuru", 1); grantStructure(s, "kazik_barikat", 1);
  const n = createNobet(cfg, s, site(), 3); n.breakT = 999; n.prep = false;
  placeTrap(s, n, "kazik_cukuru", TOWER.x + 40, TOWER.y); startWaves(n); n.waveLeft = 0;
  const f = foe(1, TOWER.x + 44, TOWER.y, 200); f.speed = 10; n.foes = [f];
  for (let i = 0; i < 60; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBeLessThan(200);
});

test("nöbette Karabaş alanında gezinir, dışına çıkmaz; alanına gireni kovalar", () => {
  const s = newGame(cfg, 6); s.pet = { id: "kopek", name: "Karabaş", bond: 20 };
  const n = createNobet(cfg, s, site(), 1); n.breakT = 999; n.prep = false;
  placePet(n, TOWER.x + 20, TOWER.y);
  for (let i = 0; i < 80; i++) stepNobet(s, n, 0.05);
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) { stepNobet(s, n, 0.05); expect(Math.hypot(n.pet!.x - n.pet!.hx, n.pet!.y - n.pet!.hy)).toBeLessThan(petGuard(n) + 0.5); seen.add(`${Math.round(n.pet!.x / 3)},${Math.round(n.pet!.y / 3)}`); }
  expect(seen.size).toBeGreaterThan(3);
  n.foes.push(foe(99, n.pet!.hx + 10, n.pet!.hy, 50)); n.foes[0].speed = 0;
  for (let i = 0; i < 80; i++) stepNobet(s, n, 0.05);
  expect(n.foes[0].hp).toBeLessThan(50);
});
