/* IELTS Listening Practice: the result screen. Band, marks by part and question type, a tip for
   the weakest type, every answer against the key, and the transcripts. */
(function (IL) {
  const $ = IL.$;
  const MESSAGES = [
    [8, 'Excellent. That is expert-level listening.'],
    [7, 'Very good. You are catching nearly everything, distractors included.'],
    [6, 'Good. A few more marks in Parts 3 and 4 will lift your band.'],
    [5, 'A fair start. Listen again to the sections where you lost marks and read along.'],
    [0, 'Keep going. Try practice mode, pause after each answer, and read the transcript afterwards.']
  ];
  const TIPS = {
    form: 'Form completion: before each section, decide what each gap needs: a number, a name, a day? Names are spelled out, so write each letter as you hear it.',
    notes: 'Note completion: read the notes ahead of the speaker and listen for the words around each gap, which are often paraphrased. Check spelling and plurals.',
    table: 'Table completion: read across the rows and down the columns first, so you know what is missing in each cell.',
    flow: 'Flow-charts follow the order of a process. Listen for sequence words: first, then, after that, finally.',
    sentences: 'Sentence completion: the answer must fit the grammar of the sentence and keep to the word limit.',
    summary: 'Summary completion: read the whole summary first and predict the kind of word for each gap.',
    mcq: 'Multiple choice: usually every option is mentioned. Listen for the one that answers the exact question, and for words like “but”, “actually” and “in the end”.',
    multi: 'Choose two: cross out options as the speakers reject them. Each right letter is a mark, so always choose two.',
    match: 'Matching: read the box first and think of other ways to say each option. The speakers rarely use the same words.',
    map: 'Maps and plans: find the entrance or “You are here” first, then follow the speaker’s route: left, right, opposite, past, next to.'
  };
  const share = t => (t.total ? t.right / t.total : 0);

  const barHtml = (label, t) => `<div class="bar"><span>${IL.esc(label)}</span>` +
    `<div class="track"><i class="${share(t) < 0.5 ? 'low' : ''}" style="width:${share(t) * 100}%"></i></div><b>${t.right}/${t.total}</b></div>`;

  /* The question type with the lowest mark, if it had at least three questions. */
  const weakest = byKind => Object.entries(byKind)
    .filter(([, t]) => t.total >= 3 && t.right < t.total)
    .sort((a, b) => share(a[1]) - share(b[1]))[0];

  /* "C" -> "C · making and repairing sails", so a letter answer makes sense on its own. Map letters stay letters. */
  function optionText(r, letter) {
    const g = r.group;
    if (!letter || g.type === 'map' || (g.type === 'gap' && !g.options)) return letter;
    const opts = g.type === 'mcq' ? g.items.find(it => it.q === r.q).options : g.options;
    const text = opts[letter.charCodeAt(0) - 65];
    return text ? `${letter} · ${text}` : letter;
  }

  function answerRow(r) {
    const cls = r.right ? 'right' : r.given ? 'wrong' : 'wrong blank';
    let note = '';
    if (r.also && r.also.length) note = `<div class="also">also accepted: ${r.also.map(IL.esc).join(', ')}</div>`;
    else if (r.any) note = `<div class="also">in either order: ${IL.esc(r.any)}</div>`;
    return `<tr class="${cls}"><td>${r.q}</td><td class="given">${r.given ? IL.esc(optionText(r, r.given)) : 'no answer'}</td>` +
      `<td>${IL.esc(optionText(r, r.expected))}${note}</td><td class="mark">${r.right ? '✓' : '✗'}<span class="sr">${r.right ? 'right' : 'wrong'}</span></td>` +
      `<td class="where"><button class="link" type="button" data-where="${r.q}">Where?</button></td></tr>`;
  }

  function answersHtml(test, res) {
    const head = '<thead><tr><th scope="col">Q</th><th scope="col">Your answer</th><th scope="col">Answer</th>' +
      '<th scope="col"><span class="sr">Mark</span></th><th scope="col"><span class="sr">In the transcript</span></th></tr></thead>';
    return test.parts.map(p => {
      const rows = res.rows.filter(r => r.part === p.n);
      const right = rows.filter(r => r.right).length;
      return `<table class="answers"><caption>Part ${p.n}: ${IL.esc(p.topic)} · ${right}/${rows.length}</caption>${head}<tbody>${rows.map(answerRow).join('')}</tbody></table>`;
    }).join('');
  }

  function show(test, res) {
    $('#r-test').textContent = `Test ${test.id}`;
    $('#r-band').textContent = res.band.toFixed(1);
    $('#r-raw').textContent = `${res.raw} / 40 correct`;
    $('#r-msg').textContent = MESSAGES.find(([b]) => res.band >= b)[1];
    $('#r-parts').innerHTML = test.parts.map(p => barHtml(`Part ${p.n}`, res.byPart[p.n])).join('');
    $('#r-kinds').innerHTML = Object.entries(res.byKind).map(([k, t]) => barHtml(IL.score.KINDS[k], t)).join('');
    const weak = weakest(res.byKind);
    $('#r-tip').textContent = weak ? TIPS[weak[0]] : '';
    $('#r-answers').innerHTML = answersHtml(test, res);
    $('#r-transcripts').innerHTML = IL.transcript.html(test);
    $('#r-again').onclick = () => IL.home.intro(test.id);
    IL.show('result');
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-where]');
    if (b) IL.transcript.reveal(Number(b.dataset.where));
  });

  IL.results = { show };
})(window.IL);
