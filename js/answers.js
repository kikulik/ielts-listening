/* IELTS Listening: how a typed answer is compared with the answer key. Shared by the page and the checker.
   Marking follows the real test: spelling must be right, capitals do not matter, and the
   answer must keep to the word limit. Small writing differences that IELTS accepts are folded
   together: 9:30 = 9.30, 9.30 a.m. = 9.30am, 1,500 = 1500, part-time = part time, £45 = 45. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.IL = root.IL || {}).answers = api;
})(typeof self !== 'undefined' ? self : globalThis, () => {
  /* Spelling-level clean-up that keeps word boundaries (used for counting words). */
  const tidy = s => String(s ?? '')
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”"]/g, '')
    .replace(/[£$€]/g, '')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d):(\d\d)/g, '$1.$2')
    .replace(/\b([ap])\.\s?m\b\.?/g, '$1m')
    .replace(/(\d)\s+([ap]m)\b/g, '$1$2')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '')
    .trim();

  /* Full comparison form: hyphens and dashes count as spaces. */
  const normalize = s => tidy(s).replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();

  /* "(the) harbour" accepts both "the harbour" and "harbour". */
  function expand(answer) {
    let outs = [''];
    for (const piece of String(answer).split(/(\([^)]*\))/)) {
      if (/^\(.*\)$/.test(piece)) {
        const word = piece.slice(1, -1);
        outs = outs.flatMap(o => [o, `${o}${word}`]);
      } else {
        outs = outs.map(o => o + piece);
      }
    }
    return [...new Set(outs.map(normalize))].filter(Boolean);
  }

  const accepted = alts => new Set([].concat(alts).flatMap(expand));
  const isRight = (given, alts) => {
    const g = normalize(given);
    return g !== '' && accepted(alts).has(g);
  };

  /* "NO MORE THAN TWO WORDS AND/OR A NUMBER" -> { words: 2, number: true } */
  const COUNT = { ONE: 1, TWO: 2, THREE: 3 };
  function parseLimit(limit) {
    const m = /^(?:NO MORE THAN )?(ONE|TWO|THREE) WORDS?( ONLY)?( AND\/OR A NUMBER)?$/.exec(String(limit || ''));
    return m ? { words: COUNT[m[1]], number: Boolean(m[3]) } : null;
  }
  const LIMITS = [
    'ONE WORD ONLY', 'ONE WORD AND/OR A NUMBER',
    'NO MORE THAN TWO WORDS', 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
    'NO MORE THAN THREE WORDS', 'NO MORE THAN THREE WORDS AND/OR A NUMBER'
  ];

  /* Words and numbers in an answer. A hyphenated word is one word; "9.30am" or "£45" is one number. */
  function count(answer) {
    const tokens = tidy(answer).split(' ').filter(Boolean);
    const numbers = tokens.filter(t => /\d/.test(t)).length;
    return { words: tokens.length - numbers, numbers };
  }
  function fits(answer, limit) {
    const L = parseLimit(limit);
    if (!L) return false;
    const c = count(answer);
    return L.number ? c.words <= L.words && c.numbers <= 1 : c.words + c.numbers <= L.words;
  }

  /* Letters for options: 0 -> "A". */
  const letter = i => String.fromCharCode(65 + i);

  return { tidy, normalize, expand, accepted, isRight, parseLimit, LIMITS, count, fits, letter };
});
