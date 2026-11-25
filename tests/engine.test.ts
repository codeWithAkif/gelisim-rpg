import { describe, it, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, repOf } from "../src/engine/state";
import { doActivity, sleep, canDoActivity, applyGain } from "../src/engine/progression";
import { derived } from "../src/engine/derived";
import { createBattle, player, enemies, playerAttack, enemyTurn, reachable, observe, finishBattle, previewAttack, dist } from "../src/engine/combat";
import { acceptQuest, walkQuest, questList } from "../src/engine/quests";

describe("gelişim", () => {
  it("koşu kas kazancını uykuya kadar bekletir, dayanıklılık nefese aktarır", () => {
    const s = newGame(cfg, 1);
    const bacak0 = s.attrs.bacak.level, nefes0 = s.attrs.nefes.level + s.attrs.nefes.pending;
    const r = doActivity(cfg, s, "kosu");
    expect("error" in r).toBe(false);
    expect(s.attrs.bacak.level).toBe(bacak0);          // henüz işlenmedi
    expect(s.attrs.bacak.pending).toBeGreaterThan(0);
    expect(s.attrs.nefes.pending + s.attrs.nefes.level).toBeGreaterThan(nefes0 + 0.5); // doğrudan + aktarım
    sleep(cfg, s);
    expect(s.attrs.bacak.level).toBeGreaterThan(bacak0);
    expect(s.attrs.bacak.pending).toBe(0);
    expect(s.day).toBe(2);
  });
  it("getiri azalır", () => {
    const s = newGame(cfg, 1);
    const first = applyGain(cfg, s, "odak", 1, {});
    s.attrs.odak.level = 90;
    const late = applyGain(cfg, s, "odak", 1, {});
    expect(late).toBeLessThan(first / 5);
  });
  it("aç uyumak kazancı azaltır", () => {
    const a = newGame(cfg, 1), b = newGame(cfg, 1);
    doActivity(cfg, a, "kosu"); doActivity(cfg, b, "kosu");
    a.satiety = 80; b.satiety = 5;
    sleep(cfg, a); sleep(cfg, b);
    expect(b.attrs.bacak.level).toBeLessThan(a.attrs.bacak.level);
  });
  it("öğretmen tanımadan ders yok; tanınırlık gelince açılır", () => {
    const s = newGame(cfg, 1);
    const c = canDoActivity(cfg, s, "resim");
    expect(c.ok).toBe(false);
    s.rep.taspinar = { taninirlik: 6 };
    expect(canDoActivity(cfg, s, "resim").ok).toBe(true);
  });
  it("körelme tabanın altına düşmez", () => {
    const s = newGame(cfg, 1);
    s.attrs.esneklik = { level: 50, pending: 0, peak: 50, lastUsedDay: 1 };
    for (let i = 0; i < 2000; i++) sleep(cfg, s);
    expect(s.attrs.esneklik.level).toBeGreaterThanOrEqual(50 * 0.6 - 1e-9);
  });
});

describe("türetilmiş değerler", () => {
  it("anatomi bilgisi hedefin türüne göre seçilir", () => {
    const s = newGame(cfg, 1);
    s.attrs.anatomi_hayvan.level = 50;
    const insan = derived(cfg, s, "kritik", { targetSpecies: "insan" }).value;
    const hayvan = derived(cfg, s, "kritik", { targetSpecies: "hayvan" }).value;
    expect(hayvan).toBeGreaterThan(insan);
  });
  it("ortam yüzdesi uygulanır", () => {
    const s = newGame(cfg, 1);
    const kuru = derived(cfg, s, "kacinma").value, camur = derived(cfg, s, "kacinma", { envIds: ["camur"] }).value;
    expect(camur).toBeLessThan(kuru);
  });
});

describe("savaş", () => {
  it("harita kurulur, hareket ve saldırı çalışır, sonunda kazanç yazılır", () => {
    const s = newGame(cfg, 7);
    const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], 42);
    expect(enemies(b).length).toBe(2);
    const p = player(b);
    expect(reachable(b, p, p.moveLeft).size).toBeGreaterThan(3);
    let guard = 0;
    while ((b.phase === "player") && guard++ < 60) {
      const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
      if (dist(p.x, p.y, e.x, e.y) === 1) {
        const pv = previewAttack(cfg, s, b, e);
        expect(pv.hit).toBeGreaterThan(0);
        playerAttack(cfg, s, b, e);
      }
      if (b.phase === "player") enemyTurn(cfg, s, b);
    }
    expect(["won", "lost"]).toContain(b.phase);
    const kilic0 = s.attrs.kilic.level;
    const out = finishBattle(cfg, s, b);
    expect(Object.keys(out.gains).length).toBeGreaterThan(0);
    expect(s.attrs.kilic.level).toBeGreaterThan(kilic0);
  });
  it("gözlem, bilgi yetiyorsa zayıf noktayı deftere işler", () => {
    const s = newGame(cfg, 3);
    const b = createBattle(cfg, s, "mera", ["kurt"], 5);
    const e = enemies(b)[0];
    observe(cfg, s, b, e);
    expect(s.journal.kurt ?? []).toHaveLength(0);
    s.attrs.analiz.level = 20; s.attrs.anatomi_hayvan.level = 10;
    player(b).acted = false;
    observe(cfg, s, b, e);
    expect(s.journal.kurt.length).toBe(3);
  });
});

