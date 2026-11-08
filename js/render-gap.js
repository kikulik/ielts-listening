/* IELTS Listening Practice: completion tasks (form, notes, table, flow-chart, sentences, summary).
   {n} in the question text becomes answer box n: a text box, or a letter list for "choose from the box". */
(function (IL) {
  const { split, GAP } = IL.markup;
  const letters = n => Array.from({ length: n }, (_, i) => IL.answers.letter(i));

  function box(q, g) {
    const name = `Question ${q}`;
    if (g.options) {
      const opts = letters(g.options.length).map(l => `<option value="${l}">${l}</option>`).join('');
      return `<span class="gap" id="q-${q}"><b class="qn">${q}</b><select data-q="${q}" aria-label="${name}"><option value=""></option>${opts}</select></span>`;
    }
    return `<span class="gap" id="q-${q}"><b class="qn">${q}</b><input type="text" data-q="${q}" aria-label="${name}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40"></span>`;
  }

  /* Question text with its {n} gaps turned into answer boxes; everything else is escaped. */
  const fill = (text, g) => split(text, GAP).map(p => (typeof p === 'string' ? IL.esc(p) : box(p.n, g))).join('');

  function formRows(g) {
    return g.rows.map(row => {
      if (row.startsWith('# ')) return `<h4>${fill(row.slice(2), g)}</h4>`;
      const at = row.indexOf(': ');
      if (at > 0 && at < 48) return `<p class="row-label">${fill(row.slice(0, at), g)}</p><p>${fill(row.slice(at + 2), g)}</p>`;
      return `<p class="row-full">${fill(row, g)}</p>`;
    }).join('');
  }

  function noteRows(g) {
    return g.rows.map(row => {
      if (row.startsWith('# ')) return `<h4>${fill(row.slice(2), g)}</h4>`;
      if (row.startsWith('-- ')) return `<p class="b2">${fill(row.slice(3), g)}</p>`;
      if (row.startsWith('- ')) return `<p class="b1">${fill(row.slice(2), g)}</p>`;
      return `<p>${fill(row, g)}</p>`;
    }).join('');
  }

  const cell = (text, g) => String(text).split('\n')
    .map(l => (l.startsWith('- ') ? `• ${fill(l.slice(2), g)}` : fill(l, g))).join('<br>');

  function table(g) {
    const [head, ...rows] = g.table;
    const th = head.map(h => `<th scope="col">${cell(h, g)}</th>`).join('');
    const tr = rows.map(r => `<tr>${r.map(c => `<td>${cell(c, g)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="qtable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }

  const paras = (cls, g) => `<div class="${cls}">${g.rows.map(r => `<p>${fill(r, g)}</p>`).join('')}</div>`;
  const flow = g => `<div class="flow">${g.rows.map(r => `<div class="box">${fill(r, g)}</div>`).join('<div class="arrow" aria-hidden="true"></div>')}</div>`;

  /* The box of words or options for "Choose ... from the box" and matching tasks. */
  const optionBox = (options, title) => `<div class="box-list">${title ? `<p class="box-title">${IL.esc(title)}</p>` : ''}` +
    `${options.map((o, i) => `<p><b>${IL.answers.letter(i)}</b>${IL.esc(o)}</p>`).join('')}</div>`;

  const LAYOUT = {
    form: g => `<div class="form">${formRows(g)}</div>`,
    notes: g => `<div class="notes">${noteRows(g)}</div>`,
    table,
    flow,
    sentences: g => paras('sentences', g),
    summary: g => paras('summary', g)
  };

  function render(g) {
    const title = g.title ? `<p class="task-title">${IL.esc(g.title)}</p>` : '';
    const words = g.options ? optionBox(g.options, g.boxTitle) : '';
    return `${words}${title}${(LAYOUT[g.layout] || LAYOUT.notes)(g)}`;
  }

  IL.renderGap = { render, optionBox };
})(window.IL);
