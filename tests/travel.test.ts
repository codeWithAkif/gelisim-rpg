import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { markSeen } from "../src/engine/explore";
import { route, planTravel, travel } from "../src/engine/travel";
import { planSession } from "../src/engine/session";

test("oyun yaylada başlar; köye yürümek zaman alır, bacağı geliştirir", () => {
  const s = newGame(cfg, 1);
  expect(s.location).toBe("yayla");
  expect(planTravel(cfg, s, "koy_meydani").ok).toBe(false); // meydanı henüz bilmiyorsun
  s.quests.mesaj = { status: "aktif" };                      // Hasan'ın işi yolu gösterir
  const r = route("yayla", "koy_meydani")!;
  expect(r.places[0]).toBe("yayla"); expect(r.places.at(-1)).toBe("koy_meydani");
  const p = planTravel(cfg, s, "koy_meydani");
  expect(p.ok).toBe(true); expect(p.minutes).toBeGreaterThan(40); expect(p.minutes).toBeLessThan(90);
  const m0 = s.minute; const t = travel(cfg, s, "koy_meydani")!;
  expect(s.location).toBe("koy_meydani"); expect(s.minute).toBe(m0 + t.minutes);
  expect(s.attrs.bacak.pending).toBeGreaterThan(0);
});
test("uzak yerler kilitli; çalışmalar yerinde yapılır", () => {
  const s = newGame(cfg, 1);
  expect(planTravel(cfg, s, "karacam").ok).toBe(false);
  expect(planSession(cfg, s, "yuzme", 600_000).ok).toBe(false); // yaylada yüzülmez
  s.location = "dere";
  expect(planSession(cfg, s, "yuzme", 600_000).ok).toBe(true);
});

import { startJourney, journeyProgress, dueEvent, resolveEvent, finishJourney, pauseJourney, resumeJourney, turnBack } from "../src/engine/journey";

test("yolculuk gerçek zamanlıdır: süre dolmadan varılmaz; sürprizler yolculuğu durdurur", () => {
  const s = newGame(cfg, 4); s.quests.mesaj = { status: "aktif" };
  expect(startJourney(cfg, s, "koy_meydani", 0).ok).toBe(true);
  const j = s.journey!; const dur = j.durMs;
  expect(finishJourney(cfg, s, dur / 2)).toBeNull();
  expect(s.location).toBe("yayla");
  // sürprizleri sırayla çöz
  let now = 0;
  for (let guard = 0; guard < 10 && s.journey; guard++) {
    now += 60_000 * 5;
    const d = dueEvent(s, now);
    if (d) { pauseJourney(s, now); const r = resolveEvent(cfg, s, d.def.choices[d.def.choices.length - 1].id, now); expect(r.text.length).toBeGreaterThan(0); now += 30_000; resumeJourney(s, now); }
    if (journeyProgress(s, now) >= 1) finishJourney(cfg, s, now);
  }
  now += s.journey ? s.journey.durMs * 2 : 0; finishJourney(cfg, s, now);
  expect(s.location).toBe("koy_meydani"); expect(s.journey).toBeUndefined();
});
test("yoldayken çalışılmaz, pazardan alınmaz; geri dönülebilir", () => {
  const s = newGame(cfg, 4); s.location = "koy_meydani"; markSeen(s, "koy_meydani"); markSeen(s, "nuri_evi");
  startJourney(cfg, s, "dere", 0);
  expect(planSession(cfg, s, "meditasyon", 600_000).ok).toBe(false);
  s.journey!.events = [];
  const half = s.journey!.durMs / 2;
  expect(turnBack(s, half)).toBe(true);
  expect(s.journey!.to).toBe("koy_meydani");
  expect(finishJourney(cfg, s, half + s.journey!.durMs + 10)).not.toBeNull();
  expect(s.location).toBe("koy_meydani");
});

test("açılmamış bölgenin çalışmaları gizlidir; bölüm açılınca görünür", async () => {
  const { activityOpen } = await import("../src/engine/travel");
  const s = newGame(cfg, 1);
  expect(activityOpen(s, "kosu")).toBe(true);            // yeri olmayan her yerde yapılır
  expect(activityOpen(s, "resim")).toBe(true);           // Nuri köyde
  expect(activityOpen(s, "satranc")).toBe(false);        // Usta Derya Karaçam'da
  s.story.reached.push("mektup"); expect(activityOpen(s, "satranc")).toBe(true);
});

test("Çalış sayfası: yeri olmayan her yerde, yeri olan yalnız orada yapılır", async () => {
  const { activityHere } = await import("../src/engine/travel");
  const s = newGame(cfg, 1); s.location = "yayla";
  expect(activityHere(s, "kosu")).toBe(true); expect(activityHere(s, "tirmanma")).toBe(true); expect(activityHere(s, "yuzme")).toBe(false);
});
