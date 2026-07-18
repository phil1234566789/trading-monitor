import { LiquidityLinePrimitive } from "./liquidity.js";
import type { Pivot, RangeState } from "./range.type";

// Neuer "1h-Range"-Trendalgorithmus (siehe test/tdd_mit_claude.ts, rangeState1..7) — löst den
// alten, verworfenen BOS/CHoCH-Ansatz (trendZigzag.ts) für die eigentliche Trendbestimmung ab:
// auf M5-Periode-10-Pivots gab es zu viele CHoCHs/BOS für einen stabilen Trend (siehe Chat
// 2026-07-18). Dieser Algorithmus arbeitet auf H1-Periode-5-Pivots und bestätigt einen Trend erst,
// wenn eine echte Pullback-Struktur (structurePivots) vorliegt, nicht schon bei jeder neuen
// Extremkerze.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Erwartet die ersten beiden gelesenen Pivots (ein 'high' und ein 'low', in Lese-Reihenfolge für
// appliedPivots) — analog zu initTrendState in trendZigzag.ts. currRange.high/low behalten hier
// bewusst ihren rohen Fraktal-Typ ('high'/'low'), werden anders als beim alten Zigzag-Ansatz NICHT
// reklassifiziert (siehe range.type.ts: PivotHigh/PivotLow).
export function initRangeState(a: Pivot, b: Pivot): RangeState {
  const high = a.type === "high" ? a : b;
  const low = a.type === "low" ? a : b;
  return {
    trend: "unknown",
    currRange: {
      high: { ...high, type: "high" },
      low: { ...low, type: "low" },
    },
    structurePivots: [],
    appliedPivots: [a, b],
  };
}

// pivotTime (Unix-Sekunden) ist die verlässliche Zeitachse für die Reihenfolge-Prüfung unten —
// bewusst NICHT die Position in appliedPivots (ein Array-Index ist fragil, siehe Chat). pivotTime
// ist im Pivot-Typ optional (range.type.ts), applyRangePivot braucht es aber zwingend -> klarer
// Fehler statt still falsch zu sortieren, falls doch mal ein Pivot ohne pivotTime hereinkommt.
function pivotTimeOf(pivot: Pivot): number {
  if (pivot.pivotTime == null) {
    throw new Error(`applyRangePivot: Pivot ohne pivotTime (pivotAt="${pivot.pivotAt}") — pivotTime ist für die Reihenfolge-Prüfung zwingend.`);
  }
  return pivot.pivotTime;
}

// Liest einen weiteren Pivot ein und wendet genau die Regeln an, die sich aus rangeState1..7
// ablesen lassen (siehe Chat 2026-07-18, Korrektur):
// 1. Pivot bricht die Range in seiner eigenen Richtung (neues Low unter currRange.low, neues High
//    über currRange.high) -> diese Grenze wird ersetzt.
// 2. Ein bestätigter Uptrend braucht 4 Punkte in strikter zeitlicher Reihenfolge (pivotTime): das
//    aktuelle currRange.low, ein currRange.high, das ZEITLICH NACH diesem Low liegt ("eligible" —
//    sonst zählt es nicht als echter Ursprung eines Aufwärts-Legs), mindestens 1 Pullback-Low in
//    structurePivots, das NACH diesem eligible currRange.high liegt, und schließlich der Bruch
//    dieses currRange.high. Beispiel rangeState4 vs. rangeState7: pivot2 ist NICHT eligible (liegt
//    vor dem aktuellen range-low pivot3) -> pivot5s Bruch von pivot2 bestätigt NICHT, obwohl pivot4
//    zeitlich danach liegt. pivot5 IST eligible (liegt nach pivot3) -> pivot8s Bruch von pivot5
//    bestätigt, weil pivot6 und pivot7 danach liegen (pivot4 zählt hier nicht mehr mit, weil es VOR
//    pivot5 liegt). Der jüngste qualifizierende Pullback wird zu 'protected-low' reklassifiziert,
//    die übrigen structurePivots bleiben unverändert.
// 3. Pivot liegt innerhalb der aktuellen Range -> Pullback, landet in structurePivots (siehe
//    rangeState3/5/6) — unabhängig davon, ob er später als "qualifizierend" zählt.
// NICHT implementiert: die spiegelbildliche Downtrend-Bestätigung (neues Low bricht currRange.low
// mit genug nachträglichen Pullback-Highs in der Struktur) — dafür gibt es noch kein Beispiel in
// tdd_mit_claude.ts, also bewusst offen gelassen statt geraten (wie beim alten trendZigzag.ts:
// "STOPP, schreib den algo erst mal bis hier und nicht weiter").
export function applyRangePivot(state: RangeState, pivot: Pivot): RangeState {
  const { currRange, structurePivots, appliedPivots, trend } = state;
  const nextAppliedPivots = [...appliedPivots, pivot];

  if (pivot.type === "low" && pivot.price < currRange.low.price) {
    return {
      ...state,
      currRange: { ...currRange, low: { ...pivot, type: "low" } },
      appliedPivots: nextAppliedPivots,
    };
  }

  if (pivot.type === "high" && pivot.price > currRange.high.price) {
    const highTime = pivotTimeOf(currRange.high);
    const highIsEligible = highTime > pivotTimeOf(currRange.low);
    const qualifyingPullbacks = structurePivots.filter((p) => p.type === "low" && pivotTimeOf(p) > highTime);

    if (trend === "unknown" && highIsEligible && qualifyingPullbacks.length >= 1) {
      // jüngster qualifizierender Pullback nach pivotTime, nicht nach Array-Position bestimmt
      const protectedLow = qualifyingPullbacks.reduce((latest, p) =>
        pivotTimeOf(p) > pivotTimeOf(latest) ? p : latest,
      );
      const nextStructurePivots = structurePivots.map((p) =>
        p === protectedLow ? { ...p, type: "protected-low" as const } : p,
      );
      return {
        trend: "uptrend",
        currRange: { ...currRange, high: { ...pivot, type: "high" } },
        structurePivots: nextStructurePivots,
        appliedPivots: nextAppliedPivots,
      };
    }
    return {
      ...state,
      currRange: { ...currRange, high: { ...pivot, type: "high" } },
      appliedPivots: nextAppliedPivots,
    };
  }

  return { ...state, structurePivots: [...structurePivots, pivot], appliedPivots: nextAppliedPivots };
}

