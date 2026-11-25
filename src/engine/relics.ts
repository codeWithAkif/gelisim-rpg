// Kadim eşya kazanmak: seviyeye doğrudan, kalıcı sıçrama.
import type { Config } from "./config";
import { type GameState, log } from "./state";
import type { GainReport } from "./progression";
import { RELICS, type Relic } from "../content/relics";

export function hasRelic(s: GameState, id: string) { return (s.relics ?? []).includes(id); }
/** Eşyayı verir ve etkisini uygular; zaten varsa null. */
export function grantRelic(cfg: Config, s: GameState, id: string, report: GainReport = {}): Relic | null {
  const r = RELICS[id]; if (!r || hasRelic(s, id)) return null;
  (s.relics ??= []).push(id);
  for (const [a, n] of Object.entries(r.boosts)) {
    const st = s.attrs[a]; if (!st) continue;
    const max = cfg.attr.get(a)?.max ?? 100;
    const before = st.level; st.level = Math.min(max, st.level + n); st.peak = Math.max(st.peak, st.level);
    report[a] = (report[a] ?? 0) + (st.level - before);
  }
  for (const j of r.journal ?? []) { const [e, w] = j.split(":"); s.journal ??= {}; const seen = (s.journal[e] ??= []); if (!seen.includes(w)) seen.push(w); }
  log(s, `Kadim eşya: ${r.name}.`, "quest");
  return r;
}
