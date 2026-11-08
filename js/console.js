/* IELTS Listening Practice: the dark status bar above the question paper. What is playing,
   the reading-time countdown, the test clock, the progress bar, volume and practice controls. */
(function (IL) {
  const $ = IL.$;
  let test = null, lastText = '';

  function status(text, cls, count) {
    const el = $('#c-status');
    el.className = `status ${cls}`;
    if (text !== lastText) {
      el.innerHTML = `<i class="dot" aria-hidden="true"></i><span></span><span class="count"></span>`;
      el.children[1].textContent = text;
      lastText = text;
    }
    el.querySelector('.count').textContent = count || '';
  }
  const bar = f => { $('#c-progress').style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; };

  function init(t, mode, h) {
    test = t;
    lastText = '';
    $('#c-test').textContent = `Test ${t.id}`;
    $('#c-controls').hidden = mode !== 'practice';
    $('#c-skip').hidden = true;
    $('#c-volume').value = IL.prefs.get('volume');
    $('#c-volume').oninput = e => h.volume(Number(e.target.value));
    $('#c-pause').onclick = h.togglePause;
    $('#c-back').onclick = h.back;
    $('#c-skip').onclick = h.skip;
    status('Starting', 'play');
    $('#c-time').textContent = '';
    bar(0);
  }

  function label(s) {
    if (s.kind === 'wait') return [s.what, /^Check/.test(s.what) ? 'check' : 'wait'];
    if (s.say) return [`Part ${s.part}: introduction`, 'play'];
    const sec = test.parts[s.part - 1].sections[s.section];
    return [`Listening: questions ${IL.span(sec.from, sec.to)}`, 'play'];
  }

  function tick({ pos, total, step, left, paused }) {
    const [text, cls] = label(step);
    status(paused ? `Paused · ${text}` : text, paused ? 'wait' : cls, step.kind === 'wait' ? IL.clock(left) : '');
    $('#c-time').textContent = `${IL.clock(pos)} / ${IL.clock(total)}`;
    $('#c-skip').hidden = step.kind !== 'wait';
    $('#c-pause').textContent = paused ? 'Play' : 'Pause';
    bar(total ? pos / total : 0);
  }

  const part = n => { $('#c-part').textContent = `· Part ${n}`; };

  function review(left) {
    status('Check your answers, then submit', 'check', IL.clock(left));
    $('#c-time').textContent = `${IL.clock(left)} left`;
    $('#c-controls').hidden = true;
    bar(1);
  }

  IL.console = { init, tick, part, review };
})(window.IL);
