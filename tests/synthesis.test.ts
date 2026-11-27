// Büyü sentezi: madde × biçim, hesap, imza büyüler, keşif ve deney.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { matterOf, synthesize, cellCount, spellSequence, discover, experiment, cellSpellId } from "../src/engine/synthesis";
import { spellOptions, baseElements } from "../src/engine/magic";
import { MATTERS, FORMS, BOOK_CELLS, SIGNATURES, formMismatch, matter } from "../src/content/synthesis";

test("geniş yelpaze: 60'tan fazla geçerli büyü; hiçbiri güç sınırını aşmaz", () => {
  const n = cellCount(); console.log("geçerli büyü:", n, "/", MATTERS.length * FORMS.length);
  expect(n).toBeGreaterThan(60);
  const synth = cfg.data.spells.filter(sp => sp.id.startsWith("sy_"));
  expect(synth.length + Object.keys(BOOK_CELLS).length).toBe(n);
  const fire = cfg.spell.get("ates_topu")!; const ratio = fire.damage! / fire.manaCost!;
  for (const sp of synth) {
    expect(sp.damage!, sp.id).toBeLessThanOrEqual(45);
    expect(sp.manaCost!, sp.id).toBeGreaterThanOrEqual(5); expect(sp.manaCost!, sp.id).toBeLessThanOrEqual(40);
    expect(sp.minMastery!, sp.id).toBeLessThanOrEqual(40);
    if (sp.id.endsWith("_top")) expect(sp.damage! / sp.manaCost!, sp.id).toBeLessThanOrEqual(ratio * 1.6);
  }
});

test("kitaptaki büyüler kendi hücrelerinde; imza büyüler geçerli hücrelerde", () => {
  for (const [cell, id] of Object.entries(BOOK_CELLS)) {
    const [m] = cell.split("|"); const sp = cfg.spell.get(id); expect(sp, id).toBeTruthy();
    const els = [...new Set(sp!.sources.flatMap(x => baseElements(cfg, x.id)))].sort();
    expect(els, id).toEqual(matter(m)!.els);
  }
  for (const cell of Object.keys(SIGNATURES)) { const [m, f] = cell.split("|"); expect(formMismatch(matter(m)!, f as never), cell).toBeNull(); expect(cellSpellId(matter(m)!, f as never)).toBe(`sy_${m}_${f}`); }
  expect(cfg.spell.get("sy_magma_firlat")!.name).toBe("Meteor");
});

test("madde işaretlerden çıkar, sıra önemsiz; ateşle ayaz birbirini yer", () => {
  expect(matterOf(["el_toprak", "el_ates"]).matter!.id).toBe("magma");
  expect(matterOf(["el_ates", "el_toprak"]).matter!.id).toBe("magma");
  expect(matterOf(["el_su", "el_ates", "el_toprak"]).matter!.id).toBe("obsidyen");
  expect(matterOf(["el_ates", "el_ayaz"]).reason).toMatch(/ayaz/);
  expect(matterOf(["el_ates", "el_ates"]).reason).toMatch(/iki kez/);
});

test("meteor: magma + fırlatma; hava sayfası olmadan olmaz; buhar duvar olmaz", () => {
  const s = newGame(cfg, 4); s.knownElements = ["el_ates", "el_toprak"];
  expect(synthesize(s, ["el_ates", "el_toprak"], "firlat").reason).toMatch(/hava/);
  s.knownElements.push("el_hava");
  expect(synthesize(s, ["el_ates", "el_toprak"], "firlat")).toMatchObject({ ok: true, spellId: "sy_magma_firlat" });
  s.knownElements.push("el_su");
  expect(synthesize(s, ["el_ates", "el_su"], "duvar").reason).toMatch(/duvar/);
  expect(synthesize(s, ["el_ayaz", "el_su"], "duvar").reason).toMatch(/sayfası/);
});

test("sentez büyüsü keşfedilmeden bilinmez; keşfedilince ustalık ve manayla yapılır; dizisi defterde", () => {
  const s = newGame(cfg, 5); s.knownElements = ["el_ates", "el_toprak", "el_hava"]; s.mana = 99;
  const has = () => spellOptions(cfg, s).find(o => o.spell.id === "sy_magma_firlat");
  expect(has()).toBeUndefined();
  expect(discover(s, "sy_magma_firlat")).toBe(true); expect(discover(s, "sy_magma_firlat")).toBe(false);
  expect(has()!.ok).toBe(false);                      // ustalık yetmez
  s.attrs.toprak_buyu.level = 40; expect(has()!.ok).toBe(true);
  expect(spellSequence("sy_magma_firlat")).toEqual({ els: ["el_ates", "el_toprak"], form: "firlat" });
  expect(spellSequence("magma_akintisi")).toEqual({ els: ["el_ates", "el_toprak"], form: "akinti" });
  // kitaptaki büyüler eskisi gibi: elementleri bilinince
  expect(spellOptions(cfg, s).some(o => o.spell.id === "magma_akintisi")).toBe(true);
});

test("deney: yeni büyü deftere yazılır, bilinen söylenir, uymayan söner, birbirini iten patlar", () => {
  const s = newGame(cfg, 6); s.knownElements = ["el_ates", "el_ayaz", "el_toprak"]; s.mana = 50; s.hp = 30; s.minute = 60;
  const a = experiment(cfg, s, ["el_toprak"], "duvar"); expect(a).toMatchObject({ kind: "yeni", spellId: "sy_el_toprak_duvar" });
  expect(experiment(cfg, s, ["el_toprak"], "duvar")).toMatchObject({ kind: "bilinen" });
  expect(experiment(cfg, s, ["el_ates"], "zincir")).toMatchObject({ kind: "soner" });
  const p = experiment(cfg, s, ["el_ates", "el_ayaz"], "top"); expect(p).toMatchObject({ kind: "patladi" }); expect(s.hp).toBeLessThan(30);
  expect(s.mana).toBe(50 - 4 * 6); expect(s.minute).toBe(100);
  s.mana = 2; expect(experiment(cfg, s, ["el_ates"], "top")).toHaveProperty("error");
});
