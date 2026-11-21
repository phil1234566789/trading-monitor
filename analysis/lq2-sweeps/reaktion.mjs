// LQ 2.0 Datenbasis, Schritt 3: Zielgröße "Reaktion nach dem Sweep" für ALLE gesweepten LQ-1.0-Level 2026 statt Trade-Winrate.
// Grundgesamtheit: Sweeps mit M5-Schluss zurück hinter den LS innerhalb 30 min (Rest = Durchbruch, getrennt gezählt).
// Stark = MFE ≥ 1,5 H1-ATR ab Touch vor dem Re-Sweep innerhalb 3 h; keine = Re-Sweep vor 0,5 ATR. Merkmal zählt nur, wenn es in H1 UND H2 2026
// trennt (|AUC − 0,5| ≥ 0,05, p < 0,01, gleiche Richtung). Regel: gierig auf H1 gelernt, auf H2 geprüft. Schreibt reaktion.json.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { formatDatedTime } from '../../src/berlinTime.js';
import { here, input, SPAN_FROM, key, featuresFor, samples, NUM, BOOL, q, auc } from './merkmale.mjs';

const STRONG = 1.5, NONE = 0.5, WINDOW = '3h';
const half = t => +formatDatedTime(t).slice(5, 7) <= 6 ? 'H1' : 'H2';
const cls = f => f[`mfe_${WINDOW}`] >= STRONG ? 'stark' : f[`resweep_${WINDOW}`] && f[`mfe_${WINDOW}`] < NONE ? 'keine' : 'mittel';
const SESSIONS = ['Asia', 'London', 'MMM', 'NY', 'Sonstige'];
const NUM_X = [...NUM, 'sweepRangeAtr', 'sweepRejection', 'sweepBodyAtr', 'zoneDepthAtr'];
const BOOL_X = [...BOOL, 'counterFvg', 'withRoot', 'withCurrent', ...SESSIONS.flatMap(s => [`ls_${s}`, `sweep_${s}`])];
// Nachlaufende Merkmale: counterFvg entsteht in der Reaktion, sessionExtreme kennt das Session-Ende. Nicht in die Regel.
const LEAK = new Set(['counterFvg', 'sessionExtreme']);
// Sweep-Kerze und Sweep-Zone gehören schon zur Reaktion (die Spanne der Sweep-Kerze steckt in der MFE). Für die LS-Bewertung (LQ 2.0)
// zählt nur, was vor dem Sweep feststeht; die zweite Regel darf sie nutzen (Entry-Auslöser).
const SWEEP_CANDLE = new Set(['sweepRangeAtr', 'sweepRejection', 'sweepBodyAtr', 'zoneDepthAtr', 'sweepDepthPips', 'sweepDepthAtr', 'closedBack']);

const rows = [], breakouts = {};
const byKey = {};
for (const instrument of input.instruments) {
  const { features } = featuresFor(instrument);
  byKey[instrument] = features;
  for (const f of features.values()) {
    if (f.pivotTime < SPAN_FROM || f.mfe_3h == null) continue;
    breakouts[f.instrument] = (breakouts[f.instrument] ?? 0) + (f.breakout ? 1 : 0);
    if (f.breakout) continue; // Durchbruch ist kein Sweep; Anteil steht getrennt im Ergebnis
    for (const s of SESSIONS) { f[`ls_${s}`] = f.lsSession === s; f[`sweep_${s}`] = f.sweepSession === s; }
    rows.push({ ...f, half: half(f.touchedTime), cls: cls(f) });
  }
}

