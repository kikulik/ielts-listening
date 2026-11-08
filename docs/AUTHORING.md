# Writing a listening test

Each test is one file, `data/tests/NN.json` (`01.json` … `30.json`). The audio is made from
the transcript by a speech engine, so the transcript **is** the recording. Every test must be
original work: never copy or closely paraphrase a Cambridge, IDP or British Council test.

After writing or changing a file, run the checker and fix every ERROR:

```bash
node tests/check-tests.cjs 7        # one test
node tools/format-test.cjs 7        # tidy the file layout (one transcript line per row)
```

## The level to aim for

Match real IELTS Academic/General Listening (the four-part test in Cambridge IELTS 15–19):
a candidate at **band 6.5 should score about 26–29 of 40**, band 8 about 35–36. Within each
part: about 3 straightforward questions, 5 that need careful listening, 2 hard ones. Part 1 is
the easiest; Parts 3 and 4 the hardest.

What makes real IELTS hard, and must be in every part:

- **Distractors.** The wrong answer is said first, then corrected or rejected:
  “It’s £35 a night… oh no, sorry, that was last year’s price. It’s [[3|£38]] now.”
  “We thought about Tuesday, but the hall’s booked, so it’ll be [[4|Thursday]].”
  In multiple choice, **every option is mentioned**, but only one fits the question.
- **Paraphrase.** Question wording differs from the recording. The question says “cheapest”,
  the speaker says “it won’t cost you as much as the others”. Never copy the sentence around
  a gap word-for-word from the transcript into the question. Typed answers themselves are the
  exact words spoken.
- **Speakers change their minds, hedge, and disagree** (Part 3), and the answer is the final
  agreed view.
- **Natural speed and no signalling.** Do not make answers stand out (“the answer is…”).
  Information comes at normal conversational pace, often in the middle of a sentence.
- **Spelling and numbers** in Part 1: a surname or street name spelled letter by letter,
  a phone number, a postcode, a price, a date or a time.
- **Answers come in question order** in the recording (except within a choose-two group).
  Leave 2–4 sentences between consecutive answers, more in Parts 3 and 4.

## Blueprint per part

| Part | Who | Length (words) | Usual tasks |
|---|---|---|---|
| 1 | Two people, everyday transaction (phone call, enquiry, booking) | 750–950 | Form / note / table completion, ONE WORD AND/OR A NUMBER |
| 2 | One speaker (sometimes introduced by a host), everyday social context: tour, talk, radio item | 750–950 | Multiple choice, map/plan labelling, matching, choose two, notes |
| 3 | Two or three people, education or training: students and/or a tutor discussing an assignment | 850–1050 | Multiple choice, matching opinions, choose two, flow-chart, sentence completion |
| 4 | One lecturer, academic subject, **no break** | 800–1000 | Note completion, ONE WORD ONLY (sometimes a table or a few MCQs) |

Parts 1–3 have **two sections** (a break where the candidate reads the next questions);
Part 4 has **one**. Section splits are usually 1–5/6–10 (or 1–6/7–10), 11–15/16–20,
21–25/26–30.

## File format

```json
{
  "id": 7,
  "parts": [
    {
      "n": 1,
      "topic": "Booking a holiday cottage",
      "context": "a woman phoning a holiday cottage agency",
      "speakers": {
        "A": { "name": "Agent", "g": "m", "accent": "gb" },
        "B": { "name": "Mrs Okafor", "g": "f", "accent": "gb" }
      },
      "sections": [
        { "from": 1, "to": 5, "lines": [
          ["A", "Good morning, Seaview Cottages. Daniel speaking. How can I help?"],
          ["B", "Hello. I'd like to book a cottage for the first week of June, if there's anything left."],
          ["A", "Let me have a look. Can I take your surname first?"],
          ["B", "Yes, it's [[1|Okafor]]. That's O-K-A-F-O-R."]
        ] },
        { "from": 6, "to": 10, "lines": [ ["A", "..."] ] }
      ],
      "groups": [
        { "type": "gap", "from": 1, "to": 10, "layout": "form", "title": "COTTAGE BOOKING FORM",
          "limit": "ONE WORD AND/OR A NUMBER",
          "rows": ["Surname: {1}", "Number of guests: {2}", "# Requirements", "Price per night: £{3}", "..."],
          "answers": { "1": ["Okafor"], "2": ["5", "five"], "3": ["38"] } }
      ]
    }
  ]
}
```

- `topic`: a short title shown on the test list.
- `context`: finishes the narrator’s sentence “You will hear …”, lower case, no full stop:
  “a woman phoning a holiday cottage agency”, “a guide talking to visitors at a restored mill”,
  “two students discussing a presentation on urban beekeeping”, “part of a lecture on the history of glass”.
- `speakers`: ids are 1–3 capital letters. `name` is shown in the transcript (use a role like
  “Receptionist” or a first name). `g` is `"m"` or `"f"`; `accent` is `"gb"` or `"us"`.
  Mostly British; include at least one American speaker somewhere in each test. Speakers
  in one part must be distinguishable (different gender or accent where possible).
