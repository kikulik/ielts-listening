/* Checks a test's parts, speakers, sections and transcript lines. */
const M = require('../../js/markup.js');

const PART_RANGE = { 1: [1, 10], 2: [11, 20], 3: [21, 30], 4: [31, 40] };
const SPEAKERS = { 1: [2, 3], 2: [1, 2], 3: [2, 4], 4: [1, 1] };
const SECTIONS = { 1: 2, 2: 2, 3: 2, 4: 1 };
const WORDS = { 1: [650, 1050], 2: [650, 1050], 3: [750, 1150], 4: [700, 1100] };
const HARD_WORDS = [450, 1400];
const VOICES_PER_KIND = 4;

const wordCount = s => (s.match(/[A-Za-z0-9£$€'’-]+/g) || []).length;

/* Characters the audio cannot speak well, outside answer markers. */
function badChars(text) {
  const bare = text.replace(M.MARK, ' ');
  const out = [];
  if (/[{}[\]|<>*_#~^\\]/.test(bare)) out.push('brackets or symbols');
  if (/\.\.\.|…/.test(bare)) out.push('an ellipsis');
  if (/[()]/.test(bare)) out.push('round brackets (write it as speech)');
  if (/\b(um+|er+m?|uh+)\b/i.test(bare)) out.push('"um"/"er" (the voices say these badly; use "Well," "Oh," "Right,")');
  return out;
}

function checkSpeakers(part, r) {
  const sp = part.speakers;
  if (!sp || typeof sp !== 'object') return r.err(`part ${part.n}: speakers missing`);
  const ids = Object.keys(sp);
  const [min, max] = SPEAKERS[part.n];
  if (ids.length < min || ids.length > max) r.err(`part ${part.n}: ${ids.length} speakers, expected ${min}-${max}`);
  const kinds = {};
  for (const id of ids) {
    const s = sp[id];
    if (!/^[A-Z]{1,3}$/.test(id)) r.err(`part ${part.n}: speaker id "${id}" should be 1-3 capital letters`);
    if (!s || typeof s.name !== 'string' || !s.name.trim()) r.err(`part ${part.n}: speaker ${id} needs a name`);
    if (!s || !['m', 'f'].includes(s.g)) r.err(`part ${part.n}: speaker ${id} needs "g": "m" or "f"`);
    if (!s || !['gb', 'us'].includes(s.accent)) r.err(`part ${part.n}: speaker ${id} needs "accent": "gb" or "us"`);
    const k = s && `${s.g}-${s.accent}`;
    kinds[k] = (kinds[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(kinds)) if (n > VOICES_PER_KIND) r.err(`part ${part.n}: too many ${k} speakers for distinct voices`);
}

function checkLines(part, sec, r) {
  const where = `part ${part.n} questions ${sec.from}-${sec.to}`;
  if (!Array.isArray(sec.lines) || sec.lines.length < 3) return r.err(`${where}: needs transcript lines`);
  const seen = new Set();
  sec.lines.forEach((line, i) => {
    if (!Array.isArray(line) || line.length !== 2 || typeof line[1] !== 'string') return r.err(`${where} line ${i + 1}: must be ["SPEAKER", "text"]`);
    const [id, text] = line;
    if (!part.speakers || !part.speakers[id]) r.err(`${where} line ${i + 1}: unknown speaker "${id}"`);
    if (!text.trim()) r.err(`${where} line ${i + 1}: empty`);
    for (const b of badChars(text)) r.err(`${where} line ${i + 1}: contains ${b}`);
    for (const m of M.marks(text)) {
      if (m.q < sec.from || m.q > sec.to) r.err(`${where} line ${i + 1}: marker for question ${m.q} is outside this section`);
      seen.add(m.q);
    }
    if (/\[\[|\]\]/.test(text.replace(M.MARK, ''))) r.err(`${where} line ${i + 1}: broken [[n|words]] marker`);
  });
  for (let q = sec.from; q <= sec.to; q++) if (!seen.has(q)) r.err(`${where}: no [[${q}|...]] marker in the transcript`);
}

function checkSections(part, r) {
  const [start, end] = PART_RANGE[part.n];
  const secs = part.sections;
  if (!Array.isArray(secs) || secs.length !== SECTIONS[part.n]) {
    return r.err(`part ${part.n}: needs ${SECTIONS[part.n]} section(s), found ${Array.isArray(secs) ? secs.length : 0}`);
  }
  let next = start;
  for (const sec of secs) {
    if (sec.from !== next) r.err(`part ${part.n}: section should start at question ${next}, starts at ${sec.from}`);
    if (!(sec.to >= sec.from + 1)) r.err(`part ${part.n}: section ${sec.from}-${sec.to} needs at least 2 questions`);
    next = sec.to + 1;
    checkLines(part, sec, r);
  }
  if (next !== end + 1) r.err(`part ${part.n}: sections should end at question ${end}`);
}

function partWords(part) {
  return (part.sections || []).flatMap(s => s.lines || []).reduce((n, l) => n + wordCount(M.plain(l[1] || '')), 0);
}

function checkPart(part, r) {
  if (!part || typeof part.n !== 'number') return r.err('part without "n"');
  if (typeof part.topic !== 'string' || part.topic.length < 3 || part.topic.length > 70) r.err(`part ${part.n}: "topic" should be a short title`);
  if (typeof part.context !== 'string' || !/^[a-z]/.test(part.context) || /\.$/.test(part.context)) {
    r.err(`part ${part.n}: "context" should finish "You will hear ..." in lower case, with no full stop`);
  }
  checkSpeakers(part, r);
  checkSections(part, r);
  const words = partWords(part), [lo, hi] = WORDS[part.n];
  if (words < HARD_WORDS[0] || words > HARD_WORDS[1]) r.err(`part ${part.n}: ${words} words, far outside ${lo}-${hi}`);
  else if (words < lo || words > hi) r.warn(`part ${part.n}: ${words} words, aim for ${lo}-${hi}`);
  return words;
}

/* Optional "say": { "words in the transcript": "how the speech engine should spell them" }. */
function checkSay(test, r) {
  if (test.say === undefined) return;
  if (!test.say || typeof test.say !== 'object' || Array.isArray(test.say)) return r.err('"say" must be an object');
  const text = test.parts.flatMap(p => p.sections || []).flatMap(s => s.lines || []).map(l => M.plain(l[1])).join('\n');
  for (const [from, to] of Object.entries(test.say)) {
    if (typeof to !== 'string' || !to.trim() || to === from) r.err(`say "${from}": needs a different spelling`);
    else if (!text.includes(from)) r.err(`say "${from}": not found in the transcript`);
  }
}

function checkTest(test, id, r) {
  if (test.id !== id) r.err(`"id" is ${test.id}, file name says ${id}`);
  if (!Array.isArray(test.parts) || test.parts.length !== 4) return r.err('needs exactly 4 parts');
  test.parts.forEach((p, i) => { if (p.n !== i + 1) r.err(`part ${i + 1} has "n": ${p.n}`); });
  checkSay(test, r);
  return test.parts.map(p => checkPart(p, r));
}

module.exports = { PART_RANGE, wordCount, partWords, checkTest };
