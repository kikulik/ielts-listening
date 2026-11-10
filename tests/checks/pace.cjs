/* The pace of the recordings is a rule of this project (docs/AUTHORING.md, "Pace of the recordings").
   It is checked on each test's speech plan, so a change to tools/speech.cjs or tools/say.cjs cannot
   make the recordings faster again without stopping the build:
   - every sentence at most 0.9 of the voices' own speed, map and plan talks at most 0.8;
   - every sentence with spelling (names, codes, phone numbers) at most 0.8, with a pause of at least
     0.45 s after every letter but the last, and at least 0.4 s before and after the spelling. */
const { planFor, isMap, respell } = require('../../tools/speech.cjs');
const { sayable, sentences, SPELL } = require('../../tools/say.cjs');
const { plain } = require('../../js/markup.js');

const RULE = { speed: 0.9, map: 0.8, spell: 0.8, letter: 0.45, around: 0.4 };

const short = t => (t.length > 50 ? `${t.slice(0, 50)}…` : t);

function checkSpelled(s, where, r) {
  if (s.speed > RULE.spell) r.err(`${where}: spelling "${short(s.text)}" at speed ${s.speed}, the rule is at most ${RULE.spell}`);
  if (s.pauses.filter(p => p >= RULE.letter).length < s.letters - 1) {
    r.err(`${where}: "${short(s.text)}" needs a pause of at least ${RULE.letter} s after every letter`);
  }
  if (s.pauses.some(p => p > 0 && p < RULE.around)) {
    r.err(`${where}: "${short(s.text)}" has a pause shorter than ${RULE.around} s around the spelling`);
  }
}

/* Transcript sentences that spell something, as the planner splits them. */
const spelledSentences = test => test.parts
  .flatMap(p => p.sections.flatMap(sec => sec.lines.flatMap(([, text]) => sentences(respell(plain(text), test.say)))))
  .filter(t => sayable(t).includes(SPELL[0])).length;

function checkPace(test, r) {
  let plan;
  try { plan = planFor(test); } catch (e) { return r.err(`speech plan: ${e.message}`); }
  let spelled = 0;
  for (const f of plan.files) {
    const [n, i] = f.name.slice(1).split('-').map(Number);
    const part = test.parts[n - 1];
    const map = i > 0 && isMap(part, part.sections[i - 1]);
    for (const s of f.segs) {
      const max = map && s.v !== plan.cast[n].narrator ? RULE.map : RULE.speed;
      if (s.speed > max) r.err(`recording ${f.name}: "${short(s.text)}" at speed ${s.speed}, the rule is at most ${max}`);
      if (s.pauses) { spelled += 1; checkSpelled(s, `recording ${f.name}`, r); }
    }
  }
  const want = spelledSentences(test);
  if (spelled < want) r.err(`${want - spelled} sentence(s) with spelling are recorded without the pauses between letters`);
}

module.exports = { checkPace, RULE };
