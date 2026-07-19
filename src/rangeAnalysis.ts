import { LiquidityLinePrimitive } from "./liquidity.js";
import { cssColor } from "./chartColors.js";
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
    innerStructurePivots: [],
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

// Prüft, ob ein High-Bruch (übergeordnet ODER eingebettet, siehe applyRangePivot/
// applyInnerRangePivot) den Uptrend bestätigt — gemeinsame Logik für beide, seit Chat 2026-07-19
// ("die Regeln müssten gleich sein, nur dass der kleinere Pivot mit einbezogen wird",
// gbp_h1_uptrend_LQ_sweep_long_setup.ts rangeState1_4). Ein bestätigter Uptrend braucht 4 Punkte
// in strikter zeitlicher Reihenfolge (pivotTime): das aktuelle currRange.low, ein currRange.high,
// das ZEITLICH NACH diesem Low liegt ("eligible" — sonst zählt es nicht als echter Ursprung eines
// Aufwärts-Legs), mindestens 1 Pullback-Low NACH diesem eligible currRange.high — aus
// structurePivots ODER innerStructurePivots zusammen, "der kleinere Pivot" darf also auch
// qualifizieren — und schließlich der Bruch dieses currRange.high durch breakingPivot. Der jüngste
// qualifizierende Pullback wird zu 'protected-low' reklassifiziert (in welcher der beiden Listen
// er auch steckt), die übrigen bleiben unverändert. Gibt null zurück, wenn (noch) nicht bestätigt.
function tryConfirmUptrend(state: RangeState, breakingPivot: Pivot): RangeState | null {
  const { currRange, structurePivots, innerStructurePivots, trend } = state;
  if (trend !== "unknown") return null;

  const highTime = pivotTimeOf(currRange.high);
  if (highTime <= pivotTimeOf(currRange.low)) return null; // nicht eligible

  const qualifyingPullbacks = [...structurePivots, ...innerStructurePivots].filter(
    (p) => p.type === "low" && pivotTimeOf(p) > highTime,
  );
  if (qualifyingPullbacks.length === 0) return null;

  // jüngster qualifizierender Pullback nach pivotTime, nicht nach Array-Position bestimmt
  const protectedLow = qualifyingPullbacks.reduce((latest, p) => (pivotTimeOf(p) > pivotTimeOf(latest) ? p : latest));
  const reclassify = (p: Pivot) => (p === protectedLow ? { ...p, type: "protected-low" as const } : p);

  return {
    ...state,
    trend: "uptrend",
    currRange: { ...currRange, high: { ...breakingPivot, type: "high" } },
    structurePivots: structurePivots.map(reclassify),
    innerStructurePivots: innerStructurePivots.map(reclassify),
  };
}

