// Reine Liquiditäts-Level-Erkennung (Williams-Fractal-Pivots), extrahiert aus liquidity.js (Chat
// 2026-07-31) — bewusst OHNE jeden Import, damit dieses Modul auch außerhalb des Browsers (Node,
// mcp-server/marketStructureAnalysis.ts) importierbar ist, ohne chartColors.js/supabaseClient.js
// (localStorage/import.meta.env) mitzuschleppen. liquidity.js selbst importiert diese Funktionen
// jetzt von hier und re-exportiert sie, damit sich an dessen öffentlicher API nichts ändert.

const RECENT_SWEEP_COUNT = 2; // siehe markTopKRecentTouches in liquidity.pine

// Exportiert (vorher lokale Konstanten in PriceChart.vue) — auch von dataExport.js gebraucht
// (LQ-Levels im Daten-Export), eine gemeinsame Quelle statt zweier Kopien, die auseinanderlaufen
// könnten.
export const LIQUIDITY_FRACTAL_PERIOD = 5; // Williams-Fractal-Periode, siehe fractals.pine — NICHT anfassen (LQ-Sweeps), siehe Chat
export const LIQUIDITY_MAX_RELEVANT = 10; // je Richtung, siehe liqMaxRelevant in inputs.pine

// Williams Fractal an chronologischem Index `p` (älteste Kerze zuerst) mit Periode `n`:
// die `n` Kerzen danach (index p+1..p+n) müssen strikt niedriger sein, die `n` Kerzen
// davor (index p-1..p-n) ebenfalls, mit Kaskaden-Logik, die Gleichstände bei den ersten
// bis zu 4 vorangehenden Kerzen zulässt — identisch zu checkFractalAtPeriod (fractals.pine),
// nur direkt auf dem chronologischen Array statt auf dem Pine-Ringpuffer indiziert.
function isUpFractal(candles, p, n) {
  const pivot = candles[p].high;
  for (let i = 1; i <= n; i++) {
    if (!(candles[p + i].high < pivot)) return false;
  }
  let c0 = true, c1 = true, c2 = true, c3 = true, c4 = true;
  for (let i = 1; i <= n; i++) {
    c0 = c0 && candles[p - i].high < pivot;
    c1 = c1 && candles[p - 1].high <= pivot && candles[p - i - 1].high < pivot;
    c2 = c2 && candles[p - 1].high <= pivot && candles[p - 2].high <= pivot && candles[p - i - 2].high < pivot;
    c3 =
      c3 &&
      candles[p - 1].high <= pivot &&
      candles[p - 2].high <= pivot &&
      candles[p - 3].high <= pivot &&
      candles[p - i - 3].high < pivot;
    c4 =
      c4 &&
      candles[p - 1].high <= pivot &&
      candles[p - 2].high <= pivot &&
      candles[p - 3].high <= pivot &&
      candles[p - 4].high <= pivot &&
      candles[p - i - 4].high < pivot;
  }
  return c0 || c1 || c2 || c3 || c4;
}

function isDownFractal(candles, p, n) {
  const pivot = candles[p].low;
  for (let i = 1; i <= n; i++) {
    if (!(candles[p + i].low > pivot)) return false;
  }
  let c0 = true, c1 = true, c2 = true, c3 = true, c4 = true;
  for (let i = 1; i <= n; i++) {
    c0 = c0 && candles[p - i].low > pivot;
    c1 = c1 && candles[p - 1].low >= pivot && candles[p - i - 1].low > pivot;
    c2 = c2 && candles[p - 1].low >= pivot && candles[p - 2].low >= pivot && candles[p - i - 2].low > pivot;
    c3 =
      c3 &&
      candles[p - 1].low >= pivot &&
      candles[p - 2].low >= pivot &&
      candles[p - 3].low >= pivot &&
      candles[p - i - 3].low > pivot;
    c4 =
      c4 &&
      candles[p - 1].low >= pivot &&
      candles[p - 2].low >= pivot &&
      candles[p - 3].low >= pivot &&
      candles[p - 4].low >= pivot &&
      candles[p - i - 4].low > pivot;
  }
  return c0 || c1 || c2 || c3 || c4;
}

