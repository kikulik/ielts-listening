/* IELTS Listening: the running order of a test as the candidate hears it, shared by the page
   (which plays it) and the audio builder (which records the narrator's words).
   Each part: introduction -> time to read -> section 1 -> time to read -> section 2 -> time to check.
   Part 4 has one section. The pauses are not in the audio files; the page times them. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.IL = root.IL || {}).timeline = api;
})(typeof self !== 'undefined' ? self : globalThis, () => {
  const READ_S = { 1: 30, 2: 30, 3: 30, 4: 45 };
  const CHECK_S = 30;
  const KIND = { 1: 'conversation', 2: 'talk', 3: 'conversation', 4: 'lecture' };
  const qs = s => `questions ${s.from} to ${s.to}`;
  const dash = s => `${s.from}–${s.to}`;

  function partSteps(p) {
    const kind = p.kind || KIND[p.n];
    const secs = p.sections;
    const out = [];
    const intro = [];
    if (p.n > 1) intro.push(`Now turn to Part ${p.n}.`);
    intro.push(`Part ${p.n}. You will hear ${p.context}.`, `First, you have some time to look at ${qs(secs[0])}.`);
    out.push({ kind: 'audio', name: `p${p.n}-0`, part: p.n, say: intro });
    out.push({ kind: 'wait', sec: READ_S[p.n], part: p.n, what: `Read questions ${dash(secs[0])}` });
    secs.forEach((sec, i) => {
      const next = secs[i + 1];
      const pre = [`${i ? 'Now listen and answer' : 'Now listen carefully and answer'} ${qs(sec)}.`];
      const post = next
        ? [`Before you hear the rest of the ${kind}, you have some time to look at ${qs(next)}.`]
        : [p.n < 4 ? `That is the end of Part ${p.n}. You now have half a minute to check your answers.` : 'That is the end of Part 4. That is the end of the listening test.'];
      out.push({ kind: 'audio', name: `p${p.n}-${i + 1}`, part: p.n, section: i, pre, post });
      if (next) out.push({ kind: 'wait', sec: 30, part: p.n, what: `Read questions ${dash(next)}` });
      else if (p.n < 4) out.push({ kind: 'wait', sec: CHECK_S, part: p.n, what: `Check your answers to Part ${p.n}` });
    });
    return out;
  }

  const steps = test => test.parts.flatMap(partSteps);

  return { READ_S, CHECK_S, steps };
});
