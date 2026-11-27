// Kervan ticareti, belgeler ve iyi sofra.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { arrive } from "../src/engine/travel";
import { buyPrice, sellTotal, buyCart, planCaravan, sendCaravan, nightlyTrade, tradeOf, cartsFree, buyPaper, hasPaper, feast, ambushChance } from "../src/engine/trade";
import { est } from "../src/engine/estate";
import { sleep } from "../src/engine/progression";
import { nextStep } from "../src/engine/actions";
import { CART_CAP } from "../src/content/trade";

const B1 = ["varis", "ilk_is", "donmus_kuzu", "suru", "iz", "kivilcim", "ates_kurt", "suru_basi", "mektup"];
function trader(seed = 3, money = 200): GameState {
  const s = newGame(cfg, seed); s.introDone = true; s.story.reached = [...B1, "k_varis"]; s.money = money;
  arrive(s, "karacam"); arrive(s, "koy_meydani"); return s;   // Karaçam pazarını gördü
}
const nextDay = (s: GameState) => { s.day += 1; s.minute = 0; };

test("bölgenin ucuz malı başka bölgede kâr eder; tersi zarar", () => {
  const s = trader(); let good = 0, bad = 0;
  for (let d = 0; d < 30; d++) { s.day = d + 1;
    good += sellTotal(s, "karacam", "peynir_kalibi", 1) - buyPrice(s, "taspinar", "peynir_kalibi");
    bad += sellTotal(s, "karacam", "kumas", 1) - buyPrice(s, "taspinar", "kumas"); }
  expect(good / 30).toBeGreaterThan(1);
  expect(bad / 30).toBeLessThan(0);
  // aynı maldan çok satmak birim fiyatı düşürür
  expect(sellTotal(s, "karacam", "peynir_kalibi", 24) / 24).toBeLessThan(sellTotal(s, "karacam", "peynir_kalibi", 1));
});

test("araba olmadan kervan çıkmaz; yük arabaya ve cebe sığmalı", () => {
  const s = trader(3, 60);
  expect(planCaravan(s, "karacam", { peynir_kalibi: 2 }, []).reason).toMatch(/araba/i);
  expect(buyCart(s).ok).toBe(true); expect(tradeOf(s).carts).toBe(1);
  expect(planCaravan(s, "karacam", { peynir_kalibi: CART_CAP + 1 }, []).ok).toBe(false);
  s.money = 3; expect(planCaravan(s, "karacam", { peynir_kalibi: 4 }, []).reason).toMatch(/cebinde/);
  s.money = 200; expect(planCaravan(s, "ayazkale", { peynir_kalibi: 4 }, []).reason).toMatch(/görmedin/);
});

test("kervan günlerce yol alır, vardığı gece satılır; araba ve korumalar döner", () => {
  const s = trader(); buyCart(s); s.money = 200;
  const e = est(s); e.heroes!.push({ id: "bora", lv: 1, xp: 0, loyalty: 60, hp: 30, status: "evde" } as never);
  const r = sendCaravan(s, "karacam", { peynir_kalibi: 8 }, ["bora"]);
  expect(r.ok).toBe(true); expect(cartsFree(s)).toBe(0); expect(e.heroes![0].status).toBe("gorevde");
  const before = s.money;
  nextDay(s); expect(nightlyTrade(s)).toHaveLength(0);
  nextDay(s); const out = nightlyTrade(s);
  expect(out).toHaveLength(1); expect(s.money).toBe(before + out[0].sold);
  expect(cartsFree(s)).toBe(1); expect(["evde", "yarali"]).toContain(e.heroes![0].status);
});

test("korumalar ve izci tehlikeli yolda kaybı azaltır", () => {
  const run = (guards: boolean) => { let profit = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const s = trader(seed, 400); s.story.reached.push("k_muhur", "k_tebesir", "k_selim", "k_derya", "k_defter", "a_gecit", "a_iceride");
      arrive(s, "ayaz_mutfak"); arrive(s, "karacam"); buyCart(s); s.money = 400;
      if (guards) { const e = est(s); for (const id of ["demir", "tilki", "kar"]) e.heroes!.push({ id, lv: 2, xp: 0, loyalty: 60, hp: 30, status: "evde" } as never); }
      const r = sendCaravan(s, "ayazkale", { kumas: 8 }, guards ? ["demir", "tilki", "kar"] : []); if (!r.ok) throw new Error(r.reason);
      for (let d = 0; d < 3; d++) nextDay(s); profit += nightlyTrade(s)[0].profit;
    } return profit / 150; };
  const bare = run(false), guarded = run(true);
  expect(guarded).toBeGreaterThan(bare + 10);
  expect(ambushChance(42, true)).toBeLessThan(ambushChance(42, false));
});

test("geçiş beratı parayla alınır; beratsız Kar geçidi 'Sıradaki adım'da önce beratı ister", () => {
  const s = trader(5, 100);
  s.story.reached.push("k_muhur", "k_tebesir", "k_selim", "k_derya", "k_defter");
  for (const q of ["mesaj", "agil_nobet", "kurt", "annenin_izi", "selim_dukkan", "isaretli_arabalar", "kervan", "sarnic", "lonca_defteri"]) s.quests[q] = { status: "bitti", count: 1 };
  s.quests.gecit = { status: "aktif" } as never; s.minute = 60; s.energy = 100;
  expect(nextStep(s)!.title).toBe("Önce: Geçiş beratı");
  expect(buyPaper(s, "berat").ok).toBe(false);                 // yanlış yer
  arrive(s, "karacam_lonca"); expect(buyPaper(s, "berat").reason).toMatch(/150/);
  s.money = 160; expect(buyPaper(s, "berat").ok).toBe(true); expect(hasPaper(s, "berat")).toBe(true); expect(s.money).toBe(10);
  expect(nextStep(s)!.title).toBe("Kar geçidi");
});

