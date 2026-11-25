// Kurtların hikâyesi: zincir açılır, sonu vardır, kadim eşyalar güçte sıçrama yapar.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { questList, acceptQuest, completeQuest, walkQuest } from "../src/engine/quests";
import { grantRelic, hasRelic } from "../src/engine/relics";
import { createBattle, player, enemies, playerAttack, enemyTurn, dist } from "../src/engine/combat";
import { QUESTS, MAPS, ENEMIES } from "../src/content/world";
import { RELICS } from "../src/content/relics";

const status = (s: GameState, id: string) => questList(s).find(q => q.def.id === id)!.status;

test("kurt zinciri: izler → donmuş karaca → Akyele; sonunda devriye biter", () => {
  const s = newGame(cfg, 1); s.minute = 0;
  for (const q of ["mesaj", "kurt", "annenin_izi"]) s.quests[q] = { status: "bitti", count: 1 };
  expect(status(s, "kurt_izi")).toBe("yeni");
  expect(status(s, "akyele")).toBe("kilitli");
  expect(status(s, "devriye")).toBe("yeni");
  acceptQuest(s, "kurt_izi"); const r1 = walkQuest(cfg, s, "kurt_izi");
  expect("error" in r1).toBe(false);
  if (!("error" in r1)) { expect(r1.after).toMatch(/donmuş bir karaca/); expect(Object.keys(r1.gains)).toContain("iz_surme"); expect(r1.money).toBeGreaterThan(0); }
  acceptQuest(s, "donmus_av"); walkQuest(cfg, s, "donmus_av");
  expect(status(s, "akyele")).toBe("yeni");
  const ates = s.attrs.ates.level;
  acceptQuest(s, "akyele"); const r = completeQuest(cfg, s, "akyele");
  expect(r.relics.map(x => x.id).sort()).toEqual(["akyele_disi", "kor_tasi"]);
  expect(s.attrs.ates.level).toBeCloseTo(ates + 4, 5);           // ani sıçrama
  expect(s.journal.kurt).toEqual(expect.arrayContaining(["boyun", "burun", "arka_bacak"]));
  expect(status(s, "devriye")).toBe("bitti");                     // sürü dağıldı
  expect(s.inventory.kurt_postu).toBe(1);
});

test("her görev bir şey kazandırır", () => {
  for (const q of QUESTS) {
    const r = q.rewards;
    expect(Object.keys(r.items ?? {}).length + (r.money ?? 0) + Object.keys(r.gains ?? {}).length + (r.relics ?? []).length, q.id).toBeGreaterThan(0);
  }
});

test("kadim eşya bir kez verilir; etkisi seviyeye doğrudan eklenir", () => {
  const s = newGame(cfg, 2); const m = s.attrs.mekansal.level;
  expect(grantRelic(cfg, s, "olcer_pusulasi")).not.toBeNull();
  expect(grantRelic(cfg, s, "olcer_pusulasi")).toBeNull();
  expect(hasRelic(s, "olcer_pusulasi")).toBe(true);
  expect(s.attrs.mekansal.level).toBeCloseTo(m + RELICS.olcer_pusulasi.boosts.mekansal, 5);
});

test("Akyele hazırlıksız başlangıç karakteri için çok zor, gelişmiş karakter için yenilebilir", () => {
  expect(MAPS.in.enemies.length).toBeGreaterThanOrEqual(3);
  const rate = (prep: (s: GameState) => void) => {
    let w = 0; const n = 150;
    for (let seed = 1; seed <= n; seed++) {
      const s = newGame(cfg, seed); prep(s);
      const b = createBattle(cfg, s, "in", ["akyele", "kurt", "kurt"], seed * 17);
      for (let g = 0; b.phase === "player" && g < 120; g++) {
        const p = player(b); const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
        if (dist(p.x, p.y, e.x, e.y) === 1) playerAttack(cfg, s, b, e);
        if (b.phase === "player") enemyTurn(cfg, s, b);
      }
      if (b.phase === "won") w++;
    }
    return w / n;
  };
  const novice = rate(() => {});
  const veteran = rate(s => { s.equipped = { weapon: "el_yapimi_bicak", armor: "temiz_giysi" }; for (const k of ["kilic", "refleks", "kardiyo", "ust_govde", "agri"]) s.attrs[k].level += 20; });
  expect(novice).toBeLessThan(0.15);
  expect(veteran).toBeGreaterThan(0.3);
});
