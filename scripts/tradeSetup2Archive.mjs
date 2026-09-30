import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(value));
  // Windows kann den Zielnamen während einer gleichzeitigen Fortschrittsanzeige
  // kurz sperren. Die vollständige Tempdatei bleibt bis zum erfolgreichen Wechsel erhalten.
  for (let attempt = 0; ; attempt++) {
    try { await rename(file + '.tmp', file); break; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 9) throw error;
      await delay(100);
    }
  }
}

export function archiveClient({ url, key, fetcher = fetch }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  async function get(table, query, extraHeaders = {}) {
    const response = await fetcher(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`,
      { headers: { ...headers, ...extraHeaders }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Archive ${table}: HTTP ${response.status}`);
    return { rows: await response.json(), count: Number(response.headers.get('content-range')?.split('/')[1]) };
  }
  async function pages(table, query) {
    const result = [];
    for (;;) {
      const { rows } = await get(table, { ...query, limit: 1000, offset: result.length });
      if (!rows.length) return result;
      result.push(...rows);
    }
  }
  async function coverage(instrument, bar) {
    const query = { instrument: `eq.${instrument}`, bar: `eq.${bar}`, select: 'time', limit: 1 };
    const first = await get('fxcm_candles', { ...query, order: 'time.asc' }, { Prefer: 'count=exact' });
    const last = await get('fxcm_candles', { ...query, order: 'time.desc' });
    return { instrument, bar, first: first.rows[0]?.time ?? null, last: last.rows[0]?.time ?? null, count: first.count };
  }
  async function candles({ instrument, bar, from, to, cacheDirectory, onPage }) {
    const file = path.join(cacheDirectory, `${instrument}-${bar}-${from}-${to}.json`);
    try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let result = [];
    try { result = JSON.parse(await readFile(file + '.partial', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let cursor = result.length ? result.at(-1).time + 1 : from;
    let page = 0;
    for (;;) {
      const { rows } = await get('fxcm_candles', { instrument: `eq.${instrument}`, bar: `eq.${bar}`,
        select: 'time,open,high,low,close,volume', order: 'time.asc', limit: 1000,
        and: `(time.gte.${new Date(cursor * 1000).toISOString()},time.lt.${new Date(to * 1000).toISOString()})` });
      if (!rows.length) break;
      const mapped = rows.map(c => ({ ...c, time: Date.parse(c.time) / 1000 }));
      if (mapped[0].time < cursor || mapped.some((c, i) => i && c.time <= mapped[i - 1].time)) throw new Error('Archive cursor did not advance');
      result.push(...mapped);
      cursor = mapped.at(-1).time + 1;
      if (++page % 10 === 0) await writeJson(file + '.partial', result);
      await onPage?.(result.length);
    }
    await writeJson(file, result);
    return result;
  }
  return { get, pages, coverage, candles };
}

export function candleCoverage(rows, duration) {
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    const from = rows[i - 1].time + duration, to = rows[i].time;
    if (to > from) gaps.push({ from, to, missingBars: Math.ceil((to - from) / duration) });
  }
  return { count: rows.length, from: rows[0]?.time ?? null, to: rows.at(-1)?.time + duration || null,
    gapCount: gaps.length, missingBars: gaps.reduce((n, g) => n + g.missingBars, 0), gaps };
}
