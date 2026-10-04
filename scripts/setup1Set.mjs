import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const setupKey = row => `${row.instrument}:${row.direction}:${Date.parse(row.ob_start_time) / 1000}`;
const month = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(new Date(value));
const fields = ['fractal_price', 'fractal_pivot_time', 'ls_price', 'ls_pivot_time', 'ls_touched_time', 'ls_timeframe',
  'ob_top', 'ob_bottom', 'ob_start_time', 'ob_fvg', 'alert_price', 'created_at', 'invalidation'];
const normalize = (field, value) => field.endsWith('_time') || field === 'created_at' ? Date.parse(value) : value;
const sweeps = row => (row.trade_setup_sweeps ?? []).map(s => [s.timeframe, s.price, Date.parse(s.pivot_time), Date.parse(s.touched_time), s.is_primary])
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

export function differences(rebuilt, live) {
  const result = fields.filter(field => normalize(field, rebuilt[field]) !== normalize(field, live[field]))
    .map(field => ({ field, rebuilt: rebuilt[field], live: live[field] }));
  if (JSON.stringify(sweeps(rebuilt)) !== JSON.stringify(sweeps(live))) result.push({ field: 'trade_setup_sweeps', rebuilt: sweeps(rebuilt), live: sweeps(live) });
  return result;
}

export function compareSet(rows, liveRows) {
  const live = new Map(liveRows.map(row => [setupKey(row), row]));
  const rebuilt = new Map(rows.map(row => [setupKey(row), row]));
  if (live.size !== liveRows.length || rebuilt.size !== rows.length) throw new Error('Duplicate setup key');
  const months = {};
  const bucket = row => months[month(row.created_at)] ??= { sameKey: 0, equalFields: 0, detectionFieldsEqual: 0, liveOnly: 0, rebuiltOnly: 0, changed: 0 };
  const deviations = [];
  for (const row of rows) {
    row.setup_key = setupKey(row);
    const original = live.get(row.setup_key);
    row.live_id = original?.id ?? null;
    row.id = original?.id ?? row.setup_key;
    if (!original) { bucket(row).rebuiltOnly++; deviations.push({ key: row.setup_key, kind: 'rebuiltOnly' }); continue; }
    bucket(row).sameKey++;
    const changes = differences(row, original);
    // Numerische DB-Rundung separat von fachlichen Erkennungsabweichungen betrachten; Rohdifferenzen bleiben erhalten.
    const substantive = changes.filter(c => !['created_at', 'alert_price'].includes(c.field)
      && !(typeof c.live === 'number' && typeof c.rebuilt === 'number' && Math.abs(c.live - c.rebuilt) < 1e-12));
    if (!substantive.length) bucket(row).detectionFieldsEqual++;
    bucket(row)[changes.length ? 'changed' : 'equalFields']++;
    if (changes.length) deviations.push({ key: row.setup_key, liveId: original.id, kind: 'changed', liveMonth: month(original.created_at), rebuiltMonth: month(row.created_at), changes });
  }
  for (const row of liveRows) if (!rebuilt.has(setupKey(row))) {
    bucket(row).liveOnly++;
    deviations.push({ key: setupKey(row), liveId: row.id, kind: 'liveOnly' });
  }
  const references = [3125, 5491, 4986].filter(id => liveRows.some(r => r.id === id)).map(id => {
    const original = liveRows.find(r => r.id === id), row = rebuilt.get(setupKey(original));
    return { liveId: id, key: setupKey(original), status: row ? 'present' : 'missing',
      changes: row ? differences(row, original) : null, live: original, rebuilt: row ?? null };
  });
  return { months, deviations, references };
}

