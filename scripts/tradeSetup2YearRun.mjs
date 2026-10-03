import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
import { archiveClient, candleCoverage, writeJson } from './tradeSetup2Archive.mjs';
import { createClient } from '@supabase/supabase-js';
import { createSimulationRepository } from '../src/tradeSetupSimulationRepository.js';

import { tradeSetupFromRow } from '../src/tradeSetupRow.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const directory = path.resolve(root, options.output ?? '.debug/trade-setup-2');
const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
process.on('SIGTERM', () => controller.abort());
process.loadEnvFile(path.join(root, '.env'));
const client = archiveClient({ url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY });
const readJson = file => readFile(file, 'utf8').then(JSON.parse);
const sec = value => Date.parse(value) / 1000;
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
await mkdir(directory, { recursive: true });
let previousRun;
try { previousRun = await readJson(path.join(directory, 'run.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

// Der gebündelte Kern ist derselbe Browsercode; keine zweite Erkennungsimplementierung.
async function loadCore() {
  const entry = path.join(directory, 'core-entry.mjs');
  const source = file => path.join(root, 'src', file).replaceAll('\\', '/');
  await import('node:fs/promises').then(fs => fs.writeFile(entry,
    ['tradeSetup2Scan.js', 'tradeSetupSimulation.js', 'tradeSetup2Anchors.js', 'tradeSetup2Configuration.js', 'tradeSetup2RangeCourse.js',
      'setup1RecognitionTime.js','countertrendChecklist.js','countertrendLifecycle.js']
      .map(file => `export * from ${JSON.stringify(source(file))};`).join('\n')));
  const bundle = await rolldown({ input: entry, platform: 'node' });
  const file = path.join(directory, 'core.mjs');
  const output = await bundle.generate({ format: 'esm' });
  await bundle.close();
  const code = output.output.find(item => item.type === 'chunk').code;
  const sourceHash = hash(code);
  // Ein neuer Kern darf weder alte Tages-Checkpoints übernehmen noch das eingefrorene
  // Referenzbundle überschreiben. Dafür ist ein eigener Laufordner erforderlich.
  if (previousRun && previousRun.provenance?.sourceHash !== sourceHash) throw new Error('Scanner source changed; choose a new --output directory. Existing run preserved.');
  await import('node:fs/promises').then(fs => fs.writeFile(file, code));
  return { core: await import(pathToFileURL(file)), sourceHash };
}

const instruments = (options.instruments ?? 'GBPUSD,EURUSD').split(',');
if (instruments.some(i => !['GBPUSD', 'EURUSD'].includes(i))) throw new Error('Only GBPUSD/EURUSD have the supported M1 contract');
const requestedFrom = sec(options.from ?? '2026-01-01T00:00:00+01:00');
const requestedTo = Math.floor(Math.min(options.to ? sec(options.to) : Date.now() / 1000, Date.now() / 1000));
if (!Number.isFinite(requestedFrom) || !Number.isFinite(requestedTo) || requestedFrom >= requestedTo) throw new Error('Invalid date interval');
let manifest;
try { manifest = await readJson(path.join(directory, 'manifest.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (!manifest) {
  const coverage = [];
  for (const instrument of instruments) for (const bar of ['1D', '1h', '5m', '1m']) coverage.push(await client.coverage(instrument, bar));
  const sessions = await client.pages('sessions', { select: '*', order: 'id.asc' });
  const schedules = await client.pages('trading_schedules', { select: '*', order: 'instrument.asc' });
  const news = await client.pages('news_events', { select: '*', order: 'event_time.asc,id.asc' });
  manifest = { requestedFrom, requestedTo, instruments, coverage, sessions, schedules, news,
    fetchedAt: Math.floor(Date.now() / 1000) };
  await writeJson(path.join(directory, 'manifest.json'), manifest);
}
if (manifest.requestedFrom !== requestedFrom || JSON.stringify(manifest.instruments) !== JSON.stringify(instruments)
  || (options.to && manifest.requestedTo !== requestedTo)) throw new Error('Output directory belongs to another window; choose a new --output');
if (options.coverage === 'true') { console.log(JSON.stringify(manifest.coverage)); process.exit(0); }
if (!options.settings) throw new Error('Provide --settings=FILE with the explicitly selected historical H1 start policy');
const configuration = await readJson(path.resolve(root, options.settings));
if (!configuration.settings || !Number.isFinite(configuration.warmupDays) || configuration.warmupDays < 14) throw new Error('Settings and warmupDays >= 14 required');
const { core, sourceHash } = await loadCore();
configuration.rangeCourseVersion = core.COUNTERTREND_RANGE_COURSE_VERSION;
const modelVersions=core.buildTradeSetup2Configuration({instrument:instruments[0]});
configuration.setupModel=modelVersions.setupModel;
configuration.entryModel=modelVersions.entryModel;

const sessionConfigs = manifest.sessions.map(r => ({ id: r.id, label: r.label, instrument: r.instrument,
  fromMinutes: r.from_minutes, toMinutes: r.to_minutes, highLowRelevant: r.high_low_relevant,
  ignoreLiquidity: r.ignore_liquidity ?? false, danger: r.danger, days: r.days }));
configuration.instruments = instruments.map(instrument => core.buildTradeSetup2Configuration({ instrument,
  settings: configuration.settings, sessionConfigs,
  tradingWindows: manifest.schedules.find(s => s.instrument === instrument)?.trading_windows,
  news: manifest.news.map(n => ({ ...n, eventTime: sec(n.event_time) })), newsLoadStatus: 'unknown' }));

const run = { id: `setup2-${hash({ configuration, manifest, sourceHash }).slice(0, 24)}`, version: core.SETUP2_VERSION,
  configuration, from: requestedFrom, to: manifest.requestedTo, evaluatedAt: manifest.fetchedAt,
  status: 'running', progress: { phase: 'download', completed: 0, total: instruments.length },
  coverage: { archive: manifest.coverage, instruments: [], excluded: [{ instrument: 'XAUUSD', reason: 'noM1Archive' }] },
  provenance: { source: 'FXCM Bid', sourceHash, snapshotAt: manifest.fetchedAt,
    validationStatus: configuration.validation ? 'validation-fixture' : 'confirmed-policy',
    validationNote: configuration.validation ? 'Referenzfall mit ausdrücklich festgehaltenem Replay-Strukturstart.'
      : 'Historischer D1-P4-Standard bestätigt; noch kein abgeschlossener Jahresvergleich.',
    limitations: ['Aktuelle Sessionkonfiguration rückwirkend angewendet.', 'Newsbestand ohne historische Vollständigkeitsgarantie.',
      'Archivlücken einschließlich Marktschließungen werden konservativ als fehlende Historie behandelt.',
      'Bid-OHLC mit 5 USD Roundturn-Kommission je eröffnetem Standardlot, ohne Spread und Slippage.'], configurationHash: hash({ configuration, sessionConfigs }) } };
const runFile = path.join(directory, 'run.json');
if (previousRun && previousRun.id !== run.id) throw new Error('Run configuration changed; choose a new --output directory. Existing run preserved.');
const repository = options.publish === 'true' ? createSimulationRepository(createClient(process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })) : null;
let publishedAt = 0;
async function saveProgress(force = false) {
  await writeJson(runFile, run);
  if (repository && (force || Date.now() - publishedAt > 30000)) {
    await repository.saveRun(run);
    publishedAt = Date.now();
  }
}
await saveProgress(true);
const outcomeRecords = (snapshots, candles, evaluatedAt) => snapshots.filter(s => s.entry).map(snapshot => ({ snapshot,
  outcomes: ['wide', 'narrow'].map(variant => core.evaluateSimulation({ entry: snapshot.entry, variant, candles, evaluatedAt,
    target1: snapshot.checklist.setup.primary.targetSelection?.target1?.price,
    target2: snapshot.checklist.setup.primary.targetSelection?.target2?.price ?? null })) }));
try {
  for (const [instrumentIndex, instrument] of instruments.entries()) {
    controller.signal.throwIfAborted();
    const archive = manifest.coverage.filter(c => c.instrument === instrument);
    const m1Coverage = archive.find(c => c.bar === '1m');
    if (!m1Coverage?.count) continue;
    const to = Math.min(manifest.requestedTo, sec(m1Coverage.last) + 60);
    const from = requestedFrom;
    const start = configuration.startPolicy === 'historical-d1-p4'
      ? Math.min(from - configuration.warmupDays * 86400, sec(archive.find(c => c.bar === '1h').first))
      : from - configuration.warmupDays * 86400;
    const rows = {};
    for (const bar of configuration.startPolicy === 'historical-d1-p4' ? ['1D', '1h', '5m', '1m'] : ['1h', '5m', '1m']) {
      rows[bar] = await client.candles({ instrument, bar, from: start, to,
        cacheDirectory: options.cache ? path.resolve(root, options.cache) : path.join(directory, 'cache'), onPage: async count => {
          controller.signal.throwIfAborted();
          run.progress = { phase: 'download', instrument, bar, loadedRows: count, completed: instrumentIndex, total: instruments.length };
          await saveProgress();
        } });
    }
    const dailyAnchors = rows['1D'] ? core.buildHistoricalDailyAnchors(rows['1D'], rows['1h']) : null;
    if (dailyAnchors && !core.historicalSettingsAt(configuration.settings, dailyAnchors, from)) throw new Error(`Missing year-start daily anchor: ${instrument}`);
    run.coverage.instruments.push({ instrument, from, to, timeframes: Object.fromEntries(
      [['1h', 3600], ['5m', 300], ['1m', 60]].map(([bar, duration]) => [bar, candleCoverage(rows[bar], duration)])) });
    const sourceFile=path.join(directory,`${instrument}-sources.json`);
    let sourceRows;
    try{sourceRows=await readJson(sourceFile);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!sourceRows){
      sourceRows=await client.pages('trade_setups',{select:'*,trade_setup_sweeps(*)',instrument:`eq.${instrument}`,
        and:`(created_at.gte.${new Date(from*1000).toISOString()},created_at.lt.${new Date(to*1000).toISOString()})`,
        order:'created_at.asc,id.asc'});
      await writeJson(sourceFile,sourceRows);
    }
    const tradeSetups=sourceRows.map(tradeSetupFromRow);
    // Unableitbare Erkennungszeiten stoppen den Lauf mit ID statt die Quelle zu verschlucken.
    for(const source of tradeSetups)core.setup1RecognitionTime(source);
    run.provenance.setupSourcesHash=hash(sourceRows);
    run.coverage.instruments.at(-1).setup1Sources=tradeSetups.length;
    await writeJson(path.join(directory,'coverage.json'),run.coverage);
    if(options.checkCoverage==='true'){
      run.status='coverage';await saveProgress(true);
      console.log(JSON.stringify({coverage:run.coverage.instruments.at(-1)}));continue;
    }
    const started=performance.now(),cpu=process.cpuUsage();
    // Ein zusammenhängender Lauf erhält offene DRs/Entries über Monats- und Tagesgrenzen.
    const snapshots=await core.scanTradeSetup2Window({instrument,h1Candles:rows['1h'],m5Candles:rows['5m'],m1Candles:rows['1m'],
      tradeSetups,dailyAnchors,fromTime:from,toTime:to-1,settings:configuration.settings,sessionConfigs,
      tradingWindows:manifest.schedules.find(s=>s.instrument===instrument)?.trading_windows,
      news:manifest.news.map(n=>({...n,eventTime:sec(n.event_time)})),newsLoadStatus:'unknown',signal:controller.signal,
      onProgress:async progress=>{
        if(progress.completed%24!==0 && progress.completed!==progress.total)return;
        run.progress={...progress,instrument,phase:'scan'};await saveProgress();
      }});
    const elapsedCpu=process.cpuUsage(cpu);
    run.provenance.measurement={wallMs:performance.now()-started,cpuMs:(elapsedCpu.user+elapsedCpu.system)/1000};
    const records=outcomeRecords(snapshots,rows['1m'],to);
    await writeJson(path.join(directory,`${instrument}-entries.json`),records);
    await writeJson(path.join(directory,`${instrument}-setups.json`),snapshots.filter(s=>!s.entry));
    if(repository){await repository.saveSetups(run.id,snapshots.filter(s=>!s.entry));await repository.saveEntries(run.id,records);}
  }
  run.status = options.checkCoverage==='true' ? 'coverage' : 'complete'; run.progress = { phase: run.status, completed: instruments.length, total: instruments.length };
} catch (error) {
  run.status = 'failed'; run.progress = { ...run.progress, error: error.message, aborted: controller.signal.aborted };
  throw error;
} finally { await saveProgress(true); }
console.log(JSON.stringify({ runId: run.id, status: run.status, output: directory }));