const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
const dist = list => Object.fromEntries(['1h', '3h', 'session'].map(w => {
  const v = list.map(r => r[`mfe_${w}`]);
  return [w, { mfe: { q25: q(v, .25), med: q(v, .5), q75: q(v, .75), q90: q(v, .9) }, maeMed: q(list.map(r => r[`mae_${w}`]), .5),
    resweep: pct(list.filter(r => r[`resweep_${w}`]).length, list.length), ab1_5: pct(v.filter(x => x >= 1.5).length, v.length) }];
}));
const value = (r, f) => typeof r[f] === 'boolean' ? +r[f] : r[f];
// Effekt je Merkmal: stark vs. keine, AUC (bei Booleans = (TPR + TNR) / 2) und Lift = P(stark | Merkmal) / P(stark).
function effect(list, f) {
  const a = auc(list.filter(r => r.cls === 'stark').map(r => value(r, f)), list.filter(r => r.cls === 'keine').map(r => value(r, f)));
  if (!a) return null;
  const out = { auc: a.auc, p: a.p };
  if (BOOL_X.includes(f)) {
    const yes = list.filter(r => r[f] === true), base = list.filter(r => r.cls === 'stark').length / list.length;
    out.anteil = pct(yes.length, list.length);
    out.lift = yes.length && base ? +(yes.filter(r => r.cls === 'stark').length / yes.length / base).toFixed(2) : null;
  }
  return out;
}
const holds = (e1, e2) => e1 && e2 && e1.p < 0.01 && e2.p < 0.01 && Math.abs(e1.auc - 0.5) >= 0.05 && Math.sign(e1.auc - 0.5) === Math.sign(e2.auc - 0.5);

// Kandidaten-Bedingungen: Booleans (wahr/falsch) und Schwellen an Quantilen der Grundgesamtheit.
function conditions(list, preOnly) {
  const out = [], ok = f => !LEAK.has(f) && !(preOnly && SWEEP_CANDLE.has(f));
  for (const f of BOOL_X.filter(ok)) { out.push({ name: f, fn: r => r[f] === true }); out.push({ name: `nicht ${f}`, fn: r => r[f] === false }); }
  for (const f of NUM_X.filter(ok)) {
    const v = list.map(r => r[f]).filter(x => x != null);
    for (const p of [.2, .4, .6, .8]) {
      const t = q(v, p);
      out.push({ name: `${f} ≥ ${t}`, fn: r => r[f] != null && r[f] >= t }, { name: `${f} ≤ ${t}`, fn: r => r[f] != null && r[f] <= t });
    }
  }
  return out;
}
const score = (list, fn) => {
  const kept = list.filter(fn), strong = list.filter(r => r.cls === 'stark').length, ks = kept.filter(r => r.cls === 'stark').length;
  const none = list.filter(r => r.cls === 'keine').length, kn = kept.filter(r => r.cls === 'keine').length;
  return { n: kept.length, precision: pct(ks, kept.length), recall: pct(ks, strong), lift: kept.length && strong ? +((ks / kept.length) / (strong / list.length)).toFixed(2) : null,
    keineBehalten: pct(kn, none), keinePrecision: pct(kn, kept.length) };
};
// Gierig: je Schritt die Bedingung mit der höchsten Precision auf H1, solange der Recall ≥ 30 % bleibt; höchstens 4 Bedingungen.
function greedy(train, preOnly) {
  const conds = conditions(train, preOnly), rule = [];
  let fn = () => true, best = score(train, fn).precision;
  for (let step = 0; step < 4; step++) {
    let pick = null;
    const prev = fn;
    for (const c of conds) {
      if (rule.includes(c.name)) continue;
      const g = r => prev(r) && c.fn(r), s = score(train, g);
      if (s.recall >= 30 && s.precision > (pick?.s.precision ?? best + 1)) pick = { c, g, s };
    }
    if (!pick) break;
    rule.push(pick.c.name); fn = pick.g; best = pick.s.precision;
  }
  return { rule, fn };
}

const out = { measurement: 'lq2-reaktion-v1', git: execSync('git rev-parse --short HEAD').toString().trim(),
  definition: { fenster: WINDOW, stark: `MFE ≥ ${STRONG} H1-ATR vor Re-Sweep`, keine: `Re-Sweep vor ${NONE} ATR`, atr: 'H1-ATR(14) zum Sweep-Zeitpunkt',
    mfe: 'ab dem Touch, vom LS-Preis weg; Re-Sweep = Extrem der 30-min-Sweep-Zone danach überschritten', durchbruch: 'kein M5-Schluss zurück hinter den LS in der Zone, nicht in der Grundgesamtheit', trennt: '|AUC−0,5| ≥ 0,05, p < 0,01 in H1 und H2, gleiche Richtung (stark vs. keine)' },
  instruments: {}, durchbrueche: breakouts };
