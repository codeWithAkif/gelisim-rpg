// Savaş ekranı: canlı harita (battle-render) + alt panelde düşman eskizi, olasılıklar ve hamleler.
// Motor her eylemde olay üretir; burada sırayla canlandırılır, bitince panel güncellenir.
import type { Config } from "../engine/config";
import type { GameState } from "../engine/state";
import {
  type Battle, type BattleOutcome, type Plan, type Scenario, type Stance, type XY,
  createBattle, player, enemies, reachable, movePlayer, playerAttack, observe, enemyTurn, tryFlee, finishBattle,
  previewAttack, knownWeakPoints, dist, visible, sightRange, threatMap, unitById, playerPush, pushChance, pushTarget,
  playerDefend, canThrowTorch, throwTorch, key, WIND_NAMES, incomingAttack, hasBow, previewShot, playerShoot,
} from "../engine/combat";
import { slashPrompt, dodgePrompt, runePrompt, pushPrompt, bowPrompt, castDrawPrompt } from "./gesture-view";
import { synthesize, discover } from "../engine/synthesis";
import { ELEMENT_RUNES, FORM_RUNES } from "../engine/gesture";
import type { FormId } from "../content/synthesis";
import { skillEase } from "../engine/timing";
import { spellRunes } from "../engine/gesture";
import { settings } from "./settings";
import { sfx, buzz } from "./feel";
import { TERRAIN, ENEMIES, MAPS } from "../content/world";
import { esc, wolfSketch, humanSketch } from "./sketch";
import { spellOptions, previewSpell, castSpell, hexRange, areaHexes, SPELL_FX, failedCast } from "../engine/magic";
import { MapRenderer } from "./battle-render";
import { type CoachStep, type CoachEvent, coachLine, coachNext, coachLearned } from "../engine/coach";
import { artUrl } from "./art";

type Mode = { k: "normal" } | { k: "spell"; id: string; target?: XY; q?: number } | { k: "torch" };

