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

test("annenin deney sayfaları: yeri ve zamanı gelince alınır; bilmecenin cevabı geçerli bir imza büyü", async () => {
  const { MOTHER_PAGES } = await import("../src/content/mother-pages");
  const { pagesAt, takePage, pageSolved, pagesWaiting } = await import("../src/engine/synthesis");
  const { PLACES } = await import("../src/content/map");
  const { CHAPTERS } = await import("../src/content/story");
  const { placeActions } = await import("../src/engine/actions");
  const ms = new Set(CHAPTERS.flatMap(c => c.milestones.map(m => m.id)));
  for (const p of MOTHER_PAGES) {
    expect(PLACES.some(x => x.id === p.place), p.id).toBe(true); expect(ms.has(p.after), p.id).toBe(true);
    expect(cfg.spell.get(p.spell), p.id).toBeTruthy();
  }
  const s = newGame(cfg, 8); s.location = "zehra_evi";
  expect(pagesAt(s, "zehra_evi")).toHaveLength(0);
  s.story.reached.push("kivilcim");
  expect(pagesWaiting(s).map(p => p.id)).toEqual(["ates_duvari"]);
  expect(placeActions(cfg, s, "zehra_evi").some(a => a.act === "mpage")).toBe(true);
  const pg = takePage(s, "ates_duvari")!; expect(pg).toBeTruthy(); expect(takePage(s, "ates_duvari")).toBeNull();
  expect(pagesWaiting(s)).toHaveLength(0);
  // bilmeceyi çözmek: alev + yatay çizgi
  s.knownElements = ["el_ates"]; s.mana = 20; s.minute = 60;
  expect(pageSolved(s, pg)).toBe(false);
  expect(experiment(cfg, s, ["el_ates"], "duvar")).toMatchObject({ kind: "yeni", spellId: "sy_el_ates_duvar" });
  expect(pageSolved(s, pg)).toBe(true);
});

test("her yerde aynı kural: keşfedilen büyü harabede de seçilir, gece savunmasında da kullanılır; girişteki çizim gücü belirler", async () => {
  const { loadoutOptions, scavSpellInfo, createScav, scavSite } = await import("../src/engine/scavenge");
  const { siegeSpells, createSiege, SIEGES } = await import("../src/engine/siege");
  const s = newGame(cfg, 12); s.knownElements = ["el_ates", "el_toprak", "el_hava"]; s.attrs.toprak_buyu.level = 40; s.mana = 99;
  expect(loadoutOptions(cfg, s).some(o => o.id === "sy_magma_firlat")).toBe(false);
  discover(s, "sy_magma_firlat");
  expect(scavSpellInfo(cfg, "sy_magma_firlat")).toMatchObject({ kind: "ates" });
  expect(loadoutOptions(cfg, s).some(o => o.id === "sy_magma_firlat")).toBe(true);
  const site = scavSite("koru_kulube")!;
  const weak = createScav(cfg, s, site, 5, { kind: "spell", id: "sy_magma_firlat", q: 0 });
  const strong = createScav(cfg, s, site, 5, { kind: "spell", id: "sy_magma_firlat", q: 1 });
  expect(strong.spell!.mul).toBeGreaterThan(weak.spell!.mul * 1.4);
  const def = Object.values(SIEGES)[0];
  const sg = createSiege(cfg, s, def, 3);
  expect(siegeSpells(cfg, s, sg).some(x => x.id === "sy_magma_firlat")).toBe(true);
});

test("şimşek kuralı her sahnede aynı: zincir elden çıkar, yıldırım üstten düşer; her şimşekli büyünün biçimi belli", async () => {
  const { boltStyle } = await import("../src/engine/spellfx");
  const { baseElements } = await import("../src/engine/magic");
  const st = (id: string) => boltStyle(cfg, id);
  expect(st("simsek_zinciri")).toBe("chain"); expect(st("sy_plazma_zincir")).toBe("chain"); expect(st("sy_miknatis_zincir")).toBe("chain");
  expect(st("yildirim_firtinasi")).toBe("sky"); expect(st("sy_el_simsek_top")).toBe("sky"); expect(st("elektrik_golu")).toBe("sky"); expect(st("sy_firtina_perde")).toBe("sky");
  expect(st("sy_plazma_duvar")).toBeNull();                          // duvar yere çizilen şerit
  expect(st("ates_topu")).toBeNull(); expect(st("buz_duvari")).toBeNull();
  for (const sp of cfg.data.spells) {
    const lightning = sp.sources.some(x => baseElements(cfg, x.id).includes("el_simsek")); const form = spellSequence(sp.id)?.form;
    if (lightning && form !== "duvar") expect(st(sp.id), sp.id).not.toBeNull();
    if (!lightning) expect(st(sp.id), sp.id).toBeNull();
  }
});

test("her özelliğin ne işe yaradığı yazılı; hiçbir şeyi etkilemeyenler bunu açıkça söyler; sıradaki açılış veriden gelir", async () => {
  const { ATTR_USE, attrUse } = await import("../src/content/attr-use");
  const { nextThreshold } = await import("../src/engine/thresholds");
  for (const a of cfg.data.attributes) { expect(attrUse(a.id), a.id).not.toBe(""); expect(attrUse(a.id).length, a.id).toBeLessThan(230); }
  expect(Object.keys(ATTR_USE).filter(id => !cfg.attr.has(id))).toEqual([]);             // olmayan özellik yazılmamış
  const s = newGame(cfg, 3); s.knownElements = ["el_ates"]; s.attrs.ates.level = 2;
  const nx = nextThreshold(cfg, s, "ates")!; expect(nx.at).toBe(5); expect(nx.t.text).toMatch(/Ateş topu/);
  s.attrs.ates.level = 6; expect(nextThreshold(cfg, s, "ates")?.t.text ?? "").not.toMatch(/duvar/i);   // keşfedilmemiş sentez büyüsü açık edilmez
});
