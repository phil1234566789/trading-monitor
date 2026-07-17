// Holt GBPUSD-Kerzen (M5 + H1) über die ctrader-candles Edge-Function für die Trend-Indikator-
// Testfixtures. Läuft als reines Node-Script (nicht über Vite), daher process.loadEnvFile statt
// import.meta.env.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

process.loadEnvFile(path.join(import.meta.dirname, "..", ".env"));

const SYMBOL = "GBPUSD";
const MAX_COUNT = 1000; // Limit der Edge-Function
const FIXTURES_DIR = path.join(import.meta.dirname, "..", "test", "fixtures");

const CTRADER_FN_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/ctrader-candles`;

async function fetchCandles(period, { count, to } = {}) {
  const params = new URLSearchParams({ symbol: SYMBOL, period, count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${CTRADER_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json; // oldest zuerst, {time,open,high,low,close}
}

// Seitenweise rückwärts paginieren (die Edge-Function deckelt count auf 1000), bis wir vor
// startSec sind oder keine älteren Kerzen mehr kommen.
async function fetchAllSince(period, startSec) {
  let all = [];
  let to; // ms epoch, exklusive Obergrenze für die nächste (ältere) Seite
  for (let i = 0; i < 20; i++) {
    const page = await fetchCandles(period, { count: MAX_COUNT, to });
    if (page.length === 0) break;
    all = page.concat(all);
    const oldest = page[0].time;
    if (oldest <= startSec) break;
    to = oldest * 1000;
  }
  return all;
}

async function fetchRecent(period, count) {
  return fetchCandles(period, { count });
}

async function writeFixture(outFile, candles, startSec) {
  // Seitengrenzen können sich überlappen (die Edge-Function behandelt `to` nicht strikt
  // exklusiv) -> dedupen.
  const deduped = [...new Map(candles.map((c) => [c.time, c])).values()].sort((a, b) => a.time - b.time);
  const trimmed = startSec != null ? deduped.filter((c) => c.time >= startSec) : deduped;

  if (trimmed.length === 0) {
    throw new Error(`Keine Kerzen für ${outFile} gefunden.`);
  }

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(trimmed, null, 2) + "\n");

  console.log(`${trimmed.length} Kerzen gespeichert -> ${path.relative(process.cwd(), outFile)}`);
  console.log(`  Erste:  ${new Date(trimmed[0].time * 1000).toISOString()} (${trimmed[0].time})`);
  console.log(`  Letzte: ${new Date(trimmed[trimmed.length - 1].time * 1000).toISOString()} (${trimmed[trimmed.length - 1].time})`);
}

// M5: Start laut Philip: 13.07.2026 22:00 (Europe/Vienna, CEST = UTC+2) — enthält noch den
// vorangehenden Uptrend, damit der Test den Übergang uptrend -> downtrend sieht.
const M5_START_ISO = "2026-07-13T22:00:00+02:00";
const m5StartSec = Math.floor(new Date(M5_START_ISO).getTime() / 1000);
const m5Candles = await fetchAllSince("M5", m5StartSec);
await writeFixture(path.join(FIXTURES_DIR, "gbpusd-m5-trend-2026-07-13.json"), m5Candles, m5StartSec);

// H1: für den Struktur-Anker (computeStructureAnchorTime) — braucht mehr Vorlauf als das
// M5-Fenster, damit auch die H1-Fraktale nahe 13.07. schon bestätigt sind (Periode 10 braucht
// 10 H1-Kerzen davor/danach). 500 Kerzen (~20 Tage) sind großzügig genug, ohne Pagination
// (MAX_COUNT) zu brauchen.
const h1Candles = await fetchRecent("H1", 500);
await writeFixture(path.join(FIXTURES_DIR, "gbpusd-h1-trend.json"), h1Candles, null);
