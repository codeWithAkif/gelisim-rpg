// Kuşatma: barikat tutar, ok ve büyü vurur, dalgalar ilerler; hazırlık ve beceri fark yaratır.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { createSiege, placeBarricade, startWave, step, shoot, cast, siegeSpells, restBetween, finishSiege, SIEGES, ARENA, placePet, type Siege } from "../src/engine/siege";

const CX = ARENA.w / 2, CY = ARENA.h / 2;
/** Basit oyuncu: en yakın düşmana ok atar, büyü hazırsa kalabalığa atar. */
function play(s: GameState, sg: Siege, opts: { bow?: boolean; magic?: boolean } = {}) {
  for (let guard = 0; guard < 20 && sg.phase !== "won" && sg.phase !== "lost"; guard++) {
    if (sg.phase === "rest") restBetween(s, sg);
    startWave(sg);
    for (let t = 0; t < 400 && sg.phase === "fight"; t++) {
      const near = sg.foes.slice().sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY))[0];
      if (near && opts.bow) shoot(s, sg, Math.atan2(near.y - CY, near.x - CX), 0.9);
      if (near && opts.magic) { const sp = siegeSpells(cfg, s, sg).find(x => x.ok); if (sp) cast(cfg, s, sg, sp.id, near.x, near.y); }
      step(cfg, s, sg, 0.1);
    }
  }
  return sg.phase;
}
const ring = (s: GameState, sg: Siege, r: number) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, b = (i + 1) / 8 * Math.PI * 2; placeBarricade(s, sg, CX + Math.cos(a) * r, CY + Math.sin(a) * r, CX + Math.cos(b) * r, CY + Math.sin(b) * r); } };

test("barikat: bütçe kadar kurulur, kendi üstüne kurulmaz, insanları durdurur", () => {
  const s = newGame(cfg, 1); s.yapi = { kazik_barikat: { n: 4, lv: 1 } }; const sg = createSiege(cfg, s, SIEGES.han, 3);
  const budget = sg.budget; expect(budget).toBe(2 + 4);
  expect(placeBarricade(s, sg, CX - 2, CY, CX + 2, CY + 1).ok).toBe(false);
  ring(s, sg, 14); expect(sg.barricades.length).toBe(budget); expect(sg.budget).toBe(0);
  startWave(sg); for (let t = 0; t < 220; t++) step(cfg, s, sg, 0.1);
  // insanlar barikatı kırmaya uğraşıyor: hasar almış barikat var ya da biri kırıldı
  expect(sg.barricades.some(b => b.hp < b.max) || sg.barricades.length < budget).toBe(true);
});

test("ok tüketir ve vurur; büyü dolma süresine girer", () => {
  const s = newGame(cfg, 2); s.inventory.av_yayi = 1; s.inventory.ok = 5; s.knownElements = ["el_ates"]; s.attrs.ates.level = 8;
  const sg = createSiege(cfg, s, SIEGES.agil, 4); startWave(sg);
  for (let t = 0; t < 30; t++) step(cfg, s, sg, 0.1);
  const f = sg.foes[0]; expect(f).toBeTruthy();
  const hp = f.hp; expect(shoot(s, sg, Math.atan2(f.y - CY, f.x - CX), 1)).toBe(true); expect(s.inventory.ok).toBe(4);
  expect(shoot(s, sg, 0, 1)).toBe(false);                     // yay geriliyor
  for (let t = 0; t < 15; t++) step(cfg, s, sg, 0.05);
  expect(sg.stats.arrowHits + (f.hp < hp ? 1 : 0)).toBeGreaterThan(0);
  const sp = siegeSpells(cfg, s, sg)[0]; expect(sp.id).toBe("ates_topu");
  expect(cast(cfg, s, sg, sp.id, f.x, f.y)).toBe(true);
  expect(siegeSpells(cfg, s, sg)[0].ok).toBe(false);          // doluyor
  expect(sg.zones.length).toBe(1);
});

test("hazırlık ve beceri kazandırır: elle dövüşen acemi zorlanır, barikat + ok + büyü + köpek kazanır", () => {
  const rate = (prep: (s: GameState, sg: Siege) => void, o: { bow?: boolean; magic?: boolean }) => {
    let w = 0; for (let k = 1; k <= 40; k++) { const s = newGame(cfg, k); const sg0 = createSiege(cfg, s, SIEGES.agil, k * 7); prep(s, sg0);
      if (play(s, sg0, o) === "won") w++; } return w / 40;
  };
  const novice = rate(() => {}, {});
  const ready = rate((s, sg) => {
    s.inventory.av_yayi = 1; s.inventory.ok = 40; s.knownElements = ["el_ates"]; s.attrs.ates.level = 8; s.attrs.okculuk.level += 10;
    s.pet = { id: "kopek", name: "Karabaş", bond: 20 }; Object.assign(sg, createSiege(cfg, s, SIEGES.agil, sg.seed)); ring(s, sg, 16); placePet(sg, CX, CY - 18);
  }, { bow: true, magic: true });
  expect(novice).toBeLessThan(0.6);
  expect(ready).toBeGreaterThan(novice + 0.25);
  const s = newGame(cfg, 9); const sg = createSiege(cfg, s, SIEGES.agil, 1); play(s, sg, {});
  const r = finishSiege(cfg, s, sg); expect(Object.keys(r.gains).length).toBeGreaterThan(0);
});
