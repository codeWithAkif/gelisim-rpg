// Editörde karşılığı olmayan ek beceriler; config'e buradan eklenir.
import type { Attribute } from "../engine/config";

export const EXTRA_ATTRS: Attribute[] = [
  { id: "ilk_yardim", name: "İlk yardım", cat: "bilgi", base: 3, max: 100, learnRate: 1, diminish: 1, decayRate: 0.02, decayFloor: 60,
    desc: "Yara sarmayı bilmek. Sargı bezi ve merhem daha çok can verir, uykuda yaralar daha çabuk kapanır. Yara sararak gelişir.",
    transfers: [{ to: "anatomi_insan", w: 0.15 }], derivedTerms: [] },
];
