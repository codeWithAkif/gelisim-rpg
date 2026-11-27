// Kuşatma: barikat tutar, ok ve büyü vurur, dalgalar ilerler; hazırlık ve beceri fark yaratır.
import { test, expect } from "vitest";
import { config as cfg } from "../src/engine/config";
import { newGame, type GameState } from "../src/engine/state";
import { createSiege, placeBarricade, startWave, step, shoot, cast, siegeSpells, restBetween, finishSiege, SIEGES, ARENA, placePet, escalate, guardOf, MAX_ESCALATION, type Siege } from "../src/engine/siege";

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

test("tekrar eden savunma her gece zorlaşır; ilk gece aynıdır, tavanı vardır, lider en sonda gelir", () => {
  const base = SIEGES.agil; const total = (d: typeof base) => d.waves.reduce((a, w) => a + w.foes.reduce((b, f) => b + f.count, 0), 0);
  expect(escalate(base, 0)).toBe(base);
  const n1 = escalate(base, 1), n2 = escalate(base, 2), n3 = escalate(base, 3);
  expect(total(n1)).toBeGreaterThan(total(base)); expect(total(n2)).toBeGreaterThan(total(n1));
  expect(n1.waves.length).toBe(base.waves.length); expect(n2.waves.length).toBe(base.waves.length + 1);
  expect(n2.waves.some(w => w.foes.some(f => f.def === "akyele"))).toBe(false);
  expect(n3.waves[n3.waves.length - 1].foes.some(f => f.def === "akyele")).toBe(true);
  expect(escalate(base, 99)).toEqual(escalate(base, MAX_ESCALATION));
  expect(base.waves[0].foes[0].count).toBe(3);   // asıl tanım bozulmaz
});

test("evcil hayvan yetenekleri kuşatmada işler: köpek alanı genişler, şahin ok menzilini uzatır", () => {
  const s = newGame(cfg, 3); s.pet = { id: "kopek", name: "Karabaş", bond: 0 } as GameState["pet"];
  expect(guardOf(s)).toBe(16); s.pet!.bond = 60; expect(guardOf(s)).toBe(22);
  const fire = (st: GameState) => { st.inventory.av_yayi = 1; st.inventory.ok = 5; const sg = createSiege(cfg, st, SIEGES.agil, 1); sg.phase = "fight"; shoot(st, sg, 0, 1); return sg.arrows[0].life; };
  const plain = newGame(cfg, 3); const hawk = newGame(cfg, 3); hawk.pet = { id: "sahin", name: "Ayaz", bond: 20 } as GameState["pet"];
  expect(fire(hawk)).toBeCloseTo(fire(plain) * 1.2);
});

test("en zor gece (lider dahil) baştan sona oynanır, hata vermez", () => {
  const s = newGame(cfg, 5); s.inventory.av_yayi = 1; s.inventory.ok = 99;
  const sg = createSiege(cfg, s, escalate(SIEGES.agil, MAX_ESCALATION), 7); play(s, sg, { bow: true });
  expect(["won", "lost"]).toContain(sg.phase);
});

test("savunmada büyü: ateş duvarı çizilen şerit boyunca yanar, buz duvarı engel kurar, ateş topu ileri atılır", async () => {
  const { createSiege, castWall, castThrow, spellAim, SIEGES, ARENA } = await import("../src/engine/siege");
  const { discover } = await import("../src/engine/synthesis");
  const s = newGame(cfg, 5); s.knownElements = ["el_ates", "el_su", "el_ayaz"]; s.attrs.ates.level = 30; s.attrs.ayaz_buyu.level = 40; s.mana = 99;
  discover(s, "sy_el_ates_duvar");
  expect(spellAim("sy_el_ates_duvar")).toBe("wall"); expect(spellAim("buz_duvari")).toBe("wall"); expect(spellAim("ates_topu")).toBe("throw");
  const sg = createSiege(cfg, s, Object.values(SIEGES)[0], 3); sg.phase = "fight"; sg.mana = 99;
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  const z0 = sg.zones.length; expect(castWall(cfg, s, sg, "sy_el_ates_duvar", cx - 10, cy - 20, cx + 10, cy - 20).ok).toBe(true);
  expect(sg.zones.length - z0).toBeGreaterThan(4); expect(sg.zones.every(z => z.kind === "ates")).toBe(true);
  const b0 = sg.barricades.length; expect(castWall(cfg, s, sg, "buz_duvari", cx - 10, cy + 20, cx + 10, cy + 20).ok).toBe(true);
  expect(sg.barricades.length).toBe(b0 + 1); expect(sg.barricades[b0].kind).toBe("buz");
  expect(castWall(cfg, s, sg, "buz_duvari", cx - 10, cy + 25, cx + 10, cy + 25).ok).toBe(false);   // dolmadı
  expect(castThrow(cfg, s, sg, "ates_topu", cx, cy - 200)).toBe(true);
  const f = sg.fx.filter(e => e.k === "cast").pop() as { y: number; from?: [number, number] };
  expect(f.from).toEqual([cx, cy]); expect(cy - f.y).toBeLessThanOrEqual(62.01);   // menzil kadar
});

test("ateşe giren kurt tutuşur ve birkaç saniye belirli hasar alır (şansa bağlı değil)", async () => {
  const { createSiege, castWall, step, SIEGES, ARENA } = await import("../src/engine/siege");
  const { discover } = await import("../src/engine/synthesis");
  const s = newGame(cfg, 6); s.knownElements = ["el_ates"]; s.attrs.ates.level = 30; s.mana = 99; discover(s, "sy_el_ates_duvar");
  const sg = createSiege(cfg, s, Object.values(SIEGES)[0], 4); sg.phase = "fight"; sg.mana = 99; sg.queue = [];
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  expect(castWall(cfg, s, sg, "sy_el_ates_duvar", cx - 10, cy - 30, cx + 10, cy - 30).ok).toBe(true);
  // şeridin üstünden geçen bir kurt (duvar kurulduktan sonra gelir)
  sg.foes.push({ id: 99, def: "kurt", x: cx, y: cy - 30, hp: 40, max: 40, speed: 0, dmg: [1, 2], atkCd: 9, slowT: 0, stunT: 0, burnT: 0, side: 1, r: 3.2, human: false });
  const f = sg.foes[sg.foes.length - 1];
  step(cfg, s, sg, 0.05); expect(f.burnT).toBeGreaterThan(3); expect(f.burnDps).toBeGreaterThanOrEqual(3);
  f.x = cx + 40;                                      // ateşten çıktı; yine de yanmaya devam eder
  for (let i = 0; i < 30; i++) step(cfg, s, sg, 0.1);
  expect(40 - f.hp).toBeGreaterThanOrEqual(8);        // ~3 saniye × ≥3/sn
});
