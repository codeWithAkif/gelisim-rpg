// Ölçer işi: sönen ateş başka bir ocakta yanar (ısı korunur). Bulmacalar çözülebilir, sıkı ve karakterle kolaylaşır.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { OLCER_LEVELS, olcerLevel, createPuzzle, transfer, measure, totalHeat, solve, bonusMoves, bonusMeasures, canStartOlcer, finishOlcer, nextLevel, OLCER_PLACE } from "../src/engine/olcer";
import { repOf } from "../src/engine/state";

test("ısı kaybolmaz: rastgele hamlelerde toplam hiç değişmez (çeken taş dahil)", () => {
  for (const l of OLCER_LEVELS) {
    const st = createPuzzle(null, l); st.moves = 200; const t0 = totalHeat(st); let r = 7;
    for (let i = 0; i < 150 && !st.done; i++) { r = (r * 1103515245 + 12345) & 0x7fffffff; const [a, b] = l.links[r % l.links.length]; transfer(st, r & 1 ? a : b, r & 1 ? b : a);
      expect(totalHeat(st)).toBe(t0); expect(Object.values(st.heat).every(h => h >= 0)).toBe(true); }
  }
});

test("her iş temel karakterle tam bütçede çözülür, bir eksikle çözülmez", () => {
  for (const l of OLCER_LEVELS) {
    expect(solve(l, l.moves), l.id).not.toBeNull();
    expect(solve(l, l.moves - 1), l.id).toBeNull();
  }
});

test("ölçmek gizliyi açar; ölçülmemiş boş yerden taşımak hamleyi boşa harcar; yol yoksa hamle olmaz", () => {
  const l = olcerLevel("kor")!; const st = createPuzzle(null, l);
  expect(st.known).not.toContain("tas"); expect(measure(st, "tas")).toBe(true); expect(st.known).toContain("tas");
  expect(measure(st, "tas")).toBe(false);
  expect(transfer(st, "ev", "ahir")).toBe("yasak"); expect(st.moves).toBe(l.moves);
  const p = createPuzzle(null, olcerLevel("pinar")!); p.heat.yol = 0;
  expect(transfer(p, "yol", "pinar")).toBe("bos"); expect(p.moves).toBe(4); expect(p.known).toContain("yol");
});

test("soğuk çeken taş her iki hamlede bir en sıcak komşusundan ısı alır", () => {
  const st = createPuzzle(null, olcerLevel("kor")!);
  transfer(st, "tas", "ev"); expect(st.heat.tas).toBe(2);         // 1. hamle: çekmez
  transfer(st, "ev", "pinar"); expect(st.heat.tas).toBe(3); expect(st.heat.ev).toBe(2);   // 2. hamle: evden (en sıcak) çeker
});

test("odak hamle, analiz ölçüm ekler", () => {
  const s = newGame(cfg, 1); expect(bonusMoves(s)).toBe(0); expect(bonusMeasures(s)).toBe(0);
  s.attrs.odak.level = 50; s.attrs.analiz.level = 40;
  const st = createPuzzle(s, olcerLevel("kor")!); expect(st.moves).toBe(11); expect(st.measures).toBe(4);
});

test("oyunda: köy meydanında, bir sayfa bilinince; ilk çözüm güven ve kayıt verir, tekrar vermez", () => {
  const s = newGame(cfg, 1);
  expect(canStartOlcer(s).ok).toBe(false); s.knownElements = ["el_ates"]; expect(canStartOlcer(s).reason).toMatch(/meydan/);
  s.location = OLCER_PLACE; expect(canStartOlcer(s).ok).toBe(true);
  expect(nextLevel(s).id).toBe("pinar");
  const st = createPuzzle(s, nextLevel(s)); for (const [a, b] of solve(st.level, st.level.moves)!) transfer(st, a, b);
  expect(st.done).toBe("won");
  const g0 = repOf(s, "taspinar", "guven"); const r = finishOlcer(cfg, s, st);
  expect(r.first).toBe(true); expect(r.gains.analiz).toBeGreaterThan(0); expect(repOf(s, "taspinar", "guven")).toBe(g0 + 1);
  expect(nextLevel(s).id).toBe("agil");
  const again = finishOlcer(cfg, s, st); expect(again.first).toBe(false); expect(repOf(s, "taspinar", "guven")).toBe(g0 + 1);
});