// Ein Level entsteht erst n Kerzen nach seinem Pivot (erst dann ist der Fraktal
// bestätigt) — ab genau dieser Bestätigungskerze wird auf Berührung/Durchbruch geprüft
// (dieselbe Kerze, mit der auch main.pine das frisch erkannte Level zuerst testet).
// Bleibt es bis zum Ende der geladenen Historie unberührt, endet die Linie an der
// letzten Kerze (wächst bei jedem Refresh weiter mit, bis sie geswept wird).
function buildLevel(candles, p, period, dir) {
  const price = dir === 1 ? candles[p].high : candles[p].low;
  let touched = false;
  let touchedTime = null;
  for (let i = p + period; i < candles.length; i++) {
    const c = candles[i];
    const cross = dir === 1 ? c.high >= price : c.low <= price;
    if (cross) {
      touched = true;
      touchedTime = c.time;
      break;
    }
  }
  return {
    price,
    dir,
    pivotTime: candles[p].time,
    touched,
    touchedTime,
    endTime: touched ? touchedTime : candles[candles.length - 1].time,
  };
}

// Erkennt alle Hoch-/Tief-Liquiditäts-Level im geladenen `candles`-Fenster. Rückgabe
// chronologisch aufsteigend (wie in liquidity.pine, wo neue Level ans Array-Ende
// gepusht werden) — wichtig für filterRelevantLevels (das "neueste" Level = letztes
// Element).
export function detectLiquidityLevels(candles, period) {
  const highs = [];
  const lows = [];
  const minIdx = period + 4; // Kaskaden-Logik braucht bis zu period+4 Kerzen davor
  const maxIdx = candles.length - 1 - period; // braucht `period` Kerzen danach zur Bestätigung

  for (let p = minIdx; p <= maxIdx; p++) {
    if (isUpFractal(candles, p, period)) highs.push(buildLevel(candles, p, period, 1));
    if (isDownFractal(candles, p, period)) lows.push(buildLevel(candles, p, period, -1));
  }
  return { highs, lows };
}

// Relevanz-Filter (eine Richtung, z.B. nur highs) — Entsprechung zu refreshLiqRelevance
// in liquidity.pine, aber ohne das dortige Zeichenobjekt-Caching (hier wird bei jedem
// Refresh ohnehin alles neu gerendert, siehe renderLiquidityLevels). Bei onlyRelevant=true
// bleiben sichtbar: das neueste Level (nur solange selbst noch unberührt), alle noch
// nicht berührten älteren Level, sowie die RECENT_SWEEP_COUNT zeitlich zuletzt berührten
// Level — insgesamt aber höchstens maxRelevant, von neu nach alt gezählt. Bei
// onlyRelevant=false zählen einfach die maxRelevant neuesten Level.
export function filterRelevantLevels(levels, maxRelevant, onlyRelevant) {
  const n = levels.length;
  if (n === 0) return [];

  const newestActive = !levels[n - 1].touched;

  const recentSweepIdx = new Set();
  levels
    .map((lvl, i) => ({ i, t: lvl.touchedTime }))
    .filter((x) => x.t != null)
    .sort((a, b) => b.t - a.t)
    .slice(0, RECENT_SWEEP_COUNT)
    .forEach((x) => recentSweepIdx.add(x.i));

  const result = [];
  let relevantCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    const lvl = levels[i];
    const isNewest = newestActive && i === n - 1;
    const isRecentSweep = recentSweepIdx.has(i);
    const baseRelevant = !onlyRelevant || isNewest || !lvl.touched || isRecentSweep;
    if (baseRelevant) {
      if (relevantCount < maxRelevant) result.push(lvl);
      relevantCount += 1;
    }
  }
  return result;
}
