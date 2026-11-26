// Diyar: rütbe, ev, adamlar, yanında gezenler, haber salma, görevler, işletmeler, gecelik hesap.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import {
  rankOf, canBuyHouse, buyHouse, canHire, hire, heroLimit, toggleParty, partyHeroes, callable, callMany, etaTo, jobsFor, assign, canAssign, nightly, found, setWorker, collect,
  heroOf, heroStats, successChance, afterBattle, est, houseOf, homeBed, dismiss, canFound,
} from "../src/engine/estate";
import { jobDef } from "../src/content/estate";
import { createBattle, allies } from "../src/engine/combat";
import { createSiege } from "../src/engine/siege";
import { createNobet, nobetSite } from "../src/engine/nobet";
import { sleepAt, sleepOptions } from "../src/engine/rest";

function rich(): GameState {
  const s = newGame(cfg, 8); s.location = "koy_meydani"; s.money = 1000; s.energy = 100;
  Object.assign(s.inventory, { odun: 30, ip: 20, deri: 10, demir_parca: 10 }); s.equipped.bag = "annenin_heybesi"; s.inventory.annenin_heybesi = 1;
  s.rep = { taspinar: { taninirlik: 40, guven: 20 } }; for (const q of ["mesaj", "kurt", "devriye", "agil_gecesi"]) s.quests[q] = { status: "bitti", count: 1 };
  return s;
}

test("rütbe: nüfuz arttıkça yükselir", () => {
  const s = newGame(cfg, 1); expect(rankOf(s).rank.id).toBe(0);
  const r = rich(); expect(rankOf(r).rank.id).toBeGreaterThanOrEqual(3);
});
test("ev: rütbe, yer ve malzeme ister; evde uyku güvenli ve iyi", () => {
  const poor = newGame(cfg, 1); poor.location = "koy_meydani"; expect(canBuyHouse(cfg, poor).ok).toBe(false);
  const s = rich(); s.location = "yayla"; expect(canBuyHouse(cfg, s).ok).toBe(false);
  s.location = "koy_meydani"; expect(buyHouse(cfg, s).ok).toBe(true); expect(houseOf(s)?.name).toBe("Köy evi"); expect(est(s).homePlace).toBe("koy_meydani");
  expect(homeBed(s)?.quality).toBeGreaterThan(1);
  const o = sleepOptions(s).find(x => x.kind === "lodging")!; expect(o.ok && o.cost === 0 && o.risk === 0).toBe(true);
  expect(buyHouse(cfg, s).ok).toBe(true); expect(houseOf(s)?.name).toBe("Taş ev"); // evdeyken büyür
});
test("adam tutmak: ev, rütbe, yer ve sınır ister", () => {
  const s = rich(); expect(canHire(s, "bora").ok).toBe(false); // ev yok
  buyHouse(cfg, s); expect(hire(s, "bora").ok).toBe(true); expect(hire(s, "bora").ok).toBe(false);
  expect(canHire(s, "kirpi").ok).toBe(heroLimit(s) >= 2);
  s.location = "yayla"; expect(canHire(s, "selvi").ok).toBe(false);
});
test("yanında gezen adamlar savaşta müttefik olur; en çok iki; evde değilken alınmaz", () => {
  const s = rich(); buyHouse(cfg, s); buyHouse(cfg, s); hire(s, "bora"); hire(s, "kirpi");
  expect(toggleParty(s, "bora").ok).toBe(true); expect(toggleParty(s, "kirpi").ok).toBe(true);
  expect(partyHeroes(s).length).toBe(2);
  const b = createBattle(cfg, s, "mera", ["kurt"], 3); expect(allies(b).filter(a => a.uid.startsWith("h:")).length).toBe(2);
  expect(createSiege(cfg, s, { id: "x", name: "x", ground: "cayir", waves: [] }, 1).helpers.length).toBe(2);
  expect(createNobet(cfg, s, nobetSite("yayla")!, 1).helpers.length).toBe(2);
  s.location = "yayla"; toggleParty(s, "kirpi"); expect(est(s).party!.length).toBe(1); // eve gönderilir (her yerden)
});
test("haber salmak vakit alır; yetişemezse olmaz", () => {
  const s = rich(); buyHouse(cfg, s); hire(s, "bora");
  const m0 = s.minute; expect(callable(s, "yayla").length).toBe(1); const eta = etaTo(s, "yayla"); expect(eta).toBeGreaterThan(15);
  expect(callMany(s, ["bora"], "yayla").ok).toBe(true); expect(s.minute).toBe(m0 + eta);
  s.minute = 1300; expect(callMany(s, ["bora"], "yayla").ok).toBe(false);
});
test("görev panosu: atanan adam geceleyin döner; başarı şansı güçle artar; kötü giderse yaralı", () => {
  const s = rich(); buyHouse(cfg, s); buyHouse(cfg, s); hire(s, "bora"); hire(s, "kirpi");
  expect(jobsFor(s).some(j => j.id === "j_devriye")).toBe(true);
  expect(assign(s, "j_devriye", "bora").ok).toBe(true); expect(canAssign(s, "j_devriye", "kirpi").ok).toBe(false); expect(heroOf(s, "bora")!.status).toBe("gorevde");
  expect(successChance(heroOf(s, "bora")!, jobDef("j_devriye")!)).toBeGreaterThan(successChance(heroOf(s, "kirpi")!, jobDef("j_devriye")!));
  s.day += 1; const m0 = s.money; const lines = nightly(cfg, s); expect(lines.length).toBeGreaterThan(0);
  const h = heroOf(s, "bora")!; expect(["evde", "yarali"]).toContain(h.status); expect(s.money).not.toBe(m0);
  const t = rich(); buyHouse(cfg, t); hire(t, "bora"); heroOf(t, "bora")!.status = "evde";
  expect(afterBattle(t, ["bora"], "won").length >= 0).toBe(true); expect(heroOf(t, "bora")!.xp).toBeGreaterThan(0);
});
test("işletme: çalışan üretir, bakım öder, ambardan alınır; çalışansız üretmez", () => {
  const s = rich(); buyHouse(cfg, s); buyHouse(cfg, s); hire(s, "kirpi"); expect(canFound(cfg, s, "odunluk").ok).toBe(true); expect(found(cfg, s, "odunluk").ok).toBe(true);
  s.day += 1; nightly(cfg, s); expect(est(s).ventures!.odunluk.stock).toBe(0);
  setWorker(s, "odunluk", "kirpi"); for (let i = 0; i < 6; i++) { s.day += 1; nightly(cfg, s); }
  expect(est(s).ventures!.odunluk.stock).toBeGreaterThan(4); const o0 = s.inventory.odun; expect(collect(cfg, s, "odunluk").ok).toBe(true); expect(s.inventory.odun).toBeGreaterThan(o0);
});
test("maaş ödenmezse sadakat düşer, çok düşünce adam gider; gece uykuda hesap işler", () => {
  const s = rich(); buyHouse(cfg, s); hire(s, "bora"); s.money = 0; for (let i = 0; i < 8; i++) { s.day += 1; nightly(cfg, s); }
  expect(heroOf(s, "bora")).toBeUndefined();
  const t = rich(); buyHouse(cfg, t); hire(t, "bora"); const r = sleepAt(cfg, t, "lodging"); expect("error" in r).toBe(false);
  if (!("error" in r)) expect(r.estate.join(" ")).toMatch(/maaş/);
  dismiss(t, "bora"); expect(est(t).heroes!.length).toBe(0); expect(heroStats({ id: "bora", lv: 3, xp: 0, loyalty: 60, hp: 1, status: "evde" }).power).toBeGreaterThan(4);
});
