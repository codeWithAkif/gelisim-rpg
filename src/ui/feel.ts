// His: ses efektleri, ortam sesi ve titreşim.
// Sesler dosya değil, WebAudio ile anında üretilir (tamamen offline, paket büyümez).
import { settings } from "./settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
function ac(): AudioContext | null {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return ctx; }
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
/** Kısa ton: frekans kayması ve sönümle. */
function tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = "sine", delay = 0, dest?: AudioNode) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master); o.start(t); o.stop(t + dur + 0.02);
}
/** Süzgeçli gürültü patlaması (hışırtı, darbe, alev). */
function hiss(dur: number, vol: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = "bandpass", dest?: AudioNode) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay; const src = c.createBufferSource(); src.buffer = noise(c);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest ?? master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
}

export type Sfx = "thunk" | "clang" | "splash" | "tap" | "page" | "step" | "hit" | "crit" | "miss" | "hurt" | "whoosh" | "fire" | "good" | "perfect" | "bad" | "beat" | "win" | "lose" | "coin" | "thunder" | "spark" | "draw";
export function sfx(k: Sfx) {
  if (!settings().sound) return;
  switch (k) {
    case "tap": tone(900, 700, 0.05, 0.12, "triangle"); break;
    case "thunk": tone(120, 60, 0.2, 0.55, "sine"); hiss(0.12, 0.35, 600, 0.7, 0, "lowpass"); break;
    case "clang": tone(1250, 1200, 0.5, 0.18, "triangle"); tone(1880, 1820, 0.35, 0.1, "sine", 0.01); hiss(0.05, 0.2, 4000, 1); break;
    case "splash": hiss(0.35, 0.22, 1400, 0.6); hiss(0.2, 0.12, 3200, 1, 0.05); break;
    case "page": hiss(0.22, 0.18, 2600, 0.6); hiss(0.12, 0.1, 5000, 0.8, 0.08); break;
    case "step": hiss(0.08, 0.16, 500, 1.2, 0, "lowpass"); break;
    case "beat": tone(180, 90, 0.12, 0.35, "sine"); hiss(0.05, 0.08, 3000, 1); break;
    case "hit": tone(160, 60, 0.18, 0.45, "sine"); hiss(0.1, 0.3, 1200, 0.8); break;
    case "crit": tone(220, 50, 0.3, 0.6, "sine"); hiss(0.16, 0.4, 900, 0.7); tone(1400, 900, 0.18, 0.12, "triangle", 0.03); break;
    case "miss": hiss(0.25, 0.18, 1800, 2, 0, "bandpass"); break;
    case "whoosh": hiss(0.3, 0.2, 900, 1.5); break;
    case "hurt": tone(140, 70, 0.25, 0.4, "sawtooth"); hiss(0.12, 0.2, 700, 1); break;
    case "fire": hiss(0.6, 0.3, 500, 0.5, 0, "lowpass"); hiss(0.4, 0.12, 2500, 1, 0.1); break;
    case "thunder": hiss(0.09, 0.5, 5200, 0.6); tone(2600, 300, 0.12, 0.22, "sawtooth"); hiss(0.7, 0.45, 160, 0.5, 0.06, "lowpass"); tone(70, 38, 0.8, 0.4, "sine", 0.08); break;
    case "spark": tone(2200, 3200, 0.06, 0.08, "triangle"); break;
    case "draw": hiss(0.06, 0.05, 3500, 2); break;
    case "good": tone(660, 660, 0.12, 0.18, "triangle"); break;
    case "perfect": tone(660, 660, 0.1, 0.18, "triangle"); tone(990, 990, 0.18, 0.18, "triangle", 0.07); break;
    case "bad": tone(220, 180, 0.18, 0.15, "square"); break;
    case "coin": tone(1300, 1300, 0.08, 0.12, "triangle"); tone(1750, 1750, 0.16, 0.12, "triangle", 0.06); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.35, 0.16, "triangle", i * 0.11)); break;
    case "lose": [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.4, 0.15, "triangle", i * 0.16)); break;
  }
}