export function openBattle(cfg: Config, s: GameState, sc: Scenario, plan: Plan, questId: string | undefined,
  onEnd: (o: BattleOutcome, b: Battle) => void, persist: () => void) {
  const b = createBattle(cfg, s, sc.mapId, sc.enemies, (sc.seed + s.minute) | 0, questId, plan, sc);
  persist();
  let selected: string | null = enemies(b)[0]?.uid ?? null;
  let aim: string | undefined;
  let stance: Stance = "normal";
  let mode: Mode = { k: "normal" };
  let busy = false;

  const el = document.createElement("div");
  el.className = "battle"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Savaş");
  el.innerHTML = `<div class="battle-top"><h2>${esc(MAPS[sc.mapId]?.name ?? "Savaş")}</h2><span class="hand" id="bInfo"></span></div>
    <div class="battle-canvas"><canvas aria-label="Savaş haritası"></canvas><button class="map-help" id="bHelp" aria-label="Harita işaretleri">?</button></div>
    <div class="battle-panel" id="bPanel"></div>`;
  document.body.appendChild(el);
  const canvas = el.querySelector("canvas")!;
  const panel = el.querySelector<HTMLElement>("#bPanel")!;
  const R = new MapRenderer(canvas);

  const stage = () => el.querySelector<HTMLElement>(".battle-canvas")!;

  /* ---------- Hasan'ın dersi: ilk savaşta adım adım ---------- */
  let coach: CoachStep | null = s.story.flags.ogretici_savas === undefined ? "giris" : null;
  const bubble = document.createElement("div"); bubble.className = "coach";
  panel.before(bubble);   // haritayla panelin arasında: kurtları kapatmasın
  const timingOn = () => !!settings().timing;
  let shown = "";
  function renderCoach() {
    const line = coach ? coachLine(coach, timingOn()) : null;
    bubble.classList.toggle("on", !!line);
    if (!line) { bubble.innerHTML = ""; shown = ""; return; }
    if (shown === line.text) return;   // aynı öğüt: balon yeniden çizilmesin (canlandırma baştan başlamasın)
    shown = line.text;
    const pic = artUrl("portre_hasan");
    bubble.innerHTML = `${pic ? `<img src="${pic}" alt="">` : ""}<div class="coach-body"><div class="coach-who hand">Hasan</div><p>${esc(line.text)}</p>
      <div class="coach-row">${line.button ? `<button class="btn small primary" data-c="ok">${esc(line.button)}</button>` : ""}<button class="coach-skip" data-c="skip">Dersi geç</button></div></div>`;
  }
  function coachEv(ev: CoachEvent) {
    if (!coach) return;
    const was = coach; coach = coachNext(coach, ev, timingOn());
    if (coach === was) return;
    if (coachLearned(coach) && s.story.flags.ogretici_savas === undefined) { s.story.flags.ogretici_savas = s.day; persist(); }
    if (coach === "bitti") coach = null;
    sfx("page"); renderCoach();
  }
  const nearFoe = () => { const p = player(b); return enemies(b).some(e => dist(p.x, p.y, e.x, e.y) === 1 && visible(cfg, s, b, e)); };
  bubble.addEventListener("click", e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-c]"); if (!t) return;
    e.stopPropagation();
    if (t.dataset.c === "ok") coachEv("tamam");
    if (t.dataset.c === "skip") { coach = null; s.story.flags.ogretici_savas ??= s.day; persist(); renderCoach(); }
  });
  /** İki altıgen arası ekran açısı (derece): a'dan b'ye. */
  const screenAngle = (a: XY, b2: XY) => { const p = R.center(...a), q = R.center(...b2); return Math.atan2(q.cy - p.cy, q.cx - p.cx) * 180 / Math.PI; };
  function refreshView() {
    const p = player(b);
    const sightR = sightRange(cfg, s, b);
    R.view = {
      w: b.w, h: b.h, tiles: b.tiles, fire: b.fire, walls: b.walls, traps: b.traps, weather: b.weather, night: b.night,
      wind: b.wind, units: b.units, sight: sightR < 50 ? { at: [p.x, p.y], range: sightR } : null, torchLit: b.night && b.torch.has && !b.torch.thrown,
    };
    const over: typeof R.over = { selected };
    if (b.phase === "player" && !busy) {
      if (mode.k === "normal") { over.reach = new Set(reachable(b, p, p.moveLeft).keys()); over.threat = threatMap(cfg, s, b); }
      if (mode.k === "spell") {
        const sp = cfg.spell.get(mode.id)!; const r = new Set<string>();
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (dist(p.x, p.y, x, y) <= hexRange(sp) && !(x === p.x && y === p.y)) r.add(key(x, y));
        over.range = r;
        if (mode.target) over.area = new Set(areaHexes(b, sp, mode.target[0], mode.target[1]).map(([x, y]) => key(x, y)));
      }
      if (mode.k === "torch") {
        const r = new Set<string>(); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (canThrowTorch(b, x, y)) r.add(key(x, y));
        over.range = r;
      }
    }
    R.over = over;
  }

  /** Motorun biriktirdiği olayları sırayla canlandırır. */
  async function play() {
    const evs = b.events.splice(0);
    if (!evs.length) return;
    busy = true; refreshView(); renderPanel();
    R.lock(true);
    // yeni tutuşan yerler, canlandırma sırası gelince görünsün
    for (const e of evs) if (e.k === "ignite") R.hideFire(key(...e.at));
    for (const e of evs) if (e.k === "throw") R.hideFire(key(...e.to));
    for (const e of evs) if (e.k === "cast" && !e.fizzle) for (const [x, y] of areaHexes(b, cfg.spell.get(e.spell)!, e.to[0], e.to[1])) R.hideFire(key(x, y));
    const pPos = () => { const p = player(b); const c = R.center(p.x, p.y); return { x: c.cx, y: c.cy }; };
    for (const e of evs) {
      switch (e.k) {
        case "move": sfx("step"); await R.animMove(e.uid, e.path); break;
        case "shoot": {
          sfx("whoosh"); await R.animProjectile(e.from, e.to, "ok");
          if (e.hit) { R.flash(e.target); sfx(e.crit ? "crit" : "hit"); buzz(e.crit ? "medium" : "light"); R.floatAt(e.target, `${e.crit ? "Kritik! " : ""}−${e.dmg}`, "#9E3423"); } else { sfx("miss"); R.floatAt(e.target, "ıska", "#8B8270"); }
          await R.wait(200); break;
        }
        case "attack": {
          const onMe = e.target === player(b).uid;
          sfx(!e.hit ? "miss" : e.crit ? "crit" : onMe ? "hurt" : "hit");
          if (e.hit) buzz(onMe ? "heavy" : e.crit ? "medium" : "light");
          await R.animAttack(e.uid, e.target, e); break;
        }
        case "cast": {
          const sp = cfg.spell.get(e.spell)!;
          if (e.fizzle) { R.floatAt("p", "büyü dağıldı", "#8B8270"); await R.wait(400); break; }
          const cold = sp.sources.some(x => x.id.includes("ayaz") || x.id.includes("buz"));
          if (SPELL_FX[e.spell]?.chain) { sfx("thunder"); buzz("heavy"); R.zap(e.hits.map(h => h.uid), e.from); await R.wait(260); }
          else { sfx("whoosh"); await R.animProjectile(e.from, e.to, cold ? "buz" : "ates"); sfx("fire"); buzz("medium"); }
          for (const [x, y] of areaHexes(b, sp, e.to[0], e.to[1])) R.showFire(key(x, y));
          for (const h of e.hits) { R.flash(h.uid); R.floatAt(h.uid, `−${h.dmg}`, "#9E3423"); }
          await R.wait(250); break;
        }
        case "ignite": R.showFire(key(...e.at)); await R.wait(120); break;
        case "burn": R.flash(e.uid); R.floatAt(e.uid, `yanıyor −${e.dmg}`, "#C2571E"); await R.wait(300); break;
        case "flee": R.floatAt(e.uid, "kaçıyor!", "#2E4C7A"); await R.animFlee(e.uid, pPos()); break;
        case "down": await R.animDown(e.uid); break;
        case "push":
          await R.animPush(e.uid, e.to, e.ok);
          R.floatAt(e.uid, !e.ok ? "direndi" : e.into === "ateş" ? "ateşe!" : e.into === "dere" ? "dereye!" : e.into === "çamur" ? "çamura!" : "geri!", e.ok ? "#2E4C7A" : "#8B8270");
          await R.wait(200); break;
        case "trap": R.flash(e.uid); R.floatAt(e.uid, `tuzak! −${e.dmg}`, "#9E3423"); await R.wait(350); break;
        case "alert": R.floatAt(e.uid, "!", "#9E3423"); await R.wait(250); break;
        case "throw": await R.animProjectile(e.from, e.to, "ates"); R.showFire(key(...e.to)); break;
        case "defend": R.floatAt("p", "savunma", "#2E4C7A"); await R.wait(250); break;
      }
    }
    R.lock(false);
    busy = false;
  }

  function info() {
    const p = player(b);
    el.querySelector("#bInfo")!.textContent = `${b.night ? "gece" : "gündüz"}, ${b.weather === "yagmur" ? "yağmur" : b.weather === "sis" ? "sis" : "açık"} · tur ${b.turn} · can ${p.hp}/${p.maxHp}${s.knownElements.length ? ` · mana ${Math.floor(s.mana)}` : ""}`;
  }

  function renderPanel() {
    info(); refreshView(); renderCoach();
    const p = player(b);
    const tgt = b.units.find(u => u.uid === selected && u.hp > 0 && !u.fled && visible(cfg, s, b, u));
    const terr = TERRAIN[b.tiles[p.y][p.x]];
    const atEdge = p.x === 0 || p.y === 0 || p.x === b.w - 1 || p.y === b.h - 1;
    const can = b.phase === "player" && !busy && !p.acted;
    const log = `<div class="battle-log">${b.log.slice(0, 2).map(t => `<div>${esc(t)}</div>`).join("")}</div>`;
    let body = "";
    if (mode.k === "spell") {
      const sp = cfg.spell.get(mode.id)!;
      let pv = `<p class="muted tiny">Kırmızı kesikli altıgenlerden hedefi seç (menzil ${hexRange(sp)}).</p>`;
      if (mode.target) {
        const v = previewSpell(cfg, s, b, mode.id, mode.target[0], mode.target[1]);
        pv = `<div class="odds"><span>İsabet <b>%${Math.round(v.hit)}</b></span><span>Bozulma <b>%${Math.round(v.fizzle)}</b></span><span>Hasar <b>${v.dmg[0]}–${v.dmg[1]}</b></span>${v.envPct ? `<span>Ortam <b>${v.envPct > 0 ? "+" : ""}${Math.round(v.envPct)}%</b></span>` : ""}</div>
          <div class="muted tiny">${v.targets.length ? `Hedefte: ${v.targets.map(t => esc(t.name)).join(", ")}. ` : "Hedefte kimse yok. "}${esc(sp.effect ?? "")}</div>`;
      }
      body = `<div class="entry-head"><span class="entry-title" style="font-size:22px">${esc(sp.name)}</span><span class="hpbar">${sp.manaCost ?? 0} mana · ${sp.castTime ?? 1} sn</span></div>${pv}
        <div class="row"><button class="btn primary" data-b="cast" ${!mode.target ? "disabled" : ""}>Büyüyü yap</button><button class="btn" data-b="cancel">Vazgeç</button></div>`;
    } else if (mode.k === "torch") {
      body = `<div class="entry-title" style="font-size:22px">Meşaleyi fırlat</div><p class="muted tiny">İki altıgene kadar bir yeri seç. Kuru ot ve ağaç kolay tutuşur; yağmurda söner.</p>
        <div class="row"><button class="btn" data-b="cancel">Vazgeç</button></div>`;
    } else if (tgt) {
      const d = ENEMIES[tgt.def!]; const known = knownWeakPoints(cfg, s, d.id); const pv = previewAttack(cfg, s, b, tgt, aim, stance);
      const adj = dist(p.x, p.y, tgt.x, tgt.y) === 1;
      const parts = pv.critParts.sort((a, c) => c.amount - a.amount).slice(0, 4).map(x => `${x.name} ${x.amount >= 0 ? "+" : ""}${x.amount.toFixed(1)}`).join(" · ");
      const pt = pushTarget(b, tgt);
      body = `<div class="foe">${d.species === "insan" ? humanSketch({ marks: known.map(w => ({ name: w.name, at: w.at })), width: 112, labels: false }) : wolfSketch({ detail: s.attrs.analiz?.level ?? 0, marks: known.map(w => ({ name: w.name, at: w.at })), width: 112, labels: false, seed: tgt.uid.length * 13 })}
        <div><div class="entry-head"><span class="entry-title" style="font-size:22px">${esc(tgt.name)}</span><span class="hpbar">${tgt.alert ? "" : "habersiz · "}can ${tgt.hp}/${tgt.maxHp}</span></div>
        <div class="odds"><span>İsabet <b>%${Math.round(pv.hit)}</b></span><span>Kritik <b>%${Math.round(pv.crit)}</b></span><span>Hasar <b>${pv.dmg[0]}–${pv.dmg[1]}</b></span></div>
        <div class="muted tiny">Kritik: ${esc(parts)}</div></div></div>
        ${known.length ? `<div class="row">${known.map(w => `<button class="btn small ${aim === w.id ? "primary" : "red"}" data-aim="${w.id}">${esc(w.name)}</button>`).join("")}</div>` : ""}
        <div class="actions">
          <button class="btn primary" data-b="attack" ${!adj || !can ? "disabled" : ""}>${aim ? "Nişanlı vur" : "Saldır"}</button>
          <button class="btn ${stance === "guclu" ? "primary" : ""}" data-b="stance" ${!can ? "disabled" : ""} title="İsabet −15, hasar ×1,5, daha yorucu">Güçlü</button>
          <button class="btn" data-b="push" ${!adj || !can ? "disabled" : ""}>İt %${Math.round(pushChance(cfg, s, b, tgt))}${adj && !pt.blocked ? ` → ${esc(pt.into)}` : ""}</button>
          <button class="btn blue" data-b="observe" ${!can ? "disabled" : ""}>Gözle</button>
          ${hasBow(s) ? (() => { const sv = previewShot(cfg, s, b, tgt); return `<button class="btn" data-b="shoot" ${sv.ok && can ? "" : "disabled"}>Ok at${sv.ok ? ` %${Math.round(sv.hit)}` : ""} · ${s.inventory.ok ?? 0} ok</button>`; })() : ""}
        </div>
        ${hasBow(s) && !previewShot(cfg, s, b, tgt).ok && can ? `<p class="muted tiny" style="margin:0">Ok: ${esc(previewShot(cfg, s, b, tgt).reason ?? "")}${previewShot(cfg, s, b, tgt).reason === "Menzil dışı" ? ` (en çok ${5} altıgen)` : ""}</p>` : ""}
        ${!adj ? `<p class="muted tiny" style="margin:0">Vurmak ya da itmek için yanına git.</p>` : ""}`;
    } else {
      body = `<p class="muted tiny" style="margin:0">Mavi taralı altıgenlere dokunarak yürü, düşmana dokunarak incele. Kırmızı gölge: düşmanın bir sonraki turda saldırabileceği yer.${b.night || b.weather === "sis" ? " Görüşün kısıtlı." : ""}</p>`;
    }
    const spells = spellOptions(cfg, s);
    // zamanlama oyunları açıksa büyü aklından çizilir (dizi gösterilmez); kapalıysa listeden seçilir
    const drawMode = settings().timing && s.knownElements.length > 0;
    const known = spells.filter(o => o.ok).map(o => o.spell.name);
    const tools = mode.k === "normal" ? `<div class="actions">
      ${drawMode ? `<button class="btn small blue" data-b="draw" ${!can ? "disabled" : ""}>Büyü çiz · mana ${Math.floor(s.mana)}</button>`
        : spells.map(o => `<button class="btn small blue" data-spell="${esc(o.spell.id)}" ${!o.ok || !can ? "disabled" : ""} title="${esc(o.reason ?? "")}">${esc(o.spell.name)} · ${o.spell.manaCost ?? 0}</button>`).join("")}
      ${b.torch.has && !b.torch.thrown ? `<button class="btn small" data-b="torch" ${!can ? "disabled" : ""}>Meşale at</button>` : ""}
      <button class="btn small" data-b="defend" ${!can ? "disabled" : ""}>Savun</button>
    </div>${drawMode && known.length ? `<p class="muted tiny" style="margin:0">Bildiklerin: ${esc(known.slice(0, 8).join(", "))}${known.length > 8 ? ` ve ${known.length - 8} büyü daha` : ""}. Dizileri defterinde.</p>` : ""}` : "";
    panel.innerHTML = `${log}${body}${tools}
      <div class="row" style="justify-content:space-between"><span class="muted tiny">${esc(terr.name)} · hareket ${p.moveLeft}${b.wind.strength ? ` · rüzgâr ${WIND_NAMES[b.wind.dir]}` : ""}</span>
      <span class="row"><button class="btn small" data-b="end" ${busy || b.phase !== "player" ? "disabled" : ""}>Turu bitir</button>${atEdge ? `<button class="btn small red" data-b="flee" ${busy ? "disabled" : ""}>Geri çekil</button>` : ""}</span></div>`;
  }

  async function after() {
    await play(); renderPanel(); persist();
    if (b.phase === "won" || b.phase === "lost" || b.phase === "fled") return finish();
    const p = player(b);
    if (p.acted && p.moveLeft === 0) await endTurn();
  }
  async function endTurn() {
    if (busy || b.phase !== "player") return;
    mode = { k: "normal" }; stance = "normal";
    busy = true; renderPanel();
    await R.wait(200);
    const inc = settings().timing ? incomingAttack(cfg, s, b) : null;
    if (inc) { b.dodgeQ = await dodgePrompt(stage(), { foe: inc.def, from: screenAngle(inc.to, inc.from), ease: skillEase(s, "refleks") * 0.7 + skillEase(s, "esneklik") * 0.3, tip: coach === "kac" ? "Hasan: çalımına kanma. Havadayken parmağını yana kaydır." : undefined }); coachEv("kacis"); }
    enemyTurn(cfg, s, b); busy = false; coachEv("tur_bitti");
    await play();
    if (!b.units.some(u => u.uid === selected && u.hp > 0 && !u.fled)) selected = enemies(b)[0]?.uid ?? null;
    persist(); renderPanel();
    const ph = b.phase as Battle["phase"];
    if (ph === "won" || ph === "lost") finish();
  }
  function finish() {
    busy = true; renderPanel();
    sfx(b.phase === "won" ? "win" : b.phase === "lost" ? "lose" : "page"); if (b.phase === "lost") buzz("long");
    setTimeout(() => {
      const o = finishBattle(cfg, s, b);
      R.stop(); window.removeEventListener("resize", onResize); ro.disconnect(); el.remove();
      onEnd(o, b);
    }, 900);
  }

  canvas.addEventListener("pointerup", e => {
    if (busy || b.phase !== "player") return;
    const hex = R.pick(e.clientX, e.clientY); if (!hex) return;
    const p = player(b);
    if (mode.k === "spell") {
      const sp = cfg.spell.get(mode.id)!;
      if (dist(p.x, p.y, hex[0], hex[1]) <= hexRange(sp) && !(hex[0] === p.x && hex[1] === p.y)) { mode.target = hex; renderPanel(); }
      return;
    }
    if (mode.k === "torch") { if (canThrowTorch(b, hex[0], hex[1])) { throwTorch(b, hex[0], hex[1]); mode = { k: "normal" }; after(); } return; }
    const u = b.units.find(v => v.hp > 0 && !v.fled && v.x === hex[0] && v.y === hex[1]);
    if (u && u.side === "enemy" && visible(cfg, s, b, u)) { if (selected !== u.uid) aim = undefined; selected = u.uid; coachEv("sec"); if (nearFoe()) coachEv("yanında"); renderPanel(); return; }
    if (movePlayer(cfg, s, b, hex[0], hex[1])) {
      // yanına vardığın kurt seçili değilse onu seç: "Saldır" hemen açılsın
      const p = player(b); const cur = selected ? unitById(b, selected) : undefined;
      if (!cur || cur.hp <= 0 || cur.fled || dist(p.x, p.y, cur.x, cur.y) !== 1) { const adj = enemies(b).find(e => dist(p.x, p.y, e.x, e.y) === 1 && visible(cfg, s, b, e)); if (adj) { selected = adj.uid; aim = undefined; } }
      if (nearFoe()) coachEv("yanında"); after();
    }
  });
  panel.addEventListener("click", e => {
    const t = (e.target as HTMLElement).closest("button"); if (!t || busy || t.disabled) return;
    if (t.dataset.aim) { aim = aim === t.dataset.aim ? undefined : t.dataset.aim; renderPanel(); return; }
    if (t.dataset.spell) {
      const sp = cfg.spell.get(t.dataset.spell)!; const p = player(b);
      const tg = selected ? unitById(b, selected) : undefined;
      mode = { k: "spell", id: sp.id, target: tg && tg.hp > 0 && !tg.fled && dist(p.x, p.y, tg.x, tg.y) <= hexRange(sp) ? [tg.x, tg.y] : undefined };
      renderPanel(); return;
    }
    const tgt = selected ? unitById(b, selected) : undefined;
    switch (t.dataset.b) {
      case "attack": if (tgt) void (async () => {
        let q: number | undefined;
        if (settings().timing) {
          busy = true; const wp = aim ? ENEMIES[tgt.def!].weakPoints.find(w => w.id === aim) : undefined;
          q = await slashPrompt(stage(), { foe: tgt.def!, aimName: wp?.name, aimAt: wp?.at, aimArtAt: wp?.artAt, detail: s.attrs.analiz?.level ?? 10, ease: skillEase(s, "refleks") * 0.5 + skillEase(s, "kilic") * 0.5,
            tip: coach === "vur" ? "Hasan: sarı açık parlayınca, parmağını içinden hızla geçir." : undefined });
          busy = false;
        }
        playerAttack(cfg, s, b, tgt, aim, stance, q); stance = "normal"; coachEv("saldir"); after();
      })(); break;
      case "stance": stance = stance === "guclu" ? "normal" : "guclu"; renderPanel(); break;
      case "push": if (tgt) void (async () => {
        let q: number | undefined; const p = player(b);
        if (settings().timing) { busy = true; const pt = pushTarget(b, tgt); q = await pushPrompt(stage(), { dir: screenAngle([p.x, p.y], [tgt.x, tgt.y]), ease: skillEase(s, "ust_govde"), into: pt.into && pt.into !== "çayır" ? pt.into : undefined }); busy = false; }
        playerPush(cfg, s, b, tgt, q); after();
      })(); break;
      case "shoot": if (tgt) void (async () => {
        let q: number | undefined;
        if (settings().timing) {
          busy = true; const sv = previewShot(cfg, s, b, tgt);
          // yan rüzgâr: rüzgârın doğu-batı bileşeni
          const wind = Math.cos(b.wind.dir * Math.PI / 3) * b.wind.strength / 2;
          q = await bowPrompt(stage(), { foe: tgt.def!, range: sv.range, wind, ease: skillEase(s, "okculuk") * 0.6 + skillEase(s, "gorus") * 0.4 });
          busy = false;
        }
        playerShoot(cfg, s, b, tgt, q); after();
      })(); break;
      case "observe": if (tgt) { observe(cfg, s, b, tgt); after(); } break;
      case "draw": void (async () => {
        busy = true; renderPanel();
        const allowed = [...ELEMENT_RUNES.filter(r => s.knownElements.includes(r)), ...FORM_RUNES];
        const lv = Math.max(...s.knownElements.map(e => s.attrs[{ el_ates: "ates" }[e] ?? e.replace("el_", "") + "_buyu"]?.level ?? 0), 0);
        const res = await castDrawPrompt(stage(), { allowed, ease: skillEase(s, "odak"), limitMs: 9000 + Math.min(6000, lv * 150) });
        busy = false;
        if (!res) { renderPanel(); return; }
        const form = res.runes[res.runes.length - 1]?.startsWith("f_") ? res.runes[res.runes.length - 1].slice(2) as FormId : undefined;
        const els = res.runes.filter(r => !r.startsWith("f_"));
        if (!form) { failedCast(s, b, res.timeout ? "Zaman doldu; biçimi çizemedin." : "Biçimsiz büyü dağıldı."); sfx("bad"); after(); return; }
        const r = synthesize(s, els, form);
        if (!r.ok) { failedCast(s, b, r.reason ?? ""); sfx("bad"); after(); return; }
        const sp = cfg.spell.get(r.spellId!)!;
        if (r.spellId!.startsWith("sy_") && discover(s, r.spellId!)) { sfx("perfect"); buzz("heavy"); b.log.unshift(`Yeni büyü: ${sp.name}! Deftere yazdın.`); persist(); }
        const opt = spellOptions(cfg, s).find(o => o.spell.id === r.spellId);
        if (!opt?.ok) { failedCast(s, b, `${sp.name}: ${opt?.reason ?? "yapamadın"}.`); sfx("bad"); after(); return; }
        const p = player(b); const tg = selected ? unitById(b, selected) : undefined;
        mode = { k: "spell", id: sp.id, q: res.q, target: tg && tg.hp > 0 && !tg.fled && dist(p.x, p.y, tg.x, tg.y) <= hexRange(sp) ? [tg.x, tg.y] : undefined };
        renderPanel();
      })(); break;
      case "defend": playerDefend(b); after(); break;
      case "torch": mode = { k: "torch" }; renderPanel(); break;
      case "cast": if (mode.k === "spell" && mode.target) void (async () => {
        const m = mode as { k: "spell"; id: string; target: XY; q?: number }; const sp = cfg.spell.get(m.id)!;
        let q: number | undefined = m.q; const runes = spellRunes(cfg, sp.sources.map(x => x.id));
        if (q === undefined && settings().timing && runes.length) {
          busy = true; const lv = sp.mastery ? s.attrs[sp.mastery]?.level ?? 0 : 0;
          q = await runePrompt(stage(), { runes, spellName: sp.name, ease: skillEase(s, sp.mastery ?? "odak") * 0.6 + skillEase(s, "odak") * 0.4, guide: Math.max(0.15, Math.min(0.8, 0.8 - (lv - 5) / 40)) });
          busy = false;
        }
        castSpell(cfg, s, b, m.id, m.target[0], m.target[1], q); mode = { k: "normal" }; after();
      })(); break;
      case "cancel": mode = { k: "normal" }; renderPanel(); break;
      case "end": endTurn(); break;
      case "flee": if (tryFlee(b)) finish(); break;
    }
  });
  el.querySelector("#bHelp")!.addEventListener("click", () => {
    const h = document.createElement("div"); h.className = "modal-bg";
    h.innerHTML = `<div class="modal"><h2>Haritayı okumak</h2>
      <p><b class="blue">Mavi tarama</b>: bu tur yürüyebileceğin yerler.</p>
      <p><b class="red">Kırmızı gölge</b>: düşmanların bir sonraki turda saldırabileceği yerler. Ne kadar koyu, o kadar çok düşman.</p>
      <p><b>z</b>: düşman seni henüz fark etmedi. Fark edilmeden yanına varırsan pusu kurarsın: isabet +15, kritik +25. Gizlenip yaklaştıysan ilk vuruşun iki kat.</p>
      <p><b>Saldır</b>: kurdun üstünde açık parlayınca içinden kes; iyi kesik hasarı artırır. <b>Kaç</b>: kurt atıldığında, havadayken yana kaydır; çalımına kanma. İyi kaçış isabeti ve hasarı düşürür. Başaramamak bir şey değiştirmez. Uzun ot ve ağaç seni saklar, rüzgâr kokunu taşır, yağmur kokunu bastırır.</p>
      <p><b>İt</b>: düşmanı bir altıgen geri iter. Arkası ateşse yanar, dereyse sersemler, çamursa saplanır.</p>
      <p><b>Savun</b>: turu harcarsın ama düşmanın isabeti düşer.</p>
      <div class="row"><button class="btn" data-h="ders">Hasan'ın dersi</button><button class="btn primary" data-h="ok">Tamam</button></div></div>`;
    document.body.appendChild(h);
    h.querySelector("[data-h=ok]")!.addEventListener("click", () => h.remove());
    h.querySelector("[data-h=ders]")!.addEventListener("click", () => { h.remove(); coach = "giris"; renderCoach(); });
  });

  const onResize = () => R.layout();
  window.addEventListener("resize", onResize);
  const ro = new ResizeObserver(() => R.layout());
  ro.observe(canvas.parentElement!);
  // yalnız geliştirme sürümünde: tarayıcı denemeleri haritadaki birimlere dokunabilsin
  if (import.meta.env.DEV) (window as unknown as { __savas?: unknown }).__savas = { b, center: (x: number, y: number) => { const c = R.center(x, y), r = canvas.getBoundingClientRect(); return { x: r.left + c.cx, y: r.top + c.cy }; } };
  refreshView(); R.layout(); renderPanel(); R.start();
  if (b.events.length) after();
  return b;
}
