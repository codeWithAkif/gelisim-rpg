// Mühendislik: kalıcı yapılar yapılır, geliştirilir, sökülür; savaşta kullanılır, tükenmez.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { build, canBuild, upgrade, canUpgrade, dismantle, owned, levelOf, barricadeCount, barricadeMul, trapEffect, trapsOwned, engLevel } from "../src/engine/engineering";
import { createSiege, placeBarricade } from "../src/engine/siege";
import { createBattle, DEFAULT_PLAN, enemies } from "../src/engine/combat";
import { itemInfo } from "../src/engine/inventory";

const rich = () => { const s = newGame(cfg, 5); s.energy = 100; Object.assign(s.inventory, { odun: 30, ip: 30, demir_parca: 30 }); s.attrs.el_becerisi.level = 20; s.attrs.taktik.level = 20; s.attrs.analiz.level = 20; s.attrs.ust_govde.level = 20; s.equipped.bag = "annenin_heybesi"; s.inventory.annenin_heybesi = 1; return s; };

test("zor: beceri ve malzeme ister; yapılınca süre geçer, malzeme gider", () => {
  const poor = newGame(cfg, 5); expect(canBuild(cfg, poor, "kazik_barikat").ok).toBe(false);
  const s = rich(); const m0 = s.minute;
  expect(build(cfg, s, "kazik_barikat").ok).toBe(true);
  expect(owned(s, "kazik_barikat")).toBe(1); expect(s.inventory.odun).toBe(24); expect(s.minute).toBeGreaterThan(m0);
  s.inventory.odun = 0; expect(canBuild(cfg, s, "kazik_barikat").ok).toBe(false);
});

test("ateş tuzağı ateş sayfası ister", () => {
  const s = rich(); expect(canBuild(cfg, s, "ates_tuzagi").ok).toBe(false); s.knownElements.push("el_ates"); expect(canBuild(cfg, s, "ates_tuzagi").ok).toBe(true);
});

test("sökünce malzemenin çoğu geri gelir, seviye kalır; yeniden yapılabilir", () => {
  const s = rich(); build(cfg, s, "kazik_barikat"); build(cfg, s, "kazik_barikat");
  expect(upgrade(cfg, s, "kazik_barikat").ok).toBe(true); expect(levelOf(s, "kazik_barikat")).toBe(2);
  const odun = s.inventory.odun ?? 0; const r = dismantle(cfg, s, "kazik_barikat");
  expect(r.ok).toBe(true); expect(owned(s, "kazik_barikat")).toBe(1); expect(s.inventory.odun).toBe(odun + 4); // 6 odunun %80'i
  expect(levelOf(s, "kazik_barikat")).toBe(2);
  expect(itemInfo(cfg, "odun").name).toBe("Odun");
});

test("geliştirme düzey ve malzeme ister; en üst seviyede durur", () => {
  const s = rich(); expect(canUpgrade(cfg, s, "ilmik_tuzagi").ok).toBe(false); // hiç yok
  build(cfg, s, "ilmik_tuzagi"); s.attrs.el_becerisi.level = 10; s.attrs.taktik.level = 10; s.attrs.analiz.level = 10; s.attrs.ust_govde.level = 10;
  expect(canUpgrade(cfg, s, "ilmik_tuzagi").ok).toBe(false); expect(engLevel(s)).toBeLessThan(13);
  s.attrs.el_becerisi.level = 40; s.attrs.taktik.level = 40; s.attrs.analiz.level = 40; s.attrs.ust_govde.level = 40; s.inventory.ip = 30; s.inventory.demir_parca = 30; s.energy = 100; s.minute = 0;
  for (let i = 0; i < 4; i++) { expect(upgrade(cfg, s, "ilmik_tuzagi").ok).toBe(true); s.minute = 0; s.energy = 100; }
  expect(levelOf(s, "ilmik_tuzagi")).toBe(5); expect(canUpgrade(cfg, s, "ilmik_tuzagi").ok).toBe(false);
  expect(trapEffect(s, "ilmik_tuzagi").dmg).toBeGreaterThan(trapEffect(newGame(cfg, 1), "ilmik_tuzagi").dmg);
});

test("kuşatmada barikat sayısı ve dayanıklılığı yapılardan gelir", () => {
  const s = rich(); expect(barricadeCount(s)).toBe(2); for (let i = 0; i < 2; i++) build(cfg, s, "kazik_barikat"); expect(barricadeCount(s)).toBe(4);
  const t = newGame(cfg, 1); const a = createSiege(cfg, t, { id: "x", name: "x", ground: "cayir", waves: [] }, 1); placeBarricade(t, a, 10, 10, 20, 10);
  t.yapi = { kazik_barikat: { n: 1, lv: 4 } }; const b = createSiege(cfg, t, { id: "x", name: "x", ground: "cayir", waves: [] }, 1); placeBarricade(t, b, 10, 10, 20, 10);
  expect(barricadeMul(t)).toBeCloseTo(1.9); expect(b.barricades[0].max).toBeGreaterThan(a.barricades[0].max * 1.5);
});

test("tuzaklar savaşta kurulur, basılınca hasar verir ve yapı olarak kalır", () => {
  const s = rich(); s.yapi = { kazik_cukuru: { n: 1, lv: 3 } }; expect(trapsOwned(s)).toEqual([{ id: "kazik_cukuru", n: 1 }]);
  const plan = { ...DEFAULT_PLAN, traps: [[3, 5]] as [number, number][], trapTypes: ["kazik_cukuru"] };
  const b = createBattle(cfg, s, "mera", ["kurt"], 4, undefined, plan);
  expect(b.trapInfo?.["3,5"]?.dmg).toBe(trapEffect(s, "kazik_cukuru").dmg); expect(b.trapInfo?.["3,5"]?.dmg).toBe(17);
  expect(owned(s, "kazik_cukuru")).toBe(1); expect(enemies(b).length).toBe(1);
});
