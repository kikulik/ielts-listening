/* IELTS Listening Practice: draws a map or building plan from the shapes in a test file.
   Always printed in light colours, like a picture on the question paper. Also used by tools/map-preview.html. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const W = 600, H = 400;
  const INK = '#1B1F2A';
  const ZONE = {
    grass: ['#D5EBC0', '#9CC77E'], field: ['#ECF3CF', '#B9CC86'], wood: ['#AFD497', '#6E9E52'], water: ['#C4E0F4', '#7FB2D9'],
    sand: ['#F5E7BF', '#D6BE7A'], paving: ['#E8E5DE', '#B9B4A8'], building: ['#F4E6CF', '#7E6A50'], room: ['#FFFFFF', INK],
    parking: ['#DEDEE4', '#9A9AA6'], plain: ['#FFFFFF', '#9A9AA6']
  };
  const PATH = { road: ['#CFCBC2', '#8F8B80'], path: ['#EBDAB2', '#B79C5F'], water: ['#A6D0EE', '#6EA6D0'], rail: ['#5E5E5E', '#5E5E5E'], corridor: ['#EFECE5', '#A9A497'] };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Short labels stay on one line; long ones wrap to fit the shape. */
  function lines(text, width) {
    const max = Math.max(6, Math.floor(width / 7.4));
    const out = [];
    for (const word of String(text).split(' ')) {
      const last = out[out.length - 1];
      if (last && `${last} ${word}`.length <= max) out[out.length - 1] = `${last} ${word}`; else out.push(word);
    }
    return out;
  }
  function label(x, y, text, { width = 160, size = 13, weight = 700, angle = 0, italic = false } = {}) {
    const ls = lines(text, width), lh = size * 1.15, top = y - ((ls.length - 1) * lh) / 2;
    const rot = angle ? ` transform="rotate(${angle} ${x} ${y})"` : '';
    const spans = ls.map((l, i) => `<tspan x="${x}" y="${(top + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join('');
    return `<text${rot} text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} fill="${INK}" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${spans}</text>`;
  }

  function zone(s) {
    const [fill, edge] = ZONE[s.fill] || ZONE.plain;
    const r = s.fill === 'room' || s.fill === 'building' ? 2 : 6;
    const box = `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${r}" fill="${fill}" stroke="${edge}" stroke-width="${s.fill === 'room' ? 2 : 1.5}"/>`;
    return box + (s.label ? label(s.x + s.w / 2, s.y + s.h / 2, s.label, { width: s.w - 8 }) : '');
  }
  function round(s) {
    const [fill, edge] = ZONE[s.fill] || ZONE.plain;
    const shape = `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>`;
    return shape + (s.label ? label(s.x, s.y, s.label, { width: s.rx * 2 - 10 }) : '');
  }

  /* The label of a road or river sits on its longest straight stretch, turned to follow it. */
  function pathLabel(s) {
    let best = null;
    for (let i = 1; i < s.pts.length; i++) {
      const [a, b] = [s.pts[i - 1], s.pts[i]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!best || len > best.len) best = { a, b, len };
    }
    let angle = (Math.atan2(best.b[1] - best.a[1], best.b[0] - best.a[0]) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    const x = (best.a[0] + best.b[0]) / 2, y = (best.a[1] + best.b[1]) / 2;
    return label(x, y, s.label, { width: best.len - 20, size: 12, angle: Math.round(angle), italic: s.fill === 'water' });
  }
  function path(s) {
    const [fill, edge] = PATH[s.fill] || PATH.road;
    const w = s.w || 16, pts = s.pts.map(p => p.join(',')).join(' ');
    const line = (stroke, width, extra = '') => `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="butt" stroke-linejoin="round"${extra}/>`;
    let body;
    if (s.fill === 'rail') body = line(fill, 4) + line(fill, 12, ' stroke-dasharray="2 9"');
    else if (s.fill === 'path') body = line(edge, w + 2, ' stroke-dasharray="6 4"') + line(fill, w);
    else body = line(edge, w + 3) + line(fill, w);
    return body + (s.label ? pathLabel(s) : '');
  }

  const spot = s => `<g><circle cx="${s.x}" cy="${s.y}" r="13" fill="#FFFFFF" stroke="${INK}" stroke-width="2.2"/>` +
    `<text x="${s.x}" y="${s.y}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${INK}">${esc(s.letter)}</text></g>`;
  const gate = s => `<path d="M${s.x - 9} ${s.y + 6} L${s.x} ${s.y - 8} L${s.x + 9} ${s.y + 6} Z" fill="${INK}"/>` + label(s.x, s.y + 18, s.text, { size: 12 });
  const you = s => `<circle cx="${s.x}" cy="${s.y}" r="7" fill="#C62828" stroke="#FFFFFF" stroke-width="2"/>` + label(s.x, s.y + 17, s.text || 'You are here', { size: 12 });
  const free = s => label(s.x, s.y, s.text, { size: 12, weight: 400, italic: true, width: 220 });
  const compass = () => `<g transform="translate(570 30)"><circle r="17" fill="#FFFFFF" stroke="${INK}" stroke-width="1.5"/>` +
    `<path d="M0 -12 L6 6 L0 2 L-6 6 Z" fill="${INK}"/><text y="-21" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}" dominant-baseline="auto">N</text></g>`;

  const DRAW = { zone, round, path, spot, gate, you, label: free };

  /* Returns SVG markup. Letters are drawn last so roads and labels never cover them. */
  function svg(map, title) {
    const shapes = (map && map.shapes) || [];
    const body = shapes.filter(s => s.k !== 'spot').map(s => (DRAW[s.k] ? DRAW[s.k](s) : '')).join('');
    const letters = shapes.filter(s => s.k === 'spot').map(spot).join('');
    return `<svg class="map" viewBox="0 -12 ${W} ${H + 12}" role="img" aria-label="${esc(title || 'Map')}" font-family="Atkinson Hyperlegible, system-ui, sans-serif">` +
      `<rect x="0" y="-12" width="${W}" height="${H + 12}" fill="#FFFFFF"/>${body}${letters}${compass()}</svg>`;
  }
  const letters = map => ((map && map.shapes) || []).filter(s => s.k === 'spot').map(s => s.letter).sort();

  IL.map = { svg, letters };
})(typeof self !== 'undefined' ? self : globalThis);
