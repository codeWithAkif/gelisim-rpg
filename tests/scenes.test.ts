// Sahneler: her görsel, ses ve konuşan tanımlı; açılış mottoyla başlar, sis ve ad sorusu yerinde.
import { test, expect } from "vitest";
import { readdirSync } from "node:fs";
import { SCENES, SPEAKERS, MOTTO, sisSides, fill } from "../src/content/scenes";
import { CHAPTERS } from "../src/content/story";
import { QUESTS } from "../src/content/world";

const arts = new Set(readdirSync("src/assets/art").map(f => f.replace(/\.webp$/, "")));
const sounds = new Set(readdirSync("src/assets/ses").filter(f => f.endsWith(".ogg")).map(f => f.replace(/^ortam_|\.ogg$/g, "")));

test("her sahnenin görseli, sesi ve konuşanı var; metinler boş değil", () => {
  for (const sc of Object.values(SCENES)) for (const b of sc.beats) {
    if (b.t === "gorsel" && b.art) expect(arts.has(b.art), `${sc.id}: ${b.art}`).toBe(true);
    if (b.t === "ses") for (const l of b.layers) expect(sounds.has(l.id), `${sc.id}: ${l.id}`).toBe(true);
    if (b.t === "soz") { expect(SPEAKERS[b.who], `${sc.id}: ${b.who}`).toBeTruthy(); const p = SPEAKERS[b.who].portrait; if (p) expect(arts.has(p)).toBe(true); }
    if (b.t === "metin" || b.t === "soz") expect(b.text.trim().length).toBeGreaterThan(0);
  }
});

test("açılış karanlıkta mottoyla başlar ve sisle biter; Hasan adı sorar", () => {
  const a = SCENES.acilis.beats; const firstText = a.find(b => b.t === "metin");
  expect(firstText && firstText.t === "metin" && firstText.text).toBe(MOTTO);
  expect(a[a.length - 1].t).toBe("sis");
  expect(SCENES.varis.beats.some(b => b.t === "ad")).toBe(true);
  const ad = SCENES.varis.beats.findIndex(b => b.t === "ad"); const after = SCENES.varis.beats[ad + 1];
  expect(after.t === "soz" && after.text.includes("{ad}")).toBe(true);
});

test("sahneye bağlı hikâye sayfaları var olan sahneleri gösterir", () => {
  for (const ch of CHAPTERS) for (const m of ch.milestones) if (m.scene) expect(SCENES[m.scene], m.id).toBeTruthy();
});

test("sis: çan iki yandan gelir, aynı yandan üst üste üç kez gelmez; tohum aynıysa aynı; ad yerine konur", () => {
  for (let seed = 1; seed < 400; seed++) {
    const s = sisSides(seed, 5);
    for (let i = 2; i < s.length; i++) expect(s[i] === s[i - 1] && s[i] === s[i - 2]).toBe(false);
  }
  expect(sisSides(42)).toEqual(sisSides(42));
  const all = new Set(Array.from({ length: 50 }, (_, k) => sisSides(k + 1).join("")));
  expect(all.size).toBeGreaterThan(2);
  expect(fill("{ad}… Buralı değil.", "Akif")).toBe("Akif… Buralı değil."); expect(fill("{ad}", "")).toBe("Yolcu");
});

test("işlere bağlı sahneler ve sahnede söz verilen işler var; Bölüm 1'in bütün ana sayfaları sahne", () => {
  for (const q of QUESTS) if (q.scene) expect(SCENES[q.scene], q.id).toBeTruthy();
  const ids = new Set(QUESTS.map(q => q.id));
  for (const ch of CHAPTERS) for (const m of ch.milestones) if (m.accept) expect(ids.has(m.accept), m.id).toBe(true);
  const b1 = CHAPTERS.find(c => c.id === "b1")!;
  for (const m of b1.milestones) expect(m.scene, m.id).toBeTruthy();
  const last = SCENES.mektup.beats[SCENES.mektup.beats.length - 1];
  expect(last.t).toBe("baslik");
});
