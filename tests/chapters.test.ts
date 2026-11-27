// Bölüm 2–4: içerik tutarlı, yerler sırayla açılır, görev zinciri baştan sona oynanabilir, bölüm sonu savaşları zorlu ama yenilebilir.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { questList, acceptQuest, completeQuest } from "../src/engine/quests";
import { advanceStory, currentChapter } from "../src/engine/story";
import { isOpen, planTravel, arrive, place } from "../src/engine/travel";
import { createBattle, player, enemies, playerAttack, enemyTurn, dist, foeWords } from "../src/engine/combat";
import { QUESTS, NPCS, ENEMIES, MAPS, GAME_ITEMS } from "../src/content/world";
import { PLACES, NPC_PLACE } from "../src/content/map";
import { CHAPTERS } from "../src/content/story";
import { RELICS } from "../src/content/relics";

test("içerik tutarlı: görev yerleri, verenler, haritalar, düşmanlar, ödüller", () => {
  const ids = new Set(PLACES.map(p => p.id));
  const milestones = new Set(CHAPTERS.flatMap(c => c.milestones.map(m => m.id)));
  for (const q of QUESTS) {
    expect(ids.has(q.at), q.id).toBe(true);
    expect(NPCS.some(n => n.id === q.giverNpc), q.id).toBe(true);
    expect(ids.has(NPC_PLACE[q.giverNpc]), q.giverNpc).toBe(true);
    if (q.after) expect(milestones.has(q.after), q.id).toBe(true);
    if (q.battle) { expect(MAPS[q.battle.map], q.id).toBeTruthy(); for (const e of q.battle.enemies) expect(ENEMIES[e], e).toBeTruthy(); expect(MAPS[q.battle.map].enemies.length).toBeGreaterThanOrEqual(q.battle.enemies.length); }
    for (const r of q.rewards.relics ?? []) expect(RELICS[r], r).toBeTruthy();
    for (const k of Object.keys(q.rewards.items ?? {})) expect(GAME_ITEMS[k] || cfg.item.get(k), k).toBeTruthy();
    for (const a of Object.keys(q.rewards.gains ?? {})) expect(cfg.attr.get(a), a).toBeTruthy();
  }
  for (const r of Object.values(RELICS)) for (const a of Object.keys(r.boosts)) expect(cfg.attr.get(a), r.id + a).toBeTruthy();
  for (const p of PLACES) if (p.unlock) expect(milestones.has(p.unlock), p.id).toBe(true);
  for (const m of Object.values(MAPS)) { const w = m.rows[0].length; for (const r of m.rows) expect(r.length).toBe(w); }
  expect(foeWords(["muhafiz"]).pl).toBe("muhafızlar"); expect(foeWords(["kayhan", "muhafiz"]).one).toBe("muhafız");
});

/** Bir görevi sırayla: kabul, (savaşsa kazanılmış say), bitir, hikâyeyi ilerlet. */
function finish(s: GameState, id: string) {
  const v = questList(s).find(q => q.def.id === id);
  expect(v?.status, id).toBe("yeni");
  acceptQuest(s, id); completeQuest(cfg, s, id); advanceStory(s);
}

