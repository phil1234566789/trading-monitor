import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { scanWindowCandles } from './tradeSetup2ScanWindow.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
for (const key of ['core', 'archive', 'output', 'days']) if (!args[key]) throw new Error(`Missing --${key}`);
const coreFile = path.resolve(args.core), directory = path.resolve(args.archive), output = path.resolve(args.output);
if (directory === output) throw new Error('Benchmark output must be separate from the archived run');
const core = await import(pathToFileURL(coreFile));
// Für reine Cache-Parität dieselbe Outcome-Version auf beide Snapshot-Sätze anwenden.
// Kostenänderungen lassen sich so unabhängig von der Erkennung vergleichen.
const outcomeCore = args['outcome-core'] ? await import(pathToFileURL(path.resolve(args['outcome-core']))) : core;
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const run = read(path.join(directory, 'run.json'));
const names = readdirSync(path.join(directory, 'cache'));
const load = bar => read(path.join(directory, 'cache', names.find(n => n.startsWith(`GBPUSD-${bar}-`) && n.endsWith('.json'))));
const h1 = load('1h'), m5 = load('5m'), m1 = load('1m'), daily = load('1D');
const anchors = core.buildHistoricalDailyAnchors(daily, h1);
const config = run.configuration.instruments.find(instrument => instrument.instrument === 'GBPUSD');
const reports = [];
mkdirSync(output, { recursive: true });
for (const date of args.days.split(',')) {
  // Gleiche fortlaufende 24h-Chunks wie der Jahresrunner, auch über den DST-Wechsel.
  const midday = Date.parse(`${date}T12:00:00+01:00`) / 1000;
  const from = run.from + Math.floor((midday - run.from) / 86400) * 86400;
  if (!Number.isFinite(from) || from < run.from || from >= run.to) throw new Error(`Day outside archive: ${date}`);
  const to = Math.min(from + 86400, run.to) - 1;
  const began = performance.now();
  let last = began;
  const steps = [];
  const snapshots = await core.scanTradeSetup2Window({ instrument: 'GBPUSD',
    ...scanWindowCandles({ '1h': h1, '5m': m5, '1m': m1 }, anchors, from, to + 1, run.configuration.warmupDays),
    fromTime: from, toTime: to,
    dailyAnchors: anchors, settings: run.configuration.settings, sessionConfigs: config.sessions,
    tradingWindows: config.tradingWindows, news: config.news, newsLoadStatus: config.newsLoadStatus,
    onProgress(progress) {
      const now = performance.now(); steps.push(now - last); last = now;
      if (progress.completed % 48 === 0) console.log(JSON.stringify({ date, ...progress, elapsedSeconds: (now - began) / 1000 }));
    },
  });
  const records = snapshots.filter(s => s.entry).map(snapshot => ({ snapshot,
    outcomes: ['wide', 'narrow'].map(variant => outcomeCore.evaluateSimulation({ entry: snapshot.entry,
      variant, candles: m1, evaluatedAt: run.to,
      target1: snapshot.checklist.setup.primary.targetSelection?.target1?.price,
      target2: snapshot.checklist.setup.primary.targetSelection?.target2?.price ?? null })),
  }));
  const report = { date, from, to, wallSeconds: (performance.now() - began) / 1000, steps: steps.length,
    firstStepMs: steps[0] ?? null, averageStepMs: steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : null,
    maxStepMs: steps.length ? Math.max(...steps) : null, processPeakRssMB: process.resourceUsage().maxRSS / 1024,
    snapshots: snapshots.length, entries: records.length };
  writeFileSync(path.join(output, `${date}.json`), JSON.stringify({ report, snapshots, records }));
  reports.push(report); console.log(JSON.stringify(report));
}
writeFileSync(path.join(output, 'summary.json'), JSON.stringify({
  referenceRunId: run.id, sourceHash: createHash('sha256').update(JSON.stringify(readFileSync(coreFile, 'utf8'))).digest('hex'),
  setupVersion: core.SETUP2_VERSION, outcomeVersion: outcomeCore.SIMULATION_VERSION, reports,
}, null, 2));
