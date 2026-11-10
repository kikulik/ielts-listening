#!/usr/bin/env node
/* Turns each test into a speech plan for the audio builder (tools/audio/synth.py):
   which voice says which sentence, and the pause after it, for every audio file of the test.
     node tools/speech.cjs          all tests  -> build/speech/NN.json
     node tools/speech.cjs 7 12     tests 07 and 12 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { steps } = require('../js/timeline.js');
const { sayable, sentences, SPELL } = require('./say.cjs');
const { plain } = require('../js/markup.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'speech');
const VERSION = 1;          // bump to re-record every file
/* Pace like the Cambridge recordings (150-170 words a minute with pauses). These are the rules in
   "Pace of the recordings" in docs/AUTHORING.md; tests/checks/pace.cjs stops the build if a plan
   breaks them.
   - everything 10% slower than the voices' own speed;
   - map and plan talks 20% slower, with longer pauses to follow the directions;
   - a sentence with spelling (names, codes, phone numbers) 20% slower and recorded in one piece,
     with a clear pause added after every letter so a listener can write each one down. */
const SPEED = 0.9;
const SLOW = { spell: 0.8, map: 0.8, mapGap: 1.25 };
const GAP = { sentence: 0.35, turn: 0.6, narrator: 0.65, around: 1.2 };
const SPELL_GAP = { around: 0.4, letter: 0.45, group: 0.7 };

/* Voices by gender and accent, best first. A part never uses the same voice twice. */
const VOICES = {
  'f-gb': ['bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily'],
  'm-gb': ['bm_fable', 'bm_lewis', 'bm_daniel', 'bm_george'],
  'f-us': ['af_heart', 'af_bella', 'af_nicole', 'af_sarah'],
  'm-us': ['am_michael', 'am_fenrir', 'am_puck', 'am_echo']
};
const NARRATORS = ['bm_george', 'bf_isabella', 'bm_fable'];
const lang = v => (v[0] === 'b' ? 'en-gb' : 'en-us');
const pad = n => String(n).padStart(2, '0');

/* Rotates the best three voices of each kind across tests so tests don't all sound alike. */
function castPart(test, part) {
  const used = new Set(), cast = {};
  Object.entries(part.speakers).forEach(([id, s], i) => {
    const pool = VOICES[`${s.g}-${s.accent}`];
    const turn = (test.id + part.n + i) % 3;
    const order = [...pool.slice(turn, 3), ...pool.slice(0, turn), ...pool.slice(3)];
    cast[id] = order.find(v => !used.has(v)) || order[0];
    used.add(cast[id]);
  });
  const narrator = NARRATORS.find(v => !used.has(v));
  return { cast, narrator };
}

const marksIn = t => (t.match(/[,.;:!?]/g) || []).length;

/* A sentence with spelling as the voice says it, and the pause to add after each of its punctuation
   marks (0: the voice's own). Letters are said in a list with a pause after each, groups (a phone
   number's, a postcode's halves) with a longer one, and there is a pause before and after:
     "It's ⟦N,I,K⟧." -> text "It's, N, I, K."  pauses [0.4, 0.45, 0.45, 0.4]  letters 3 */
function spelledLine(said) {
  const [open, close] = SPELL;
  const joined = said.split(`${close} ${open}`).join('/').split(`${close}, ${open}`).join('/');
  let text = '', letters = 0;
  const pauses = [];
  const put = (t, pause = 0) => { text += t; pauses.push(...Array(marksIn(t)).fill(pause)); };
  const breath = () => {
    text = text.trimEnd();
    if (!text) return;
    if (/[,.;:!?]$/.test(text)) pauses[pauses.length - 1] = Math.max(pauses[pauses.length - 1], SPELL_GAP.around);
    else put(',', SPELL_GAP.around);
    text += ' ';
  };
  joined.split(open).forEach((chunk, i) => {
    const [spelt, rest = ''] = i ? chunk.split(close) : [null, chunk];
    if (spelt) {
      breath();
      spelt.split('/').forEach((group, g) => {
        if (g) put(', ', SPELL_GAP.group);
        group.split(',').forEach((u, k) => { put(`${k ? ', ' : ''}${u.trim()}`, SPELL_GAP.letter); letters += 1; });
      });
      if (/^\s*[A-Za-z0-9]/.test(rest)) breath();
    }
    const first = pauses.length;
    put(spelt && /^\s*[A-Za-z0-9]/.test(rest) ? rest.trimStart() : rest);
    if (spelt && /^\s*[,.;:!?]/.test(rest)) pauses[first] = SPELL_GAP.around;
  });
  return { text: text.trim(), pauses, letters };
}