describe("görevler", () => {
  it("basit görev mütevazı ödül ve tanınırlık verir, sıradaki görevi açar", () => {
    const s = newGame(cfg, 1);
    expect(questList(s).find(q => q.def.id === "kurt")!.status).toBe("kilitli");
    acceptQuest(s, "mesaj");
    walkQuest(cfg, s, "mesaj");
    expect(repOf(s, "taspinar", "taninirlik")).toBe(1);
    expect(s.inventory.peynir).toBe(1);
    expect(questList(s).find(q => q.def.id === "kurt")!.status).toBe("yeni");
  });
});

import { spellOptions, castSpell, previewSpell } from "../src/engine/magic";
import { advanceStory } from "../src/engine/story";
import { tickEnvironment } from "../src/engine/combat";
import { Rng } from "../src/engine/rng";

describe("büyü", () => {
  it("defter sayfası ve ustalık olmadan büyü yok", () => {
    const s = newGame(cfg, 1);
    expect(spellOptions(cfg, s)).toHaveLength(0);
    s.knownElements.push("el_ates");
    const o = spellOptions(cfg, s).find(x => x.spell.id === "ates_topu")!;
    expect(o.ok).toBe(false);              // ustalık 0 < 5
    s.attrs.ates.level = 6; s.mana = 30;
    expect(spellOptions(cfg, s).find(x => x.spell.id === "ates_topu")!.ok).toBe(true);
  });
  it("ateş çalışması sayfa açılınca yapılabilir", () => {
    const s = newGame(cfg, 1);
    expect(canDoActivity(cfg, s, "calisma_ates").ok).toBe(false);
    s.knownElements.push("el_ates");
    expect(canDoActivity(cfg, s, "calisma_ates").ok).toBe(true);
  });
  it("yağmur ateş topunu zayıflatır, büyü mana harcar ve ustalığı geliştirir", () => {
    const s = newGame(cfg, 2); s.knownElements.push("el_ates"); s.attrs.ates.level = 10; s.mana = 30;
    const b = createBattle(cfg, s, "mera", ["kurt"], 9);
    const e = enemies(b)[0]; const p = player(b);
    p.x = e.x; p.y = Math.min(b.h - 1, e.y + 2);
    b.weather = "acik"; const dry = previewSpell(cfg, s, b, "ates_topu", e.x, e.y);
    b.weather = "yagmur"; const wet = previewSpell(cfg, s, b, "ates_topu", e.x, e.y);
    expect(wet.dmg[1]).toBeLessThan(dry.dmg[1]);
    b.weather = "acik";
    expect(castSpell(cfg, s, b, "ates_topu", e.x, e.y)).toBeTruthy();
    expect(s.mana).toBeLessThan(30);
    const before = s.attrs.ates.level; finishBattle(cfg, s, b);
    expect(s.attrs.ates.level).toBeGreaterThan(before);
  });
  it("ateş kuru otta yayılır, yağmurda yayılmaz ve söner", () => {
    const s = newGame(cfg, 3); const b = createBattle(cfg, s, "mera", ["kurt"], 4);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.tiles[y][x] = "uzun_ot";
    b.weather = "acik"; b.fire = { "3,4": 3 };
    const rng = new Rng(1); for (let i = 0; i < 3; i++) tickEnvironment(b, rng);
    expect(Object.keys(b.fire).length).toBeGreaterThan(1);
    b.weather = "yagmur"; b.fire = { "3,4": 3 }; tickEnvironment(b, rng); tickEnvironment(b, rng);
    expect(Object.keys(b.fire).length).toBe(0);
  });
});

describe("hikâye", () => {
  it("kilometre taşları sırayla açılır ve annenin sayfası Ateş'i öğretir", () => {
    const s = newGame(cfg, 1);
    expect(advanceStory(s)).toHaveLength(0);
    s.introDone = true; expect(advanceStory(s).map(m => m.id)).toEqual(["varis"]);
    s.quests.mesaj = { status: "bitti", count: 1 }; s.quests.kurt = { status: "bitti", count: 1 };
    s.quests.annenin_izi = { status: "bitti", count: 1 };
    const got = advanceStory(s).map(m => m.id);
    expect(got).toEqual(["ilk_is", "suru", "iz"]);
    expect(s.knownElements).toContain("el_ates");
    s.attrs.ates.level = 5; s.story.flags.buyuluZafer = 1;
    expect(advanceStory(s).map(m => m.id)).toEqual(["kivilcim", "ates_kurt"]);
    s.day += 1; expect(advanceStory(s).map(m => m.id)).toEqual(["mektup"]);
  });
});
