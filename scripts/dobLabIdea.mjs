// Labor DOB-LAB-IDEE (Philip): mehrere Trades auf dieselbe Idee (gleiche Kraft-Zone + Richtung + Retest-Episode der Zone).
// Konfig-Regeln (1) nur erster Entry, (2) kein Entry solange einer offen, (3) höchstens 2, (4) nach Loss keine weiteren; Träger wie der
// v3-Fill (Kombi), ohne und mit Philips Sperren. Ausgang je Trade zum TP nach Konfig. Schreibt analysis/dob-setup/lab-idea-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';
import { loadDobV3Lab } from './dobV3Carriers.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { formatDatedTime } = await server.ssrLoadModule('/src/berlinTime.js');
  const { cases, block: blockR, outcome, ideasOf, ideaRules, dataEnd, berlinDateStrFor, gitHash } = await loadDobV3Lab(server, root);
  const result = { measurement: 'dob-lab-idea-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Trades: v2 mit Gegen-DOB-Status wie der v3-Fill (bester über die tragenden Paare), Modus Kombi; (a) nur TP-Fenster/Default, (b) Philips gespeicherte Konfig mit Sperren.',
      'Idee = gleiche Richtung + gleiche Kraft-Zone (TF, Start, Kanten) + gleiche Retest-Episode der Zone (Start der letzten Touch-Episode vor OB1).',
      'Ausgang je Trade: evaluateDoubleOrderBlockOutcome zum TP nach Konfig (inkl. nur tote Gegen-DOBs → 5R). Offen = Ausgang nach dem Entry des nächsten Trades bzw. noch offen/unbekannt.',
      '(2) und (4) kausal in Entry-Reihenfolge über die zugelassenen Trades; (4) sperrt erst ab dem Ausstieg des Losses.',
      'n = Win + Loss, ΣR = R·Win − Loss; Halbjahre nach Berliner Entry-Monat.'],
    carriers: {} };
  for (const { name: cName, trades: list, tpR } of cases) {
    const res = t => { const o = outcome(t, tpR(t)); return { status: o.status, exit: o.recognizedAt ?? Infinity }; };
    const block = l => blockR(l, tpR);
    const ideas = ideasOf(list), rules = { 'Konfig (alle Entries)': list, ...ideaRules(list, tpR) };
    const sizes = [...ideas.values()].map(l => l.length);
    const byPos = pos => [...ideas.values()].flatMap(l => pos < 3 ? (l[pos - 1] ? [l[pos - 1]] : []) : l.slice(2));
    // Beispiel 28.08.: alle Ideen mit ≥ 3 Trades, die in einer Stunde komplett ausgestoppt wurden, als Beleg.
    const wipeouts = [...ideas.values()].filter(l => l.length >= 3 && l.every(t => res(t).status === 'loss')).length;
    result.carriers[cName] = { trades: list.length, ideas: ideas.size,
      distribution: { '1': sizes.filter(n => n === 1).length, '2': sizes.filter(n => n === 2).length, '3+': sizes.filter(n => n >= 3).length, max: Math.max(...sizes) },
      ideasWith3PlusAllLoss: wipeouts,
      ideasWith3PlusAnyWin: [...ideas.values()].filter(l => l.length >= 3 && l.some(t => res(t).status === 'success')).length,
      byPosition: { '1.': block(byPos(1)), '2.': block(byPos(2)), '3.+': block(byPos(3)) },
      rules: Object.fromEntries(Object.entries(rules).map(([n, l]) => [n, block(l)])),
      example2808: [...ideas.values()].filter(l => berlinDateStrFor(l[0].entryTime) === '2026-08-28').map(l => l.map(t => `${t.direction} ${formatDatedTime(t.entryTime)} ${res(t).status}`)) };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-idea-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.trades} T · ${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  for (const [c, v] of Object.entries(result.carriers)) {
    console.log(`\n== ${c}: ${v.trades} Trades, ${v.ideas} Ideen, Verteilung ${JSON.stringify(v.distribution)}, 3+ alle Loss ${v.ideasWith3PlusAllLoss}, 3+ mit Win ${v.ideasWith3PlusAnyWin}`);
    for (const [k, s] of Object.entries(v.byPosition)) console.log('Position', k.padEnd(5), f(s));
    for (const [k, s] of Object.entries(v.rules)) console.log(k.padEnd(56), f(s));
    console.log('28.08.:', JSON.stringify(v.example2808));
  }
} finally {
  await server.close();
}