export function reportHtml(report) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cell = value => `<td>${escape(value)}</td>`;
  const table = (head, rows) => `<table><thead><tr>${head.map(v => `<th>${escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table>`;
  const berlin = value => /T\d\d:/.test(String(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : typeof value === 'object' ? JSON.stringify(value) : value;
  return `<!doctype html><html lang="de"><meta charset="utf-8"><title>Setup 1 Eingabesätze 2026</title>
    <style>body{font:16px system-ui;max-width:1200px;margin:32px auto;padding:0 20px;color:#17212c}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{padding:8px;text-align:left;border-bottom:1px solid #ccd3da;overflow-wrap:anywhere}th{background:#edf1f4}code{overflow-wrap:anywhere}</style>
    <h1>Setup 1 Eingabesätze 2026</h1><p>Reproduzierbarer Neuaufbau aus geschlossenen FXCM-Bid-Kerzen. Die Live-Tabelle wurde nur gelesen.</p>
    <p>Schlüssel: Instrument, Richtung und OB-Zeit in Unix-Sekunden. Bei gleichem Schlüssel werden <code>live_id</code> und <code>id</code> aus dem Live-Bestand übernommen; das bedeutet keine Feldgleichheit. Ohne Live-Treffer ist <code>id</code> der stabile Schlüssel.</p>
    <p>Die heutige Konfiguration gilt rückwirkend für das ganze Jahr. Keine historischen Tickpreise: H1-Touch wird aus M5-Kerzen rekonstruiert. Erkennungszeit im Satz ist der M5-Schluss.</p>
    <p>„Gleich“ zählt gemeinsame Schlüssel. „Felder exakt“ umfasst Erkennungsfelder, alert_price, created_at, Invalidation und Sweeps. „Erkennung gleich“ lässt alert_price, created_at und numerische Rundung unter 1e-12 außer Betracht. Alle Rohabweichungen bleiben in comparison.json erhalten. Gemeinsame Schlüssel zählen im Neuaufbau-Monat; Live-only im Live-created_at-Monat. Zeiten hier: Europe/Berlin.</p>
    ${report.results.map(r => `<h2>${escape(r.instrument)}</h2><p><code>${escape(r.id)}</code> — ${r.count} Setups, ${(r.elapsedMs / 1000).toFixed(2)} Sekunden Replay, ${(r.bytes / 1024 / 1024).toFixed(1)} MiB Satzdateien.</p>
      ${table(['Monat', 'Gleich', 'Felder exakt', 'Erkennung gleich', 'Nur Live', 'Nur Neuaufbau'], Object.entries(r.months).map(([m, c]) => [m, c.sameKey, c.equalFields, c.detectionFieldsEqual, c.liveOnly, c.rebuiltOnly]))}
      ${r.references.map(ref => `<h3>Live-ID ${ref.liveId}</h3><p>${ref.status === 'missing' ? 'Nicht reproduziert. Live-Zeile bleibt unverändert erhalten.' : 'Schlüssel reproduziert; Live-ID zugeordnet.'} Live-OB: ${escape(berlin(ref.liveObStartTime))}; Live-created_at: ${escape(berlin(ref.liveCreatedAt))}.</p>${ref.changes?.length ? table(['Feld', 'Neuaufbau', 'Live'], ref.changes.map(c => [c.field, berlin(c.rebuilt), berlin(c.live)])) : ''}`).join('')}`).join('')}
    <h2>Gold Vorlauf</h2><p>${escape(report.goldWarmup)}</p>
    <h2>Lauf und Backup</h2><p>Gesamt ${(report.elapsedMs / 1000).toFixed(2)} Sekunden; ${escape(report.mode)}. ${escape(report.backup)}</p>
    <p><a href="report.json">Maschinenlesbarer Gesamtbericht</a>. Die einzelnen Satzordner enthalten Manifest, Quellen, Live-Snapshot und vollständige Abweichungsliste. Benachrichtigungs- und DB-Metadaten werden nicht als Erkennungsfelder verglichen.</p></html>`;
}

export async function readSetupSetManifest(root, id) {
  if (!/^setup1-[a-f0-9]{24}$/.test(id)) throw new Error('Invalid --setupSet ID');
  return JSON.parse(await readFile(path.join(root, 'local-data', 'setup1-sets', id, 'manifest.json'), 'utf8'));
}

export async function loadSetupSet(root, id, instrument, from, to) {
  const manifest = await readSetupSetManifest(root, id);
  const directory = path.join(root, 'local-data', 'setup1-sets', id);
  if (manifest.id !== id || manifest.status !== 'complete' || manifest.instrument !== instrument
    || from < manifest.from || to > manifest.to) throw new Error('Setup set is incomplete or does not cover instrument/window');
  const rows = JSON.parse(await readFile(path.join(directory, 'sources.json'), 'utf8'));
  if (hash(rows) !== manifest.rowsHash) throw new Error('Setup set rows hash mismatch');
  return { rows: rows.filter(r => Date.parse(r.created_at) / 1000 >= from && Date.parse(r.created_at) / 1000 < to), manifest };
}
