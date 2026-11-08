/* IELTS Listening Practice: plays a test's timeline. Recordings one after another, with the
   reading and checking pauses timed by the clock. Exam mode never pauses; practice mode can.
   P is one running player: its steps, the audio element, and where it is. */
(function (IL) {
  const TICK_MS = 250;
  const now = () => performance.now();

  const current = P => P.steps[P.i];
  const inAudio = P => Boolean(current(P)) && current(P).kind === 'audio';
  const waitLeft = P => Math.max(0, P.left - (P.since ? (now() - P.since) / 1000 : 0));

  function position(P) {
    const s = current(P);
    if (!s) return P.total;
    return P.starts[P.i] + (s.kind === 'audio' ? Math.min(P.audio.currentTime || 0, s.sec) : s.sec - waitLeft(P));
  }

  function tick(P) {
    if (P.done || P.i < 0) return;
    const s = current(P);
    if (s.kind === 'wait' && !P.paused && waitLeft(P) <= 0) { go(P, P.i + 1); return; }
    const left = s.kind === 'wait' ? waitLeft(P) : Math.max(0, s.sec - (P.audio.currentTime || 0));
    P.on.tick({ pos: position(P), total: P.total, step: s, left, paused: P.paused });
  }

  function play(P) {
    const p = P.audio.play();
    if (p && p.catch) p.catch(() => P.on.error('The browser stopped the sound. Press Try again to carry on.', () => play(P)));
  }

  /* Warms the browser cache with the next recording, so there is no gap while it loads. */
  function preload(P) {
    const next = P.steps.slice(P.i + 1).find(s => s.kind === 'audio');
    if (next) { P.warm.src = next.src; P.warm.load(); }
  }

  function go(P, n) {
    P.i = n;
    if (P.i >= P.steps.length) { P.done = true; clearInterval(P.beat); P.on.end(); return; }
    const s = current(P);
    P.on.step(s, P.i);
    if (s.kind === 'audio') { P.audio.src = s.src; if (!P.paused) play(P); }
    else { P.left = s.sec; P.since = P.paused ? 0 : now(); }
    preload(P);
    tick(P);
  }

  function pause(P) {
    if (P.paused || P.done) return;
    P.paused = true;
    if (inAudio(P)) P.audio.pause(); else { P.left = waitLeft(P); P.since = 0; }
    tick(P);
  }

  function resume(P) {
    if (!P.paused || P.done) return;
    P.paused = false;
    if (inAudio(P)) play(P); else P.since = now();
    tick(P);
  }

  function stop(P) {
    P.done = true;
    clearInterval(P.beat);
    P.audio.pause();
    P.audio.removeAttribute('src');
    P.warm.removeAttribute('src');
  }

  function wire(P) {
    P.audio.addEventListener('ended', () => { if (!P.done) go(P, P.i + 1); });
    P.audio.addEventListener('error', () => {
      if (P.done || !inAudio(P)) return;
      P.on.error('The recording did not load. Check the internet connection, then press Try again.', () => { P.audio.load(); play(P); });
    });
  }

  function steps(test, durations) {
    return IL.timeline.steps(test).map(s => (s.kind === 'audio'
      ? { ...s, src: IL.audioUrl(test.id, s.name), sec: (durations[s.name] && durations[s.name].sec) || 0 }
      : { ...s }));
  }

  function create({ test, durations, volume, on }) {
    const list = steps(test, durations);
    const starts = [];
    let total = 0;
    list.forEach(s => { starts.push(total); total += s.sec; });
    const P = { steps: list, starts, total, on, i: -1, beat: 0, paused: false, left: 0, since: 0, done: false, audio: new Audio(), warm: new Audio() };
    P.audio.preload = 'auto';
    P.audio.volume = volume;
    P.warm.preload = 'auto';
    P.warm.muted = true;
    wire(P);
    return {
      total,
      /* Call from a click: browsers only allow sound that the user started. */
      start: () => { P.beat = setInterval(() => tick(P), TICK_MS); go(P, 0); },
      pause: () => pause(P),
      resume: () => resume(P),
      back: sec => { if (inAudio(P)) P.audio.currentTime = Math.max(0, P.audio.currentTime - sec); tick(P); },
      skip: () => { if (current(P) && current(P).kind === 'wait') go(P, P.i + 1); },
      stop: () => stop(P),
      setVolume: v => { P.audio.volume = v; },
      isPaused: () => P.paused
    };
  }

  IL.player = { create };
})(window.IL);
