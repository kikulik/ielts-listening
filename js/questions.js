/* IELTS Listening Practice: the question paper. Draws all four parts with the standard IELTS
   instructions, and keeps the candidate's answers in a responses object as they type or click. */
(function (IL) {
  const L = IL.answers.letter;
  const NOUN = { form: 'form', notes: 'notes', table: 'table', flow: 'flow-chart', summary: 'summary' };
  const letterList = k => (k === 3 ? 'A, B or C' : k === 4 ? 'A, B, C or D' : `A–${L(k - 1)}`);
  const fromBox = (n, k, range) => `Choose <b>${IL.count(n)}</b> answers from the box, <b>A–${L(k - 1)}</b>, for questions ${range}.`;

  /* The instruction lines above a group, worded as in the exam. */
  function instruction(g) {
    const n = g.to - g.from + 1, range = IL.span(g.from, g.to);
    if (g.type === 'gap') {
      const what = g.layout === 'sentences' ? 'Complete the sentences below.' : `Complete the ${NOUN[g.layout]} below.`;
      return [what, g.options ? fromBox(n, g.options.length, range) : `Write <b>${IL.esc(g.limit)}</b> for each answer.`];
    }
    if (g.type === 'mcq') return [`Choose the correct letter, <b>${letterList(Math.max(...g.items.map(i => i.options.length)))}</b>.`];
    if (g.type === 'multi') return [`Choose <b>${IL.count(n)}</b> letters, <b>A–${L(g.options.length - 1)}</b>.`];
    if (g.type === 'match') {
      const k = g.options.length;
      const how = k < g.items.length
        ? `Choose the correct letter, <b>${letterList(k)}</b>, for questions ${range}. You may choose any letter more than once.`
        : fromBox(n, k, range);
      return [IL.esc(g.lead), how];
    }
    const last = IL.map.letters(g.map).slice(-1)[0];
    return [`Label the ${g.kind === 'plan' ? 'plan' : 'map'} below.`, `Choose the correct letter, <b>A–${last}</b>, for questions ${range}.`];
  }

  function group(g) {
    const body = g.type === 'gap' ? IL.renderGap.render(g) : IL.renderChoice[g.type](g);
    const lines = instruction(g).map(l => `<p>${l}</p>`).join('');
    return `<section class="group"><div class="group-head"><h3>Questions ${IL.span(g.from, g.to)}</h3>${lines}</div>${body}</section>`;
  }

  const partRange = p => [p.groups[0].from, p.groups[p.groups.length - 1].to];
  function part(p) {
    const [a, b] = partRange(p);
    return `<section class="part" data-part="${p.n}" hidden><header class="part-head"><h2>Part ${p.n}</h2>` +
      `<p>Questions ${IL.span(a, b)}</p></header>${p.groups.map(group).join('')}</section>`;
  }
  const render = test => test.parts.map(part).join('');

  /* "Choose TWO": picked letters fill the group's questions in order; no more than allowed can be ticked. */
  function pickMulti(root, el, responses) {
    const from = Number(el.dataset.multi), max = Number(el.dataset.max);
    const boxes = IL.$$(`input[data-multi="${from}"]`, root);
    const picked = boxes.filter(b => b.checked).map(b => b.value).sort();
    boxes.forEach(b => { b.disabled = !b.checked && picked.length >= max; });
    const qs = IL.score.range(from, from + max - 1);
    qs.forEach((q, i) => { responses[q] = picked[i] || ''; });
    return qs;
  }

  function update(root, el, responses) {
    if (el.dataset.multi) return pickMulti(root, el, responses);
    if (el.type === 'radio' && !el.checked) return [];
    const q = Number(el.dataset.q);
    responses[q] = el.value.trim();
    const gap = el.closest('.gap');
    if (gap) gap.classList.toggle('answered', responses[q] !== '');
    return [q];
  }

  /* onChange(questionNumbers) runs after every answer. */
  function bind(root, responses, onChange) {
    root.oninput = e => { if (e.target.matches('input[type=text]')) onChange(update(root, e.target, responses)); };
    root.onchange = e => { if (e.target.matches('select, input[type=radio], input[type=checkbox]')) onChange(update(root, e.target, responses)); };
  }

  IL.questions = { render, bind, instruction, partRange };
})(window.IL);