const report = {};
for (const instrument of [...input.instruments, 'ALLE']) {
  const list = instrument === 'ALLE' ? rows : rows.filter(r => r.instrument === instrument);
  const H = { H1: list.filter(r => r.half === 'H1'), H2: list.filter(r => r.half === 'H2') };
  const counts = l => Object.fromEntries(['stark', 'mittel', 'keine'].map(c => [c, l.filter(r => r.cls === c).length]));
  const feats = Object.fromEntries([...NUM_X, ...BOOL_X].map(f => [f, { H1: effect(H.H1, f), H2: effect(H.H2, f) }]));
  const top = Object.entries(feats).filter(([, e]) => holds(e.H1, e.H2))
    .sort((a, b) => Math.abs(b[1].H1.auc + b[1].H2.auc - 1) - Math.abs(a[1].H1.auc + a[1].H2.auc - 1)).map(([f]) => f);
  const rules = { vorSweep: greedy(H.H1, true), mitSweepKerze: greedy(H.H1, false) };
  report[instrument] = rules;
  out.instruments[instrument] = { n: list.length, H1: { n: H.H1.length, ...counts(H.H1) }, H2: { n: H.H2.length, ...counts(H.H2) },
    verteilung: dist(list), merkmale: feats, trenntInBeidenHalbjahren: top,
    regeln: Object.fromEntries(Object.entries(rules).map(([k, { rule, fn }]) => [k, { bedingungen: rule, H1: score(H.H1, fn), H2: score(H.H2, fn) }])) };
}

// Fachliche Kandidaten (nur Merkmale vor dem Sweep), gleiche Bewertung wie die gierige Regel.
const CANDIDATES = {
  'LQ2.0 heute (LH nach LL + BOS ≤ 2 h)': r => r.bos2h,
  'LH nach LL': r => r.lhAfterLL === true,
  'Impuls ≥ 0,5 ATR': r => r.impulseAtr >= 0.5,
  'Impuls ≥ 1 ATR': r => r.impulseAtr >= 1,
  'Impuls ≥ 1,5 ATR': r => r.impulseAtr >= 1.5,
  'Alter ≥ 2 h': r => r.ageHours >= 2,
  'Alter ≥ 10 h': r => r.ageHours >= 10,
  'LH nach LL & (Impuls ≥ 1 ATR | Alter ≥ 2 h)': r => r.lhAfterLL === true && (r.impulseAtr >= 1 || r.ageHours >= 2),
  'Impuls ≥ 1 ATR & ≥ 1 Swing': r => r.impulseAtr >= 1 && r.brokenSwings >= 1,
  'Impuls ≥ 1,5 ATR & Sweep nicht Asia': r => r.impulseAtr >= 1.5 && r.sweepSession !== 'Asia',
  'Impuls ≥ 1 ATR & Alter ≥ 2 h & Sweep nicht Asia': r => r.impulseAtr >= 1 && r.ageHours >= 2 && r.sweepSession !== 'Asia',
  'Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia': r => r.impulseAtr >= 1 && r.brokenSwings >= 1 && r.sweepSession !== 'Asia',
  'Impuls ≥ 1 ATR & (≥ 1 Swing | Alter ≥ 10 h) & Sweep nicht Asia': r => r.impulseAtr >= 1 && (r.brokenSwings >= 1 || r.ageHours >= 10) && r.sweepSession !== 'Asia',
  'LS ist LH & Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia': r => r.isLH === true && r.impulseAtr >= 1 && r.brokenSwings >= 1 && r.sweepSession !== 'Asia',
  'LH nach LL & Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia': r => r.lhAfterLL === true && r.impulseAtr >= 1 && r.brokenSwings >= 1 && r.sweepSession !== 'Asia',
  'LH nach LL & Impuls ≥ 1 ATR & Sweep nicht Asia': r => r.lhAfterLL === true && r.impulseAtr >= 1 && r.sweepSession !== 'Asia',
};
for (const instrument of [...input.instruments, 'ALLE']) {
  const list = instrument === 'ALLE' ? rows : rows.filter(r => r.instrument === instrument);
  out.instruments[instrument].kandidaten = Object.fromEntries(Object.entries(CANDIDATES).map(([n, fn]) =>
    [n, { H1: score(list.filter(r => r.half === 'H1'), fn), H2: score(list.filter(r => r.half === 'H2'), fn) }]));
}

