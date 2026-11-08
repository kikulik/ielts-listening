/* IELTS Listening Practice: transcripts on the result screen, with each answer highlighted
   where it is heard, and a player for every section so it can be heard again. */
(function (IL) {
  const { split, MARK } = IL.markup;

  function lineHtml(text, seen) {
    return split(text, MARK).map(p => {
      if (typeof p === 'string') return IL.esc(p);
      const id = seen.has(p.n) ? '' : ` id="t-${p.n}"`;
      seen.add(p.n);
      return `<mark class="ans"${id} data-q="${p.n}">${IL.esc(p.text)}<sup>${p.n}</sup></mark>`;
    }).join('');
  }

  function sectionHtml(test, part, sec, i, seen) {
    const src = IL.audioUrl(test.id, `p${part.n}-${i + 1}`);
    const turns = sec.lines.map(([who, text]) =>
      `<p class="turn"><span class="who">${IL.esc(part.speakers[who].name)}</span><span>${lineHtml(text, seen)}</span></p>`).join('');
    return `<div class="sec"><div class="sec-head"><b>Questions ${IL.span(sec.from, sec.to)}</b>` +
      `<audio controls preload="none" src="${src}"></audio></div>${turns}</div>`;
  }

  function html(test) {
    const seen = new Set();
    return test.parts.map(p => `<details class="transcript" data-part="${p.n}"><summary>Part ${p.n}: ${IL.esc(p.topic)}</summary>` +
      `${p.sections.map((s, i) => sectionHtml(test, p, s, i, seen)).join('')}</details>`).join('');
  }

  /* Opens the right part and shows where question q is answered. */
  function reveal(q) {
    const m = document.getElementById(`t-${q}`);
    if (!m) return;
    m.closest('details').open = true;
    IL.$$('mark.ans.focus').forEach(x => x.classList.remove('focus'));
    m.classList.add('focus');
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* Only one section plays at a time. */
  document.addEventListener('play', e => {
    IL.$$('#r-transcripts audio').forEach(a => { if (a !== e.target) a.pause(); });
  }, true);

  IL.transcript = { html, reveal };
})(window.IL);
