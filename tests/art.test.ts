import { test, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { NPCS, GAME_ITEMS, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR } from "../src/content/world";
import "../src/content/gear";
import "../src/content/engineering";
import { PLACES } from "../src/content/map";
import { INTRO, CHAPTERS } from "../src/content/story";
import { HEROES } from "../src/content/estate";
import { PET_TYPES } from "../src/content/pets";
import { STRUCTURES } from "../src/content/engineering";
import { NOBET_SITES } from "../src/engine/nobet";

// Görsel dosya adları ada göre eşleşir; yanlış yazılan ad oyunda sessizce eskize döner.
const DIR = "src/assets/art";
test("her görsel bilinen bir kişi, yer ya da eşyaya ait ve küçük boyutlu", () => {
  const items = new Set([...Object.keys(GAME_ITEMS), ...Object.keys(CONFIG_WEAPON_DAMAGE), ...Object.keys(CONFIG_ARMOR)]);
  for (const f of readdirSync(DIR)) {
    expect(f, f).toMatch(/^(portre|yer|esya|hikaye|dusman|poz|harita|anim|vucut|yapi|kule|harabe)_[a-z0-9_]+\.webp$/);
    const [, kind, id] = f.match(/^([a-z]+)_(.+)\.webp$/)!;
    if (kind === "portre") expect(id === "anne" || NPCS.some(n => n.id === id) || HEROES.some(h => h.id === id), f).toBe(true);
    if (kind === "anim") expect(["kahraman_yuru", "kahraman_yay", "kahraman_ara", "kahraman_tirman", "kahraman_buyu", "kurt_yuru", ...Object.keys(PET_TYPES).map(k => k + "_yuru")], f).toContain(id);
    if (kind === "yapi") expect(STRUCTURES.some(d => d.id === id), f).toBe(true);
    if (kind === "kule") expect(NOBET_SITES.some(d => d.place === id), f).toBe(true);
    if (kind === "harabe") expect(/^(oda_(koru|karacam_sarnic|ardic_kul)|merdiven|kilit_kapi|kapi_acik|cikis|sandik|dolap|fici|cuval|raf|yatak|ocak|kasa|tas_nis|soba|anahtar|silah_(pasli_kilic|eski_mizrak|civili_sopa|kemik_balta|avci_yayi|kisa_yay))$/.test(id), f).toBe(true);
    if (kind === "vucut") expect(id, f).toBe("insan");
    if (kind === "yer") expect(PLACES.some(p => p.id === id), f).toBe(true);
    if (kind === "esya") expect(items.has(id) || id === "mesale", f).toBe(true); // meşale savaş hazırlığında
    if (kind === "hikaye") expect(INTRO.some(p => p.art === id) || id === "defter" || CHAPTERS.some(c => c.milestones?.some(m => m.id === id)), f).toBe(true);
    expect(statSync(`${DIR}/${f}`).size, f).toBeLessThan(kind === "anim" || kind === "vucut" ? 320_000 : 200_000);
  }
});
