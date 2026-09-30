import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SimulationRunStatus from '../src/components/SimulationRunStatus.vue';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const run = { id: 'archive-run', version: 'v1', status: 'running', from: at('09:00'), to: at('10:00'), evaluatedAt: at('10:05'),
  progress: { phase: 'scan', completed: 3, total: 12, instrument: 'GBPUSD' },
  coverage: { instruments: [{ instrument: 'GBPUSD', from: at('09:00'), to: at('09:55'),
    timeframes: { '1m': { count: 53, from: at('09:00'), to: at('09:55'), gapCount: 1, missingBars: 2 } } }],
    excluded: [{ instrument: 'XAUUSD', reason: 'noM1Archive' }] },
  provenance: { source: 'FXCM Bid', limitations: ['Newsbestand ohne Vollständigkeitsgarantie.'] } };

describe('simulation run coverage', () => {
  it('distinguishes requested range, measured coverage, gaps and progress', async () => {
    const html = await renderToString(createSSRApp(SimulationRunStatus, { run }));
    expect(html).toContain('Angeforderter Zeitraum 2026-09-09 09:00 – 2026-09-09 10:00');
    expect(html).toContain('geladenes Datenfenster 2026-09-09 09:00 – 2026-09-09 09:55');
    expect(html).toContain('nur bisher gespeicherte Daten');
    expect(html).toContain('3 / 12 Schritte');
    expect(html).toContain('value="3" max="12"');
    expect(html).toContain('Newsbestand ohne Vollständigkeitsgarantie.');
    expect(html).toContain('XAUUSD ausgeschlossen: Kein M1-Archiv verfügbar.');
    expect(html).toMatch(/>53<\/td><td[^>]*>1<\/td><td[^>]*>2<\/td>/);
  });
  it('does not imply full coverage when metadata is absent or the run failed', async () => {
    const html = await renderToString(createSSRApp(SimulationRunStatus, { run: { ...run, status: 'failed', coverage: {} } }));
    expect(html).toContain('nicht vollständig abgeschlossen');
    expect(html).toContain('noch kein ausgewerteter Datenumfang');
    expect(html).not.toContain('<progress');
  });
  it('shows the different H1 configuration of replay and historical runs', async () => {
    const historical = await renderToString(createSSRApp(SimulationRunStatus, { run: { ...run, configuration: { startPolicy: 'historical-d1-p4' } } }));
    expect(historical).toContain('Jeweils damals bestätigter Tagespivot (D1, Periode 4)');
    const replay = await renderToString(createSSRApp(SimulationRunStatus, { run: { ...run, configuration: { settings: { rangesFixedStartActive: true, rangesFixedStartTime: at('09:00') } } } }));
    expect(replay).toContain('Manuell fixiert: 2026-09-09 09:00 (Replay)');
  });
  it('identifies a paused checkpoint as interrupted rather than a completed result', async () => {
    const html = await renderToString(createSSRApp(SimulationRunStatus, { run: { ...run, status: 'failed', progress: { phase: 'paused' } } }));
    expect(html).toContain('Unterbrochen');
    expect(html).toContain('nicht vollständig abgeschlossen');
  });
});
