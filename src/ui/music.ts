// Müzik: src/assets/music altındaki dosyalar ada göre bulunur (muzik_<bölge>.ogg gibi; ayrıntı README.md).
// Dosya yoksa sessiz kalınır. Parça kesintisiz döner, bölge değişince yumuşakça geçer, annenin ezgisi
// çalarken kısılır. Uygulama paketine girer; ağ isteği yoktur.
import { settings } from "./settings";
import { audioOut, onDuck } from "./feel";
import { pickTrack } from "../engine/soundscape";

const files = import.meta.glob("../assets/music/*.{ogg,opus,mp3,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const TRACKS: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) TRACKS[path.split("/").pop()!.replace(/\.(ogg|opus|mp3|m4a)$/, "")] = url;
export const availableTracks = () => new Set(Object.keys(TRACKS));

const VOL = 0.32, FADE = 1.6;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
function load(key: string): Promise<AudioBuffer | null> {
  let p = buffers.get(key);
  if (!p) {
    const a = audioOut();
    p = !a ? Promise.resolve(null) : fetch(TRACKS[key]).then(r => r.arrayBuffer()).then(b => a.c.decodeAudioData(b)).catch(() => null);
    buffers.set(key, p);
  }
  return p;
}

let cur: { key: string; src: AudioBufferSourceNode | null; gain: GainNode } | null = null;
let duckUntil = 0;
function stopCur() {
  const a = audioOut(); if (!cur || !a) { cur = null; return; }
  const old = cur; cur = null;
  old.gain.gain.cancelScheduledValues(a.c.currentTime); old.gain.gain.setTargetAtTime(0, a.c.currentTime, FADE / 3);
  setTimeout(() => { try { old.src?.stop(); } catch { /* */ } old.gain.disconnect(); }, FADE * 1000 + 400);
}
/**
 * Bu adaylardan elde olan ilk parçayı çalar; hiçbiri yoksa ya da müzik kapalıysa susar.
 * Aynı parça zaten çalıyorsa dokunmaz.
 */
export function playMusic(candidates: string[] | null) {
  const want = candidates && settings().music && settings().sound && !document.hidden ? pickTrack(candidates, availableTracks()) : null;
  if (cur?.key === want) return;
  stopCur(); if (!want) return;
  const a = audioOut(); if (!a) return;
  const gain = a.c.createGain(); gain.gain.value = 0; gain.connect(a.out);
  const me = { key: want, src: null as AudioBufferSourceNode | null, gain }; cur = me;
  void load(want).then(buf => {
    if (cur !== me || !buf) return;
    const src = a.c.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start();
    me.src = src; const t = a.c.currentTime;
    gain.gain.setTargetAtTime(duckUntil > Date.now() ? VOL * 0.25 : VOL, t, FADE / 3);
  });
}
// annenin ezgisi çalarken müzik geri çekilir, bitince döner
onDuck(sec => {
  const a = audioOut(); duckUntil = Date.now() + sec * 1000; if (!cur || !a) return;
  const t = a.c.currentTime; cur.gain.gain.setTargetAtTime(VOL * 0.25, t, 0.15); cur.gain.gain.setTargetAtTime(VOL, t + sec, 0.8);
});
