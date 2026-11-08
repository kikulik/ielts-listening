/* Rewrites transcript text into words the speech engine reads the way a British speaker would.
   The rules match "Writing speech the voices can say" in docs/AUTHORING.md. */
const { plain } = require('../js/markup.js');

const UNITS = 'metres?|meters?|kilometres?|km|centimetres?|cm|millimetres?|mm|kilos?|kilograms?|kg|grams?|g|litres?|tonnes?|tons?|miles?|hectares?|degrees?|per|percent|million|billion|times|seconds?|minutes?|hours?|years?|%';
const TIME_BEFORE = /\b(?:at|from|until|till|by|to|after|before|around|about|between|and|or|opens?|closes?|starts?|begins?|ends?|finishes?|leaves?|arrives?|departs?|is|it's|that's)\s*$/i;

/* "H-A-R-R-Y" -> "H, A, double R, Y"; sep " " reads digit groups as one run. */
function spell(chars, sep = ', ') {
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] === '0' ? 'oh' : chars[i];
    if (chars[i + 1] === chars[i] && chars[i + 2] !== chars[i]) { out.push(`double ${c}`); i += 1; } else out.push(c);
  }
  return out.join(sep);
}

const spelled = s => s.replace(/\b[A-Z](?:-[A-Z])+\b/g, m => spell(m.split('-')));

/* Codes like BS7 4QN or JX472: character by character. */
const codes = s => s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,8}\b/g, m => spell(m.split('')));

/* Phone and reference numbers: "0798 445 2210" -> "oh seven nine eight, double four five, ..." */
const digitRuns = s => s.replace(/(?<![\d,.])\b(?:0\d{2,}(?: \d{2,})*|\d{5,})\b/g, m => m.split(' ').map(g => spell(g.split(''), ' ')).join(', '));

/* £38 -> 38 pounds, £12.50 -> 12 pounds 50, $1.25 -> 1 dollar 25, £3 million -> 3 million pounds */
const MONEY = { '£': ['pound', 'pounds', 'p'], '$': ['dollar', 'dollars', 'cents'], '€': ['euro', 'euros', 'cents'] };
function money(s) {
  return s.replace(/([£$€])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d\d))?(\s(?:million|billion|thousand))?/g, (_, sym, whole, cents, big) => {
    const [one, many, small] = MONEY[sym];
    const n = Number(whole.replace(/,/g, ''));
    if (big) return `${whole}${big} ${many}`;
    if (n === 0 && cents) return `${Number(cents)} ${sym === '£' ? 'pence' : small}`;
    const unit = n === 1 ? one : many;
    return cents && cents !== '00' ? `${whole} ${unit} ${Number(cents)}` : `${whole} ${unit}`;
  });
}

/* 9.30 -> 9 30, 10.05 -> 10 oh 5, 6.00 pm -> 6 p.m.; decimals with units are left alone. */
function times(s) {
  return s.replace(/(^|[^\d.£$€])(\d{1,2})\.(\d\d)(?!\d|\.\d)(\s?(?:am|pm|a\.m\.|p\.m\.))?(?=(\s+(\S+))?)/gi, (all, pre, h, m, ap, _, next, offset, str) => {
    const before = str.slice(0, offset + pre.length);
    const unit = next && new RegExp(`^(?:${UNITS})\\b`, 'i').test(next);
    const isTime = Number(h) <= 24 && Number(m) < 60 && !unit && (ap || TIME_BEFORE.test(before));
    if (!isTime) return all;
    const mins = m === '00' ? (ap ? '' : " o'clock") : m[0] === '0' ? ` oh ${m[1]}` : ` ${m}`;
    return `${pre}${h}${mins}${ap ? ` ${/p/i.test(ap) ? 'p.m.' : 'a.m.'}` : ''}`;
  });
}
const ampm = s => s.replace(/\b(\d{1,2})\s?(am|pm)\b/gi, (_, h, ap) => `${h} ${ap.toLowerCase() === 'pm' ? 'p.m.' : 'a.m.'}`);

/* 1998 -> nineteen ninety-eight, 1905 -> nineteen oh five, 2024 -> twenty twenty-four */
function years(s) {
  return s.replace(/(^|[^\d,.£$€])(1[1-9]\d\d|20[1-9]\d)(?!\d|,\d)/g, (_, pre, y) => {
    const hi = y.slice(0, 2), lo = Number(y.slice(2));
    if (lo === 0) return `${pre}${hi} hundred`;
    return `${pre}${hi} ${lo < 10 ? `oh ${lo}` : lo}`;
  });
}

const words = s => s
  .replace(/&/g, ' and ')
  .replace(/([ap])\.m\.\./g, '$1.m.')
  .replace(/\be\.g\./gi, 'for example')
  .replace(/\bi\.e\./gi, 'that is')
  .replace(/\betc\./gi, 'etcetera')
  .replace(/\s+/g, ' ')
  .trim();

/* Order matters: spelling and codes before numbers, money before times. */
const sayable = text => words(years(ampm(times(money(digitRuns(codes(spelled(plain(text)))))))));

/* Splits a turn into sentences so long turns get natural pauses. */
const sentences = text => text.split(/(?<=[.!?])\s+(?=["'A-Z0-9£$€])/).map(s => s.trim()).filter(Boolean);

module.exports = { sayable, sentences, spell };
