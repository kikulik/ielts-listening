/* Checks question groups: numbering, options, answer keys, word limits, and that every typed
   answer is exactly the words marked in the transcript, heard in question order. */
const M = require('../../js/markup.js');
const A = require('../../js/answers.js');
const S = require('../../js/score.js');
const { checkMap } = require('./map.cjs');
const { PART_RANGE } = require('./structure.cjs');

const LAYOUTS = ['form', 'notes', 'table', 'flow', 'sentences', 'summary'];
const PREFIX = /^[A-H][.)]\s*\S/;
const isLetter = (l, n) => typeof l === 'string' && /^[A-Z]$/.test(l) && l.charCodeAt(0) - 65 < n;
const strings = (a, min, max) => Array.isArray(a) && a.length >= min && a.length <= max && a.every(s => typeof s === 'string' && s.trim());

/* q -> [{ text, pos }] for every marker in the part, pos growing through the transcript. */
function partMarks(part) {
  const out = {};
  let line = 0;
  for (const sec of part.sections || []) {
    for (const l of sec.lines || []) {
      for (const m of M.marks(l[1] || '')) (out[m.q] = out[m.q] || []).push({ text: m.text, pos: line * 10000 + m.at });
      line += 1;
    }
  }
  return out;
}

function checkOptions(opts, min, max, where, r) {
  if (!strings(opts, min, max)) return r.err(`${where}: needs ${min}-${max} options`);
  opts.forEach((o, i) => { if (PREFIX.test(o) && /^[A-H]$/.test(o[0]) && o[0] === A.letter(i)) r.err(`${where}: option "${o}" carries its own letter; letters are added by the page`); });
}

function checkItems(g, where, r, fn) {
  if (!Array.isArray(g.items)) return r.err(`${where}: needs "items"`);
  const qs = g.items.map(it => it && it.q);
  const want = S.range(g.from, g.to);
  if (qs.join() !== want.join()) r.err(`${where}: items should be questions ${want.join(', ')} in order`);
  g.items.forEach(it => it && fn(it, `${where} q${it.q}`));
}

function gapTexts(g, where, r) {
  if (g.layout === 'table') {
    const t = g.table;
    if (!Array.isArray(t) || t.length < 2 || !t.every(row => Array.isArray(row) && row.length === t[0].length)) {
      r.err(`${where}: "table" must be rows of equal length, the first row being the headings`);
      return [];
    }
    return t.flat().map(String);
  }
  if (!strings(g.rows, 1, 40)) { r.err(`${where}: needs "rows"`); return []; }
  return g.rows;
}

function checkTyped(g, q, marks, where, r) {
  const alts = g.answers && g.answers[q];
  if (!strings(alts, 1, 8)) return r.err(`${where} q${q}: "answers" needs a list of accepted answers`);
  alts.forEach(a => { if (!A.fits(a, g.limit)) r.err(`${where} q${q}: "${a}" breaks the limit ${g.limit}`); });
  const heard = (marks[q] || []).map(m => A.normalize(m.text));
  const ok = A.accepted([alts[0]]);
  if (!heard.some(h => ok.has(h))) r.err(`${where} q${q}: first answer "${alts[0]}" must be exactly the marked words (${(marks[q] || []).map(m => `"${m.text}"`).join(', ') || 'none'})`);
}

function checkGap(g, marks, where, r) {
  if (!LAYOUTS.includes(g.layout)) r.err(`${where}: "layout" must be one of ${LAYOUTS.join(', ')}`);
  const nums = gapTexts(g, where, r).flatMap(M.gaps);
  const want = S.range(g.from, g.to);
  if ([...nums].sort((a, b) => a - b).join() !== want.join()) r.err(`${where}: answer boxes {n} should be ${want.join(', ')}, each once (found ${nums.join(', ')})`);
  if (g.layout === 'sentences') g.rows.forEach(row => { if (M.gaps(row).length !== 1) r.warn(`${where}: sentence "${row}" should hold one gap`); });
  if (g.options) {
    checkOptions(g.options, 5, 12, where, r);
    const used = want.map(q => g.answers && g.answers[q]);
    used.forEach((l, i) => { if (!isLetter(l, (g.options || []).length)) r.err(`${where} q${want[i]}: answer must be a letter from the box`); });
    if (new Set(used).size !== used.length) r.warn(`${where}: a box letter is used twice`);
    return;
  }
  if (!A.LIMITS.includes(g.limit)) r.err(`${where}: "limit" must be one of: ${A.LIMITS.join(' | ')}`);
  want.forEach(q => checkTyped(g, q, marks, where, r));
}

