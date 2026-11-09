/* Rewrites transcript text into words the speech engine reads the way a British speaker would.
   The rules match "Writing speech the voices can say" in docs/AUTHORING.md. */
const { plain } = require('../js/markup.js');

const UNITS = 'metres?|meters?|kilometres?|km|centimetres?|cm|millimetres?|mm|kilos?|kilograms?|kg|grams?|g|litres?|tonnes?|tons?|miles?|hectares?|degrees?|per|percent|million|billion|times|seconds?|minutes?|hours?|years?|%';

/* "H-A-R-R-Y" -> "H, A, double R, Y"; sep " " reads digit groups as one run. */
function spell(chars, sep = ', ') {
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] === '0' ? 'oh' : chars[i];
    if (chars[i + 1] === chars[i] && chars[i + 2] !== chars[i]) { out.push(`double ${c}`); i += 1; } else out.push(c);
  }
  return out.join(sep);
}

/* Everything read character by character is wrapped in SPELL marks, so tools/speech.cjs can
   record it slower than the rest of the sentence. */
const SPELL = ['\u27E6', '\u27E7'];
const mark = t => `${SPELL[0]}${t}${SPELL[1]}`;

const spelled = s => s.replace(/\b[A-Z](?:-[A-Z])+\b/g, m => mark(spell(m.split('-'))));

/* Codes like BS7 4QN or JX472: character by character. */
const codes = s => s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,8}\b/g, m => mark(spell(m.split(''))));

/* Phone and reference numbers: "0798 445 2210" -> "oh seven nine eight, double four five, ...".
   Four-digit numbers that cannot be years (5836) are read digit by digit too. */
const YEAR = /^(1[1-9]\d\d|20\d\d)$/;
const digitRuns = s => s.replace(/(?<![\d,.])\b(?:0\d{2,}(?: \d{2,})*|\d{4,})\b(?!,\d)/g,
  m => (YEAR.test(m) ? m : mark(m.split(' ').map(g => spell(g.split(''), ' ')).join(', '))));

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

/* 9.30 -> 9 30, 10.05 -> 10 oh 5, 6.00 pm -> 6 p.m.; a number followed by a unit (2.45 metres) is a decimal. */
function times(s) {
  return s.replace(/(^|[^\d.£$€])(\d{1,2})\.(\d\d)(?!\d|\.\d)(\s?(?:am|pm|a\.m\.|p\.m\.))?(?=(\s+(\S+))?)/gi, (all, pre, h, m, ap, _, next) => {
    const unit = next && new RegExp(`^(?:${UNITS})\\b`, 'i').test(next);
    const isTime = Number(h) <= 24 && Number(m) < 60 && !unit;
    if (!isTime) return all;
    const mins = m === '00' ? (ap ? '' : " o'clock") : m[0] === '0' ? ` oh ${m[1]}` : ` ${m}`;
    return `${pre}${h}${mins}${ap ? ` ${/p/i.test(ap) ? 'p.m.' : 'a.m.'}` : ''}`;
  });
}
const pence = s => s.replace(/\b(\d+)p\b/g, (_, n) => `${n} ${n === '1' ? 'penny' : 'pence'}`);
const ampm = s => s.replace(/\b(\d{1,2})\s?(am|pm)\b/gi, (_, h, ap) => `${h} ${ap.toLowerCase() === 'pm' ? 'p.m.' : 'a.m.'}`);

/* 1970s -> nineteen seventies, 1900s -> nineteen hundreds, 2020s -> twenty twenties, 80s -> eighties */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const upTo99 = n => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const plural = t => (t === 'ten' ? 'tens' : t.replace(/y$/, 'ies'));
function decades(s) {
  return s.replace(/(^|[^\d£$€,.])(?:(1[1-9]|20)(\d)0|([2-9])0)s\b/g, (_, pre, hi, d, short) => {
    if (short) return `${pre}${plural(TENS[+short])}`;
    if (d === '0') return `${pre}${hi === '20' ? 'two thousands' : `${upTo99(+hi)} hundreds`}`;
    return `${pre}${upTo99(+hi)} ${plural(TENS[+d])}`;
  });
}

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
  .replace(/\bMs\b\.?/g, 'Miz')
  .replace(/([ap])\.m\.\./g, '$1.m.')
  .replace(/\be\.g\./gi, 'for example')
  .replace(/\bi\.e\./gi, 'that is')
  .replace(/\betc\./gi, 'etcetera')
  .replace(/\s+/g, ' ')
  .trim();

/* "use" is a noun after these words ("no use", "make use of", "land use"). Anywhere else it is the
   verb, which the voices often say like the noun ("people yooss it"), so it is respelled. */
const USE_NOUN = new Set(('a an the no much any some its their our your his her my this in of for into new minor general ' +
  'promising practical main good best full further wide widespread common everyday daily regular frequent heavy ' +
  'limited personal proper public private land tool water energy drug make made makes making little more less same').split(' '));
const verbUse = s => s.replace(/\b([Uu])se\b/g, (w, u, at) => {
  const prev = (s.slice(0, at).match(/([A-Za-z']+)[^A-Za-z']*$/) || [])[1];
  return prev && USE_NOUN.has(prev.toLowerCase()) ? w : `${u === 'U' ? 'Y' : 'y'}ooz`;
});

/* Order matters: spelling and codes before numbers, money before times. */
const sayable = text => verbUse(words(years(decades(ampm(pence(times(money(digitRuns(codes(spelled(plain(text))))))))))));

/* Splits a turn into sentences so long turns get natural pauses. */
const sentences = text => text.split(/(?<=[.!?])\s+(?=["'A-Z0-9£$€])/).map(s => s.trim()).filter(Boolean);

module.exports = { sayable, sentences, spell, SPELL };