- Optional `"kind"` on a part (`"conversation"`, `"talk"`, `"interview"`, `"discussion"`) changes the narrator’s
  “Before the … continues” line. Defaults: conversation for Parts 1 and 3, talk for Part 2.
- `sections[].lines`: `["SPEAKER_ID", "what they say"]`, one turn per line. Monologue
  paragraphs of 2–5 sentences per line.

### Answer markers in the transcript

Wrap the words that give the answer in `[[q|words]]`. The audio says only the words; the
review screen highlights them so the learner can see where each answer was.

- **Typed answers:** wrap exactly the answer words, at the place where the correct answer is
  stated (not the distractor). The first entry in `answers` must equal the marked words
  (capitals, `£ $ €`, `9:30`/`9.30`, `1,500`/`1500` and hyphens do not matter).
- **Letter answers** (multiple choice, matching, map): wrap the phrase (a few words to a clause)
  that proves the right option. Never wrap a distractor.
- Every question needs at least one marker, inside the section that covers it.
- For a spelled name, put the marker on the word, not the letters: `It's [[1|Okafor]]. That's O-K-A-F-O-R.`

## Question groups

Each part’s `groups` cover its ten questions in order (1–10, 11–20, 21–30, 31–40).
The page writes the standard IELTS instructions itself (“Complete the notes below. Write ONE
WORD ONLY for each answer.”, “Choose the correct letter, A, B or C.” …), so give only the
content.

### `gap`: form, notes, table, flow-chart, sentence or summary completion

```json
{ "type": "gap", "from": 31, "to": 40, "layout": "notes", "title": "The history of glass",
  "limit": "ONE WORD ONLY",
  "rows": [
    "# Early glass",
    "- first made in Mesopotamia, probably by accident",
    "- early objects were mainly {31} and small containers",
    "-- coloured with metal {32}",
    "# Roman developments"
  ],
  "answers": { "31": ["beads"], "32": ["oxides"] } }
```

- `layout`: `form` (rows like `"Label: value {n}"`), `notes`, `table`, `flow` (each row is a
  box, arrows between), `sentences` (one gap per row), `summary` (each row a paragraph).
- Row markup: `# Heading`, `- bullet`, `-- sub-bullet`. `{n}` is the answer box for question n.
  Put the unit next to the box when the answer is a number: `£{3}`, `{4} minutes`.
- `table` layout uses `"table"` instead of `rows`: the first row is the headings;
  `\n` breaks a line inside a cell; `""` is an empty cell.
  `"table": [["Day", "Activity", "Cost"], ["Monday", "{11} tour", "£{12}"], ["Tuesday", "boat trip\n- bring a {13}", "free"]]`
- `limit`: one of `ONE WORD ONLY`, `ONE WORD AND/OR A NUMBER`, `NO MORE THAN TWO WORDS`,
  `NO MORE THAN TWO WORDS AND/OR A NUMBER`, `NO MORE THAN THREE WORDS`,
  `NO MORE THAN THREE WORDS AND/OR A NUMBER`. Every accepted answer must keep to it
  (“9.30” and “£45” count as one number; a hyphenated word is one word).
- `answers`: for each question, a list. The first is the marked words; add only other forms a
  real examiner accepts: `["5", "five"]`, `["colour", "color"]`, `["9.30", "9.30am"]`. The answer
  must fit the gap grammatically, and only one word or phrase from the recording may fit.
- With a box of words instead of typing (“Choose FOUR answers from the box”), give
  `"options": ["noise", "cost", ...]` (5–12 options, more than the gaps) and letters as answers:
  `"answers": { "27": "C", "28": "A" }`. No `limit` then.

### `mcq`: one correct letter

```json
{ "type": "mcq", "from": 11, "to": 14, "items": [
  { "q": 11, "stem": "Why was the mill closed in 1962?",
    "options": ["The river had become too shallow.", "Cheaper flour came from abroad.", "The building was unsafe."],
    "answer": "B" } ] }
```

Three options (four is rare). Do not write letters in the options; the page adds A, B, C.
All options must be plausible and mentioned in the recording. Spread right answers across A/B/C.

### `multi`: choose TWO (or THREE) letters

```json
{ "type": "multi", "from": 15, "to": 16, "stem": "Which TWO facilities are new this year?",
  "options": ["a café", "a gift shop", "a children's playground", "an electric bus", "free lockers"],
  "answer": ["A", "D"] }
```

Five options for two answers (seven for three). Each right letter is one mark, any order.
At least two of the wrong options should be mentioned and ruled out.

### `match`: matching to a box of options

```json
{ "type": "match", "from": 17, "to": 20, "lead": "What does the speaker say about each of the following rides?",
  "boxTitle": "Comments",
  "options": ["It is closed for repairs.", "It is suitable for young children.", "It has a height limit.", "It is the most popular.", "It is free on weekdays."],
  "items": [ { "q": 17, "text": "The Big Wheel", "answer": "D" } ] }
```

Usually more options than items (one or two are never used). If there are fewer options than
items (for example three opinions A–C for five items), letters may be used more than once;
the page says so. Items follow the recording order; options do not.

