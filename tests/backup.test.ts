// Yedek kodu: kayıt (Türkçe karakterli ad dahil) kodlanıp aynen geri gelmeli; bozuk kod reddedilmeli.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { encodeBackup, decodeBackup } from "../src/engine/save";

test("yedek kodu kaydı aynen taşır", () => {
  const s = newGame(cfg, 3); s.name = "Şükrü Çağlayan"; s.day = 12; s.money = 41;
  const code = encodeBackup(JSON.stringify(s), JSON.stringify({ anim: "hizli" }));
  expect(code.startsWith("GD1:")).toBe(true);
  const b = decodeBackup("  " + code.slice(0, 20) + "\n" + code.slice(20) + " ")!; // yapıştırırken bölünse de
  expect(b.name).toBe("Şükrü Çağlayan"); expect(b.day).toBe(12);
  expect(JSON.parse(b.save)).toEqual(JSON.parse(JSON.stringify(s)));
  expect(JSON.parse(b.settings!)).toEqual({ anim: "hizli" });
  expect(decodeBackup("merhaba")).toBeNull();
  expect(decodeBackup(code.slice(0, -10))).toBeNull();
});
