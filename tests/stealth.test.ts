// Gizlenme: her seferinde yol vardır; çalıda saklanan görünmez; koşan duyulur; taş bakışı çeker.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame } from "../src/engine/state";
import { createStealth, stepStealth, moveTo, throwStone, canSee, canSmell, finishStealth, FIELD, PLAYER_R, type Stealth } from "../src/engine/stealth";
import { rollFoes, modeOptions, stealthGoal, siegeFromFoes } from "../src/engine/encounter";

/** Izgarada aşağıdan yukarıdaki çıkışa yürünebilir bir yol var mı (katı engellerden kaçarak). */
function reachable(st: Stealth): boolean {
  const C = 2, W = Math.ceil(FIELD.w / C), H = Math.ceil(FIELD.h / C);
  const solid = (x: number, y: number) => st.blocks.some(b => b.kind !== "cali" && x > b.x - PLAYER_R && x < b.x + b.w + PLAYER_R && y > b.y - PLAYER_R && y < b.y + b.h + PLAYER_R);
  const seen = new Set<number>(); const q: [number, number][] = [[Math.floor(st.px / C), Math.floor(st.py / C)]];
  while (q.length) {
    const [x, y] = q.shift()!; const k = y * W + x; if (seen.has(k)) continue; seen.add(k);
    const cx = x * C + C / 2, cy = y * C + C / 2;
    if (cx > st.exit.x && cx < st.exit.x + st.exit.w && cy < st.exit.y + st.exit.h) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (!solid(nx * C + C / 2, ny * C + C / 2)) q.push([nx, ny]); }
  }
  return false;
}

test("her arazide çıkışa giden bir yol var", () => {
  const s = newGame(cfg, 3);
  for (let seed = 1; seed < 60; seed++) for (const foes of [["kurt", "kurt"], ["muhafiz", "muhafiz", "muhafiz"]])
    expect(reachable(createStealth(s, foes, "kacis", seed, false))).toBe(true);
});

test("çalıdaki görünmez, açıktaki görünür; gece insan gözü kısalır", () => {
  const s = newGame(cfg, 3);
  const st = createStealth(s, ["muhafiz"], "sizma", 7, false);
  const w = st.watchers[0]; w.x = 50; w.y = 50; w.dir = Math.PI / 2;
  st.blocks = [{ x: 40, y: 70, w: 20, h: 10, kind: "cali" }];
  st.px = 50; st.py = 75; expect(canSee(st, w)).toBe(false);
  st.px = 50; st.py = 62; expect(canSee(st, w)).toBe(true);
  st.py = 80; st.blocks = []; expect(canSee(st, w)).toBe(true);
  st.night = true; expect(canSee(st, w)).toBe(false);
});

test("kurt rüzgâr altındakini uzaktan koklar", () => {
  const s = newGame(cfg, 3);
  const st = createStealth(s, ["kurt"], "pusu", 9, false); const w = st.watchers[0];
  w.x = 50; w.y = 50; st.px = 50; st.py = 70;
  st.wind = { x: 0, y: -1 }; expect(canSmell(st, w)).toBe(true);   // rüzgâr kokuyu kurda taşıyor
  st.wind = { x: 0, y: 1 }; expect(canSmell(st, w)).toBe(false);   // rüzgâr arkasından esiyor
});

test("bakan bekçinin önünde koşan yakalanır; taş bakışları çeker", () => {
  const s = newGame(cfg, 3);
  const st = createStealth(s, ["muhafiz"], "sizma", 11, false); st.blocks = [];
  const w = st.watchers[0]; w.x = 50; w.y = 100; w.path = [[50, 100]]; w.dir = Math.PI / 2;
  st.px = 50; st.py = 120; st.run = true; moveTo(st, 30, 120);
  for (let i = 0; i < 200 && st.phase === "play"; i++) stepStealth(st, 0.05);
  expect(st.phase).toBe("lost");
  const st2 = createStealth(s, ["muhafiz"], "sizma", 11, false); st2.blocks = [];
  const w2 = st2.watchers[0]; w2.x = 50; w2.y = 100; w2.path = [[50, 100]];
  st2.px = 50; st2.py = 110; expect(throwStone(st2, 50, 75)).toBe(true); expect(w2.look?.y).toBe(75); expect(st2.stones).toBe(2);
});

test("gizlenmek gelişim verir, zaman alır", () => {
  const s = newGame(cfg, 3); const m = s.minute;
  const st = createStealth(s, ["kurt", "kurt"], "kacis", 5, false); st.phase = "won";
  const r = finishStealth(cfg, s, st);
  expect(r.won).toBe(true); expect(r.gains.cevresel).toBeGreaterThan(0); expect(s.minute).toBeGreaterThan(m);
});

test("sürü sayısı oynar, gece kalabalıklaşır; lider hep orada", () => {
  const s = newGame(cfg, 4); s.quests.devriye = { status: "aktif", count: 3 };
  const counts = new Set<number>();
  for (let d = 1; d < 30; d++) { s.day = d; s.minute = 120; counts.add(rollFoes(s, ["kurt", "kurt"], "devriye").length); }
  expect(counts.size).toBeGreaterThan(1);
  s.minute = 15 * 60; let night = 0, day = 0;
  for (let d = 1; d < 30; d++) { s.day = d; s.minute = 15 * 60; night += rollFoes(s, ["kurt", "kurt"], "devriye").length; s.minute = 120; day += rollFoes(s, ["kurt", "kurt"], "devriye").length; }
  expect(night).toBeGreaterThan(day);
  expect(rollFoes(s, ["akyele", "kurt", "kurt"], "akyele")).toContain("akyele");
});

test("savaş şekilleri: sızma, pusu, kaçış; barikat dalgaları karşılaşmadan kurulur", () => {
  const s = newGame(cfg, 4);
  expect(stealthGoal(["muhafiz", "muhafiz"], "gorev")).toBe("sizma");
  expect(stealthGoal(["kayhan", "muhafiz"], "gorev")).toBe("pusu");
  expect(stealthGoal(["kurt"], "yol")).toBe("kacis");
  expect(modeOptions(s, ["kurt"], "yol").map(m => m.id)).toEqual(["yakin", "barikat", "gizlen"]);
  const sg = siegeFromFoes("Yol", ["akyele", "kurt", "kurt"], "cayir");
  const all = sg.waves.flatMap(w => w.foes);
  expect(all.find(f => f.def === "akyele")).toBeTruthy();
  expect(sg.waves[sg.waves.length - 1].foes.some(f => f.def === "akyele")).toBe(true);
  expect(all.filter(f => f.def === "kurt").reduce((a, f) => a + f.count, 0)).toBe(3);
});
