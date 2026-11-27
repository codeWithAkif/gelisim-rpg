// Parmak hareketleri: kaydırma, kesik, işaret tanıma ve savaşa etkileri.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { swipeOf, dirScore, slashScore, runeScore, recognize, RUNES, spellRunes, castQuality, type P } from "../src/engine/gesture";
import { createBattle, player, enemies, playerPush, pushChance } from "../src/engine/combat";
import { castSpell, previewSpell } from "../src/engine/magic";

const line = (x1: number, y1: number, x2: number, y2: number, ms: number, n = 12): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: x1 + (x2 - x1) * i / (n - 1), y: y1 + (y2 - y1) * i / (n - 1), t: ms * i / (n - 1) }));
/** Şablonu ölçekleyip kaydırarak ve titreterek "elle çizilmiş" hâle getir. */
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const hand = (id: string, size: number, jitter: number, reverse = false) => {
  const pts = RUNES[id].pts.map(([x, y]) => ({ x: 40 + x * size + (rnd() - 0.5) * jitter, y: 60 + y * size + (rnd() - 0.5) * jitter }));
  return reverse ? pts.reverse() : pts;
};

test("kaydırma yönü ve kalitesi", () => {
  const right = swipeOf(line(0, 0, 120, 5, 150));
  expect(Math.abs(right.angle)).toBeLessThan(5);
  expect(dirScore(right, 0, 45)).toBeGreaterThan(0.8);
  expect(dirScore(right, 180, 45)).toBe(0);
  expect(dirScore(swipeOf(line(0, 0, 10, 0, 50)), 0, 45)).toBe(0); // çok kısa
  expect(dirScore(right, 30, 45)).toBeLessThan(dirScore(right, 0, 45));
});

test("kesik: gövdeden geçmeli, hızlı ve düz iyi; zayıf noktadan geçen tam", () => {
  const body = [{ x: 100, y: 100, r: 30 }]; const weak = { x: 130, y: 75, r: 10 };
  expect(slashScore(line(0, 0, 40, 10, 100), body, undefined, 1).q).toBe(0); // ıska
  const fast = slashScore(line(40, 100, 180, 100, 120), body, undefined, 1).q;
  const slow = slashScore(line(40, 100, 180, 100, 900), body, undefined, 1).q;
  expect(fast).toBeGreaterThan(slow);
  const w = slashScore(line(60, 105, 180, 54, 120), body, weak, 1);
  expect(w.weak).toBe(true); expect(w.q).toBe(1);
  expect(slashScore(line(40, 100, 180, 100, 120), body, weak, 1).q).toBeLessThan(1);
});

test("işaretler kendileri olarak tanınır, ters yönde de, farklı boyda da", () => {
  for (const id of Object.keys(RUNES)) {
    for (const [size, rev] of [[120, false], [260, true], [80, false]] as const) {
      const r = recognize(hand(id, size, size * 0.06, rev));
      expect(r.id, `${id} ${size}`).toBe(id);
      expect(r.q, `${id} ${size}`).toBeGreaterThan(0.6);
    }
  }
  expect(runeScore(line(0, 0, 200, 0, 100), "el_ates")).toBeLessThan(0.4); // düz çizgi alev değil
});

test("birleşim büyüleri temel işaretlere açılır", () => {
  expect(spellRunes(cfg, ["el_ates"])).toEqual(["el_ates"]);
  expect(spellRunes(cfg, ["magma"])).toEqual(["el_ates", "el_toprak"]);
  expect(spellRunes(cfg, ["obsidyen"])).toEqual(["el_su", "el_ates", "el_toprak"]);
  expect(castQuality([0.9, 0.4])).toBe(0.4);
});

test("kötü çizilen büyü dağılır, iyi çizilen daha çok yakar; iyi itme daha çok tutar", () => {
  const setup = () => {
    const s = newGame(cfg, 9); s.knownElements = ["el_ates"]; s.attrs.ates.level = 8; s.mana = -1;
    const b = createBattle(cfg, s, "mera", ["kurt"], 4); const p = player(b); const e = enemies(b)[0];
    e.x = p.x + 2; e.y = p.y; s.mana = 50; return { s, b, e };
  };
  const a = setup(); expect(previewSpell(cfg, a.s, a.b, "ates_topu", a.e.x, a.e.y).inRange).toBe(true);
  castSpell(cfg, a.s, a.b, "ates_topu", a.e.x, a.e.y, 0.1);
  expect(a.b.events.find(x => x.k === "cast")).toMatchObject({ fizzle: true });
  let good = 0, plain = 0;
  for (let i = 0; i < 40; i++) {
    const g = setup(); g.b.seed = i * 7 + 1; castSpell(cfg, g.s, g.b, "ates_topu", g.e.x, g.e.y, 1); good += 22 - g.e.hp;
    const n = setup(); n.b.seed = i * 7 + 1; castSpell(cfg, n.s, n.b, "ates_topu", n.e.x, n.e.y); plain += 22 - n.e.hp;
  }
  expect(good).toBeGreaterThan(plain);
  // itme
  const s = newGame(cfg, 2); const b = createBattle(cfg, s, "mera", ["kurt"], 3); const p = player(b); const e = enemies(b)[0];
  e.x = p.x + 1; e.y = p.y;
  const base = pushChance(cfg, s, b, e);
  let ok = 0, ok2 = 0;
  for (let i = 0; i < 200; i++) {
    const b1 = structuredClone(b); b1.seed = i; playerPush(cfg, structuredClone(s), b1, enemies(b1)[0], 1); if (b1.events.some(x => x.k === "push" && x.ok)) ok++;
    const b2 = structuredClone(b); b2.seed = i; playerPush(cfg, structuredClone(s), b2, enemies(b2)[0], 0); if (b2.events.some(x => x.k === "push" && x.ok)) ok2++;
  }
  expect(ok).toBeGreaterThan(ok2); expect(base).toBeGreaterThan(0);
});

test("12 işaret (6 element, 6 biçim) birbirine karışmaz: her şablon kendini tanır, ikinci aday belirgin geride", async () => {
  const { RUNES, recognize, ELEMENT_RUNES, FORM_RUNES } = await import("../src/engine/gesture");
  const ids = [...ELEMENT_RUNES, ...FORM_RUNES];
  for (const id of ids) {
    // şablonu 200 piksellik kutuya ölçekle, biraz titret (elle çizim)
    const pts = RUNES[id].pts.flatMap(([x, y], k, a) => { const out = [{ x: 20 + x * 200, y: 20 + y * 200 }];
      if (k < a.length - 1) { const [x2, y2] = a[k + 1]; for (let j = 1; j < 6; j++) out.push({ x: 20 + (x + (x2 - x) * j / 6) * 200 + Math.sin(k * 7 + j) * 3, y: 20 + (y + (y2 - y) * j / 6) * 200 + Math.cos(k * 5 + j) * 3 }); }
      return out; });
    const best = recognize(pts, ids); expect(best.id, id).toBe(id); expect(best.q, id).toBeGreaterThan(0.6);
    const second = recognize(pts, ids.filter(x => x !== id)); expect(second.q, `${id} ~ ${second.id}`).toBeLessThan(best.q - 0.15);
  }
});
