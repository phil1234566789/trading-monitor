import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

it('rejects a changed source before overwriting a frozen run or its core', () => {
  const directory = mkdtempSync(join(tmpdir(), 'setup2-resume-'));
  try {
    const run = JSON.stringify({ id: 'original', provenance: { sourceHash: 'original-source' } });
    writeFileSync(join(directory, 'run.json'), run);
    writeFileSync(join(directory, 'core.mjs'), 'original frozen core');
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ settings: {}, warmupDays: 30 }));
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ requestedFrom: Date.parse('2026-01-01T00:00:00+01:00') / 1000,
      requestedTo: Date.parse('2026-02-01T00:00:00+01:00') / 1000, instruments: ['GBPUSD'] }));
    // Der Schutz muss vor Netzwerkzugriff greifen und benötigt keine privaten .env-Dateien.
    const preload = join(directory, 'without-env.mjs');
    writeFileSync(preload, 'process.loadEnvFile = () => {};');
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href,
      resolve('scripts/tradeSetup2YearRun.mjs'), '--instruments=GBPUSD',
      `--output=${directory}`, `--settings=${join(directory, 'settings.json')}`], { encoding: 'utf8', timeout: 30000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Scanner source changed');
    expect(readFileSync(join(directory, 'run.json'), 'utf8')).toBe(run);
    expect(readFileSync(join(directory, 'core.mjs'), 'utf8')).toBe('original frozen core');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30000);
