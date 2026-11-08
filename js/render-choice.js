/* IELTS Listening Practice: choice tasks. Multiple choice, choose two, matching, and map labelling. */
(function (IL) {
  const L = IL.answers.letter;
  const qn = q => `<b class="qn">${q}</b>`;

  const choice = (type, name, value, text, data) =>
    `<label class="choice"><input type="${type}" name="${name}" value="${value}" ${data}><b>${value}</b><span>${IL.esc(text)}</span></label>`;

  function mcq(g) {
    return g.items.map(it => `<div class="item" id="q-${it.q}"><p class="item-q">${qn(it.q)}<span>${IL.esc(it.stem)}</span></p>` +
      `<div class="choices" role="radiogroup" aria-label="Question ${it.q}">` +
      `${it.options.map((o, i) => choice('radio', `q${it.q}`, L(i), o, `data-q="${it.q}"`)).join('')}</div></div>`).join('');
  }

  /* "Choose TWO letters": the anchors let the navigator jump to either question number. */
  function multi(g) {
    const max = g.to - g.from + 1;
    const anchors = IL.score.range(g.from, g.to).map(q => `<span id="q-${q}"></span>`).join('');
    return `<div class="item">${anchors}<p class="item-q">${qn(IL.span(g.from, g.to))}<span>${IL.esc(g.stem)}</span></p>` +
      `<div class="choices" role="group" aria-label="Questions ${g.from} to ${g.to}">` +
      `${g.options.map((o, i) => choice('checkbox', `m${g.from}`, L(i), o, `data-multi="${g.from}" data-max="${max}"`)).join('')}</div></div>`;
  }

  /* Rows of questions against letter buttons: one click per answer. */
  function grid(items, letters) {
    const rows = items.map(it => `<tr id="q-${it.q}"><td>${qn(it.q)}<span>${IL.esc(it.text)}</span></td>` +
      letters.map(l => `<td><label><input type="radio" name="q${it.q}" value="${l}" data-q="${it.q}" aria-label="Question ${it.q}: ${l}">${l}</label></td>`).join('') +
      '</tr>').join('');
    return `<div class="grid-wrap"><table class="mgrid"><tbody>${rows}</tbody></table></div>`;
  }

  const match = g => IL.renderGap.optionBox(g.options, g.boxTitle) + grid(g.items, g.options.map((_, i) => L(i)));
  const map = g => `${g.title ? `<p class="task-title">${IL.esc(g.title)}</p>` : ''}${IL.map.svg(g.map, g.title)}${grid(g.items, IL.map.letters(g.map))}`;

  IL.renderChoice = { mcq, multi, match, map };
})(window.IL);
