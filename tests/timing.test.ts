// Zamanlama komutları ve mini oyun verimi.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { grade, rhythmScore, sessionBoost, sessionRounds, attackWindow, miniEase, attackTimingMods, dodgeMod, dodgeMods, miniFor } from "../src/engine/timing";
import { startSession, recordPlay, finishSession, roundsLeft } from "../src/engine/session";
import { createBattle, player, enemies, playerAttack, enemyTurn, dist, willBeAttacked, previewAttack, DEFAULT_PLAN } from "../src/engine/combat";

test("not: tam an, iyi, erken/geç, kaçırdın", () => {
  expect(grade(0.01, 0.1).q).toBe(1);
  const g = grade(0.07, 0.1); expect(g.label).toBe("İyi"); expect(g.q).toBeGreaterThan(0.6); expect(g.q).toBeLessThan(0.9);
  expect(grade(-0.15, 0.1).label).toBe("Erken");
  expect(grade(0.15, 0.1).label).toBe("Geç kaldın");
  expect(grade(0.5, 0.1).q).toBe(0);
});

test("beceri arttıkça doğru an genişler", () => {
  const s = newGame(cfg, 1); const w0 = attackWindow(s), e0 = miniEase(s, "cizgi");
  s.attrs.refleks.level += 30; s.attrs.kilic.level += 30; s.attrs.el_becerisi.level += 40;
  expect(attackWindow(s)).toBeGreaterThan(w0 * 1.5);
  expect(miniEase(s, "cizgi")).toBeCloseTo(e0 + 1, 5);
});

test("ritim puanı: isabetli dokunuş yüksek, boş dokunuş cezalı", () => {
  const beats = [500, 1000, 1500, 2000];
  expect(rhythmScore(beats, [505, 990, 1510, 2002], 80)).toBe(1);
  expect(rhythmScore(beats, [], 80)).toBe(0);
  const sloppy = rhythmScore(beats, [560, 1060, 1440, 2070], 80);
  expect(sloppy).toBeGreaterThan(0.5); expect(sloppy).toBeLessThan(1);
  expect(rhythmScore(beats, [505, 990, 1510, 2002, 300, 700, 1200, 1700, 1800], 80)).toBeLessThan(0.85);
});

test("oturum verimi: oynamak ×2'ye kadar artırır, kötü oynamak cezalandırmaz", () => {
  expect(sessionBoost(undefined, 3_600_000)).toBe(1);
  expect(sessionBoost([1], 3_600_000)).toBe(1.5);
  expect(sessionBoost([0], 3_600_000)).toBe(1);
  expect(sessionRounds(5 * 3_600_000)).toBe(5);
  expect(sessionBoost([1], 5 * 3_600_000)).toBeCloseTo(1.1, 5);   // uzun oturumda tur başına pay
  expect(sessionBoost([1, 1, 1, 1, 1, 0.2], 5 * 3_600_000)).toBe(1.5); // en iyi turlar sayılır
});

test("mini oyunla çalışmak daha çok kazandırır ama en çok ×1,5 (oynamamak cezasız)", () => {
  const run = (score?: number) => {
    const s = newGame(cfg, 3); s.location = "koy_meydani";
    expect(startSession(cfg, s, "meditasyon", 3_600_000, 0).ok).toBe(true);
    if (score !== undefined) { expect(recordPlay(s, score)).toBe(true); expect(recordPlay(s, 1)).toBe(false); }
    const r = finishSession(cfg, s, s.session!.durMs)!;
    return Object.values(r.gains).reduce((a, g) => a + g, 0);
  };
  const idle = run(), good = run(0.9);
  expect(good).toBeGreaterThan(idle * 1.35); expect(good).toBeLessThanOrEqual(idle * 1.5 + 1e-9);
  expect(miniFor("meditasyon")).toBe("mum"); expect(miniFor("kilic_idman")).toBe("kesme"); expect(miniFor("botanik")).toBe("ayikla"); expect(miniFor("resim")).toBe("cizgi"); expect(miniFor("odun")).toBe("odun"); expect(miniFor("calisma_ates")).toBe("isaret");
});

test("savaşta zamanlama: iyi oynayan oyuncu daha sık kazanır ama kurt hâlâ tehlikeli", () => {
  const rate = (q?: number) => {
    let w = 0; const n = 200;
    for (let seed = 1; seed <= n; seed++) {
      const s: GameState = newGame(cfg, seed);
      const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], seed * 31);
      for (let g = 0; b.phase === "player" && g < 80; g++) {
        const p = player(b);
        const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
        if (dist(p.x, p.y, e.x, e.y) === 1) playerAttack(cfg, s, b, e, undefined, "normal", q);
        if (b.phase === "player") { if (q !== undefined && willBeAttacked(cfg, s, b)) b.dodgeQ = q; enemyTurn(cfg, s, b); }
      }
      if (b.phase === "won") w++;
    }
    return w / n;
  };
  const none = rate(), poor = rate(0), great = rate(1), good = rate(0.7);
  expect(good).toBeGreaterThan(none);
  expect(great).toBeGreaterThan(none + 0.15);
  expect(great).toBeLessThan(0.97);
  // başaramamak hiçbir şeyi değiştirmez (ceza yok)
  expect(poor).toBe(none);
  expect(attackTimingMods(undefined)).toEqual({ hit: 0, crit: 0, dmg: 1 });
  expect(attackTimingMods(0)).toEqual({ hit: 0, crit: 0, dmg: 1 });
  expect(attackTimingMods(1).dmg).toBeGreaterThan(attackTimingMods(0.7).dmg);
  expect(dodgeMod(1)).toBeGreaterThan(dodgeMod(0.7));
  expect(dodgeMods(0)).toEqual({ hit: 0, dmg: 1 });
  expect(dodgeMods(1).dmg).toBeLessThan(dodgeMods(0.7).dmg);
});

test("saldırı önceden bilinir ve bilmek sonucu değiştirmez", () => {
  const s = newGame(cfg, 7); const b = createBattle(cfg, s, "mera", ["kurt"], 9);
  const before = JSON.stringify(b);
  willBeAttacked(cfg, s, b);
  expect(JSON.stringify(b)).toBe(before);
});

test("gizlice yaklaşınca uyuyan bir kurdun dibinde başlarsın; ilk vuruş iki kat, sonra normal", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame(cfg, seed);
    const b = createBattle(cfg, s, "mera", ["kurt", "kurt"], seed * 17, undefined, { ...DEFAULT_PLAN, surprise: true });
    const p = player(b);
    const near = enemies(b).filter(e => dist(p.x, p.y, e.x, e.y) === 1);
    expect(near.length, `seed ${seed}`).toBeGreaterThan(0);
    expect(enemies(b).every(e => !e.alert)).toBe(true);
    const t = near[0];
    const once = previewAttack(cfg, s, b, t);
    const plain = previewAttack(cfg, s, { ...b, firstStrike: false }, t);
    expect(once.dmg[1]).toBe(plain.dmg[1] * 2);
    playerAttack(cfg, s, b, t);
    expect(b.firstStrike).toBe(false);
  }
});
