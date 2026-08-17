// Liquiditäts-Level (Williams-Fractal-Pivots als horizontale Linie), portiert aus
// tv-indikator/src/{fractals,liquidity}.pine. Vereinfacht für Batch-Berechnung (wie
// orderBlocks.js): kein Ringpuffer/Streaming-State pro geschlossener Bar, stattdessen
// bei jedem Refresh einmal komplett über das geladene `candles`-Array (aktueller
// Chart-Timeframe) neu berechnet.
import { snapToBarTime, businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { canShowLabels } from "./chartZoom.js";
import { classifyAge } from "./ageTier";
// Reine Fraktal-Erkennung seit Chat 2026-07-31 nach liquidityDetection.js ausgelagert (dort auch
// die Begründung) — hier nur re-exportiert, damit sich an der öffentlichen API dieser Datei nichts
// ändert (PriceChart.vue/dataExport.js importieren weiterhin von hier).
import { LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, detectLiquidityLevels, filterRelevantLevels } from "./liquidityDetection.js";

export { LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, detectLiquidityLevels, filterRelevantLevels };

const PIN_HALO_EXTRA_WIDTH = 3; // px, zusätzlich zur normalen lineWidth (Chat 2026-08-17)

class LiquidityLineRenderer {
  constructor(p1, p2, options, chart, candles) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
    this._chart = chart;
    this._candles = candles;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p1.y === null || p2.x === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const y = Math.round(p1.y * scope.verticalPixelRatio);
      const x1 = Math.round(p1.x * scope.horizontalPixelRatio);
      const x2 = Math.round(p2.x * scope.horizontalPixelRatio);
      // Pin-Halo (Chat 2026-08-17, analog zum Rahmen bei OrderBlockPrimitive/Ring bei
      // TradeMarkerPrimitive) — dickere Linie in der Pin-Akzentfarbe HINTER der eigentlichen
      // Linie, damit gepinnte Level auch bei kräftigen Sweep-/High-/Low-Farben noch erkennbar
      // hervorstechen, ohne deren semantische Farbe zu verlieren.
      if (this._options.inPinContext) {
        ctx.strokeStyle = this._options.pinColor;
        ctx.lineWidth = (this._options.lineWidth + PIN_HALO_EXTRA_WIDTH) * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.min(x1, x2), y);
        ctx.lineTo(Math.max(x1, x2), y);
        ctx.stroke();
      }

      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = this._options.lineWidth;
      // gestrichelt für "sweeped" (Docht durchbrochen, aber noch kein bestätigter Bruch) — siehe
      // marketStructureAnalysis.ts: renderMarketStructureAnalysis, Chat 2026-07-19. setLineDash([]) = durchgezogen,
      // muss bei jedem draw() neu gesetzt werden (kein impliziter Reset zwischen Primitives).
      ctx.setLineDash(this._options.dashed ? [6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio] : []);
      ctx.beginPath();
      ctx.moveTo(Math.min(x1, x2), y);
      ctx.lineTo(Math.max(x1, x2), y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Debug-Modus (showLiquidityDebug-Toggle) und Trendanalyse-Labels: Preis/Beschriftung an
      // der Linie einblenden. labelSide "start" (Default) = am Pivot-Ursprung, wie der Debug-
      // Toggle es will; "end" = rechts vom Linienende (siehe Trendanalyse-Toggle); "center-above"/
      // "center-below" = horizontal mittig über/unter der Linie (Chat 2026-07-24, Break of
      // Structure: "im uptrend über der Linie mittig, im downtrend unter der Linie mittig");
      // "end-above"/"end-below" = rechtsbündig am Linienende, aber ÜBER/UNTER statt AUF der Linie
      // (Chat 2026-07-27, M5-LQ-Sweep im Trade-Setup: "Label fängt nicht am Ende der Linie an,
      // sondern endet zusammen mit der Linie" — anders als "end" wächst das Label hier nach LINKS
      // über die Linie statt nach rechts über den Pane-Rand hinaus, kein Clamp nötig).
      // Chat 2026-07-25: "wenn ich im 1h den chart etwas herauszoome, dann verdecken mir die
      // Labels die Sicht" — sobald die Kerzen zu dünn sind (siehe chartZoom.js), Label weglassen,
      // Linie selbst bleibt unverändert stehen.
      if (this._options.label && canShowLabels(this._chart, this._candles)) {
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
        } else if (this._options.labelSide === "end-above" || this._options.labelSide === "end-below") {
          const endX = Math.max(x1, x2);
          const above = this._options.labelSide === "end-above";
          ctx.textBaseline = above ? "bottom" : "top";
          ctx.textAlign = "right";
          ctx.fillText(this._options.label, endX, y + (above ? -2 : 2) * scope.verticalPixelRatio);
        } else if (this._options.labelSide === "center-above" || this._options.labelSide === "center-below") {
          const midX = (x1 + x2) / 2;
          const above = this._options.labelSide === "center-above";
          ctx.textBaseline = above ? "bottom" : "top";
          ctx.textAlign = "center";
          ctx.fillText(this._options.label, midX, y + (above ? -2 : 2) * scope.verticalPixelRatio);
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
    return new LiquidityLineRenderer(this._p1, this._p2, this._source._options, this._source._chart, this._source._candles);
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

  get level() {
    return this._level;
  }

  // Distanz zum Pin-Kontextmenü (Chat 2026-08-02, LQ-Level als fünfte Kontext-Art) — analog zu
  // OrderBlockPrimitive.distanceTo (orderBlocks.js), aber für eine horizontale Strecke statt eines
  // Rechtecks: 0 innerhalb des x-Bereichs bei exakter y-Höhe, sonst vertikaler Abstand innerhalb des
  // Bereichs bzw. euklidischer Abstand zum nächstgelegenen Endpunkt außerhalb davon. x/y in
  // CSS-Pixeln relativ zum Chart-Container, wie bei allen anderen Primitives hier.
  distanceTo(x, y) {
    const { _p1: p1, _p2: p2 } = this._paneViews[0];
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return Infinity;
    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    if (x < left) return Math.hypot(x - left, y - p1.y);
    if (x > right) return Math.hypot(x - right, y - p1.y);
    return Math.abs(y - p1.y);
  }
}

// Konfigurierbar seit Chat 2026-07-25 (Style-Modal), siehe src/chartLineWidths.js.

// " (1d 3h alt)" hinter dem Preis-Label, oder "" ohne pivotTime/nowSec (Chat 2026-07-22: "bei den
// relevanten LQ-Leveln das Alter anzeigen ... Wochenende nicht mitzählen") — businessSecondsBetween
// lässt Sa/So komplett raus.
function ageSuffix(pivotTime, nowSec) {
  if (pivotTime == null || nowSec == null) return "";
  const age = formatAge(businessSecondsBetween(pivotTime, nowSec));
  return age ? ` (${age} alt)` : "";
}

// "Major LS 1,13545 (22d 19h alt)" — gemeinsames Label-Format für die Trade-Setup-LS-Linie
// (PriceChart.vue) UND die "1h LQ-Sweep"-Linie (marketStructureAnalysis.ts), Chat 2026-07-28: seit
// collectH1LqLevels (selber Chat) ist das oft exakt derselbe Pivot, zweimal gezeichnet — mit
// identischem Label-Text überlappen sich beide Linien lesbar statt zwei leicht unterschiedliche
// Strings übereinander zu zeigen ("1h LQ-Sweep..." vs. "LS..."). Tier-Präfix ("Major "/"Medium ")
// nur ab medium — "minor" (< 1 Tag) bewusst ohne Präfix ("aus Platzgründen", Chat 2026-07-28).
// Kein pivotTime/nowSec (z.B. synthetische Test-Pivots) -> nur "LS {price}", kein Tier/Alter.
export function formatLsLabel(formattedPrice, pivotTime, nowSec) {
  if (pivotTime == null || nowSec == null) return `LS ${formattedPrice}`;
  const tier = classifyAge(businessSecondsBetween(pivotTime, nowSec));
  const prefix = tier === "minor" ? "" : `${tier[0].toUpperCase()}${tier.slice(1)} `;
  return `${prefix}LS ${formattedPrice}${ageSuffix(pivotTime, nowSec)}`;
}

// Bullische Sweep-/Setup-Linien beschriften sich rechtsbündig UNTER, bärische DARÜBER — reine
// visuelle Unterscheidung (siehe PP-/LS-Linien in PriceChart.vue, Chat 2026-07-27). Chat
// 2026-07-28 ("genauso wie schon in trades die Protected Pivots und die LS") baut die "1h
// LQ-Sweep"-Linie in marketStructureAnalysis.ts auf dieselbe Regel um statt sie separat zu
// entscheiden — daher hier als gemeinsame Stelle statt einer dritten eigenen Kopie.
export function bullBearLabelSide(bearish) {
  return bearish ? "end-above" : "end-below";
}

function levelOptions(lvl, { debugPrices, formatPrice, nowSec, inPinContext } = {}) {
  const key = lvl.touched ? "liquiditySweep" : lvl.dir === 1 ? "liquidityHigh" : "liquidityLow";
  const color = cssColor(key);
  const label = debugPrices ? `${formatPrice(lvl.price)}${ageSuffix(lvl.pivotTime, nowSec)}` : null;
  return { color, lineWidth: lineWidth(key), label, inPinContext, pinColor: cssColor("pin") };
}

// Timeframe bewusst NICHT Teil des Strings (anders als obZoneNaturalKey/orderBlocks.js) — diese
// Funktion baut den Schlüssel nur für die Level des GERADE angezeigten Chart-Timeframes (siehe
// renderLiquidityLevels-Aufrufer in PriceChart.vue: es existiert immer nur eine currentBar-Menge
// gleichzeitig), Dashboard.vue filtert schon vorher nach Timeframe/kind (liquidity_level=1H vs.
// m5_liquidity_level=aktueller Nicht-1h-Timeframe), bevor beide Kind-Arten in DIESELBE Pin-Keys-
// Menge gemischt werden — pinContext.js: liquidityLevelEntryNaturalKey/m5LiquidityEntryNaturalKey
// bauen denselben String aus der DB-Zeile/dem Rohdaten-Snapshot.
export function liquidityLevelNaturalKey(dir, pivotTime) {
  return `${dir === 1 ? "high" : "low"}|${pivotTime}`;
}

// Zeichnet die übergebenen Level neu (komplettes Ersetzen der bisherigen Primitives) —
// analog zu renderPersistedZones in orderBlocks.js. `debugPrices`/`formatPrice` steuern das
// Preis-Label am Pivot-Ursprung (Debug-Toggle im Dashboard) — ohne `formatPrice` bleibt es aus.
// `pinKeys` (Chat 2026-08-17, analog zu renderPersistedZones' pinKeys-Parameter): Set von
// liquidityLevelNaturalKey-Strings, die dauerhaft hervorgehoben werden sollen.
export function renderLiquidityLevels(series, levels, existingPrimitives, candles, { debugPrices, formatPrice, nowSec, pinKeys } = {}) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const lvl of levels) {
    const inPinContext = pinKeys?.has(liquidityLevelNaturalKey(lvl.dir, lvl.pivotTime)) ?? false;
    const primitive = new LiquidityLinePrimitive(lvl, levelOptions(lvl, { debugPrices, formatPrice, nowSec, inPinContext }), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
