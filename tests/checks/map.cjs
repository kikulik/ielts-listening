/* Checks a map or plan drawing: shapes stay on the 600 x 400 canvas, letters are clear and unique. */
const W = 600, H = 400;
const KINDS = { zone: ['x', 'y', 'w', 'h'], round: ['x', 'y', 'rx', 'ry'], path: ['pts'], spot: ['x', 'y', 'letter'], label: ['x', 'y', 'text'], gate: ['x', 'y', 'text'], you: ['x', 'y'] };
const ZONE_FILLS = ['grass', 'field', 'wood', 'water', 'sand', 'paving', 'building', 'room', 'parking', 'plain'];
const PATH_FILLS = ['road', 'path', 'water', 'rail', 'corridor'];
const COMPASS = { x: 540, y: 60 };
const MIN_GAP = 30;

const num = v => typeof v === 'number' && Number.isFinite(v);
const inside = (x, y) => x >= 0 && x <= W && y >= 0 && y <= H;

function checkShape(s, i, where, r) {
  const need = KINDS[s && s.k];
  if (!need) return r.err(`${where} shape ${i + 1}: "k" must be one of ${Object.keys(KINDS).join(', ')}`);
  for (const f of need) if (s[f] === undefined) r.err(`${where} shape ${i + 1} (${s.k}): needs "${f}"`);
  if (s.k === 'zone') {
    if (![s.x, s.y, s.w, s.h].every(num) || !inside(s.x, s.y) || !inside(s.x + s.w, s.y + s.h)) r.err(`${where} zone ${i + 1}: off the 600 x 400 canvas`);
    if (s.fill && !ZONE_FILLS.includes(s.fill)) r.err(`${where} zone ${i + 1}: fill must be one of ${ZONE_FILLS.join(', ')}`);
  }
  if (s.k === 'round') {
    if (![s.x, s.y, s.rx, s.ry].every(num) || !inside(s.x - s.rx, s.y - s.ry) || !inside(s.x + s.rx, s.y + s.ry)) r.err(`${where} round ${i + 1}: off the canvas`);
    if (s.fill && !ZONE_FILLS.includes(s.fill)) r.err(`${where} round ${i + 1}: fill must be one of ${ZONE_FILLS.join(', ')}`);
  }
  if (s.k === 'path') {
    if (!Array.isArray(s.pts) || s.pts.length < 2 || !s.pts.every(p => Array.isArray(p) && num(p[0]) && num(p[1]) && inside(p[0], p[1]))) {
      r.err(`${where} path ${i + 1}: "pts" must be 2+ [x, y] points on the canvas`);
    }
    if (s.fill && !PATH_FILLS.includes(s.fill)) r.err(`${where} path ${i + 1}: fill must be one of ${PATH_FILLS.join(', ')}`);
  }
  if (['spot', 'label', 'gate', 'you'].includes(s.k) && !(num(s.x) && num(s.y) && inside(s.x, s.y))) r.err(`${where} ${s.k} ${i + 1}: off the canvas`);
}

/* Returns the letters on the map. */
function checkMap(g, where, r) {
  const shapes = g.map && g.map.shapes;
  if (!Array.isArray(shapes) || shapes.length < 6) {
    r.err(`${where}: "map.shapes" needs at least 6 shapes`);
    return [];
  }
  shapes.forEach((s, i) => checkShape(s, i, where, r));
  const spots = shapes.filter(s => s && s.k === 'spot');
  const letters = spots.map(s => s.letter);
  const expect = letters.map((_, i) => String.fromCharCode(65 + i));
  if ([...letters].sort().join('') !== expect.join('')) r.err(`${where}: map letters should be A, B, C... with none missing or repeated (found ${letters.join(', ')})`);
  spots.forEach((a, i) => {
    if (a.x > COMPASS.x && a.y < COMPASS.y) r.err(`${where}: letter ${a.letter} sits under the compass (top-right corner)`);
    spots.slice(i + 1).forEach(b => {
      if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_GAP) r.err(`${where}: letters ${a.letter} and ${b.letter} are closer than ${MIN_GAP}`);
    });
  });
  return letters;
}

module.exports = { checkMap, W, H, ZONE_FILLS, PATH_FILLS };
