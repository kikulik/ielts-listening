/* IELTS Listening Practice: the home screen (settings, progress, the 30 tests) and the
   screen before a test starts (what is in it, how long it takes, sound check). */
(function (IL) {
  const $ = IL.$;
  let catalog = [], pickersReady = false;
  const band = b => Number(b).toFixed(1);
  const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const check = new Audio();
  check.preload = 'none';

  function hints() {
    $('#mode-hint').textContent = IL.MODES[IL.prefs.get('mode')].hint;
    $('#review-hint').textContent = IL.REVIEWS[IL.prefs.get('review')].hint;
  }

  function pickers() {
    if (pickersReady) return;
    pickersReady = true;
    IL.picker({
      el: '#mode-pick', name: 'mode', selected: IL.prefs.get('mode'),
      options: Object.entries(IL.MODES).map(([k, m]) => [k, m.name]),
      onChange: v => { IL.prefs.set('mode', v); hints(); }
    });
    IL.picker({
      el: '#review-pick', name: 'review', selected: IL.prefs.get('review'),
      options: Object.entries(IL.REVIEWS).map(([k, m]) => [k, m.name]),
      onChange: v => { IL.prefs.set('review', Number(v)); hints(); }
    });
    hints();
  }

  function stats() {
    const h = IL.history.all();
    const done = catalog.filter(t => (h[t.id] || []).length);
    if (!done.length) { $('#stats').innerHTML = ''; return; }
    const latest = done.map(t => h[t.id][h[t.id].length - 1].band);
    const avg = Math.round((latest.reduce((a, b) => a + b, 0) / latest.length) * 2) / 2;
    const best = Math.max(...done.map(t => IL.history.best(t.id).band));
    $('#stats').innerHTML = [[`${done.length} of ${catalog.length}`, 'tests taken'], [band(avg), 'average band, latest tries'], [band(best), 'best band']]
      .map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  }

  function card(t) {
    const best = IL.history.best(t.id);
    const badge = best ? `<span class="badge done">Band ${band(best.band)} · ${best.raw}/40</span>` : `<span class="badge">${t.minutes} min</span>`;
    const topics = t.topics.map((tp, i) => `<li><i>${i + 1}</i>${IL.esc(tp)}</li>`).join('');
    return `<li><button class="test" type="button" data-test="${t.id}"><span class="test-head"><b>Test ${t.id}</b>${badge}</span><ol>${topics}</ol></button></li>`;
  }

  function show() {
    check.pause();
    pickers();
    stats();
    $('#test-list').innerHTML = catalog.map(card).join('');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    IL.show('home');
  }

  function render(list) { catalog = list; show(); }

  /* Length of the whole test as the candidate experiences it, check time included. */
  function minutes(test, durations) {
    const sec = IL.timeline.steps(test).reduce((t, s) => t + (s.kind === 'audio' ? ((durations[s.name] || {}).sec || 0) : s.sec), 0);
    return Math.round(sec / 60 + IL.prefs.get('review'));
  }

  function fillIntro(test, durations) {
    $('#intro-parts').innerHTML = test.parts.map(p => {
      const [a, b] = IL.questions.partRange(p);
      return `<li><b>Part ${p.n}</b><span>${IL.esc(p.topic)} <span class="hint">· questions ${IL.span(a, b)}</span></span></li>`;
    }).join('');
    const mode = IL.MODES[IL.prefs.get('mode')];
    $('#intro-time').textContent = `About ${minutes(test, durations)} minutes, including ${IL.REVIEWS[IL.prefs.get('review')].name} to check your answers at the end.`;
    $('#intro-mode').textContent = `${mode.name} mode. ${mode.hint}`;
    const past = IL.history.of(test.id);
    const last = past[past.length - 1];
    $('#intro-best').textContent = last ? `Last time: band ${band(last.band)} (${last.raw}/40) on ${day(last.at)}.` : '';
    $('#start').disabled = false;
    $('#start').onclick = () => { check.pause(); IL.exam.start(test, durations); };
    new Audio(IL.audioUrl(test.id, 'p1-0')).preload = 'auto';
  }

  async function intro(id) {
    check.pause();
    IL.show('intro');
    history.replaceState(null, '', `#test-${id}`);
    $('#intro-title').textContent = `Test ${id}`;
    $('#intro-parts').innerHTML = '';
    $('#intro-time').textContent = 'Loading…';
    $('#intro-best').textContent = '';
    $('#start').disabled = true;
    try {
      const [test, durations] = await Promise.all([IL.getJSON(`data/tests/${IL.pad(id)}.json`), IL.getJSON(`audio/${IL.pad(id)}/index.json`)]);
      fillIntro(test, durations);
    } catch (e) {
      $('#intro-time').textContent = 'This test could not be loaded. Check the internet connection and try again.';
    }
  }

  $('#intro-volume').value = IL.prefs.get('volume');
  $('#intro-volume').oninput = e => { const v = Number(e.target.value); check.volume = v; IL.prefs.set('volume', v); };
  $('#sound-check').onclick = () => {
    check.src = IL.audioUrl(0, 'check');
    check.volume = IL.prefs.get('volume');
    check.currentTime = 0;
    check.play().catch(() => {});
  };

  IL.home = { render, show, intro };
})(window.IL);
