// Yer kartı: buradayken ne yapılabileceği İşler'e gitmeden görünür.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { placeActions, nextHint } from "../src/engine/actions";
import { acceptQuest } from "../src/engine/quests";

test("yaylada: Hasan'ın işi üstlenilir, arama yapılır, tırmanma çalışılır", () => {
  const s = newGame(cfg, 1);
  const a = placeActions(cfg, s, "yayla");
  expect(a.find(x => x.act === "accept")?.id).toBe("mesaj");
  expect(a.some(x => x.act === "search")).toBe(true);
  expect(a.some(x => x.act === "session-pick" && x.id === "tirmanma")).toBe(true);
  acceptQuest(s, "mesaj");
  expect(placeActions(cfg, s, "yayla").some(x => x.act === "accept" && x.id === "mesaj")).toBe(false);
  // iş başka yerde: kart sıradaki işi gösterir
  expect(nextHint(s)).toMatchObject({ act: "show-place", id: "koy_meydani" });
  const m = placeActions(cfg, s, "koy_meydani");
  expect(m[0]).toMatchObject({ act: "walk", id: "mesaj", primary: true });
  expect(m.some(x => x.act === "market")).toBe(true);
});
