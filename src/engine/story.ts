// Hikâye ilerleyişi: kilometre taşları koşulları sağlanınca açılır ve etkilerini uygular.
import type { GameState } from "./state";
import { log } from "./state";
import { CHAPTERS, type Milestone, type Chapter } from "../content/story";

/** Yeni ulaşılan kilometre taşlarını işler; zincirleme açılanlar dahil. */
export function advanceStory(s: GameState): Milestone[] {
  const out: Milestone[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const ch of CHAPTERS) for (const m of ch.milestones) {
      if (s.story.reached.includes(m.id) || !m.reached(s)) continue;
      s.story.reached.push(m.id);
      const e = m.effects;
      if (e?.learnElement && !s.knownElements.includes(e.learnElement)) s.knownElements.push(e.learnElement);
      if (e?.items) for (const [k, n] of Object.entries(e.items)) s.inventory[k] = (s.inventory[k] ?? 0) + n;
      if (e?.flag) s.story.flags[e.flag] = s.day;
      log(s, `Yeni sayfa: ${m.title}`, "quest");
      out.push(m); changed = true;
    }
  }
  return out;
}

export function currentChapter(s: GameState): Chapter {
  return CHAPTERS.find(c => !c.soon && c.milestones.some(m => !s.story.reached.includes(m.id))) ?? CHAPTERS.find(c => c.soon) ?? CHAPTERS[0];
}
export function nextMilestone(s: GameState): Milestone | undefined {
  for (const c of CHAPTERS) for (const m of c.milestones) if (!s.story.reached.includes(m.id)) return m;
  return undefined;
}
