// Büyülerin görsel kuralı, her savaş sahnesinde aynı (altıgen savaş, barikat, nöbet, harabe).
// Şimşek: ZİNCİR kahramanın elinden çıkar, hedeften hedefe atlar; YILDIRIM üstten aşağı düşer.
// Tek kural burada; sahneler yalnız bu kurala göre çizer. Yeni büyü eklerken önce buraya bak.
import type { Config } from "./config";
import { baseElements } from "./magic";
import { spellSequence } from "./synthesis";

export type BoltStyle = "chain" | "sky";
/** Şimşek içeren her büyü ya zincirdir (elden, hedeften hedefe) ya yıldırımdır (üstten aşağı).
 * Zincir biçimli olanlar zincir; duvar biçimi yere çizilen şerit olarak kalır (çizgi, bolt değil); geri kalan her şey
 * (top, akıntı, perde, yağmur) ve adı Yıldırım fırtınası olan hedefin üstüne düşer. Şimşeksizse null. */
export function boltStyle(cfg: Config, id: string): BoltStyle | null {
  const sp = cfg.spell.get(id); if (!sp) return null;
  if (!sp.sources.some(x => baseElements(cfg, x.id).includes("el_simsek"))) return null;
  if (id.includes("yildirim") || id.includes("firtina")) return "sky";
  const form = spellSequence(id)?.form;
  if (form === "zincir") return "chain";
  if (form === "duvar") return null;
  return "sky";
}
