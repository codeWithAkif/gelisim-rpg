// Yolda karşına çıkabilecekler. Her olayın koşulu, ağırlığı ve seçenekleri var;
// sonuçları engine/journey.ts uygular.
export interface TravelEventDef {
  id: string; title: string; text: string; weight: number;
  when?: { patika?: boolean; night?: boolean; minMinutes?: number; notIn?: string[] };
  choices: { id: string; label: string; need?: string }[];
}
export const TRAVEL_EVENTS: TravelEventDef[] = [
  { id: "kenevir", title: "Yol kenarında kenevir", weight: 3, text: "Yol kenarında kendiliğinden bitmiş kenevir var. Biraz uğraşırsan ip yapacak kadar lif çıkar.",
    choices: [{ id: "topla", label: "Topla (15 dk)" }, { id: "gec", label: "Geç" }] },
  { id: "elma", title: "Yaban elması", weight: 3, text: "Yamaçta dalları eğilmiş küçük bir yaban elması ağacı.",
    choices: [{ id: "topla", label: "Topla (10 dk)" }, { id: "gec", label: "Geç" }] },
  { id: "bakir", title: "Yerde bakırlar", weight: 2, text: "Toprağın içinde parlayan üç bakır. Birinin kesesinden düşmüş olmalı.",
    choices: [{ id: "al", label: "Cebine koy" }, { id: "teslim", label: "Muhtara götürmek üzere ayır" }] },
  { id: "kurt", title: "Yolu kesen kurt", weight: 2, when: { patika: true }, text: "Çalılığın arasından bir kurt çıktı; dişlerini gösteriyor, yolu kesmiş.",
    choices: [{ id: "savas", label: "Savaş" }, { id: "geri", label: "Gözünü ayırmadan yavaşça geri çekil" }, { id: "ates", label: "Avucunda ateş yak", need: "ates" }] },
  { id: "yasli", title: "Yükü ağır bir yaşlı", weight: 2, text: "Sırtında odun taşıyan yaşlı bir kadın soluklanıyor. Yolu senin gittiğin yöne.",
    choices: [{ id: "yardim", label: "Yükünü taşı (+20 dk)" }, { id: "gec", label: "Selam verip geç" }] },
  { id: "satici", title: "Seyyar satıcı", weight: 1, text: "Eşeğine yüklenmiş heybelerle bir satıcı. Pazardan ucuza mal veriyor.",
    choices: [{ id: "ip", label: "İp al (1 bakır)" }, { id: "deri", label: "Deri al (2 bakır)" }, { id: "gec", label: "Teşekkür et" }] },
  { id: "iz", title: "Taze izler", weight: 2, when: { patika: true }, text: "Çamurda taze pençe izleri; yön değiştirip çalılığa girmişler.",
    choices: [{ id: "incele", label: "Diz çöküp incele (+10 dk)" }, { id: "gec", label: "Geç" }] },
  { id: "saganak", title: "Ani sağanak", weight: 2, when: { minMinutes: 20 }, text: "Bulutlar bir anda kapandı; iri damlalar düşmeye başladı.",
    choices: [{ id: "sigin", label: "Ağacın altına sığın (+20 dk)" }, { id: "devam", label: "Islanarak devam et" }] },
  { id: "tokez", title: "Taşlı yokuş", weight: 2, when: { patika: true }, text: "Yokuş gevşek taşlarla dolu. Bir taş ayağının altından kaydı.",
    choices: [{ id: "devam", label: "Dengeni bul" }] },
];
