import { describe, it, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { capacity, slotsUsed, addItem, equip, buy, stacks } from "../src/engine/inventory";
import { planSession, startSession, finishSession, sessionProgress, startCraft } from "../src/engine/session";
import { maxHp } from "../src/engine/combat";

describe("çanta", () => {
  it("bez torba 8 göz; kuşanılanlar göz kaplamaz; yiyecek yığılır", () => {
    const s = newGame(cfg, 1);
    expect(capacity(cfg, s)).toBe(8);
    expect(slotsUsed(cfg, s)).toBe(1); // yalnız ekmek (değnek ve torba kuşanılı)
    addItem(cfg, s, "ekmek", 4); expect(slotsUsed(cfg, s)).toBe(1); // 5'lik yığın
    addItem(cfg, s, "ekmek", 1); expect(slotsUsed(cfg, s)).toBe(2);
  });
  it("dolu çanta fazlasını bırakır; büyük çanta gelirse kuşanılır", () => {
    const s = newGame(cfg, 1);
    const dropped = addItem(cfg, s, "deri", 100);
    expect(dropped).toBeGreaterThan(0); expect(slotsUsed(cfg, s)).toBe(8);
    expect(addItem(cfg, s, "annenin_heybesi", 1)).toBe(0);
    expect(s.equipped.bag).toBe("annenin_heybesi"); expect(capacity(cfg, s)).toBe(16);
    expect(stacks(cfg, s).some(x => x.id === "bez_torba")).toBe(true);
  });
  it("küçük çantaya geçmek, eşyalar sığmazsa reddedilir; pazar parayı düşer", () => {
    const s = newGame(cfg, 1); addItem(cfg, s, "annenin_heybesi", 1); equip(cfg, s, "annenin_heybesi");
    addItem(cfg, s, "deri", 120);
    expect(equip(cfg, s, "bez_torba").ok).toBe(false);
    const t = newGame(cfg, 1); expect(buy(cfg, t, "ip").ok).toBe(false); t.location = "koy_meydani"; const m = t.money; expect(buy(cfg, t, "ip").ok).toBe(true); expect(t.money).toBe(m - 1);
  });
});

describe("gerçek zamanlı oturum", () => {
  it("1 saat bir tam oturum kazancı verir, 10 sn çok azını; süre dolmadan bitmez", () => {
    const a = newGame(cfg, 1), b = newGame(cfg, 1);
    startSession(cfg, a, "meditasyon", 3_600_000, 0);
    expect(finishSession(cfg, a, 1000)).toBeNull();          // süre dolmadı
    expect(sessionProgress(a, 1_800_000)).toBeCloseTo(0.5);
    const ra = finishSession(cfg, a, 3_600_000)!;
    startSession(cfg, b, "meditasyon", 10_000, 0); const rb = finishSession(cfg, b, 10_000)!;
    expect(ra.gains.odak).toBeGreaterThan(rb.gains.odak * 100);
    expect(a.session).toBeUndefined();
  });
  it("yarıda bırakınca geçen süre kadar kazanılır", () => {
    const s = newGame(cfg, 1); startSession(cfg, s, "meditasyon", 3_600_000, 0);
    const r = finishSession(cfg, s, 900_000, true)!;
    expect(r.early).toBe(true); expect(r.minutes).toBeCloseTo(15);
  });
  it("enerji yetmezse uzun koşu açılmaz; oturum sürerken ikinci başlamaz", () => {
    const s = newGame(cfg, 1);
    expect(planSession(cfg, s, "kosu", 18_000_000).ok).toBe(false); // 5 saat koşu
    expect(planSession(cfg, s, "kosu", 3_600_000).ok).toBe(true);
    startSession(cfg, s, "kosu", 3_600_000, 0);
    expect(planSession(cfg, s, "meditasyon", 60_000).ok).toBe(false);
  });
  it("yaralıyken bedensel kazanç düşer", () => {
    const a = newGame(cfg, 1), b = newGame(cfg, 1);
    b.hp = Math.floor(maxHp(cfg, b) * 0.3);
    startSession(cfg, a, "kosu", 3_600_000, 0); startSession(cfg, b, "kosu", 3_600_000, 0);
    const ra = finishSession(cfg, a, 3_600_000)!, rb = finishSession(cfg, b, 3_600_000)!;
    expect(rb.gains.bacak).toBeLessThan(ra.gains.bacak); expect(rb.wounded).toBe(true);
  });
  it("çanta dikmek malzemeyi ayırır, bitince deri çanta verir", () => {
    const s = newGame(cfg, 1); addItem(cfg, s, "deri", 2); addItem(cfg, s, "ip", 2);
    expect(startCraft(cfg, s, "canta_dik", 0).ok).toBe(false); // el becerisi 10 < 12
    s.attrs.el_becerisi.level = 12;
    expect(startCraft(cfg, s, "canta_dik", 0).ok).toBe(true);
    expect(s.inventory.deri).toBeUndefined();
    const r = finishSession(cfg, s, 3_600_000)!;
    expect(r.product).toBe("deri_canta"); expect(s.inventory.deri_canta).toBe(1);
  });
});
