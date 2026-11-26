// Çanta: ek bölme dikmek, kategoriler.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { capacity, attachPouch, detachPouch, equip, addItem, slotsUsed, inTab, pouchSlots } from "../src/engine/inventory";

test("heybeye dikilen deri çanta kendi gözünün ancak bir kısmını katar", () => {
  const s = newGame(cfg, 1); s.inventory.annenin_heybesi = 1; s.inventory.deri_canta = 1;
  expect(equip(cfg, s, "annenin_heybesi").ok).toBe(true);
  const base = capacity(cfg, s);
  expect(attachPouch(cfg, s, "deri_canta").ok).toBe(true);
  const added = capacity(cfg, s) - base;
  expect(added).toBe(pouchSlots(cfg, "deri_canta"));
  expect(added).toBeLessThan(12);      // ana çanta olsaydı 12 göz verirdi
  expect(added).toBeGreaterThan(0);
  expect(attachPouch(cfg, s, "deri_canta").ok).toBe(false); // ikinci tane yok
});

test("ek bölme sökülürse eşyalar sığmıyorsa sökülmez; ana çanta yapılabilir", () => {
  const s = newGame(cfg, 1); s.inventory.deri_canta = 1;
  attachPouch(cfg, s, "deri_canta"); const cap = capacity(cfg, s);
  const kinds = ["ekmek", "peynir", "deri", "ip", "ok", "kekik", "elma", "isirgan", "nane", "mantar", "adacayi", "mesale"];
  for (const k of kinds) { if (slotsUsed(cfg, s) >= cap) break; addItem(cfg, s, k, 1); }
  expect(detachPouch(cfg, s, 0).ok).toBe(slotsUsed(cfg, s) <= capacity(cfg, s) - 4 ? true : false);
  const t = newGame(cfg, 1); t.inventory.deri_canta = 1; attachPouch(cfg, t, "deri_canta");
  expect(equip(cfg, t, "deri_canta").ok).toBe(true); expect(t.equipped.pouches?.length ?? 0).toBe(0); expect(capacity(cfg, t)).toBe(12);
});

test("kategoriler", () => {
  expect(inTab(cfg, "ekmek", "yiyecek")).toBe(true); expect(inTab(cfg, "ekmek", "malzeme")).toBe(false);
  expect(inTab(cfg, "deri_canta", "kusanilir")).toBe(true); expect(inTab(cfg, "deri", "hepsi")).toBe(true);
});