// --- Zeichnung ----------------------------------------------------------------------------------
// Pfeil-Marker (roh: kleines gefülltes Dreieck) für range.high/range.low — sitzt ganz rechts am
// Pane-Rand (wie das Linienende, siehe toLevel), nicht am Pivot selbst (siehe Chat: "nach ganz
// rechts"). Farbe entscheidet die Seite: grün sitzt ÜBER der Linie und zeigt nach oben weg, rot
// UNTER der Linie und zeigt nach unten weg (siehe Chat: "Pfeile umdrehen").
class ArrowRenderer {
  private _point: any;
  private _options: any;

  constructor(point: any, options: any) {
    this._point = point;
    this._options = options;
  }

  draw(target: any) {
    const p = this._point;
    if (p.x === null || p.y === null) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const x = Math.round(p.x * scope.horizontalPixelRatio);
      const y = Math.round(p.y * scope.verticalPixelRatio);
      const size = 5 * scope.horizontalPixelRatio;
      ctx.fillStyle = this._options.color;
      ctx.beginPath();
      if (this._options.direction === "down") {
        // sitzt über der Linie, zeigt nach oben weg (für range.low)
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x, y - size * 3);
      } else {
        // sitzt unter der Linie, zeigt nach unten weg (für range.high)
        ctx.moveTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x, y + size * 3);
      }
      ctx.closePath();
      ctx.fill();
    });
  }
}

class ArrowPaneView {
  private _source: ArrowPrimitive;
  private _point: any;

  constructor(source: ArrowPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;
    const pivot = this._source._pivot;
    const lastTime = candles.length > 0 ? candles[candles.length - 1].time : null;
    this._point = {
      x: lastTime != null ? timeScale.timeToCoordinate(lastTime) : null,
      y: series.priceToCoordinate(pivot.price),
    };
  }

  renderer() {
    return new ArrowRenderer(this._point, this._source._options);
  }
}

export class ArrowPrimitive {
  _pivot: Pivot;
  _options: { color: string; direction: "up" | "down" };
  _candles: Candle[];
  _paneViews: ArrowPaneView[];
  _chart: any;
  _series: any;