### `map`: map or plan labelling

```json
{ "type": "map", "from": 15, "to": 20, "kind": "map", "title": "Hartley Mill site",
  "map": { "shapes": [
    { "k": "zone", "x": 0, "y": 0, "w": 600, "h": 400, "fill": "grass" },
    { "k": "path", "pts": [[0, 330], [600, 330]], "w": 26, "fill": "road", "label": "Mill Lane" },
    { "k": "path", "pts": [[90, 0], [90, 400]], "w": 30, "fill": "water", "label": "River Wey" },
    { "k": "zone", "x": 150, "y": 60, "w": 140, "h": 90, "fill": "building", "label": "Mill" },
    { "k": "round", "x": 450, "y": 150, "rx": 70, "ry": 40, "fill": "water", "label": "Mill pond" },
    { "k": "gate", "x": 300, "y": 318, "text": "Entrance" },
    { "k": "spot", "x": 220, "y": 220, "letter": "A" },
    { "k": "spot", "x": 380, "y": 250, "letter": "B" }
  ] },
  "items": [ { "q": 15, "text": "Café", "answer": "B" } ] }
```

- Canvas is 600 wide × 400 high, origin top-left, **north is up** (a compass is drawn in the
  top-right corner; keep x > 540, y < 60 free). Shapes draw in order: background first.
- `zone` (rectangle): `x y w h`, `fill` one of grass, field, wood, water, sand, paving,
  building, room, parking, plain; optional `label`.
- `round` (ellipse): centre `x y`, radii `rx ry`, same fills, optional `label`.
- `path` (road, river, footpath): `pts` [[x, y], …], width `w` (8–40), `fill` one of road,
  path, water, rail, corridor; optional `label`.
- `spot`: a lettered circle for the answer letters, A, B, C… in any order on the map,
  at least 30 apart. Use 1–3 more letters than questions.
- `gate` (entrance marker), `you` (“You are here”), `label` (free text) with `x y text`.
- Labelled landmarks (entrance, roads, the river, two or three named buildings) are what the
  speaker uses for directions. The lettered spots are the places asked about, unlabelled.
- **The directions in the transcript must match the drawing exactly**: “as you come in through
  the entrance, the café is on your right, just past the mill pond” must be true of the
  coordinates. Use north/south/east/west, left/right from the entrance, opposite, next to,
  between, at the far end, in the corner. A plan of a building uses `room` zones and
  `corridor` paths.

## Writing speech the voices can say

The recording is made by a speech engine. Write exactly what the speaker says, with these
conventions so it is read correctly:

| Write | Heard as |
|---|---|
| `O-K-A-F-O-R` (capitals joined by hyphens) | “O, K, A, F, O, R” (spelled; double letters are said “double R”) |
| `0798 445 2210` (phone numbers, starting with 0, in groups) | “oh seven nine eight, double four five…” |
| `BS7 4QN`, `JX472` (codes: capitals and digits) | spelled character by character |
| `£38`, `£12.50`, `$45`, `€20` | “thirty-eight pounds”, “twelve pounds fifty” |
| `9.30`, `10.15 am`, `7 pm`, `6 o'clock` | “nine thirty”, “ten fifteen a.m.” |
| `1998`, `2024` | “nineteen ninety-eight”, “twenty twenty-four” |
| `2,500` (commas in numbers of 1,000 and more) | “two thousand five hundred” |
| `15%`, `21st March`, `the 3rd of May` | as expected |

- Words spelled one way but said two ways are often said wrongly: *lead* the metal, *read* in
  the past, thread *wound* round, foxes *live* for, gates *close* at, my daughter *lives* there.
  Add them to the test’s optional top-level `"say"` object, from the exact words in the
  transcript to a spelling the engine reads right:
  `"say": { "but lead": "but led", "She read it out": "She red it out", "gates close at": "gates cloze at" }`.
  Only the recording changes; the transcript and the answers stay as written, and the checker
  makes sure every phrase is in the transcript. *use* as a verb is handled for you.
  To see how the engine will say something:
  `.venv/bin/python -c "from kokoro_onnx.tokenizer import Tokenizer; print(Tokenizer().phonemize('but lead', 'en-gb'))"`.
- No ellipses, brackets, stage directions, `um`, `er`, emails or web addresses.
  Hesitation is fine as words: “Well,” “Oh,” “Right,” “Let me see,” “Hmm,” “Actually,”.
- Use British spelling everywhere (colour, centre, programme), also for American speakers.
- Numbers of 1,000 and more need the comma, otherwise they are read digit by digit.

## Checklist before you finish a test

1. `node tests/check-tests.cjs N` passes with no ERROR (fix warnings about length too).
2. Read each question against the transcript as a candidate would: exactly one option or word
   fits, the distractor is clearly rejected, and the answer is heard after the previous one.
3. Every typed answer is in the recording, spelled as the key spells it, and keeps to the limit.
4. Maps: walk the directions on the coordinates.
5. `node tools/format-test.cjs N`.
