/* IELTS Listening Practice: shared page helpers and saved settings. Every other script adds to window.IL. */
window.IL = window.IL || {};
(function (IL) {
  IL.$ = (s, root = document) => root.querySelector(s);
  IL.$$ = (s, root = document) => [...root.querySelectorAll(s)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  IL.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
  IL.pad = n => String(n).padStart(2, '0');
  IL.clock = sec => {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const NUMBER = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
  IL.count = n => NUMBER[n] || String(n);
  IL.span = (a, b) => (a === b ? `${a}` : `${a}–${b}`);
  IL.audioUrl = (id, name) => `audio/${IL.pad(id)}/${name}.mp3`;

  IL.getJSON = async url => {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  };

  IL.show = id => {
    IL.$$('.screen').forEach(s => { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
  };

  /* Browser storage can be blocked (private windows); then nothing is remembered and nothing breaks. */
  IL.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(`il-${key}`); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`il-${key}`, JSON.stringify(value)); } catch (e) { /* not saved */ }
    }
  };

  IL.MODES = {
    exam: { name: 'Exam', hint: 'Like the real test: each recording plays once and cannot be paused or replayed.' },
    practice: { name: 'Practice', hint: 'Pause, go back 10 seconds, or skip the reading pauses. Your score is still saved.' }
  };
  IL.REVIEWS = {
    2: { name: '2 minutes', hint: 'As in the computer-delivered test: two minutes to check all your answers.' },
    10: { name: '10 minutes', hint: 'As in the paper test, where this is the time to copy answers onto the answer sheet. Use it to check spelling.' }
  };
  const valid = {
    mode: v => Object.hasOwn(IL.MODES, v),
    review: v => Object.hasOwn(IL.REVIEWS, String(v)),
    volume: v => typeof v === 'number' && v >= 0 && v <= 1
  };
  const DEFAULTS = { mode: 'exam', review: 2, volume: 0.9 };
  IL.prefs = {
    get(k) { const v = IL.store.get(k, DEFAULTS[k]); return valid[k](v) ? v : DEFAULTS[k]; },
    set(k, v) { if (valid[k](v)) IL.store.set(k, v); }
  };

  /* Results per test: { "7": [{ at, raw, band, mode }] }, newest last. */
  IL.history = {
    all: () => IL.store.get('history', {}),
    of: id => (IL.store.get('history', {})[id] || []),
    add(id, entry) {
      const h = IL.store.get('history', {});
      h[id] = [...(h[id] || []), entry].slice(-20);
      IL.store.set('history', h);
    },
    best: id => IL.history.of(id).reduce((b, e) => (!b || e.raw > b.raw ? e : b), null)
  };
})(window.IL);
