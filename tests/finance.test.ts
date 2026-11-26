// Para düzeni: satış fiyatı mantıklı, aynı mal çok satılınca düşer; ortaklık kazandırır ama risklidir.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { sellPrice, sell, canSell, invest, withdraw, nightlyFinance, stake, PARTNERS } from "../src/engine/finance";
import { itemInfo } from "../src/engine/inventory";

test("satış: pazarda, alıştan ucuza; aynı malı çok satınca fiyat düşer; yadigâr satılmaz", () => {
  const s = newGame(cfg, 3); s.inventory = { ...s.inventory, ip: 5, kartal_tuyu: 1, annenin_heybesi: 1 };
  expect(canSell(cfg, s, "ip").ok).toBe(false);            // yaylada pazar yok
  s.location = "koy_meydani";
  const p1 = sellPrice(cfg, s, "ip"); expect(p1).toBeLessThanOrEqual(itemInfo(cfg, "ip").price!);
  const prices: number[] = []; for (let i = 0; i < 4; i++) prices.push(sell(cfg, s, "kekik").price); // kekik yok: satılmaz
  expect(prices.every(p => p >= 0)).toBe(true);
  s.inventory.kekik = 6; const a = sell(cfg, s, "kekik").price; sell(cfg, s, "kekik"); sell(cfg, s, "kekik"); const d = sellPrice(cfg, s, "kekik");
  expect(d).toBeLessThanOrEqual(a);
  expect(canSell(cfg, s, "annenin_heybesi").ok).toBe(false);
  expect(canSell(cfg, s, "degnek").reason).toMatch(/Kuşandığını/);   // elindeki değnek
  // kartal tüyü şehirde köyden iyi gider
  const koy = sellPrice(cfg, s, "kartal_tuyu", "koy_meydani"), sehir = sellPrice(cfg, s, "kartal_tuyu", "karacam");
  expect(sehir).toBeGreaterThan(koy);
  s.day++; expect(sellPrice(cfg, s, "kekik")).toBeGreaterThan(d * 0.9);  // ertesi gün fiyat toparlanır
});

test("ortaklık: kilitli başlar, ortağın yanında yatırılır, geceleri ortalamada kazandırır, bazen kaybettirir", () => {
  const s = newGame(cfg, 9); s.money = 100;
  s.quests.kurt = { status: "bitti", count: 1 }; s.location = "yayla";
  expect(invest(s, "suru", 20).reason).toMatch(/Karaçam/);   // ortaklık Bölüm 2'de açılır
  s.story.reached.push("k_varis"); delete s.quests.kurt;
  expect(invest(s, "suru", 20).ok).toBe(false);              // önce kurt derdi
  s.quests.kurt = { status: "bitti", count: 1 };
  s.location = "koy_meydani"; expect(invest(s, "suru", 20).reason).toMatch(/yanında/);
  s.location = "yayla";
  expect(invest(s, "suru", 5).ok).toBe(false);               // en az 10
  expect(invest(s, "suru", 40).ok).toBe(true); expect(s.money).toBe(60);
  let gained = 0, losses = 0; const before = s.money;
  for (let d = 0; d < 40; d++) { s.day++; for (const l of nightlyFinance(s)) { if (l.amount > 0) gained += l.amount; else losses++; } if (!stake(s, "suru")) break; }
  expect(gained).toBeGreaterThan(0);
  expect(s.money).toBe(before + gained);
  expect(losses).toBeGreaterThan(0);                          // 40 gecede en az bir kötü gün
  const st = stake(s, "suru");
  if (st) { const r = withdraw(s, "suru"); expect(r.amount).toBe(st); expect(stake(s, "suru")).toBe(0); }
  for (const p of PARTNERS) { expect(p.rate).toBeGreaterThan(p.risk * p.loss * 0.5); expect(p.min).toBeLessThan(p.max); }
});

test("en küçük payla da sürü zamanla para getirir (kesirler birikir)", () => {
  const s = newGame(cfg, 9); s.quests.kurt = { status: "bitti", count: 1 }; s.location = "yayla"; s.money = 10; s.story.reached.push("k_varis");
  expect(invest(s, "suru", 10).ok).toBe(true);
  let gained = 0;
  for (let d = 0; d < 15; d++) { s.day++; for (const l of nightlyFinance(s)) if (l.amount > 0) gained += l.amount; if (!stake(s, "suru")) break; }
  expect(gained).toBeGreaterThanOrEqual(3);
});
