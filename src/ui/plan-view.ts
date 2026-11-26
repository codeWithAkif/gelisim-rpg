// Savaş öncesi hazırlık: araziyi oku, zamanı ve giriş noktasını seç, tuzak kur, meşale al.
// Her seçimin getirdiği avantaj/dezavantaj anında görünür; plan savaşı gerçekten değiştirir.
import { itemPic } from "./art";
import type { Config } from "../engine/config";
import { type GameState, clock, DAY_MINUTES, isNight } from "../engine/state";
import {
  type Plan, type Scenario, type Unit, type XY, makeScenario, enemySpots, prepOptions, assessPlan, planCost, doPrep, prepDone,
  key, WIND_NAMES, foeWords } from "../engine/combat";
import { MAPS, MAP_CHARS, TERRAIN, ENEMIES } from "../content/world";
import { esc } from "./sketch";
import { MapRenderer } from "./battle-render";
import { trapsOwned, owned, structure } from "../engine/engineering";

const WEATHER_TR = { acik: "açık", yagmur: "yağmur", sis: "sis" } as const;

export function openPlan(cfg: Config, s: GameState, questId: string, title: string, mapId: string, enemyIds: string[],
  onStart: (sc: Scenario, plan: Plan) => void, persist: () => void) {
  const sc = makeScenario(s, mapId, enemyIds, questId);
  const m = MAPS[mapId];
  const done = prepDone(s, questId);
  const plan: Plan = { timing: "simdi", start: 0, scout: done.scout, readWind: done.readWind, traps: [], trapTypes: [], torch: false, paid: [] };
  let trapSel = trapsOwned(s)[0]?.id ?? "ilmik_tuzagi";
  const remain = (id: string) => owned(s, id) - plan.trapTypes!.filter(x => x === id).length;
  const maxTraps = () => trapsOwned(s).reduce((n, t) => n + t.n, 0);
  let trapMode = false;
  const tiles = m.rows.map(r => [...r].map(c => MAP_CHARS[c] ?? "cayir"));
  const spots = enemySpots(mapId, enemyIds.length, sc.seed);

  const el = document.createElement("div");
  el.className = "battle plan"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Hazırlık");
  el.innerHTML = `<div class="battle-top"><h2>Hazırlık</h2><span class="hand">${esc(title)}</span></div>
    <div class="battle-canvas plan-canvas"><canvas aria-label="Arazi"></canvas><div class="map-note" id="pNote"></div></div>
    <div class="plan-panel" id="pPanel"></div>`;
  document.body.appendChild(el);
  const canvas = el.querySelector("canvas")!; const panel = el.querySelector<HTMLElement>("#pPanel")!;
  const R = new MapRenderer(canvas);

  function view() {
    const st = m.starts[plan.start];
    const units: Unit[] = [{ uid: "p", side: "player", name: "Sen", x: st.at[0], y: st.at[1], hp: 1, maxHp: 1, moveLeft: 0, acted: false, slowed: 0 }];
    if (plan.scout) enemyIds.forEach((id, i) => { const [x, y] = spots[i]; units.push({ uid: "e" + i, side: "enemy", def: id, name: ENEMIES[id].name, x, y, hp: 1, maxHp: 1, moveLeft: 0, acted: false, slowed: 0, alert: plan.timing === "aksam" }); });
    const traps: Record<string, number> = {}; plan.traps.forEach(([x, y]) => traps[key(x, y)] = 1);
    R.view = { w: tiles[0].length, h: tiles.length, tiles, fire: {}, walls: {}, traps, weather: plan.timing === "aksam" ? sc.weatherEvening : sc.weatherNow, night: plan.timing === "aksam", wind: plan.readWind ? sc.wind : null, units, sight: null, torchLit: plan.torch && plan.timing === "aksam" };
    R.over = {
      markers: m.starts.map((x, i) => ({ at: x.at, label: String(i + 1), active: i === plan.start })),
      unknown: plan.scout ? [] : [[3, 0] as XY],
      reach: trapMode ? new Set(tiles.flatMap((row, y) => row.map((t, x) => (!TERRAIN[t].blocks && !m.starts.some(st2 => st2.at[0] === x && st2.at[1] === y)) ? key(x, y) : "")).filter(Boolean)) : undefined,
    };
    el.querySelector("#pNote")!.textContent = trapMode ? `${structure(trapSel)?.name}: altıgene dokun (${remain(trapSel)} kaldı)` : "";
  }

  function render() {
    view();
    const nowW = sc.weatherNow, eveW = sc.weatherEvening;
    const late = s.minute >= (20 - 6) * 60 - 30;
    const cost = planCost(s, plan);
    const left = DAY_MINUTES - s.minute - cost.minutes;
    const opts = prepOptions(cfg, s);
    const adv = assessPlan(cfg, s, sc, plan); const W = foeWords(enemyIds);
    const prepRow = (id: string, label: string, state: string, btn: string) =>
      `<div class="prep"><div><div class="prep-name">${label}</div><div class="muted tiny">${state}</div></div>${btn}</div>`;
    const o = (id: string) => opts.find(x => x.id === id)!;
    panel.innerHTML = `
      <section class="sec"><h3>Ne zaman?</h3><div class="choices">
        <button class="choice ${plan.timing === "simdi" ? "on" : ""}" data-t="simdi"><b>Şimdi</b><span>${clock(s)} · ${WEATHER_TR[nowW]}</span><span class="muted tiny">${isNight(s) ? `Gece: ${esc(W.pl)} ${esc(W.hunt)}. Daha tehlikeli, ödülü daha çok.` : `Gündüz: ${esc(W.pl)} ${esc(W.rest)}.`}</span></button>
        ${late ? "" : `<button class="choice ${plan.timing === "aksam" ? "on" : ""}" data-t="aksam"><b>Akşamı bekle</b><span>20:00 · tahmin: ${WEATHER_TR[eveW]}</span><span class="muted tiny">Gece: ${esc(W.pl)} ${esc(W.hunt)}. Ödülü daha çok.</span></button>`}
      </div></section>
      <section class="sec"><h3>Nereden gireceksin?</h3><div class="choices">
        ${m.starts.map((st, i) => `<button class="choice ${plan.start === i ? "on" : ""}" data-s="${i}"><b>${i + 1}. ${esc(st.name)}</b><span class="muted tiny">${esc(st.note)}</span></button>`).join("")}
      </div></section>
      <section class="sec"><h3>Hazırlık</h3>
        ${prepRow("scout", o("scout").name, plan.scout ? `Yapıldı: ${enemyIds.length} düşman; haritada yerleri görünüyor.` : o("scout").desc + " 30 dk · enerji −4",
          plan.scout ? `<span class="hand" style="color:var(--green)">✓</span>` : `<button class="btn small" data-p="scout">Keşfet</button>`)}
        ${prepRow("readWind", o("readWind").name, plan.readWind ? (sc.wind.strength === 0 ? "Hava durgun; koku pek taşınmıyor." : `Rüzgâr ${WIND_NAMES[sc.wind.dir]} esiyor (${sc.wind.strength === 2 ? "sert" : "hafif"}). Haritada ok.`) : o("readWind").ok ? o("readWind").desc + " 10 dk" : esc(o("readWind").reason ?? ""),
          plan.readWind ? `<span class="hand" style="color:var(--green)">✓</span>` : `<button class="btn small" data-p="readWind" ${o("readWind").ok ? "" : "disabled"}>Oku</button>`)}
        ${prepRow("trap", `${o("trap").name} (${plan.traps.length}/${maxTraps()})`, o("trap").ok ? o("trap").desc + " Her biri 30 dk · enerji −6" + `<div class="chips" style="margin-top:4px">${trapsOwned(s).map(t => `<button class="chip ${trapSel === t.id ? "on" : ""}" data-trap="${t.id}">${esc(structure(t.id)!.name)} ${remain(t.id)}/${t.n}</button>`).join("")}</div>` : esc(o("trap").reason ?? ""),
          `<button class="btn small ${trapMode ? "primary" : ""}" data-p="trap" ${o("trap").ok ? "" : "disabled"}>${trapMode ? "Bitti" : "Yerleştir"}</button>`)}
        ${prepRow("torch", `${itemPic("mesale", 30)} ${o("torch").name}`, o("torch").desc + " 10 dk · 2 bakır",
          `<button class="btn small ${plan.torch ? "primary" : ""}" data-p="torch" ${o("torch").ok || plan.torch ? "" : "disabled"}>${plan.torch ? "Alındı" : "Al"}</button>`)}
      </section>
      <section class="sec"><h3>Planın</h3><div class="advice">${adv.map(a => `<div class="${a.good ? "good" : "bad"}"><span>${a.good ? "+" : "−"}</span>${esc(a.text)}</div>`).join("")}</div>
        <p class="muted tiny" style="margin:0">Savaşa girerken: ${cost.minutes} dk${cost.energy ? ` · enerji −${cost.energy}` : ""}${cost.money ? ` · ${cost.money} bakır` : ""}. ${left < 30 ? "<b class='red'>Gecenin sonuna zaman kalmıyor.</b>" : ""}</p></section>
      <div class="row plan-go"><button class="btn" data-x="cancel">Vazgeç</button><button class="btn primary" data-x="go" ${left < 20 ? "disabled" : ""}>Savaşa gir</button></div>`;
  }

  panel.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
    if (b.dataset.t) { plan.timing = b.dataset.t as Plan["timing"]; }
    else if (b.dataset.s) { plan.start = +b.dataset.s; { const keep = plan.traps.map(([x, y], i) => ({ x, y, t: plan.trapTypes![i] })).filter(v => !(m.starts[plan.start].at[0] === v.x && m.starts[plan.start].at[1] === v.y)); plan.traps = keep.map(v => [v.x, v.y] as [number, number]); plan.trapTypes = keep.map(v => v.t); } }
    else if (b.dataset.p === "scout" || b.dataset.p === "readWind") { doPrep(cfg, s, questId, b.dataset.p); plan[b.dataset.p] = true; plan.paid!.push(b.dataset.p); persist(); }
    else if (b.dataset.trap) { trapSel = b.dataset.trap; trapMode = true; }
    else if (b.dataset.p === "trap") trapMode = !trapMode;
    else if (b.dataset.p === "torch") plan.torch = !plan.torch;
    else if (b.dataset.x === "cancel") { close(); return; }
    else if (b.dataset.x === "go") { close(); onStart(sc, { ...plan, paid: [...plan.paid!], trapTypes: [...plan.trapTypes!] }); return; }
    render();
  });
  canvas.addEventListener("pointerup", e => {
    const hex = R.pick(e.clientX, e.clientY); if (!hex) return;
    if (!trapMode) { const i = m.starts.findIndex(st => st.at[0] === hex[0] && st.at[1] === hex[1]); if (i >= 0) { plan.start = i; render(); } return; }
    const [x, y] = hex; if (TERRAIN[tiles[y][x]].blocks || m.starts.some(st => st.at[0] === x && st.at[1] === y)) return;
    const i = plan.traps.findIndex(([a, c]) => a === x && c === y);
    if (i >= 0) { plan.traps.splice(i, 1); plan.trapTypes!.splice(i, 1); }
    else if (remain(trapSel) > 0) { plan.traps.push([x, y]); plan.trapTypes!.push(trapSel); }
    if (remain(trapSel) <= 0) { const nx = trapsOwned(s).find(t => remain(t.id) > 0); if (nx) trapSel = nx.id; else trapMode = false; }
    render();
  });
  // canlı önizleme: sık değişmeyen sahne, ama ot ve su kımıldasın
  const ro = new ResizeObserver(() => R.layout()); ro.observe(canvas.parentElement!);
  function close() { R.stop(); ro.disconnect(); el.remove(); }
  render(); R.layout(); R.start();
}
