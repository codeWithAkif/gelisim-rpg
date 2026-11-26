// Şimşek geometrisi: uçlar yerinde, dallar ana hattan çıkar, aynı tohum aynı çakmayı verir.
import { test, expect } from "vitest";
import { bolt, chain, skyBolt, boltLife } from "../src/ui/lightning";

test("çakma uçlardan geçer, kırıktır, dallanır", () => {
  const b = bolt([0, 0], [100, 200], 7);
  expect(b.main[0]).toEqual([0, 0]); expect(b.main[b.main.length - 1]).toEqual([100, 200]); expect(b.main.length).toBeGreaterThan(16);
  expect(b.forks.length).toBe(3);
  for (const f of b.forks) expect(b.main.some(p => p[0] === f[0][0] && p[1] === f[0][1])).toBe(true);
  const L = b.main.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - b.main[i][0], p[1] - b.main[i][1]), 0);
  expect(L).toBeGreaterThan(Math.hypot(100, 200));      // düz değil, kırık
});
test("aynı tohum aynı çakma; farklı tohum farklı", () => {
  expect(bolt([0, 0], [50, 50], 3)).toEqual(bolt([0, 0], [50, 50], 3)); expect(bolt([0, 0], [50, 50], 3).main).not.toEqual(bolt([0, 0], [50, 50], 4).main);
});
test("zincir halkaları sırayla gecikmeli; gökten çakma hedefe iner", () => {
  const c = chain([[0, 0], [30, 10], [60, 5], [80, 40]], 1); expect(c.map(x => x.delay)).toEqual([0, 70, 140]);
  expect(c[1].bolt.main[0]).toEqual([30, 10]);
  const s = skyBolt([40, 90], -10, 5); expect(s.main[0][1]).toBe(-10); expect(s.main[s.main.length - 1]).toEqual([40, 90]);
});
test("parlaklık sert başlar, söner", () => { expect(boltLife(0.05)).toBe(1); expect(boltLife(0.9)).toBeLessThan(0.2); expect(boltLife(1.2)).toBe(0); });
