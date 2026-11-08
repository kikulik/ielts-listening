/* IELTS Listening: turns a test into its 40 questions, marks a set of answers and gives the band.
   Shared by the page (results screen) and the checker (every answer key must score 40/40). */
(function (root, make) {
  const isNode = typeof module === 'object' && module.exports;
  const api = make(isNode ? require('./answers.js') : root.IL.answers);
  if (isNode) module.exports = api;
  else root.IL.score = api;
})(typeof self !== 'undefined' ? self : globalThis, A => {
  /* Raw score out of 40 -> band. The usual Listening conversion; the official table moves by a mark or so between test versions. */
  const BANDS = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
    [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]];
  const band = raw => BANDS.find(([min]) => raw >= min)[1];

  const KINDS = {
    form: 'Form completion', notes: 'Note completion', table: 'Table completion', flow: 'Flow-chart completion',
    sentences: 'Sentence completion', summary: 'Summary completion',
    mcq: 'Multiple choice', multi: 'Choose two (or three)', match: 'Matching', map: 'Map and plan labelling'
  };
  const kindOf = g => (g.type === 'gap' ? g.layout : g.type);
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  /* The 40 questions in order: { q, part, kind, group, answer }. answer is a list of accepted
     texts (typed answers) or one letter; for "choose two" it is the group's set of letters. */
  function questions(test) {
    const out = [];
    test.parts.forEach(part => part.groups.forEach(g => {
      const kind = kindOf(g);
      const base = { part: part.n, kind, group: g };
      if (g.type === 'gap') range(g.from, g.to).forEach(q => out.push({ ...base, q, answer: [].concat(g.answers[q]) }));
      else if (g.type === 'multi') range(g.from, g.to).forEach(q => out.push({ ...base, q, answer: g.answer }));
      else g.items.forEach(it => out.push({ ...base, q: it.q, answer: [it.answer] }));
    }));
    return out.sort((a, b) => a.q - b.q);
  }

  /* Choose-two groups: each correct letter picked is one mark, in any order. */
  function markMulti(qs, responses) {
    const want = qs[0].answer;
    const picked = qs.map(x => String(responses[x.q] || '').toUpperCase());
    const missing = want.filter(l => !picked.includes(l));
    const seen = new Set();
    return qs.map((x, i) => {
      const l = picked[i];
      const right = Boolean(l) && want.includes(l) && !seen.has(l);
      if (right) seen.add(l);
      const expected = right ? l : missing.shift() || want.join(' / ');
      return { q: x.q, given: l, right, expected, any: want.join(', ') };
    });
  }

  function markOne(x, responses) {
    const given = String(responses[x.q] ?? '').trim();
    if (x.group.type === 'gap' && !x.group.options) {
      return { q: x.q, given, right: A.isRight(given, x.answer), expected: x.answer[0], also: x.answer.slice(1) };
    }
    return { q: x.q, given: given.toUpperCase(), right: given.toUpperCase() === x.answer[0], expected: x.answer[0] };
  }

  /* responses: { "1": "Harrington", "11": "B", ... } -> marks for every question plus totals. */
  function mark(test, responses) {
    const qs = questions(test), rows = [], done = new Set();
    for (const x of qs) {
      if (done.has(x.q)) continue;
      if (x.group.type === 'multi') {
        const set = qs.filter(y => y.group === x.group);
        set.forEach(y => done.add(y.q));
        rows.push(...markMulti(set, responses).map((r, i) => ({ ...r, part: x.part, kind: x.kind, group: set[i].group })));
      } else {
        done.add(x.q);
        rows.push({ ...markOne(x, responses), part: x.part, kind: x.kind, group: x.group });
      }
    }
    const raw = rows.filter(r => r.right).length;
    const tally = key => rows.reduce((m, r) => {
      const t = m[r[key]] || (m[r[key]] = { right: 0, total: 0 });
      t.total += 1; t.right += r.right ? 1 : 0;
      return m;
    }, {});
    return { raw, band: band(raw), rows, byPart: tally('part'), byKind: tally('kind') };
  }

  /* The answer key as responses: used by the checker to prove the key scores 40/40. */
  function keyResponses(test) {
    const res = {};
    for (const x of questions(test)) {
      if (x.group.type === 'multi') {
        const qs = range(x.group.from, x.group.to);
        res[x.q] = x.group.answer[qs.indexOf(x.q)];
      } else {
        res[x.q] = x.answer[0];
      }
    }
    return res;
  }

  return { BANDS, band, KINDS, kindOf, range, questions, mark, keyResponses };
});