/* One sentence as one recording; with spelling, slower and with the pauses for synth.py to add. */
function seg(v, text, gap, speed = SPEED) {
  const said = sayable(text);
  if (!said.includes(SPELL[0])) return { v, lang: lang(v), text: said, speed, gap };
  const { text: spoken, pauses, letters } = spelledLine(said);
  return { v, lang: lang(v), text: spoken, speed: Math.min(speed, SLOW.spell), gap, pauses, letters };
}
const narration = (v, lines, lastGap) => lines.flatMap(sentences).map((s, i, all) => seg(v, s, i === all.length - 1 ? lastGap : GAP.narrator));

/* A test's "say" respellings for words the voices would get wrong: { "but lead": "but led" }. */
const respell = (text, say = {}) => Object.entries(say).reduce((t, [from, to]) => t.split(from).join(to), text);

function sectionSegs(lines, cast, say, map) {
  const speed = map ? SLOW.map : SPEED, k = map ? SLOW.mapGap : 1;
  return lines.flatMap(([id, text]) => {
    const parts = sentences(respell(plain(text), say));
    return parts.map((s, i) => seg(cast[id], s, (i === parts.length - 1 ? GAP.turn : GAP.sentence) * k, speed));
  });
}

/* A section with map or plan labelling questions. */
const isMap = (part, sec) => part.groups.some(g => g.type === 'map' && g.from <= sec.to && g.to >= sec.from);

const digest = segs => crypto.createHash('sha1').update(JSON.stringify({ VERSION, SPEED, segs })).digest('hex').slice(0, 16);

/* The sound check on the screen before a test: audio/00/check.mp3. */
const CHECK = [
  'This is a sound check.',
  'You should hear this voice clearly. If it is too quiet or too loud, change the volume now.',
  'In the test, each recording is played once only.'
];
function checkPlan() {
  const segs = narration(NARRATORS[0], CHECK, 0);
  return { id: 0, speed: SPEED, cast: {}, files: [{ name: 'check', hash: digest(segs), segs }] };
}

function planFor(test) {
  const roles = {};
  test.parts.forEach(p => { roles[p.n] = castPart(test, p); });
  const files = steps(test).filter(s => s.kind === 'audio').map(step => {
    const { cast, narrator } = roles[step.part];
    let segs;
    if (step.say) segs = narration(narrator, step.say, 0);
    else {
      const part = test.parts[step.part - 1];
      const sec = part.sections[step.section];
      const body = sectionSegs(sec.lines, cast, test.say, isMap(part, sec));
      body[body.length - 1].gap = GAP.around;
      segs = [...narration(narrator, step.pre, GAP.around), ...body, ...narration(narrator, step.post, 0)];
    }
    return { name: step.name, hash: digest(segs), segs };
  });
  return { id: test.id, speed: SPEED, cast: roles, files };
}

function main() {
  const dir = path.join(ROOT, 'data', 'tests');
  const args = process.argv.slice(2);
  const ids = args.length ? args.map(Number) : fs.readdirSync(dir).filter(f => /^\d\d\.json$/.test(f)).map(f => Number(f.slice(0, 2)));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, '00.json'), JSON.stringify(checkPlan(), null, 1));
  for (const id of ids) {
    const test = JSON.parse(fs.readFileSync(path.join(dir, `${pad(id)}.json`), 'utf8'));
    const plan = planFor(test);
    fs.writeFileSync(path.join(OUT, `${pad(id)}.json`), JSON.stringify(plan, null, 1));
    const words = plan.files.flatMap(f => f.segs).reduce((n, s) => n + s.text.split(' ').length, 0);
    console.log(`Test ${pad(id)}: ${plan.files.length} files, ${words} words, about ${Math.round(words / 150)} min of speech`);
  }
}

if (require.main === module) main();
module.exports = { planFor, isMap, respell, VOICES, NARRATORS, PACE: { SPEED, SLOW, GAP, SPELL_GAP } };
