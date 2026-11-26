// Keşif: arama, koleksiyon, günlük istekler, gezdikçe açılan harita.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { searchHere, canSearch, collected, dailyRequests, deliverRequest, isSeen, markSeen, findChance, searchInfo } from "../src/engine/explore";
import { COLLECTIBLES, FINDS, REQUESTS, FINDS_PER_DAY } from "../src/content/explore";
import { GAME_ITEMS } from "../src/content/world";
import { PLACES } from "../src/content/map";
import { startJourney, finishJourney } from "../src/engine/journey";

test("içerik tutarlı: bulunanlar ve istenenler gerçek eşya ve yerler", () => {
  for (const c of COLLECTIBLES) if (c.item) expect(GAME_ITEMS[c.item], c.id).toBeTruthy();
  for (const [pl, fs] of Object.entries(FINDS)) { expect(PLACES.some(p => p.id === pl), pl).toBe(true); for (const f of fs) expect(COLLECTIBLES.some(c => c.id === f.id), f.id).toBe(true); }
  for (const r of REQUESTS) for (const k of Object.keys(r.want)) expect(GAME_ITEMS[k], r.id + k).toBeTruthy();
});

test("aramak zaman alır, bir şeyler bulunur, ilk bulunan deftere işlenir, günlük sınır var", () => {
  const s = newGame(cfg, 11); s.location = "dere"; s.energy = 100;
  const m0 = s.minute; let found = 0, firsts = 0;
  for (let i = 0; i < 20 && canSearch(s).ok; i++) { const r = searchHere(cfg, s); expect(r.ok).toBe(true); if (r.found) found++; if (r.first) firsts++; }
  expect(s.minute).toBeGreaterThan(m0 + 40);
  expect(found).toBe(FINDS_PER_DAY);
  expect(searchInfo(s).left).toBe(0);
  expect(canSearch(s).reason).toMatch(/kalmadı/);
  expect(firsts).toBeGreaterThan(0);
  expect(collected(s).size).toBe(firsts);
  expect((s.inventory.isirgan ?? 0) + (s.inventory.nane ?? 0)).toBeGreaterThan(0);
  expect(Object.values(s.inventory).reduce((a, b) => a + b, 0)).toBeGreaterThan(3); // bulunanlar gerçekten çantada
  s.day++; expect(canSearch(s).ok).toBe(true); // ertesi gün yeniden
});

test("keskin duyular daha çok bulur", () => {
  const s = newGame(cfg, 1); const low = findChance(s, "koku"); s.attrs.koku.level += 30; s.attrs.analiz.level += 20;
  expect(findChance(s, "koku")).toBeGreaterThan(low + 25);
});

test("günlük istekler: tanıdıklardan gelir, getirince ödül, ertesi gün yenilenir", () => {
  const s = newGame(cfg, 5);
  expect(dailyRequests(s)).toHaveLength(0); // kimseyi tanımıyorsun
  s.metNpcs = ["hasan", "zehra", "nuri", "kemal", "ayse"];
  const reqs = dailyRequests(s); expect(reqs).toHaveLength(2);
  expect(new Set(reqs.map(r => r.def.npc)).size).toBe(2);
  const r = reqs[0];
  expect(deliverRequest(cfg, s, r.def.id).ok).toBe(false);
  s.location = r.place; for (const [k, n] of Object.entries(r.def.want)) s.inventory[k] = n;
  const money = s.money;
  expect(deliverRequest(cfg, s, r.def.id).ok).toBe(true);
  expect(s.money).toBe(money + r.def.money);
  expect(deliverRequest(cfg, s, r.def.id).ok).toBe(false);
  const ids = reqs.map(x => x.def.id).join();
  let changed = false; for (let d = 0; d < 6; d++) { s.day++; if (dailyRequests(s).map(x => x.def.id).join() !== ids) changed = true; }
  expect(changed).toBe(true);
  expect(dailyRequests(s).every(x => !x.done)).toBe(true);
});

test("harita gezdikçe açılır", () => {
  const s = newGame(cfg, 2);
  expect(isSeen(s, "yayla")).toBe(true); expect(isSeen(s, "zehra_evi")).toBe(true);
  expect(isSeen(s, "dere")).toBe(false); expect(isSeen(s, "karacam")).toBe(true); // uzak şehir kilitli ama görünür
  markSeen(s, "koy_meydani"); expect(isSeen(s, "nuri_evi")).toBe(true);
  s.metNpcs.push("nuri"); expect(isSeen(s, "nuri_evi")).toBe(true);
  // varınca komşular açılır
  const t = newGame(cfg, 3);
  expect(startJourney(cfg, t, "koru", 0).ok).toBe(true);
  t.journey!.events = []; // yol sürprizsiz
  finishJourney(cfg, t, 10_000_000);
  expect(t.location).toBe("koru"); expect(isSeen(t, "demirhane")).toBe(true);
});

test("etrafa bak oyunu: saklı şeyler seçilir, zaman harcanır; bulunanlar çantaya/deftere işlenir", async () => {
  const { beginSearch, collectFind } = await import("../src/engine/explore");
  const s = newGame(cfg, 3); s.location = "dere"; s.energy = 90; const m0 = s.minute;
  const b = beginSearch(s); expect(b.ok).toBe(true); expect(b.targets.length).toBeGreaterThan(0); expect(b.targets.length).toBeLessThanOrEqual(3);
  expect(s.minute).toBeGreaterThan(m0);
  const r = collectFind(cfg, s, b.targets[0].id); expect(r.ok).toBe(true);
  expect(Object.keys(s.collection ?? {}).length + (r.relic ? 1 : 0)).toBeGreaterThan(0);
  s.location = "mera_yok"; expect(beginSearch(s).ok).toBe(false);
});
