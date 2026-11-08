/* IELTS Listening: the two small markups used in test files. Shared by the page and the build tools.
   In a transcript line, [[7|on Wednesday]] marks where the answer to question 7 is heard.
   The audio speaks only the words ("on Wednesday"); the review screen highlights them.
   In question text, {7} is the answer box for question 7. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.IL = root.IL || {}).markup = api;
})(typeof self !== 'undefined' ? self : globalThis, () => {
  const MARK = /\[\[(\d{1,2})\|([^[\]|]+)\]\]/g;
  const GAP = /\{(\d{1,2})\}/g;

  /* The words as spoken, without markers. */
  const plain = text => String(text).replace(MARK, '$2');
  /* Every marker in a line: [{ q, text, at }]. */
  const marks = text => [...String(text).matchAll(MARK)].map(m => ({ q: +m[1], text: m[2], at: m.index }));
  /* Question numbers of the answer boxes in a piece of question text. */
  const gaps = text => [...String(text).matchAll(GAP)].map(m => +m[1]);

  /* Splits text into plain strings and { n, text } pieces for drawing. */
  function split(text, re) {
    const out = [], s = String(text);
    let last = 0;
    for (const m of s.matchAll(re)) {
      if (m.index > last) out.push(s.slice(last, m.index));
      out.push({ n: +m[1], text: m[2] ?? '' });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  }

  return { MARK, GAP, plain, marks, gaps, split };
});
