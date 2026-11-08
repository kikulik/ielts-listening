#!/usr/bin/env node
/* Writes data/catalog.json, the list on the home screen: each test's id, its four topics, and
   its length in minutes (from the recorded audio, plus the pauses and 2 minutes to check).
     node tools/catalog.cjs */
const fs = require('fs');
const path = require('path');
const { steps } = require('../js/timeline.js');
const { partWords } = require('../tests/checks/structure.cjs');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'data', 'tests');
const OUT = path.join(ROOT, 'data', 'catalog.json');
const CHECK_MIN = 2;
const WPM = 165;
const pad = n => String(n).padStart(2, '0');

const ids = () => fs.readdirSync(TESTS).filter(f => /^\d\d\.json$/.test(f)).map(f => Number(f.slice(0, 2))).sort((a, b) => a - b);
const load = id => JSON.parse(fs.readFileSync(path.join(TESTS, `${pad(id)}.json`), 'utf8'));

function durations(id) {
  const p = path.join(ROOT, 'audio', pad(id), 'index.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/* Recorded length when the audio exists, otherwise an estimate from the word count. */
function minutes(test) {
  const d = durations(test.id);
  const waits = steps(test).filter(s => s.kind === 'wait').reduce((t, s) => t + s.sec, 0);
  const audio = d
    ? Object.values(d).reduce((t, f) => t + f.sec, 0)
    : test.parts.reduce((t, p) => t + (partWords(p) / WPM) * 60 + 40, 0);
  return Math.round((audio + waits) / 60 + CHECK_MIN);
}

const entry = test => ({ id: test.id, topics: test.parts.map(p => p.topic), minutes: minutes(test) });
const build = () => ids().map(id => entry(load(id)));

/* For the checker: the catalog must list every test with its current topics. */
function stale() {
  if (!fs.existsSync(OUT)) return 'data/catalog.json is missing';
  const have = JSON.parse(fs.readFileSync(OUT, 'utf8')).map(t => `${t.id}:${t.topics.join('|')}`);
  const want = ids().map(id => { const t = load(id); return `${t.id}:${t.parts.map(p => p.topic).join('|')}`; });
  return have.join('\n') === want.join('\n') ? '' : 'data/catalog.json is out of date';
}

if (require.main === module) {
  const list = build();
  fs.writeFileSync(OUT, `${JSON.stringify(list, null, 1)}\n`);
  console.log(`data/catalog.json: ${list.length} tests, ${list.reduce((t, x) => t + x.minutes, 0)} minutes in all`);
}

module.exports = { build, stale };
