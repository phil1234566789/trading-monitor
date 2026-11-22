// Preisdiagramm DR #148 (M5, 01.10.2026 11:45–18:00 Berlin) aus fall-dr148.json → fall-dr148.svg. Farben aus src/chartColors.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Hexwerte aus DEFAULT_CHART_COLORS (src/chartColors.js); das Modul selbst braucht localStorage und läuft nicht unter Node.
const C = Object.fromEntries(Object.entries({ candleUp: '#26a69a', candleDown: '#ef5350', obBearM5: '#ef5350', obBull15m: '#4dd0e1', obBull1h: '#26a69a',
  liquidityLowM5: '#ff9800', tradeTarget: '#ab47bc' }).map(([k, hex]) => [k, { hex }]));
const here = fileURLToPath(new URL('.', import.meta.url));
const fall = JSON.parse(await fs.readFile(path.join(here, 'fall-dr148.json'), 'utf8'));
const t0 = Date.parse('2026-10-01T09:45:00Z') / 1000, t1 = Date.parse('2026-10-01T16:05:00Z') / 1000;
const k = fall.kerzen.filter(([t]) => t >= t0 && t < t1);
const W = 1100, H = 560, L = 70, R = 300, T = 30, Bm = 40, lo = 1.3183, hi = 1.3253;
const x = t => L + (t - t0) / (t1 - t0) * (W - L - R), y = p => T + (hi - p) / (hi - lo) * (H - T - Bm), bw = (W - L - R) / k.length * 0.7;
const col = key => C[key]?.hex ?? '#888', berlin = t => new Date((t + 7200) * 1000).toISOString().slice(11, 16); // CEST am 01.10.
const T_ = s => Date.parse(`2026-10-01T${s}:00Z`) / 1000 - 7200;
const box = (from, to, top, bot, key, op, label) => `<rect x="${x(from)}" y="${y(top)}" width="${x(to) - x(from)}" height="${y(bot) - y(top)}" fill="${col(key)}" fill-opacity="${op}" stroke="${col(key)}" stroke-opacity=".6"/>` +
  `<text x="${x(from) + 4}" y="${y(top) + 13}" font-size="11" fill="${col(key)}">${label}</text>`;
const line = (p, key, dash, label, from = t0) => `<line x1="${x(from)}" x2="${W - R + 10}" y1="${y(p)}" y2="${y(p)}" stroke="${col(key)}" stroke-width="1.5" ${dash ? 'stroke-dasharray="6 4"' : ''}/>` +
  `<text x="${W - R + 14}" y="${y(p) + 4}" font-size="12" fill="#333">${label}</text>`;
const dot = (t, p, label, dy = -8) => `<circle cx="${x(t) + bw / 2}" cy="${y(p)}" r="5" fill="none" stroke="#333" stroke-width="2"/><text x="${x(t) + bw / 2 + 8}" y="${y(p) + dy}" font-size="12" fill="#333">${label}</text>`;
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter,system-ui,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`,
  box(T_('13:00'), t1, 1.32261, 1.31923, 'obBull1h', 0.18, '1H-OB 13:00 bullisch, ungetestet (Journal-Anti-Confluence)'),
  box(T_('13:30'), t1, 1.3231, 1.32186, 'obBull15m', 0.22, ''),
  `<text x="${x(T_('16:10'))}" y="${y(1.32186) - 4}" font-size="11" fill="#00838f">15M-FVG 13:30 offen</text>`,
  box(T_('15:00'), t1, 1.3232, 1.32274, 'obBearM5', 0.35, 'Entry-OB M5 15:00'),
  ...k.map(([t, o, h, l, c]) => { const up = c >= o, cl = col(up ? 'candleUp' : 'candleDown');
    return `<line x1="${x(t) + bw / 2}" x2="${x(t) + bw / 2}" y1="${y(h)}" y2="${y(l)}" stroke="${cl}"/><rect x="${x(t)}" y="${y(Math.max(o, c))}" width="${bw}" height="${Math.max(1, Math.abs(y(o) - y(c)))}" fill="${cl}"/>`; }),
  line(1.32377, 'candleUp', true, 'SL hinter P2-LH 1,32377 → hält, TP +2,09 R'),
  line(1.32292, 'candleDown', true, 'SL Journal/DOB 1,32292 → 15:45 getroffen'),
  line(1.3223, 'liquidityLowM5', false, 'Entry 15:14 · 1,32230'),
  line(1.32106, 'tradeTarget', true, 'Ziel DOB 1,32106 (2R)'),
  line(1.31923, 'tradeTarget', false, 'Ziel Journal 1,31923 · 17:30'),
  dot(T_('14:30'), 1.32372, 'P2-LH 14:30 · 1,32372'), dot(T_('13:55'), 1.3249, 'Hoch 13:55 · 1,32490'),
  dot(T_('13:25'), 1.32111, 'protected-low 13:25 · 1,32111', 18), dot(T_('15:45'), 1.32333, 'SL-Treffer 15:45', -10),
  dot(T_('12:00'), 1.31923, 'bullischer LQ-Sweep 11:55–12:00 · 1,31923', 18),
  ...[...Array(13).keys()].map(i => t0 + 900 + i * 1800).map(t => `<text x="${x(t)}" y="${H - 14}" font-size="11" fill="#666">${berlin(t)}</text>`),
  `<text x="${L}" y="18" font-size="14" font-weight="600" fill="#111">GBPUSD M5 01.10.2026 (Berlin) · DR #148 Short</text></svg>`].join('\n');
await fs.writeFile(path.join(here, 'fall-dr148.svg'), svg);
console.log('fall-dr148.svg', k.length, 'Kerzen');
