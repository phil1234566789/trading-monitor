// Gemeinsamer Kerzen-/Session-Cache der DOB-Messskripte (dobWinrate, dobSetupWinrate): Kerzen einmal laden, lokal halten.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function dobCandleCache({ outDir, symbol, refresh, defaultStartSec, startSec, fetchInitialCandles, supabase }) {
  const write = async (file, data) => {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data));
  };
  // Kalenderbars bis Start plus Fenster: Wochenenden machen das zur sicheren Obergrenze für den Vorlauf.
  // coveredFrom = frühester Start, dessen Fenster der Cache trägt; ein früheres --from lädt nur das Ältere nach.
  const candles = async (bar, seconds, window) => {
    const file = path.join(outDir, `candles-${symbol}-${bar === '1m' ? 'm1' : 'm5'}.json`);
    let cache = !refresh && existsSync(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : null;
    if (Array.isArray(cache)) cache = { coveredFrom: defaultStartSec, rows: cache };
    // Ein leerer oder unvollständiger Cache wird neu geholt statt an rows[0] zu scheitern.
    if (!Number.isFinite(cache?.coveredFrom) || !Array.isArray(cache?.rows) || !cache.rows.length) cache = null;
    if (cache && cache.coveredFrom <= startSec) return cache.rows;
    const toSec = cache ? cache.rows[0].time : Math.floor(Date.now() / 1000);
    const rows = await fetchInitialCandles(symbol, bar, Math.ceil((toSec - startSec) / seconds) + window, toSec * 1000 - 1);
    cache = { coveredFrom: startSec, rows: [...rows.filter(c => c.time < toSec), ...(cache?.rows ?? [])] };
    await write(file, cache);
    return cache.rows;
  };
  // Gleiche Ignore-Fenster wie markIgnored() im Dashboard.
  const sessions = async () => {
    const file = path.join(outDir, `sessions-${symbol}.json`);
    if (!refresh && existsSync(file)) return JSON.parse(await fs.readFile(file, 'utf8'));
    const { data, error } = await supabase.from('sessions').select('from_minutes,to_minutes,days,ignore_liquidity')
      .eq('instrument', symbol).limit(200);
    if (error) throw error;
    const rows = data.map(r => ({ fromMinutes: r.from_minutes, toMinutes: r.to_minutes, days: r.days, ignoreLiquidity: r.ignore_liquidity ?? false }));
    await write(file, rows);
    return rows;
  };
  return { candles, sessions };
}
