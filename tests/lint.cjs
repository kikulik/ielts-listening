#!/usr/bin/env node
/* Code-size and duplication gate, run in the Docker build:
   - no source file over 400 lines
   - no JavaScript function over 60 lines
   - no function body copied into a second place
     node tests/lint.cjs */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['js', 'css', 'tools', 'tests'];
const EXT = /\.(js|cjs|css|py|html)$/;
const MAX_FILE = 400, MAX_FN = 60, MIN_DUP = 4;
const SKIP = /(^|\/)(models|node_modules)(\/|$)/;

function files(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(d => {
    const rel = path.join(dir, d.name);
    if (SKIP.test(rel)) return [];
    if (d.isDirectory()) return files(rel);
    return EXT.test(d.name) ? [rel] : [];
  });
}

/* Function starts: `function x(`, `x = (...) => {`, `x(...) {` methods. Ends by brace matching. */
const START = /(\bfunction\b[^(]*\([^)]*\)\s*\{|=>\s*\{|^\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{)\s*$/;
function functions(text) {
  const lines = text.split('\n'), out = [];
  lines.forEach((line, i) => {
    if (!START.test(line) || /^\s*(if|for|while|switch|catch)\b/.test(line)) return;
    if (/^[(}]/.test(line)) return; // a module wrapper at the top level, not a function
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j].replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')) {
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
      }
      if (depth <= 0 && j > i) { out.push({ at: i + 1, len: j - i + 1, body: lines.slice(i + 1, j).join('\n') }); return; }
    }
  });
  return out;
}

const shape = body => body.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();

function main() {
  const problems = [], seen = new Map();
  for (const rel of DIRS.flatMap(files).concat(['index.html'])) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const n = text.split('\n').length;
    if (n > MAX_FILE) problems.push(`${rel}: ${n} lines (max ${MAX_FILE})`);
    if (!/\.(js|cjs)$/.test(rel)) continue;
    for (const f of functions(text)) {
      if (f.len > MAX_FN) problems.push(`${rel}:${f.at}: function is ${f.len} lines (max ${MAX_FN})`);
      if (f.body.split('\n').length < MIN_DUP) continue;
      const key = shape(f.body);
      if (seen.has(key)) problems.push(`${rel}:${f.at}: same body as ${seen.get(key)}`);
      else seen.set(key, `${rel}:${f.at}`);
    }
  }
  problems.forEach(p => console.log(`LINT ${p}`));
  console.log(problems.length ? `\n${problems.length} lint problem(s).` : 'Lint: files and functions within limits, no copied functions.');
  process.exit(problems.length ? 1 : 0);
}

main();