test("zengin sofra o gece uykuda işlenen gelişimi %25 artırır", () => {
  const a = trader(7), b = trader(7);
  a.attrs.kilic.pending = 2; b.attrs.kilic.pending = 2; a.satiety = b.satiety = 80;
  arrive(b, "karacam_han"); b.money = 50; expect(feast(b).ok).toBe(true); expect(feast(b).ok).toBe(false);
  const ra = sleep(cfg, a), rb = sleep(cfg, b);
  expect(rb.applied.kilic! / ra.applied.kilic!).toBeCloseTo(1.25, 2);
});

test("ekonomi: Bölüm 1 sonundaki cep (100) ve bir korumayla 150 bakırlık berat 10–30 günde birikir", () => {
  const s = trader(11, 140); buyCart(s); est(s).heroes!.push({ id: "bora", lv: 1, xp: 0, loyalty: 60, hp: 30, status: "evde" } as never);
  let day = 0;
  // net servet: cep + ilk arabadan sonra arabalara yatırılan (araba satılmaz ama birikimdir)
  const worth = () => s.money + [0, 0, 90, 250][tradeOf(s).carts];
  while (worth() < 150 + 100 && day < 60) {
    const here = s.location === "koy_meydani" ? "taspinar" : "karacam";
    const goodId = here === "taspinar" ? "peynir_kalibi" : "kumas"; const to = here === "taspinar" ? "karacam" : "taspinar";
    if (tradeOf(s).carts < 3 && s.money > [0, 90, 160][tradeOf(s).carts] + 80) buyCart(s);
    const n = Math.min(cartsFree(s) * CART_CAP, Math.floor((s.money - 10) / buyPrice(s, here, goodId)));
    if (n > 0 && sellTotal(s, to, goodId, n) > buyPrice(s, here, goodId) * n) sendCaravan(s, to, { [goodId]: n }, est(s).heroes![0].status === "evde" ? ["bora"] : []);
    s.money -= 2;   // Bora'nın maaşı
    nextDay(s); day++; nightlyTrade(s); for (const h of est(s).heroes!) if (h.status === "yarali" && (h.until ?? 0) <= s.day) h.status = "evde";
    if (!tradeOf(s).caravans.length) arrive(s, here === "taspinar" ? "karacam" : "koy_meydani");
  }
  console.log("berat için gün:", day, "para:", s.money, "araba:", tradeOf(s).carts);
  expect(day).toBeGreaterThanOrEqual(10); expect(day).toBeLessThanOrEqual(30);
});

test("Selim'in defteri: ders araba verir, kârlı sefer ve üç sefer sonraki adımları açar; lonca ucuzlatır, kervansaray güvenli kılar", async () => {
  const { advanceStory, openSideStories } = await import("../src/engine/story");
  const { routeDanger } = await import("../src/engine/trade");
  const s = trader(21, 500); s.story.reached.push("k_muhur", "k_tebesir", "k_selim"); s.story.flags.selimGun = s.day;
  advanceStory(s); expect(s.story.reached).not.toContain("f_ders");          // ertesi gün, Karaçam'da
  s.day++; arrive(s, "karacam"); advanceStory(s);
  expect(s.story.reached).toContain("f_ders"); expect(tradeOf(s).carts).toBe(1);
  expect(openSideStories(s).map(m => m.id)).toEqual(["f_ilk_yuk"]);
  tradeOf(s).stats = { trips: 1, profitTrips: 1, robbed: 0, profit: 30 }; advanceStory(s); expect(s.story.reached).toContain("f_ilk_yuk");
  tradeOf(s).stats!.trips = 3; advanceStory(s); expect(s.story.reached).toContain("f_kayip");
  const before = buyPrice(s, "karacam", "kumas");
  arrive(s, "karacam_lonca"); expect(buyPaper(s, "lonca").ok).toBe(true); advanceStory(s);
  expect(s.story.reached).toContain("f_lonca"); expect(buyPrice(s, "karacam", "kumas")).toBeLessThan(before);
  const d0 = routeDanger(s, "karacam", "taspinar");
  arrive(s, "karacam"); expect(buyPaper(s, "kervansaray").ok).toBe(true); advanceStory(s);
  expect(s.story.reached).toContain("f_kervansaray"); expect(routeDanger(s, "karacam", "taspinar")).toBeLessThan(d0);
  expect(routeDanger(s, "taspinar", "ardic")).toBe(25);
});

test("adamlar yaptıkları işte ustalaşır: kervan seferi korumayı güçlendirir", async () => {
  const { heroSkill, practice } = await import("../src/engine/estate");
  const { guardPower } = await import("../src/engine/trade");
  const s = trader(); const e = est(s); e.heroes!.push({ id: "bora", lv: 1, xp: 0, loyalty: 60, hp: 30, status: "evde" } as never);
  const h = e.heroes![0]; const p0 = guardPower(s, ["bora"]).power;
  for (let i = 0; i < 8; i++) practice(h, "kervan");
  expect(heroSkill(h, "kervan")).toBe(2); expect(heroSkill(h, "isletme")).toBe(0);
  expect(guardPower(s, ["bora"]).power).toBeGreaterThan(p0 * 1.15);
});
