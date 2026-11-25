import { test, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { NPCS, GAME_ITEMS, CONFIG_WEAPON_DAMAGE, CONFIG_ARMOR } from "../src/content/world";
import { PLACES } from "../src/content/map";

// Görsel dosya adları ada göre eşleşir; yanlış yazılan ad oyunda sessizce eskize döner.
const DIR = "src/assets/art";
test("her görsel bilinen bir kişi, yer ya da eşyaya ait ve küçük boyutlu", () => {
  const items = new Set([...Object.keys(GAME_ITEMS), ...Object.keys(CONFIG_WEAPON_DAMAGE), ...Object.keys(CONFIG_ARMOR)]);
  for (const f of readdirSync(DIR)) {
    expect(f, f).toMatch(/^(portre|yer|esya|hikaye|dusman|poz)_[a-z0-9_]+\.webp$/);
    const [, kind, id] = f.match(/^([a-z]+)_(.+)\.webp$/)!;
    if (kind === "portre") expect(id === "anne" || NPCS.some(n => n.id === id), f).toBe(true);
    if (kind === "yer") expect(PLACES.some(p => p.id === id), f).toBe(true);
    if (kind === "esya") expect(items.has(id) || id === "mesale", f).toBe(true); // meşale savaş hazırlığında
    expect(statSync(`${DIR}/${f}`).size, f).toBeLessThan(200_000);
  }
});
