#!/usr/bin/env node
/* Rewrites test files in one tidy layout: one transcript line per row, short lists on one line.
     node tools/format-test.cjs 7 12     tests 07 and 12
     node tools/format-test.cjs          all tests
   The data never changes: the file is re-read and compared before it is written. */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'tests');
const WIDTH = 150;
const pad = n => String(n).padStart(2, '0');

const isPrim = v => v === null || typeof v !== 'object';
const inline = v => {
  if (isPrim(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  const body = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ');
  return body ? `{ ${body} }` : '{}';
};
const depth = v => (isPrim(v) ? 0 : 1 + Math.max(0, ...Object.values(v).map(depth)));
/* A transcript line: ["A", "what they say"]. Always one row, however long. */
const isLine = v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && v[0].length <= 3 && typeof v[1] === 'string';

function print(v, ind) {
  if (isPrim(v)) return JSON.stringify(v);
  const one = inline(v);
  if (isLine(v) || (depth(v) <= 2 && ind.length + one.length <= WIDTH)) return one;
  const next = `${ind}  `;
  if (Array.isArray(v)) return `[\n${v.map(x => next + print(x, next)).join(',\n')}\n${ind}]`;
  const rows = Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${print(x, next)}`);
  return `{\n${rows.join(',\n')}\n${ind}}`;
}

function formatFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const text = `${print(data, '')}\n`;
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(data)) throw new Error(`${file}: layout changed the data`);
  fs.writeFileSync(file, text);
  return text.split('\n').length;
}

const args = process.argv.slice(2);
const list = args.length
  ? args.map(a => path.join(DIR, `${pad(Number(a))}.json`))
  : fs.readdirSync(DIR).filter(f => /^\d\d\.json$/.test(f)).map(f => path.join(DIR, f));
for (const file of list) console.log(`${path.basename(file)}: ${formatFile(file)} lines`);
