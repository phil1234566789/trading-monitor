// Liquiditäts-Level (Williams-Fractal-Pivots als horizontale Linie), portiert aus
// tv-indikator/src/{fractals,liquidity}.pine. Vereinfacht für Batch-Berechnung (wie
// orderBlocks.js): kein Ringpuffer/Streaming-State pro geschlossener Bar, stattdessen
// bei jedem Refresh einmal komplett über das geladene `candles`-Array (aktueller
// Chart-Timeframe) neu berechnet.
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";

const RECENT_SWEEP_COUNT = 2; // siehe markTopKRecentTouches in liquidity.pine

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

class LiquidityLineRenderer {
  constructor(p1, p2, options) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p1.y === null || p2.x === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const y = Math.round(p1.y * scope.verticalPixelRatio);
      const x1 = Math.round(p1.x * scope.horizontalPixelRatio);
      const x2 = Math.round(p2.x * scope.horizontalPixelRatio);
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = this._options.lineWidth;
      ctx.beginPath();
      ctx.moveTo(Math.min(x1, x2), y);
      ctx.lineTo(Math.max(x1, x2), y);
      ctx.stroke();

      // Debug-Modus (showLiquidityDebug-Toggle) und Trendanalyse-Labels: Preis/Beschriftung an
      // der Linie einblenden. labelSide "start" (Default) = am Pivot-Ursprung, wie der Debug-
      // Toggle es will; "end" = rechts vom Linienende (siehe Trendanalyse-Toggle).
      if (this._options.label) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = this._options.color;
        if (this._options.labelSide === "end") {
          // Linien, die bis "jetzt" reichen (z.B. Swing High/Low), enden direkt am rechten
          // Pane-Rand — ohne Clamp würde das Label dort abgeschnitten. An den Rand klemmen
          // (mit etwas Innenabstand), notfalls überlappt es minimal mit dem Linienende.
          const textWidth = ctx.measureText(this._options.label).width;
          const desiredX = Math.max(x1, x2) + 6 * scope.horizontalPixelRatio;
          const maxX = scope.bitmapSize.width - textWidth - 4 * scope.horizontalPixelRatio;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(this._options.label, Math.min(desiredX, maxX), y);
        } else {
          ctx.textBaseline = "bottom";
          ctx.textAlign = "left";
          ctx.fillText(this._options.label, Math.min(x1, x2) + 4 * scope.horizontalPixelRatio, y - 2 * scope.verticalPixelRatio);
        }
      }
    });
  }

  get p1() {
    return this._p1;
  }

  get p2() {
    return this._p2;
  }
}

class LiquidityPaneView {
  constructor(source) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const lvl = this._source._level;
    const candles = this._source._candles;

    const startBarTime = snapToBarTime(candles, lvl.pivotTime);
    const endBarTime = snapToBarTime(candles, lvl.endTime);
    const y = series.priceToCoordinate(lvl.price);
    this._p1 = { x: startBarTime != null ? timeScale.timeToCoordinate(startBarTime) : null, y };
    this._p2 = { x: endBarTime != null ? timeScale.timeToCoordinate(endBarTime) : null, y };
  }

  renderer() {
    return new LiquidityLineRenderer(this._p1, this._p2, this._source._options);
  }
}

export class LiquidityLinePrimitive {
  constructor(level, options, candles) {
    this._level = level;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new LiquidityPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    // Anders als beim initialen Laden (wo candleSeries.setData() ohnehin einen Redraw
    // auslöst) hängt ein Primitive-Wechsel allein (z.B. beim "Liquidität"-Toggle) sonst
    // in der Luft, bis irgendein anderes Chart-Event (Resize/Pan/nächster Poll) zufällig
    // einen Redraw anstößt — deshalb hier explizit anfordern.
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

const LINE_WIDTH = 1;

function levelOptions(lvl, { debugPrices, formatPrice } = {}) {
  const key = lvl.touched ? "liquiditySweep" : lvl.dir === 1 ? "liquidityHigh" : "liquidityLow";
  const color = cssColor(key);
  const label = debugPrices ? formatPrice(lvl.price) : null;
  return { color, lineWidth: LINE_WIDTH, label };
}

// Zeichnet die übergebenen Level neu (komplettes Ersetzen der bisherigen Primitives) —
// analog zu renderPersistedZones in orderBlocks.js. `debugPrices`/`formatPrice` steuern das
// Preis-Label am Pivot-Ursprung (Debug-Toggle im Dashboard) — ohne `formatPrice` bleibt es aus.
export function renderLiquidityLevels(series, levels, existingPrimitives, candles, { debugPrices, formatPrice } = {}) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const lvl of levels) {
    const primitive = new LiquidityLinePrimitive(lvl, levelOptions(lvl, { debugPrices, formatPrice }), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
