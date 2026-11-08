/* IELTS Listening Practice: the exam screen. Runs the recording, moves to each new part as it
   starts, keeps the question navigator up to date, times the final check and marks the test. */
(function (IL) {
  const $ = IL.$;
  const CONFIRM_MS = 4000;
  let S = null;

  const partQs = p => IL.score.range(...IL.questions.partRange(p));
  const guard = e => { e.preventDefault(); e.returnValue = ''; };

  function navHtml(test) {
    const parts = test.parts.map(p => `<div class="navpart" data-part="${p.n}">` +
      `<button type="button" data-goto-part="${p.n}" data-count="">Part ${p.n}</button>` +
      `<span class="nums">${partQs(p).map(q => `<button type="button" data-goto="${q}" aria-label="Question ${q}">${q}</button>`).join('')}</span></div>`);
    return `${parts.join('')}<div class="finish"><button id="submit" class="btn" type="button">Submit answers</button></div>`;
  }

  function refreshNav() {
    IL.$$('#qnav [data-goto]').forEach(b => b.classList.toggle('done', Boolean(S.responses[b.dataset.goto])));
    S.test.parts.forEach(p => {
      const qs = partQs(p);
      $(`#qnav [data-goto-part="${p.n}"]`).dataset.count = `${qs.filter(q => S.responses[q]).length}/${qs.length}`;
    });
  }

  function showPart(n) {
    S.part = n;
    IL.$$('#paper .part').forEach(s => { s.hidden = Number(s.dataset.part) !== n; });
    IL.$$('#qnav .navpart').forEach(d => d.classList.toggle('on', Number(d.dataset.part) === n));
    IL.console.part(n);
  }

  function goTo(q) {
    const p = S.test.parts.find(pp => partQs(pp).includes(q));
    if (p) showPart(p.n);
    const anchor = document.getElementById(`q-${q}`);
    if (!anchor) return;
    const host = anchor.closest('.item, .gap, tr') || anchor;
    host.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const input = host.querySelector('input:not(:disabled), select');
    if (input) input.focus({ preventScroll: true });
    const badge = host.querySelector('.qn');
    if (badge) { badge.classList.remove('target'); void badge.offsetWidth; badge.classList.add('target'); }
  }

  function alert(msg, label, action) {
    const box = $('#alert');
    box.innerHTML = '<span></span><button class="btn" type="button"></button>';
    box.firstChild.textContent = msg;
    box.lastChild.textContent = label;
    box.lastChild.onclick = () => { box.hidden = true; action(); };
    box.hidden = false;
  }

  function onStep(step) {
    if (step.kind === 'audio' && step.say) { showPart(step.part); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  function startReview() {
    const ends = Date.now() + IL.prefs.get('review') * 60000;
    S.reviewing = true;
    const beat = () => {
      const left = (ends - Date.now()) / 1000;
      if (left <= 0) { submit(); return; }
      IL.console.review(left);
    };
    S.reviewBeat = setInterval(beat, 250);
    beat();
  }

  function submit() {
    if (!S || S.over) return;
    S.over = true;
    S.player.stop();
    clearInterval(S.reviewBeat);
    window.removeEventListener('beforeunload', guard);
    const res = IL.score.mark(S.test, S.responses);
    IL.history.add(S.test.id, { at: new Date().toISOString(), raw: res.raw, band: res.band, mode: S.mode });
    IL.results.show(S.test, res);
  }

  /* While the recording is still playing, submitting needs a second click. */
  function askSubmit(btn) {
    if (S.reviewing || S.confirm) { submit(); return; }
    btn.textContent = 'Submit now? Click again';
    S.confirm = setTimeout(() => { S.confirm = 0; btn.textContent = 'Submit answers'; }, CONFIRM_MS);
  }

  const handlers = () => ({
    volume: v => { S.player.setVolume(v); IL.prefs.set('volume', v); },
    togglePause: () => (S.player.isPaused() ? S.player.resume() : S.player.pause()),
    back: () => S.player.back(10),
    skip: () => S.player.skip()
  });

  function start(test, durations) {
    const mode = IL.prefs.get('mode');
    S = { test, mode, responses: {}, part: 1, confirm: 0, reviewing: false, over: false };
    $('#paper').innerHTML = IL.questions.render(test);
    IL.questions.bind($('#paper'), S.responses, refreshNav);
    $('#qnav').innerHTML = navHtml(test);
    $('#alert').hidden = true;
    IL.show('exam');
    IL.console.init(test, mode, handlers());
    showPart(1);
    refreshNav();
    S.player = IL.player.create({
      test, durations, volume: IL.prefs.get('volume'),
      on: { step: onStep, tick: IL.console.tick, end: startReview, error: (msg, retry) => alert(msg, 'Try again', retry) }
    });
    window.addEventListener('beforeunload', guard);
    S.player.start();
  }

  document.addEventListener('click', e => {
    if (!S || S.over) return;
    const t = e.target.closest('#qnav button');
    if (!t) return;
    if (t.id === 'submit') askSubmit(t);
    else if (t.dataset.goto) goTo(Number(t.dataset.goto));
    else if (t.dataset.gotoPart) { showPart(Number(t.dataset.gotoPart)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  IL.exam = { start };
})(window.IL);