test("bölüm 2 → 3 → 4: yerler açılır, elementler öğrenilir, hikâye biter", () => {
  const s = newGame(cfg, 7); s.introDone = true;
  for (const q of ["mesaj", "agil_nobet", "kurt", "annenin_izi"]) s.quests[q] = { status: "bitti", count: 1 };
  s.story.reached = ["varis", "ilk_is", "donmus_kuzu", "suru", "iz", "kivilcim", "ates_kurt", "mektup"];
  advanceStory(s);
  const kc = place("karacam")!; const ak = place("ayazkale")!; const ar = place("ardic")!;
  expect(isOpen(kc, s)).toBe(true); expect(isOpen(ak, s)).toBe(false); expect(isOpen(ar, s)).toBe(false);
  expect(questList(s).some(q => q.def.id === "gecit")).toBe(false);   // ileri bölüm görevleri görünmez
  s.location = "demirhane"; expect(planTravel(cfg, s, "karacam").ok).toBe(true);

  arrive(s, "karacam"); expect(s.region).toBe("karacam"); advanceStory(s);
  expect(currentChapter(s).id).toBe("b2");
  for (const q of ["selim_dukkan", "isaretli_arabalar", "kervan", "sarnic", "lonca_defteri"]) finish(s, q);
  expect(s.knownElements).toContain("el_su");
  expect(isOpen(ak, s)).toBe(true); expect(currentChapter(s).id).toBe("b3");

  arrive(s, "ayaz_gecit"); finish(s, "gecit");
  arrive(s, "ayaz_mutfak"); finish(s, "mutfak"); expect(isOpen(place("ayaz_kule")!, s)).toBe(false); finish(s, "gizli_merdiven");
  expect(isOpen(place("ayaz_kule")!, s)).toBe(true);
  finish(s, "kule"); expect(s.knownElements).toContain("el_ayaz"); expect(s.relics).toContain("annenin_kalemi");
  finish(s, "soguk_ocak"); expect(isOpen(ar, s)).toBe(true); expect(currentChapter(s).id).toBe("b4");

  arrive(s, "ardic"); advanceStory(s);
  arrive(s, "ardic_kul"); finish(s, "kul_ana"); expect(s.knownElements).toContain("el_simsek");
  finish(s, "saray_yolu"); expect(isOpen(place("ardic_dehliz")!, s)).toBe(true);
  finish(s, "buyuk_ocak");
  expect(s.story.reached).toContain("d_bahar");
  expect(CHAPTERS.every(c => c.milestones.every(m => m.side || s.story.reached.includes(m.id)))).toBe(true);
});

/** Basit oyuncu: yakındakine vurur. Gelişmiş karakter + iyi ekipmanla bölüm sonu savaşlarının kazanılabilirliği. */
function winRate(map: string, foes: string[], prep: (s: GameState) => void, n = 120) {
  let w = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = newGame(cfg, seed); prep(s);
    const b = createBattle(cfg, s, map, foes, seed * 13);
    for (let g = 0; b.phase === "player" && g < 150; g++) {
      const p = player(b); const e = enemies(b).sort((a, c) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, c.x, c.y))[0];
      if (dist(p.x, p.y, e.x, e.y) === 1) playerAttack(cfg, s, b, e);
      if (b.phase === "player") enemyTurn(cfg, s, b);
    }
    if (b.phase === "won") w++;
  }
  return w / n;
}
const grow = (n: number, gear: { weapon?: string; armor?: string }) => (s: GameState) => {
  s.equipped = { ...gear, bag: "bez_torba" };
  for (const k of ["kilic", "refleks", "kardiyo", "ust_govde", "agri", "core"]) s.attrs[k].level += n;
  s.pet = { id: "kopek", name: "Karabaş", bond: Math.min(100, n * 2) };
};
test("bölüm sonu savaşları: hazırlıksıza çok zor, bölüme göre gelişmiş karaktere yenilebilir", () => {
  const novice = (s: GameState) => { s.equipped = { weapon: "degnek", bag: "bez_torba" }; };
  expect(winRate("depo", ["muhafiz", "muhafiz"], novice)).toBeLessThan(0.35);
  expect(winRate("depo", ["muhafiz", "muhafiz"], grow(15, { weapon: "el_yapimi_bicak", armor: "temiz_giysi" }))).toBeGreaterThan(0.5);
  expect(winRate("kule", ["kayhan", "muhafiz"], novice)).toBeLessThan(0.1);
  expect(winRate("kule", ["kayhan", "muhafiz"], grow(25, { weapon: "dede_kilici", armor: "deri_zirh" }))).toBeGreaterThan(0.35);
  expect(winRate("dehliz", ["sungur", "muhafiz", "muhafiz"], novice)).toBeLessThan(0.05);
  expect(winRate("dehliz", ["sungur", "muhafiz", "muhafiz"], grow(35, { weapon: "dede_kilici", armor: "zincir_zirh" }))).toBeGreaterThan(0.3);
});