// Gegenprobe: Pins, Journal-Gewinner, Muster gegen die gepoolte Regel (ALLE) und die Instrument-Regel.
const probe = [];
for (const s of samples.filter(s => ['pin', 'muster'].includes(s.source) || s.source.startsWith('journal'))) {
  const feats = byKey[s.instrument];
  let f = feats.get(key(s.dir, s.pivotTime));
  for (const d of [-300, 300]) f ??= feats.get(key(s.dir, s.pivotTime + d));
  if (!f) continue;
  probe.push({ breakout: f.breakout, source: s.source, group: s.group, ref: s.ref, instrument: s.instrument, berlin: formatDatedTime(f.pivotTime), klasse: f.mfe_3h == null ? null : cls(f),
    mfe3h: f.mfe_3h == null ? null : +f.mfe_3h.toFixed(2), mfeSession: f.mfe_session == null ? null : +f.mfe_session.toFixed(2),
    vorSweepAlle: report.ALLE.vorSweep.fn(f), vorSweepInstrument: report[s.instrument].vorSweep.fn(f),
    mitKerzeAlle: report.ALLE.mitSweepKerze.fn(f), mitKerzeInstrument: report[s.instrument].mitSweepKerze.fn(f),
    kandidaten: Object.entries(CANDIDATES).filter(([, fn]) => fn(f)).map(([n]) => n) });
}
const tally = (list, k) => `${list.filter(p => p[k]).length}/${list.length}`;
const groupsOf = { 'Pins': p => p.source === 'pin', 'Journal-Gewinner': p => p.source.startsWith('journal') && p.group === 'pos',
  'Journal-Verlierer': p => p.source.startsWith('journal') && p.group === 'neg', 'Muster +': p => p.source === 'muster' && p.group === 'pos',
  'Muster − (19:40)': p => p.source === 'muster' && p.group === 'neg' };
out.gegenprobe = { faelle: probe, summe: Object.fromEntries(Object.entries(groupsOf).map(([n, g]) => {
  const l = probe.filter(g); return [n, { ...Object.fromEntries(['vorSweepAlle', 'vorSweepInstrument', 'mitKerzeAlle', 'mitKerzeInstrument'].map(k => [k, tally(l, k)])),
    kandidaten: Object.fromEntries(Object.keys(CANDIDATES).map(c => [c, `${l.filter(p => p.kandidaten.includes(c)).length}/${l.length}`])),
    klasseStark: tally(l.map(p => ({ s: p.klasse === 'stark' })), 's'), klasseKeine: tally(l.map(p => ({ s: p.klasse === 'keine' })), 's') }]; })) };
await writeFile(path.join(here, 'reaktion.json'), JSON.stringify(out, null, 1));
for (const [i, o] of Object.entries(out.instruments)) console.log(i, o.n, JSON.stringify(o.H1), JSON.stringify(o.H2), '\n  trennt:', o.trenntInBeidenHalbjahren.join(', '),
  '\n  ', ...Object.entries(o.regeln).flatMap(([k, r]) => [`
  ${k}:`, r.bedingungen.join(' & '), JSON.stringify(r.H1), JSON.stringify(r.H2)]));
console.log(JSON.stringify(out.gegenprobe.summe));
