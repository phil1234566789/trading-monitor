// c-beispiele: (1) Fälle zum Durchklicken (c Win / d meist Loss bei HTF-OB v3, Gegenbeispiele, LQ-Sweep c Win statt a Loss) mit
// Chart-Link wie dobChartUrl/dobChartLink, (2) „zu früh ausgestoppt“ und ob der M15-P2 öfter hält als ein gleich weites Kontroll-Level.
// Liest sl-statt-sperre.json, schreibt c-beispiele.json. Zielmaß WR.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { berlinOffsetMinutes, formatDatedTime } from '../../src/berlinTime.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const { alle } = JSON.parse(await readFile(path.join(here, 'sl-statt-sperre.json'), 'utf8'));
// Wie src/dobAlarm.js (dobChartUrl) und src/dobTradeStatistics.js (dobChartLink): Replay 4 h nach dem späteren Exit.
const SITE = 'https://phil1234566789.github.io/trading-monitor/', AFTER = 4 * 3600;
const link = r => `${SITE}#/?dob=${encodeURIComponent(r.id)}&instrument=${r.instrument}&bar=5m&replay=${Math.max(r.exitTime ?? 0, r.cM15.zeitSec ?? 0, r.entryTime + 300) + AFTER}`;
const tz = s => berlinOffsetMinutes(s * 1000), minutes = t => ((t / 60 + tz(t)) % 1440 + 1440) % 1440;
const session = t => { const m = minutes(t); return m < 420 ? 'Asia' : m < 630 ? 'London' : m < 780 ? 'MMM' : m < 840 ? '13–14 Uhr' : m < 1320 ? 'NY' : '22–24 Uhr'; };
const month = t => formatDatedTime(t).slice(5, 7);
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
const isHit = r => r.hitA || r.hitB;
const dLosses = r => (r.dFest ?? []).filter(x => x === -1).length, dWins = r => (r.dFest ?? []).filter(x => x > 0).length;

// Auswahl: NY/London zuerst, Assets im Wechsel, je Asset und Monat höchstens ein Fall, jüngste zuerst.
function pick(list, n) {
  const pref = l => l.sort((a, b) => (['NY', 'London'].includes(session(b.entryTime)) - ['NY', 'London'].includes(session(a.entryTime))) || b.entryTime - a.entryTime);
  const byAsset = Object.groupBy(pref(list), r => r.instrument), out = [], seen = new Set();
  for (let i = 0; out.length < n && i < 200; i++) for (const a of ['GBPUSD', 'EURUSD', 'XAUUSD']) {
    const r = byAsset[a]?.[i]; if (!r || out.length >= n) continue;
    const k = a + month(r.entryTime); if (seen.has(k)) continue; seen.add(k); out.push(r);
  }
  return out;
}
const fall = r => ({ asset: r.instrument, richtung: r.side === -1 ? 'Short' : 'Long', lauf: r.run, entry: r.entry, session: session(r.entryTime), entryPreis: r.entryPrice,
  slAlt: r.sl, slNeu: r.cM15.sl, m15Pivot: r.cM15.swing, tp: r.target, a: r.outcome === 'success' ? 'Win' : 'Loss', c: r.cM15.ergebnis === 'win' ? 'Win' : r.cM15.ergebnis === 'loss' ? 'Loss' : 'offen',
  cZeit: r.cM15.zeit, dLoss: `${dLosses(r)}/20`, link: link(r) });
const out = { measurement: 'c-beispiele-v1' };
const htf = alle.filter(r => r.run.includes('setup') && isHit(r) && r.cM15.sl != null), lq = alle.filter(r => r.run.includes('lq-sweep') && isHit(r) && r.cM15.sl != null);
out.htfCWinDLoss = pick(htf.filter(r => r.cM15.ergebnis === 'win' && dLosses(r) >= 15), 10).map(fall);
out.gegenbeispiele = pick(htf.filter(r => r.cM15.ergebnis === 'loss' && dWins(r) >= 15), 5).map(fall);
out.lqCWinALoss = pick(lq.filter(r => r.cM15.ergebnis === 'win' && r.outcome === 'loss'), 5).map(fall);
out.anzahl = { htfCWinDLoss: htf.filter(r => r.cM15.ergebnis === 'win' && dLosses(r) >= 15).length, htfGegen: htf.filter(r => r.cM15.ergebnis === 'loss' && dWins(r) >= 15).length,
  lqCWinALoss: lq.filter(r => r.cM15.ergebnis === 'win' && r.outcome === 'loss').length };

