# IELTS Listening Practice

Thirty IELTS Listening practice tests with recordings, made for one learner preparing for the exam.
The recordings must sound like the Cambridge IELTS tests. README.md describes the files and
commands; docs/AUTHORING.md is the guide to writing tests and the speech rules.

## Rules for the recordings (always)

- **Cambridge pace**: 150–170 words a minute with the pauses. Every voice at 0.9 of its own speed
  or slower; map and plan talks at 0.8 or slower with longer pauses.
- **Spelling must be easy to write down**, like the Cambridge tests. A name spelled out
  (N … I … K … O … L … O … Z), a code or a phone number: the sentence at 0.8 or slower, at least
  0.45 s of pause after every letter (about 0.75 s a letter), at least 0.4 s before and after,
  0.7 s between the groups of a phone number or a postcode.
- Never make these faster. They live in `SPEED`, `SLOW` and `SPELL_GAP` in `tools/speech.cjs`;
  `tests/checks/pace.cjs` stops the build if a plan breaks them.
- Never record letters one by one: the voices add a stray sound before a single letter said alone.
  The whole sentence is said in one recording and `tools/audio/synth.py` widens the gap after each
  letter (it needs the timed model it makes, `tools/audio/models/kokoro-v1.0-timed.onnx`).

## After changing tests or the speech tools

```bash
node tests/check-tests.cjs && node tests/lint.cjs
node tools/speech.cjs && .venv/bin/python tools/audio/synth.py   # re-records only changed files
node tools/catalog.cjs                                           # test lengths on the home screen
.venv/bin/python tools/audio/hear_check.py N                     # Whisper: every answer audible
```

The site is GitHub Pages from `main` (https://kikulik.github.io/ielts-listening/). A deploy can
time out on GitHub's side while syncing files; pushing an empty commit starts a new one.