function checkMcq(g, where, r) {
  checkItems(g, where, r, (it, w) => {
    if (typeof it.stem !== 'string' || !it.stem.trim()) r.err(`${w}: needs "stem"`);
    checkOptions(it.options, 3, 5, w, r);
    if (!isLetter(it.answer, (it.options || []).length)) r.err(`${w}: "answer" must be one of the option letters`);
  });
}

function checkMulti(g, where, r) {
  const n = g.to - g.from + 1;
  if (n < 2 || n > 3) r.err(`${where}: choose-two/three groups cover 2 or 3 questions`);
  if (typeof g.stem !== 'string' || !g.stem.trim()) r.err(`${where}: needs "stem"`);
  checkOptions(g.options, 5, 7, where, r);
  const ans = g.answer;
  if (!Array.isArray(ans) || ans.length !== n || new Set(ans).size !== n || !ans.every(l => isLetter(l, (g.options || []).length))) {
    r.err(`${where}: "answer" must be ${n} different option letters`);
  }
}

function checkMatch(g, where, r) {
  if (typeof g.lead !== 'string' || !g.lead.trim()) r.err(`${where}: needs "lead" (the question above the list)`);
  checkOptions(g.options, 3, 8, where, r);
  checkItems(g, where, r, (it, w) => {
    if (typeof it.text !== 'string' || !it.text.trim()) r.err(`${w}: needs "text"`);
    if (!isLetter(it.answer, (g.options || []).length)) r.err(`${w}: "answer" must be a letter from the box`);
  });
}

function checkMapGroup(g, where, r) {
  if (!['map', 'plan'].includes(g.kind)) r.err(`${where}: "kind" must be "map" or "plan"`);
  const letters = checkMap(g, where, r);
  checkItems(g, where, r, (it, w) => {
    if (typeof it.text !== 'string' || !it.text.trim()) r.err(`${w}: needs "text"`);
    if (!letters.includes(it.answer)) r.err(`${w}: "answer" ${it.answer} is not a letter on the map`);
  });
  if (Array.isArray(g.items) && letters.length <= g.items.length) r.err(`${where}: the map needs more letters than questions`);
}

const CHECKS = { gap: checkGap, mcq: checkMcq, multi: checkMulti, match: checkMatch, map: checkMapGroup };

/* Answers come in the order of the recording (choose-two groups excepted). */
function checkOrder(part, marks, r) {
  const free = new Set((part.groups || []).filter(g => g.type === 'multi').flatMap(g => S.range(g.from, g.to)));
  const [start, end] = PART_RANGE[part.n];
  let last = -1, lastQ = 0;
  for (let q = start; q <= end; q++) {
    if (free.has(q) || !marks[q]) continue;
    const pos = Math.min(...marks[q].map(m => m.pos));
    if (pos < last) r.err(`part ${part.n}: question ${q} is answered before question ${lastQ} in the recording`);
    last = pos; lastQ = q;
  }
}

function checkGroups(part, r) {
  const [start, end] = PART_RANGE[part.n];
  const groups = part.groups;
  if (!Array.isArray(groups) || !groups.length) return r.err(`part ${part.n}: needs "groups"`);
  const marks = partMarks(part);
  let next = start;
  for (const g of groups) {
    const where = `part ${part.n} ${g.type || '?'} ${g.from}-${g.to}`;
    if (g.from !== next || !(g.to >= g.from)) r.err(`${where}: groups must run on from question ${next}`);
    next = g.to + 1;
    if (!CHECKS[g.type]) { r.err(`${where}: "type" must be one of ${Object.keys(CHECKS).join(', ')}`); continue; }
    if (g.type === 'gap') checkGap(g, marks, where, r);
    else CHECKS[g.type](g, where, r);
  }
  if (next !== end + 1) r.err(`part ${part.n}: groups should end at question ${end}`);
  checkOrder(part, marks, r);
}

/* The key must score 40/40 through the same marking code the page uses. */
function checkKey(test, r) {
  const res = S.mark(test, S.keyResponses(test));
  if (res.raw !== 40) r.err(`answer key scores ${res.raw}/40; wrong: ${res.rows.filter(x => !x.right).map(x => x.q).join(', ')}`);
  const letters = S.questions(test).filter(x => x.kind === 'mcq').map(x => x.answer[0]);
  const top = Math.max(0, ...['A', 'B', 'C', 'D'].map(l => letters.filter(x => x === l).length));
  if (letters.length >= 5 && top / letters.length > 0.6) r.warn(`multiple-choice answers lean on one letter (${letters.join('')})`);
}

module.exports = { checkGroups, checkKey };
