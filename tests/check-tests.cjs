#!/usr/bin/env node
/* Checks every listening test in data/tests/ (or the ids given) and stops the build on any error.
     node tests/check-tests.cjs          all tests
     node tests/check-tests.cjs 7 12     tests 07 and 12 only */
const fs = require('fs');
const path = require('path');
const { checkTest } = require('./checks/structure.cjs');
const { checkGroups, checkKey } = require('./checks/groups.cjs');

const DIR = path.join(__dirname, '..', 'data', 'tests');
const pad = n => String(n).padStart(2, '0');

function report(name) {
  const errors = [], warnings = [];
  return { name, errors, warnings, err: m => errors.push(m), warn: m => warnings.push(m) };
}

function checkFile(file) {
  const id = Number(path.basename(file, '.json'));
  const r = report(`Test ${pad(id)}`);
  let test;
  try {
    test = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    r.err(`not valid JSON: ${e.message}`);
    return r;
  }
  const words = checkTest(test, id, r) || [];
  r.words = words;
  if (Array.isArray(test.parts)) test.parts.forEach(p => p && p.n && checkGroups(p, r));
  if (!r.errors.length) checkKey(test, r);
  return r;
}

function files(args) {
  if (args.length) return args.map(a => path.join(DIR, `${pad(Number(a))}.json`));
  return fs.readdirSync(DIR).filter(f => /^\d\d\.json$/.test(f)).sort().map(f => path.join(DIR, f));
}

function main() {
  const list = files(process.argv.slice(2));
  if (!list.length) { console.error('No tests found in data/tests/'); process.exit(1); }
  let bad = 0;
  for (const file of list) {
    if (!fs.existsSync(file)) { console.log(`${path.basename(file)}  missing`); bad += 1; continue; }
    const r = checkFile(file);
    const words = (r.words || []).filter(Boolean).join('/');
    console.log(`${r.name}  ${r.errors.length ? `${r.errors.length} error(s)` : 'ok'}  words ${words}`);
    r.errors.forEach(e => console.log(`   ERROR ${e}`));
    r.warnings.forEach(w => console.log(`   warn  ${w}`));
    if (r.errors.length) bad += 1;
  }
  if (!process.argv[2]) {
    const why = require('../tools/catalog.cjs').stale();
    if (why) { console.log(`ERROR ${why}: run node tools/catalog.cjs`); bad += 1; }
  }
  console.log(bad ? `\n${bad} problem(s).` : `\nAll ${list.length} test(s) pass.`);
  process.exit(bad ? 1 : 0);
}

main();