// (2a) Zu früh ausgestoppt: alle DOB-Losses mit M15-P2; nach dem Stopp zuerst Ziel (ja) oder zuerst M15-P2-Level (nein).
const zuFrueh = list => { const l = list.filter(r => r.outcome === 'loss' && r.zuFrueh), j = l.filter(r => r.zuFrueh === 'ja').length, nn = l.filter(r => r.zuFrueh === 'nein').length;
  return { losses: list.filter(r => r.outcome === 'loss').length, mitM15: l.length, ja: j, nein: nn, offen: l.length - j - nn, anteilJa: pct(j, j + nn) }; };
const groups = { ...Object.groupBy(alle, r => r.run), 'alle LQ-Sweep': alle.filter(r => r.run.includes('lq-sweep')), 'alle HTF-OB v3': alle.filter(r => r.run.includes('setup')), alle };
out.zuFrueh = Object.fromEntries(Object.entries(groups).map(([g, l]) => [g, { gesamt: zuFrueh(l), H1: zuFrueh(l.filter(r => r.half === 'H1')), H2: zuFrueh(l.filter(r => r.half === 'H2')),
  treffer: zuFrueh(l.filter(isHit)), keinTreffer: zuFrueh(l.filter(r => !isHit(r))) }]));
// (2b) Hält der M15-P2 bis zum Ziel (Trades, die das Ziel irgendwann erreichen) öfter als ein gleich weites Kontroll-Level?
const haelt = list => { const l = list.filter(r => r.haelt && r.haeltKontrolle), mean = f => l.length ? +(100 * l.reduce((s, r) => s + f(r), 0) / l.length).toFixed(1) : null;
  return { n: l.length, p2HaeltDocht: mean(r => !r.haelt.wick), kontrolleHaeltDocht: mean(r => 1 - r.haeltKontrolle.wickGebrochen),
    p2HaeltSchluss: mean(r => !r.haelt.close), kontrolleHaeltSchluss: mean(r => 1 - r.haeltKontrolle.closeGebrochen) }; };
out.haelt = Object.fromEntries(Object.entries(groups).map(([g, l]) => [g, { gesamt: haelt(l), H1: haelt(l.filter(r => r.half === 'H1')), H2: haelt(l.filter(r => r.half === 'H2')) }]));
await writeFile(path.join(here, 'c-beispiele.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.anzahl));
for (const k of ['htfCWinDLoss', 'gegenbeispiele', 'lqCWinALoss']) { console.log('--', k); for (const f of out[k]) console.log(f.asset, f.richtung, f.lauf, f.entry, f.session, 'E', f.entryPreis, 'SL', f.slAlt, '→', f.slNeu, 'P2', f.m15Pivot, 'TP', f.tp, 'a', f.a, 'c', f.c, f.cZeit, 'd-Loss', f.dLoss); }
for (const [g, v] of Object.entries(out.zuFrueh)) console.log('zuFrüh', g.padEnd(24), ['gesamt', 'H1', 'H2', 'treffer', 'keinTreffer'].map(h => `${h} ${v[h].anteilJa}% (${v[h].ja}/${v[h].ja + v[h].nein}, offen ${v[h].offen}, ohne P2 ${v[h].losses - v[h].mitM15})`).join(' | '));
for (const [g, v] of Object.entries(out.haelt)) console.log('hält', g.padEnd(24), ['gesamt', 'H1', 'H2'].map(h => `${h} n ${v[h].n} Docht P2 ${v[h].p2HaeltDocht} / Kontr ${v[h].kontrolleHaeltDocht} · Schluss ${v[h].p2HaeltSchluss} / ${v[h].kontrolleHaeltSchluss}`).join(' | '));
