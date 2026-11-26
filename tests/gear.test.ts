// Kuşam: baş, üst, alt, eller, takılar; sağ/sol el, iki elli, kalkan; yay ayrı.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, migrate } from "../src/engine/state";
import { equip, unequip, capacity, slotsUsed, stacks } from "../src/engine/inventory";
import { weaponSet, totalArmor, totalDodge, gearBonus, hasBow, slotsFor } from "../src/engine/gear";
import { effectiveAttr } from "../src/engine/derived";

const g = () => { const s = newGame(cfg, 3); Object.assign(s.inventory, { el_yapimi_bicak: 1, hancer: 1, odun_baltasi: 1, agac_kalkan: 1, av_yayi: 1, deri_baslik: 1, yun_salvar: 1, deri_eldiven: 1, temiz_giysi: 1, bakir_yuzuk: 1, nazar_boncugu: 1, kemik_kolye: 1, annenin_heybesi: 1 }); s.equipped.bag = "annenin_heybesi"; return s; };

test("giyim parçaları korumaya toplanır; takılar özelliğe ek verir", () => {
  const s = g();
  for (const id of ["deri_baslik", "yun_salvar", "deri_eldiven", "temiz_giysi"]) expect(equip(cfg, s, id).ok).toBe(true);
  expect(totalArmor(s)).toBe(2 + 1 + 1 + 1);
  const odak0 = effectiveAttr(cfg, s, "odak");
  expect(equip(cfg, s, "bakir_yuzuk").ok).toBe(true); expect(equip(cfg, s, "nazar_boncugu").ok).toBe(true);
  expect(s.equipped.trinket1).toBe("bakir_yuzuk"); expect(s.equipped.trinket2).toBe("nazar_boncugu");
  expect(effectiveAttr(cfg, s, "odak")).toBeCloseTo(odak0 + 2); expect(gearBonus(s, "stres")).toBe(1.5);
});

test("çift silah: sol el yarım vurur, isabet düşer; iki elli sol eli boşaltır; kalkan korur", () => {
  const s = g(); s.equipped.weapon = undefined;
  equip(cfg, s, "el_yapimi_bicak", "weapon"); const one = weaponSet(cfg, s);
  equip(cfg, s, "hancer", "offhand"); const two = weaponSet(cfg, s);
  expect(two.dual).toBe(true); expect(two.dmg).toBeCloseTo(one.dmg + 5 * 0.5); expect(two.acc).toBeLessThanOrEqual(0);
  equip(cfg, s, "odun_baltasi"); expect(s.equipped.offhand).toBeUndefined(); expect(weaponSet(cfg, s).twoHanded).toBe(true);
  equip(cfg, s, "agac_kalkan"); expect(s.equipped.weapon).toBeUndefined(); // kalkan alınca iki elli bırakılır
  equip(cfg, s, "el_yapimi_bicak", "weapon"); expect(totalArmor(s)).toBe(2); expect(totalDodge(s)).toBe(4);
  expect(slotsFor("odun_baltasi")).toEqual(["weapon"]); expect(slotsFor("hancer")).toEqual(["weapon", "offhand"]);
});

test("yay ayrı yuvada: kılıçla birlikte taşınır; kuşanılanlar göz kaplamaz", () => {
  const s = g(); equip(cfg, s, "el_yapimi_bicak", "weapon"); expect(equip(cfg, s, "av_yayi").ok).toBe(true);
  expect(s.equipped.bow).toBe("av_yayi"); expect(s.equipped.weapon).toBe("el_yapimi_bicak"); expect(hasBow(s)).toBe(true);
  expect(stacks(cfg, s).some(x => x.id === "av_yayi")).toBe(false);
  unequip(cfg, s, "bow"); expect(s.equipped.bow).toBeUndefined();
  expect(slotsUsed(cfg, s)).toBeGreaterThan(0); expect(capacity(cfg, s)).toBeGreaterThan(0);
});

test("eski kayıt: elde tutulan yay yay yuvasına geçer", () => {
  const s = newGame(cfg, 3); s.inventory.av_yayi = 1; s.equipped.weapon = "av_yayi";
  migrate(cfg, s); expect(s.equipped.bow).toBe("av_yayi"); expect(s.equipped.weapon).toBeUndefined();
});

test("demircilik silahın ağzını bakımlı tutar: vuruş artar, yumruk değişmez", async () => {
  const { honeMul } = await import("../src/engine/gear");
  const s = g(); expect(equip(cfg, s, "hancer", "weapon").ok).toBe(true); const d0 = weaponSet(cfg, s).dmg;
  s.attrs.demircilik.level = 100; expect(honeMul(s)).toBeCloseTo(1.25); expect(weaponSet(cfg, s).dmg).toBeCloseTo(d0 * 1.25);
  const bare = newGame(cfg, 3); delete bare.equipped.weapon; bare.attrs.demircilik.level = 100; expect(weaponSet(cfg, bare).dmg).toBe(2);
});
