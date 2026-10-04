import { readFile, mkdir, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rolldown } from 'rolldown';
import { archiveClient, writeJson, candleCoverage } from './tradeSetup2Archive.mjs';
import { hash, compareSet, reportHtml } from './setup1Set.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const started = performance.now();
const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
const readJson = file => readFile(file, 'utf8').then(JSON.parse);
const directory = path.resolve(root, options.snapshot ?? `local-data/setup1-builds/${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(directory, { recursive: true });
let input;
if (options.snapshot) {
  input = await readJson(path.join(directory, 'input.json'));
} else {
  process.loadEnvFile(path.join(root, '.env'));
  const client = archiveClient({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY });
  const from = Date.parse(options.from ?? '2026-01-01T00:00:00+01:00') / 1000;
  const to = Math.floor(options.to ? Date.parse(options.to) / 1000 : Date.now() / 1000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to > Date.now() / 1000) throw new Error('Invalid date interval');
  const bundle = await rolldown({ input: path.join(root, 'supabase/functions/trading-monitor-mcp/scripts/setup1Replay.ts'), platform: 'node' });
  const output = await bundle.generate({ format: 'esm' });
  await bundle.close();
  const code = output.output.find(item => item.type === 'chunk').code;
  await writeFile(path.join(directory, 'recognition.mjs'), code);
  const files = ['supabase/functions/_shared/tradeSetup.ts', 'supabase/functions/_shared/liquidityDetection.ts',
    'supabase/functions/_shared/orderBlocks.ts', 'supabase/functions/_shared/instrumentConfig.js',
    'supabase/functions/trading-monitor-mcp/scripts/setup1Replay.ts'];
  const detectionFiles = {};
  for (const file of files) detectionFiles[file] = { hash: hash(await readFile(path.join(root, file), 'utf8')),
    lastCommit: execFileSync('git', ['log', '-1', '--format=%H', '--', file], { cwd: root, encoding: 'utf8' }).trim() || null };
  input = { schemaVersion: 1, from, to, snapshotAt: new Date().toISOString(), source: 'FXCM native Bid archive',
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    detectionFiles, bundleHash: hash(code), instruments: ['GBPUSD', 'EURUSD', 'XAUUSD'],
    sessions: await client.pages('sessions', { select: '*', order: 'id.asc' }),
    schedules: await client.pages('trading_schedules', { select: '*', order: 'instrument.asc' }), inputs: {} };
  await writeJson(path.join(directory, 'download.json'), input);
  for (const instrument of input.instruments) {
    const rows = {};
    for (const [bar, warmupDays, duration] of [['5m', 7, 300], ['1h', 200, 3600]]) {
      controller.signal.throwIfAborted();
      console.log(`${instrument} ${bar}: download`);
      rows[bar] = (await client.candles({ instrument, bar, from: from - warmupDays * 86400, to,
        cacheDirectory: options.cache ? path.resolve(root, options.cache) : path.join(directory, 'candles'), onPage: count => {
          controller.signal.throwIfAborted();
          if (count % 10000 === 0) console.log(`${instrument} ${bar}: ${count} candles`);
        } })).filter(c => c.time + duration <= to);
      await writeJson(path.join(directory, `${instrument}-${bar}.json`), rows[bar]);
    }
    // OB-Schlüssel statt created_at: auch der September-Ausreißer mit Juli-OB bleibt im Abgleich.
    const live = await client.pages('trade_setups', { select: '*,trade_setup_sweeps(*)', instrument: `eq.${instrument}`, order: 'id.asc' });
    await writeJson(path.join(directory, `${instrument}-live.json`), live);
    input.inputs[instrument] = { m5: hash(rows['5m']), h1: hash(rows['1h']), live: hash(live) };
  }
  await writeJson(path.join(directory, 'input.json'), input);
}
const code = await readFile(path.join(directory, 'recognition.mjs'), 'utf8');
if (hash(code) !== input.bundleHash) throw new Error('Frozen recognition bundle changed');
const core = await import(pathToFileURL(path.join(directory, 'recognition.mjs')));
const results = [];
let goldWarmup;
for (const instrument of input.instruments) {
  controller.signal.throwIfAborted();
  const instrumentStarted = performance.now();
  const m5 = await readJson(path.join(directory, `${instrument}-5m.json`));
  const h1 = await readJson(path.join(directory, `${instrument}-1h.json`));
  const live = await readJson(path.join(directory, `${instrument}-live.json`));
  if (hash(m5) !== input.inputs[instrument].m5 || hash(h1) !== input.inputs[instrument].h1 || hash(live) !== input.inputs[instrument].live) throw new Error('Frozen input hash mismatch');
  if (!m5.length || !h1.length) throw new Error(`Missing candles: ${instrument}`);
  const sessions = input.sessions.filter(s => s.instrument === instrument).map(s => ({ fromMinutes: s.from_minutes,
    toMinutes: s.to_minutes, days: s.days, ignoreLiquidity: s.ignore_liquidity }));
  const configuration = { ...core.DEFAULT_TRADE_SETUP_PARAMS,
    maxDistanceM5: core.strategyDistance(core.DEFAULT_TRADE_SETUP_PARAMS.maxDistanceM5, instrument),
    maxSweepDistance: core.strategyDistance(core.DEFAULT_TRADE_SETUP_PARAMS.maxSweepDistance, instrument) };
  const policy = { configuration, sessions, minimum: core.obMinimum(instrument, '5m'), m5Window: core.M5_CANDLE_LIMIT,
    h1Window: core.H1_LOOKBACK_CANDLES, m5FractalPeriod: core.TRADE_SETUP_M5_FRACTAL_PERIOD,
    h1FractalPeriod: core.TRADE_SETUP_H1_FRACTAL_PERIOD, recognition: 'closed M5 bar; first detection wins; all hours',
    liveTouchReplacement: 'H1 touch refined against available M5 candles',
    schedule: input.schedules.find(s => s.instrument === instrument) ?? null };
  console.log(`${instrument}: replay ${m5.length} M5 / ${h1.length} H1`);
  const { rows, ticks } = core.replaySetup1({ instrument, m5Alle: core.markIgnored(m5, sessions), h1Alle: core.markIgnored(h1, sessions),
    startSec: input.from, endeSec: input.to, configuration, minimum: policy.minimum,
    onProgress: progress => { controller.signal.throwIfAborted(); console.log(JSON.stringify({ instrument, ...progress })); } });
  for (const row of rows) {
    row.trade_setup_sweeps = row.sweeps.map((s, index) => ({ timeframe: s.timeframe, price: s.level.price,
      pivot_time: new Date(s.level.pivotTime * 1000).toISOString(), touched_time: new Date(s.level.touchedTime * 1000).toISOString(), is_primary: index === 0 }));
    delete row.sweeps;
    row.invalidation = row.direction === 'short' ? row.ob_top : row.ob_bottom;
  }
  const report = compareSet(rows, live.filter(r => Date.parse(r.ob_start_time) / 1000 >= input.from - 86400
    && Date.parse(r.ob_start_time) / 1000 < input.to));
  const id = `setup1-${hash({ instrument, input, policy, rows }).slice(0, 24)}`;
  const target = path.join(root, 'local-data', 'setup1-sets', id);
  await mkdir(target, { recursive: true });
  const firstFullM5 = m5[core.M5_CANDLE_LIMIT - 1]?.time + 300 || null;
  const firstFullH1 = h1[core.H1_LOOKBACK_CANDLES - 1]?.time + 3600 || null;
  let manifest = { id, schemaVersion: 1, status: 'complete', instrument, source: 'versioned rebuild',
    from: input.from, to: input.to, generatedAt: new Date().toISOString(), snapshotAt: input.snapshotAt,
    gitHead: input.gitHead, detectionFiles: input.detectionFiles, bundleHash: input.bundleHash,
    configuration: policy, configurationHash: hash(policy), candleHashes: input.inputs[instrument], rowsHash: hash(rows),
    rows: rows.length, ticks, elapsedMs: performance.now() - instrumentStarted,
    coverage: { m5: candleCoverage(m5, 300), h1: candleCoverage(h1, 3600) },
    warmup: { missingPreYearHistory: instrument === 'XAUUSD', firstFullM5, firstFullH1,
      firstUsableDate: firstFullH1 ? new Date(Math.max(input.from, firstFullM5, firstFullH1) * 1000).toISOString() : null,
      note: 'M5 requires 300 bars; H1 partial history is used and must be read cautiously until 3000 H1 bars. Older Gold source probe is outside this task.' },
    limitations: ['Current configuration applied to entire year.', 'No historical live tick prices; candle-close reconstruction may differ.',
      'Archive read is not a DB transaction; frozen files and hashes identify the exact input.'],
    inputSnapshot: path.relative(root, directory), backup: 'Ignored by Git. Back up the entire set folder and its inputSnapshot externally; no automatic backup was made.' };
  if (instrument === 'XAUUSD') goldWarmup = `Kein Vorlauf vor 2026. Volles M5-Fenster ab ${new Date(firstFullM5 * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}, volles H1-Fenster ab ${firstFullH1 ? new Date(firstFullH1 * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : 'noch nicht verfügbar'}. Frühere Ergebnisse verwenden verkürzte H1-Historie und sind mit Vorsicht zu lesen. Ältere Gold-Kerzen wären für vollständigen Vorlauf nötig; die FXCM-Quellenprobe ist nicht Teil dieses Tasks.`;
  let existing;
  try { existing = await readJson(path.join(target, 'manifest.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (existing.id !== id || existing.status !== 'complete' || existing.rowsHash !== hash(rows)
      || existing.bundleHash !== input.bundleHash || hash(await readJson(path.join(target, 'sources.json'))) !== existing.rowsHash)
      throw new Error('Existing setup set changed; original preserved');
    for (const [file, expected] of [['M5.json', input.inputs[instrument].m5], ['H1.json', input.inputs[instrument].h1], ['live.json', input.inputs[instrument].live]])
      if (hash(await readJson(path.join(target, file))) !== expected) throw new Error(`Existing setup set ${file} changed; original preserved`);
    if (hash(await readFile(path.join(target, 'recognition.mjs'), 'utf8')) !== input.bundleHash) throw new Error('Existing recognition bundle changed; original preserved');
    manifest = existing;
  } else {
    await writeJson(path.join(target, 'sources.json'), rows);
    for (const [source, dest] of [[`${instrument}-5m.json`, 'M5.json'], [`${instrument}-1h.json`, 'H1.json'],
      [`${instrument}-live.json`, 'live.json'], ['recognition.mjs', 'recognition.mjs'], ['input.json', 'input.json']]) await copyFile(path.join(directory, source), path.join(target, dest));
    await writeJson(path.join(target, 'manifest.json'), manifest);
  }
  await writeJson(path.join(target, 'comparison.json'), report);
  let bytes = 0;
  for (const file of ['manifest.json', 'sources.json', 'comparison.json', 'M5.json', 'H1.json', 'live.json', 'recognition.mjs', 'input.json']) bytes += (await stat(path.join(target, file))).size;
  results.push({ instrument, id, count: rows.length, bytes, elapsedMs: manifest.elapsedMs, months: report.months,
    references: report.references.map(r => ({ liveId: r.liveId, key: r.key, status: r.status,
      liveCreatedAt: r.live.created_at, liveObStartTime: r.live.ob_start_time, changes: r.changes })) });
  console.log(JSON.stringify(results.at(-1)));
}
const report = { results, goldWarmup, mode: options.snapshot ? 'frozen replay (no downloads)' : 'build with downloads', elapsedMs: performance.now() - started,
  key: 'instrument:direction:OB Unix seconds; live_id/id copied on key match, even when detection fields differ. Unmatched id is the stable key.',
  comparison: 'sameKey means same OB key, equalFields additionally requires detection fields, alert_price, created_at, invalidation and canonical sweeps to match. Notification/DB metadata are excluded. Matches use rebuilt recognition month; liveOnly uses live created_at month. Cross-month changes retain both months.',
  references: '3125 and 5491 are checked explicitly; mismatches are reported, never patched from live. 4986 keeps its live timestamp in live.json/comparison.json.',
  backup: 'Die Ordner local-data/setup1-sets und local-data/setup1-builds sind in Git ignoriert. Beide vollständig extern sichern; es wurde kein automatisches Backup erstellt.' };
await writeJson(path.join(directory, 'report.json'), report);
await writeFile(path.join(directory, 'report.html'), reportHtml(report));
console.log(JSON.stringify({ status: 'complete', snapshot: directory, results: results.map(({ instrument, id, count }) => ({ instrument, id, count })) }));
