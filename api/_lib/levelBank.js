// The quick level test: 12 multiple-choice questions from A1 to C1.
// The correct answer index lives only on the server. The browser receives
// questions without the `answer` field (see /api/level/questions.js).
export const LEVEL_BANK = [
  { level: 'A1', q: 'Ich ___ aus Tunesien.', options: ['bin', 'bist', 'ist', 'sind'], answer: 0 },
  { level: 'A1', q: 'Wie ___ du?', options: ['heißen', 'heißt', 'heiße', 'heiß'], answer: 1 },
  { level: 'A1', q: 'Das ist ___ Hund.', options: ['ein', 'eine', 'einer', 'eines'], answer: 0 },
  { level: 'A2', q: 'Gestern ___ ich im Kino.', options: ['bin', 'habe', 'war', 'hatte'], answer: 2 },
  { level: 'A2', q: 'Ich kann leider nicht ___.', options: ['kommen', 'komme', 'kam', 'gekommen'], answer: 0 },
  { level: 'A2', q: 'Wir fahren ___ den Strand.', options: ['in', 'an', 'auf', 'zu'], answer: 1 },
  { level: 'B1', q: 'Wenn ich Zeit ___, lese ich.', options: ['hätte', 'habe', 'hatte', 'haben'], answer: 1 },
  { level: 'B1', q: 'Ich freue mich ___ das Geschenk.', options: ['auf', 'für', 'über', 'an'], answer: 2 },
  { level: 'B1', q: 'Das Auto, ___ ich gekauft habe, ist schnell.', options: ['der', 'die', 'das', 'dem'], answer: 2 },
  { level: 'B2', q: 'Es ist wichtig, dass man pünktlich ___.', options: ['ist', 'sei', 'wäre', 'erscheint'], answer: 3 },
  { level: 'B2', q: 'Trotz ___ schlechten Wetters gehen wir raus.', options: ['dem', 'das', 'den', 'des'], answer: 3 },
  { level: 'C1', q: 'Er behauptet, das Buch bereits ___ zu haben.', options: ['lesen', 'gelesen', 'las', 'liest'], answer: 1 },
];