  constructor(pivot: Pivot, options: { color: string; direction: "up" | "down" }, candles: Candle[]) {
    this._pivot = pivot;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new ArrowPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Feste Bildschirmposition (rechts, vertikal mittig in der Pane) statt Preis/Zeit-Koordinate —
// für das Trend-Label ("1h uptrend"), siehe Chat. Keine der bestehenden Primitives (Linie, Punkt,
// Pfeil) ist preis-/zeit-UNABHÄNGIG positioniert, daher eigene, sehr kleine Renderer-Klasse.
class TrendLabelRenderer {
  private _text: string;
  private _color: string;

  constructor(text: string, color: string) {
    this._text = text;
    this._color = color;
  }

  draw(target: any) {
    if (!this._text) return;
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      ctx.font = `${Math.round(13 * scope.verticalPixelRatio)}px sans-serif`;
      ctx.fillStyle = this._color;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const x = scope.bitmapSize.width - 12 * scope.horizontalPixelRatio;
      const y = scope.bitmapSize.height / 2;
      ctx.fillText(this._text, x, y);
    });
  }
}

class TrendLabelPaneView {
  private _source: TrendLabelPrimitive;

  constructor(source: TrendLabelPrimitive) {
    this._source = source;
  }

  renderer() {
    return new TrendLabelRenderer(this._source._text, this._source._color);
  }
}

export class TrendLabelPrimitive {
  _text: string;
  _color: string;
  _paneViews: TrendLabelPaneView[];

  constructor(text: string, color: string) {
    this._text = text;
    this._color = color;
    this._paneViews = [new TrendLabelPaneView(this)];
  }

  attached({ requestUpdate }: { requestUpdate: () => void }) {
    requestUpdate(); // keine Chart-/Series-Referenz nötig, Position kommt rein aus der Pane-Größe
  }

  updateAllViews() {
    // nichts zu berechnen — Position wird erst beim Draw aus der Pane-Bitmapgröße abgeleitet
  }

  paneViews() {
    return this._paneViews;
  }
}

const RANGE_HIGH_COLOR = "rgba(239, 83, 80, 0.95)"; // rot
const RANGE_LOW_COLOR = "rgba(0, 230, 118, 0.95)"; // grün
const PROTECTED_LOW_COLOR = "rgba(255, 255, 255, 0.95)"; // weiß, wie TRADE_SETUP_PROTECTED_COLOR in PriceChart.vue
const LINE_WIDTH = 2;

function toLevel(pivot: Pivot, candles: Candle[]) {
  // Vereinfachung: Linie reicht immer bis zur letzten geladenen Kerze (nicht bis touchedAt-Zeit) —
  // für range.high/range.low/protected-low reicht das, weil sie per Definition der aktuell
  // gültige, unberührte Rand der Struktur sind (in Philips Beispiel sind alle drei `touched: false`).
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0);
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
}

// Ersetzt existingPrimitives komplett durch die aktuelle Range-Analyse-Darstellung: roter
// Pfeil+Linie an currRange.high, grüner Pfeil+Linie an currRange.low, bei bestätigtem Trend
// zusätzlich eine beschriftete Linie am protected-low und rechts/mittig das Trend-Label
// (siehe Chat). state=null (oder zu wenig Kerzen) -> nur aufräumen, nichts zeichnen.
export function renderRangeAnalysis(
  series: any,
  state: RangeState | null,
  existingPrimitives: any[],
  candles: Candle[],
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state || candles.length === 0) return;

  const highLine = new LiquidityLinePrimitive(toLevel(state.currRange.high, candles), { color: RANGE_HIGH_COLOR, lineWidth: LINE_WIDTH }, candles);
  const lowLine = new LiquidityLinePrimitive(toLevel(state.currRange.low, candles), { color: RANGE_LOW_COLOR, lineWidth: LINE_WIDTH }, candles);
  // rot: unter der Linie, zeigt nach oben; grün: über der Linie, zeigt nach unten (siehe Chat)
  const highArrow = new ArrowPrimitive(state.currRange.high, { color: RANGE_HIGH_COLOR, direction: "up" }, candles);
  const lowArrow = new ArrowPrimitive(state.currRange.low, { color: RANGE_LOW_COLOR, direction: "down" }, candles);
  for (const primitive of [highLine, lowLine, highArrow, lowArrow]) {
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }

  const protectedLow = state.structurePivots.find((p) => p.type === "protected-low");
  if (protectedLow) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedLow, candles),
      { color: PROTECTED_LOW_COLOR, lineWidth: LINE_WIDTH, label: "1h protected low", labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  if (state.trend !== "unknown") {
    const color = state.trend === "uptrend" ? RANGE_LOW_COLOR : RANGE_HIGH_COLOR;
    const label = new TrendLabelPrimitive(`1h ${state.trend}`, color);
    series.attachPrimitive(label);
    existingPrimitives.push(label);
  }
}