// Liest einen weiteren Pivot ein und wendet genau die Regeln an, die sich aus rangeState1..7
// ablesen lassen (siehe Chat 2026-07-18, Korrektur):
// 1. Pivot bricht die Range in seiner eigenen Richtung (neues Low unter currRange.low, neues High
//    über currRange.high) -> diese Grenze wird ersetzt.
// 2. Bestätigung siehe tryConfirmUptrend oben. Beispiel rangeState4 vs. rangeState7: pivot2 ist
//    NICHT eligible (liegt vor dem aktuellen range-low pivot3) -> pivot5s Bruch von pivot2
//    bestätigt NICHT, obwohl pivot4 zeitlich danach liegt. pivot5 IST eligible (liegt nach pivot3)
//    -> pivot8s Bruch von pivot5 bestätigt, weil pivot6 und pivot7 danach liegen (pivot4 zählt
//    hier nicht mehr mit, weil es VOR pivot5 liegt).
// 3. Pivot liegt innerhalb der aktuellen Range -> Pullback, landet in structurePivots (siehe
//    rangeState3/5/6) — unabhängig davon, ob er später als "qualifizierend" zählt.
// NICHT implementiert: die spiegelbildliche Downtrend-Bestätigung (neues Low bricht currRange.low
// mit genug nachträglichen Pullback-Highs in der Struktur) — dafür gibt es noch kein Beispiel in
// tdd_mit_claude.ts, also bewusst offen gelassen statt geraten (wie beim alten trendZigzag.ts:
// "STOPP, schreib den algo erst mal bis hier und nicht weiter").
// Jeder hier gelesene ÜBERGEORDNETE (z.B. Periode-5-)Pivot räumt innerStructurePivots leer —
// die eingebettete Struktur bezieht sich immer nur auf "seit dem letzten übergeordneten Pivot"
// (siehe Chat 2026-07-19, gbp_h1_uptrend_LQ_sweep_long_setup.ts: rangeState1_2 -> rangeState2,
// "wenn neuer übergeordneter pivot, dann innerStructurePivots CLEAREN"). Gilt für alle drei Fälle
// unten (Low-Bruch/High-Bruch/Struktur-Pullback), nicht nur für den Trend-Bestätigungsfall.
export function applyRangePivot(state: RangeState, pivot: Pivot): RangeState {
  const { currRange, structurePivots, appliedPivots } = state;
  const nextAppliedPivots = [...appliedPivots, pivot];

  if (pivot.type === "low" && pivot.price < currRange.low.price) {
    return {
      ...state,
      currRange: { ...currRange, low: { ...pivot, type: "low" } },
      innerStructurePivots: [],
      appliedPivots: nextAppliedPivots,
    };
  }

  if (pivot.type === "high" && pivot.price > currRange.high.price) {
    const confirmed = tryConfirmUptrend(state, pivot);
    if (confirmed) {
      return { ...confirmed, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
    }
    return {
      ...state,
      currRange: { ...currRange, high: { ...pivot, type: "high" } },
      innerStructurePivots: [],
      appliedPivots: nextAppliedPivots,
    };
  }

  return {
    ...state,
    structurePivots: [...structurePivots, pivot],
    innerStructurePivots: [],
    appliedPivots: nextAppliedPivots,
  };
}

// Analog zu closesBelowOldLow in trendZigzag.ts, nur für die Gegenrichtung: prüft, ob zwischen
// fromTime (Zeit des ALTEN currRange.high) und toTime (Zeit des brechenden Pivots) irgendeine
// Kerze ÜBER dem alten High-Preis geschlossen hat. Nur dann ist der Bruch "echt" (Preis bleibt
// oben) — sonst ist es nur ein Sweep: Preis hat den Docht drüber geschoben, kann aber laut Philip
// "potenziell umdrehen" (siehe Chat 2026-07-19). Ohne Kerzendaten konservativ NICHT abwerten
// (wie beim Vorbild) — sonst würde ein fehlender Candle-Fetch stillschweigend jeden Bruch zum
// Sweep degradieren.
function closesAboveOldHigh(candles: Candle[], fromTime: number, toTime: number, oldHighPrice: number): boolean {
  if (candles.length === 0) return true;
  return candles.some((c) => c.time > fromTime && c.time <= toTime && c.close > oldHighPrice);
}

// Spiegelbildlich zu closesAboveOldHigh, für structurePivots statt currRange.high: prüft, ob seit
// levelTime (Zeit des betroffenen Pivots selbst) bis toTime irgendeine Kerze UNTER levelPrice
// geschlossen hat. Ohne Kerzendaten konservativ KEINEN Sweep behaupten (anders als bei
// closesAboveOldHigh — dort ist "echter Bruch" der Default, hier ist "plain low" der Default, siehe
// markLqSweeps).
function closesBelowLevel(candles: Candle[], levelTime: number, toTime: number, levelPrice: number): boolean {
  if (candles.length === 0) return true;
  return candles.some((c) => c.time > levelTime && c.time <= toTime && c.close < levelPrice);
}

// Ein LOW-structurePivot, der per Docht schon mal angetestet wurde (touched, aus der Fraktal-
// Erkennung selbst) aber NIE eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab statt
// eines echten Bruchs — wird zu 'LQ-sweep' reklassifiziert (siehe Chat 2026-07-19, gbp_h1_uptrend_
// mit_LQ_sweep_LONG_SETUP.ts: rangeState1_1, "potenzieller 1h bullischer LQ-Sweep & Long Trade").
// Läuft über ALLE bisherigen structurePivots (nicht nur den, den der aktuelle Pivot direkt
// berührt) — ein Sweep kann durch jede neue Kerze nachträglich bestätigt werden, nicht nur exakt
// im Moment des auslösenden Pivots (siehe rangeState1_1: pivot9 wird durch p2Pivot37 bestätigt,
// pivot12 dagegen NICHT — dort hat zwischenzeitlich tatsächlich eine Kerze drunter geschlossen,
// also ein "echter" Touch, kein Sweep).
// BIDIREKTIONAL (Fix 2026-07-19, siehe Chat: "aktuell werden 3 1h LQ-Sweeps erkannt"): `touched`
// ist der volle Fixture-Endstand (steht schon fest, bevor der eigentliche Docht-Moment in der
// Replay-Reihenfolge überhaupt erreicht ist, siehe pivot9), daher kann closesBelowLevel bei einem
// FRÜHEN Zwischenschritt (toTime lange vor dem eigentlichen Close-drunter) fälschlich "noch kein
// Close" liefern. Ohne Rückweg bliebe das für immer als 'LQ-sweep' hängen, auch wenn ein späterer
// Schritt (näher am echten Zeitpunkt) den tatsächlichen Close-drunter längst sehen würde — daher
// hier IMMER neu bewerten (auch bereits als 'LQ-sweep' markierte), in beide Richtungen. Am
// tatsächlichen Ziel-toTime (z.B. p2Pivot37) ist das Ergebnis dadurch unabhängig vom genauen
// Zwischenschritt-Pfad immer korrekt. 'protected-low' bleibt unangetastet (anderes Konzept).
// NICHT implementiert: was mit einem ECHTEN Close-Bruch eines structurePivots passieren soll (die
// spiegelbildliche Downtrend-Bestätigung) — dafür gibt es noch kein Beispiel, der Pivot bleibt in
// dem Fall einfach unverändert 'low' liegen (siehe pivot12).
function markLqSweeps(structurePivots: Pivot[], candles: Candle[], toTime: number): Pivot[] {
  return structurePivots.map((p) => {
    if ((p.type !== "low" && p.type !== "LQ-sweep") || !p.touched) return p;
    const closedBelow = closesBelowLevel(candles, pivotTimeOf(p), toTime, p.price);
    if (closedBelow) return p.type === "LQ-sweep" ? { ...p, type: "low" as const } : p;
    return p.type === "low" ? { ...p, type: "LQ-sweep" as const } : p;
  });
}

// Liest einen eingebetteten (z.B. Periode-2-)Pivot ein — läuft NUR gegen die aktuelle Range, NIE
// gegen appliedPivots (das bleibt reine übergeordnete Zeitachse, siehe rangeState2_1: p2Pivot4
// taucht dort nur in innerStructurePivots auf) — siehe Chat 2026-07-19,
// gbp_h1_uptrend_LQ_sweep_long_setup.ts rangeState1_2/rangeState2_1/rangeState1_4:
// 0. Zuerst IMMER markLqSweeps über structurePivots (siehe oben) — unabhängig davon, was der
//    aktuelle Pivot selbst bricht.
// 1. Pivot liegt innerhalb der Range -> reiner Pullback, landet in innerStructurePivots.
// 2. Pivot bricht currRange.high preislich UND mindestens eine Kerze hat seit dem alten High
//    tatsächlich DRÜBER geschlossen (closesAboveOldHigh) -> echter Bruch, kein Sweep mehr ("ein
//    Sweep bedeutet, der Preis kann potenziell umdrehen — ohne Sweep reicht der erste Bruch
//    schon", siehe Chat) -> currRange.high wird SOFORT komplett ersetzt (Preis/Zeit des neuen
//    Pivots), unabhängig davon, ob der Uptrend selbst schon bestätigt. Bestätigt zusätzlich noch
//    (siehe tryConfirmUptrend, "der kleinere Pivot" darf mitbestätigen, siehe rangeState1_4:
//    p2Pivot5 bestätigt anhand von pivot3) -> Trend auf 'uptrend'. Landet in JEDEM Fall zusätzlich
//    in innerStructurePivots (anders als beim übergeordneten Fall, wo appliedPivots wächst).
// 3. Pivot bricht currRange.high preislich, aber KEINE Kerze schließt drüber -> nur Sweep:
//    currRange.high bleibt (Preis/pivotTime unverändert), nur type wird 'sweeped-high' (siehe
//    rangeState2_1: p2Pivot4).
// NICHT implementiert: der spiegelbildliche Fall (innerer Pivot bricht currRange.low) — dafür gibt
// es noch kein Beispiel.
export function applyInnerRangePivot(state: RangeState, pivot: Pivot, { candles = [] }: { candles?: Candle[] } = {}): RangeState {
  const sweepChecked = { ...state, structurePivots: markLqSweeps(state.structurePivots, candles, pivotTimeOf(pivot)) };
  const { currRange, innerStructurePivots } = sweepChecked;

  if (pivot.type === "high" && pivot.price > currRange.high.price) {
    const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), pivotTimeOf(pivot), currRange.high.price);

    if (isRealBreak) {
      const confirmed = tryConfirmUptrend(sweepChecked, pivot);
      if (confirmed) {
        return { ...confirmed, innerStructurePivots: [...confirmed.innerStructurePivots, pivot] };
      }
      return {
        ...sweepChecked,
        currRange: { ...currRange, high: { ...pivot, type: "high" } },
        innerStructurePivots: [...innerStructurePivots, pivot],
      };
    }
    return {
      ...sweepChecked,
      currRange: { ...currRange, high: { ...currRange.high, type: "sweeped-high" } },
      innerStructurePivots: [...innerStructurePivots, pivot],
    };
  }

  return { ...sweepChecked, innerStructurePivots: [...innerStructurePivots, pivot] };
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

  const highColor = cssColor("rangeHigh");
  const lowColor = cssColor("rangeLow");
  // Gestrichelt statt durchgezogen, solange range.high/low nur "sweeped" ist (Docht durchbrochen,
  // aber noch keine Kerze drüber/drunter geschlossen -> kein bestätigter Bruch, siehe Chat
  // 2026-07-19). Dreieck (ArrowPrimitive) bleibt unverändert — nur die Linie ändert sich.
  const highDashed = state.currRange.high.type === "sweeped-high";
  const lowDashed = state.currRange.low.type === "sweeped-low";
  const highLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.high, candles),
    { color: highColor, lineWidth: LINE_WIDTH, dashed: highDashed },
    candles,
  );
  const lowLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.low, candles),
    { color: lowColor, lineWidth: LINE_WIDTH, dashed: lowDashed },
    candles,
  );
  // rot: unter der Linie, zeigt nach oben; grün: über der Linie, zeigt nach unten (siehe Chat)
  const highArrow = new ArrowPrimitive(state.currRange.high, { color: highColor, direction: "up" }, candles);
  const lowArrow = new ArrowPrimitive(state.currRange.low, { color: lowColor, direction: "down" }, candles);
  for (const primitive of [highLine, lowLine, highArrow, lowArrow]) {
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }

  const protectedLow = state.structurePivots.find((p) => p.type === "protected-low");
  if (protectedLow) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedLow, candles),
      { color: cssColor("rangeProtectedLow"), lineWidth: LINE_WIDTH, label: "1h protected low", labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Goldene Linie je LQ-Sweep (siehe Chat 2026-07-19: "GOLDENE Linie ... mit dem label '1h
  // LQ-Sweep'") — anders als protected-low (immer nur der jeweils jüngste) potenziell mehrere
  // gleichzeitig, deshalb hier eine Linie PRO markiertem structurePivot statt nur die erste.
  for (const lqSweep of state.structurePivots.filter((p) => p.type === "LQ-sweep")) {
    const line = new LiquidityLinePrimitive(
      toLevel(lqSweep, candles),
      { color: cssColor("rangeLqSweep"), lineWidth: LINE_WIDTH, label: "1h LQ-Sweep", labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  if (state.trend !== "unknown") {
    const color = state.trend === "uptrend" ? lowColor : highColor;
    const label = new TrendLabelPrimitive(`1h ${state.trend}`, color);
    series.attachPrimitive(label);
    existingPrimitives.push(label);
  }
}
