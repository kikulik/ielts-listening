#!/usr/bin/env node
/* Turns each test into a speech plan for the audio builder (tools/audio/synth.py):
   which voice says which sentence, and the pause after it, for every audio file of the test.
     node tools/speech.cjs          all tests  -> build/speech/NN.json
     node tools/speech.cjs 7 12     tests 07 and 12 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { steps } = require('../js/timeline.js');
const { sayable, sentences } = require('./say.cjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'speech');
const VERSION = 1;          // bump to re-record every file
const SPEED = 1.0;
const GAP = { sentence: 0.3, turn: 0.55, narrator: 0.6, around: 1.1 };

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

const seg = (v, text, gap) => ({ v, lang: lang(v), text: sayable(text), gap });
const narration = (v, lines, lastGap) => lines.flatMap(sentences).map((s, i, all) => seg(v, s, i === all.length - 1 ? lastGap : GAP.narrator));

function sectionSegs(lines, cast) {
  return lines.flatMap(([id, text]) => {
    const parts = sentences(text);
    return parts.map((s, i) => seg(cast[id], s, i === parts.length - 1 ? GAP.turn : GAP.sentence));
  });
}

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
      const body = sectionSegs(part.sections[step.section].lines, cast);
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
    console.log(`Test ${pad(id)}: ${plan.files.length} files, ${words} words, about ${Math.round(words / 165)} min of speech`);
  }
}

if (require.main === module) main();
module.exports = { planFor, VOICES, NARRATORS };
