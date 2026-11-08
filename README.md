# IELTS Listening Practice

Thirty full IELTS Listening practice tests in the real exam format: four parts, 40 questions,
about 30 minutes each. The recording plays once, with the narrator’s instructions, 30 seconds
to read before each section (45 before Part 4), 30 seconds to check after each part, and 2 or 10
minutes to check everything at the end. Afterwards you get the band score, marks by part and by
question type, every answer against the key, and the transcript with each answer highlighted.

- **Exam mode**: like the real test, no pausing.
- **Practice mode**: pause, back 10 seconds, skip the reading pauses.
- Question types: form, note, table, flow-chart, sentence and summary completion, multiple
  choice, choose two, matching, and map and plan labelling.
- Marking follows the exam: spelling counts, capitals don’t, word limits apply.
  The band uses the usual Listening conversion of the mark out of 40.

The tests are original practice material in the IELTS format; they are not official IELTS
tests. The recordings are made from the transcripts with the Kokoro speech model
(Apache-2.0), run locally.

**Online:** https://kikulik.github.io/ielts-listening/ (GitHub Pages, updates on every push to `main`).

## Run it

```bash
./deploy.sh                 # builds the image and starts it
# open http://localhost:10370
docker compose down         # stop it
```

Use another port with `IELTS_PORT=8080 ./deploy.sh`.

The Docker build runs `tests/lint.cjs` (no file over 400 lines, no function over 60, no copied
functions) and `tests/check-tests.cjs` (every test, see below) first, and stops if either fails.

## Files

| Path | What it does |
|---|---|
| `index.html` | The page: home, test intro, exam, result screens |
| `css/base.css`, `css/exam.css`, `css/results.css` | Styles, light and dark |
| `js/core.js` | Helpers, saved settings and results (browser storage only) |
| `js/markup.js` | The `[[7\|words]]` answer markers and `{7}` answer boxes (shared with the tools) |
| `js/answers.js` | Comparing a typed answer with the key, word limits (shared with the checker) |
| `js/score.js` | The 40 questions of a test, marking, raw score to band (shared with the checker) |
| `js/timeline.js` | Running order: narrator, sections, reading and checking pauses (shared with the audio tools) |
| `js/render-gap.js`, `js/render-choice.js`, `js/render-map.js` | Drawing each question type; maps as SVG |
| `js/questions.js` | The question paper, instructions, collecting answers |
| `js/player.js` | Plays the recordings and times the pauses |
| `js/console.js`, `js/exam.js` | The exam screen: status bar, navigator, final check, submit |
| `js/results.js`, `js/transcript.js` | The result screen |
| `js/home.js`, `js/picker.js`, `js/app.js` | Home and intro screens, start-up |
| `data/tests/NN.json` | The tests: transcripts, questions, answer keys ([format](docs/AUTHORING.md)) |
| `data/catalog.json` | The test list (made by `tools/catalog.cjs`) |
| `audio/NN/*.mp3` | The recordings; `audio/NN/index.json` holds their lengths |
| `tests/check-tests.cjs`, `tests/checks/` | Checks every test |
| `tests/lint.cjs` | Code-size and duplication gate |
| `tools/say.cjs`, `tools/speech.cjs`, `tools/audio/synth.py` | Making the recordings |
| `tools/format-test.cjs` | Tidies a test file’s layout |
| `tools/map-preview.html` | Every map with its answer key, for checking drawings |
| `tools/share-card.html` | Source of `img/share.png`, the link preview picture |

## What the checker enforces

`node tests/check-tests.cjs` (or `node tests/check-tests.cjs 7` for one test):

- 4 parts, questions 1–10, 11–20, 21–30, 31–40; two sections in Parts 1–3, one in Part 4
- every question has a marker in the transcript, inside its own section, and answers are heard
  in question order
- every typed answer is exactly the words marked in the transcript and keeps to the word limit
- letters, options, matching boxes and map letters are valid; maps stay on the canvas
- the answer key scores 40/40 through the same marking code the page uses
- part lengths, and nothing in the transcript the voices can’t say

## Making the recordings

One-off setup (about 350 MB):

```bash
python3 -m venv .venv
.venv/bin/pip install kokoro-onnx soundfile lameenc
mkdir -p tools/audio/models && cd tools/audio/models
gh release download model-files-v1.0 -R thewh1teagle/kokoro-onnx -p kokoro-v1.0.onnx -p voices-v1.0.bin
```

After adding or changing tests:

```bash
node tests/check-tests.cjs 7                       # fix every error first
node tools/speech.cjs 7                            # speech plan -> build/speech/07.json
.venv/bin/python tools/audio/synth.py 0 7          # record -> audio/07/*.mp3 (0 = sound check)
node tools/catalog.cjs                             # update the test list
.venv/bin/python tools/audio/hear_check.py 7       # Whisper listens: is every typed answer audible?
```

`hear_check.py` needs `.venv/bin/pip install faster-whisper` once (its model downloads on first use).

Only files whose text changed are recorded again. All 30 tests take a little over an hour on a
24-core CPU (`--workers 6 --threads 4`). `tools/say.cjs` turns prices, times, years, phone
numbers, codes and spelled names into words the voices read correctly. Words spelled one way
but said two ways (*lead* the metal, *read* in the past) go in a test’s `"say"` list; see
[docs/AUTHORING.md](docs/AUTHORING.md).

## Share picture

```bash
google-chrome --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=8000 \
  --screenshot="$PWD/img/share.png" "file://$PWD/tools/share-card.html"
```

After pushing, refresh Facebook’s copy at
https://developers.facebook.com/tools/debug/?q=https://kikulik.github.io/ielts-listening/ (Scrape Again).