/* ---------- titreşim ---------- */
type HapticsApi = { impact(o: { style: string }): Promise<void>; vibrate(o: { duration: number }): Promise<void> };
// Dikkat: Capacitor eklentisi bir Proxy'dir; Promise ile doğrudan döndürülürse ".then" aranır ve
// "Haptics.then() is not implemented" hatası atar. Bu yüzden bir kutu ({ api }) içinde taşınır.
let hap: { api: HapticsApi | null } | undefined;
let loading: Promise<void> | null = null;
function loadHaptics(): Promise<void> {
  loading ??= (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")) {
        const mod = await import("@capacitor/haptics");
        hap = { api: mod.Haptics as unknown as HapticsApi }; return;
      }
    } catch { /* yok */ }
    hap = { api: null };
  })();
  return loading;
}
export type Buzz = "light" | "medium" | "heavy" | "long";
export function buzz(k: Buzz) {
  if (!settings().haptic) return;
  const run = () => {
    const h = hap?.api;
    try {
      if (h) { (k === "long" ? h.vibrate({ duration: 250 }) : h.impact({ style: k === "light" ? "LIGHT" : k === "medium" ? "MEDIUM" : "HEAVY" })).catch(() => {}); return; }
      navigator.vibrate?.(k === "light" ? 10 : k === "medium" ? 25 : k === "heavy" ? 45 : 220);
    } catch { /* titreşim yoksa sessizce geç */ }
  };
  if (hap) run(); else void loadHaptics().then(run, () => {});
}

/* ---------- ortam sesi ---------- */
let amb: { gain: GainNode; timer: number; night: boolean; src: AudioBufferSourceNode } | null = null;
/** Ortam: gündüz rüzgâr + ara ara kuş, gece cırcırböceği. Sessizce süregelir. */
export function ambience(on: boolean, night = false) {
  const want = on && settings().ambient && settings().sound && !document.hidden;
  if (!want) { if (amb) { amb.gain.gain.setTargetAtTime(0, ctx!.currentTime, 0.4); clearInterval(amb.timer); const g = amb.gain, sr = amb.src; setTimeout(() => { try { sr.stop(); } catch { /* */ } g.disconnect(); }, 1500); amb = null; } return; }
  if (amb && amb.night === night) return;
  ambience(false);
  const c = ac(); if (!c || !master) return;
  const g = c.createGain(); g.gain.value = 0; g.connect(master); g.gain.setTargetAtTime(1, c.currentTime, 0.8);
  // sürekli hafif rüzgâr
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = night ? 300 : 450;
  const wg = c.createGain(); wg.gain.value = night ? 0.025 : 0.04;
  src.connect(f).connect(wg).connect(g); src.start();
  const tick = () => {
    if (night) { for (let i = 0; i < 3; i++) tone(4300, 4200, 0.04, 0.025, "sine", i * 0.07, g); }
    else if (Math.random() < 0.45) { const b = 1800 + Math.random() * 1400; tone(b, b * 1.35, 0.09, 0.03, "sine", 0, g); tone(b * 1.2, b * 0.9, 0.12, 0.025, "sine", 0.12, g); }
    f.frequency.setTargetAtTime((night ? 250 : 380) + Math.random() * 200, c.currentTime, 1.5);
  };
  const timer = window.setInterval(tick, night ? 900 : 2300);
  amb = { gain: g, timer, night, src };
}
/** Tarayıcı sesi ilk dokunuştan sonra açar. */
export function unlockAudio() {
  const go = () => { ac(); window.removeEventListener("pointerdown", go); };
  window.addEventListener("pointerdown", go);
}

/** Çalgı notası (0–5): pentatonik, kopuz gibi tellerde. */
export function note(i: number) {
  if (!settings().sound) return;
  const f = [294, 330, 392, 440, 523, 587][i % 6];
  tone(f, f * 0.995, 0.6, 0.22, "triangle"); tone(f * 2, f * 2, 0.25, 0.05, "sine");
}
