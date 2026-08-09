// Zeichnung/Primitives fürs "1h-Range"-Marktstruktur-Feature (PriceChart.vue) — abgetrennt von
// marketStructureAnalysis.ts (Chat 2026-07-31), damit die reine Trend-Mathematik dort ohne
// Browser-Abhängigkeiten (chartColors.js/liquidity.js-Primitives) importierbar bleibt, u.a. für den
// mcp-server (siehe CLAUDE.md "MCP-Server"). Diese Datei zeichnet, importiert also bewusst weiter
// alles Chart-bezogene — computeRangesPivots/buildMarketStructureState/summarizeMarketStructureState
// bleiben in marketStructureAnalysis.ts, hier nur der State -> Chart-Primitives-Teil.
import { LiquidityLinePrimitive, bullBearLabelSide, formatLsLabel } from "./liquidity.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { PIP_SIZE } from "./pipConfig.js";
import type { Pivot, MarketStructureState } from "./range.type";
import type { Candle } from "./marketStructureAnalysis";
import { pivotTimeOf } from "./marketStructureAnalysis";

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
    // Bug-Report Philip 2026-08-07: ArrowPrimitive wird mittlerweile nur noch für LQ-Sweep-Pfeile
    // verwendet (range.high/low-Pfeile wurden 2026-07-26 entfernt, siehe Aufrufer), deren Linie
    // (toTouchedLevel) korrekt am touchedTime endet statt bis "jetzt" durchgezeichnet zu werden —
    // der Pfeil muss also am touchedTime sitzen, nicht an der letzten geladenen Kerze, sonst
    // klebt er (v.a. im Replay) am rechten Fensterrand statt an der LQ-Linie.
    const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : null;
    const arrowTime = pivot.touched ? (pivot.touched.touchedTime ?? lastCandleTime) : lastCandleTime;
    this._point = {
      x: arrowTime != null ? timeScale.timeToCoordinate(arrowTime) : null,
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

// Gerade Linie(n) durch beliebig viele (Zeit, Preis)-Punkte, der Reihe nach verbunden — für die
// abgeschlossene Range nach einer Promotion. Erst als reine 2-Punkte-Linie gebaut (Chat 2026-07-25:
// "nur ne Linie, kein Zigzack"), dann auf beliebig viele Punkte erweitert (Chat 2026-07-25, zweite
// Runde: "ich hätte gerne die ZickZack Linie ... noch im Chart drin" — 3 Punkte low->middle->high,
// siehe ClosedRange/invalidateUptrend). LiquidityLinePrimitive (siehe liquidity.js) zeichnet nur
// horizontale Preis-Level, keine Diagonalen zwischen unterschiedlichen Preisen — deshalb eine
// eigene, kleine Primitive nach demselben Muster wie ArrowPrimitive oben (attached/paneViews/
// Renderer mit useBitmapCoordinateSpace).
class RangeLineRenderer {
  private _points: any[];
  private _options: any;

  constructor(points: any[], options: any) {
    this._points = points;
    this._options = options;
  }

  draw(target: any) {
    const pts = this._points;
    if (pts.length < 2 || pts.some((p) => p.x === null || p.y === null)) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1) * scope.horizontalPixelRatio;
      // gestrichelt fürs Protected-Fib (Chat 2026-07-30, siehe computeFibLevels) — dieselben
      // Dash-Werte/derselbe Reset-danach wie LiquidityLinePrimitive (liquidity.js), kein impliziter
      // Reset zwischen Primitives.
      ctx.setLineDash(this._options.dashed ? [6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio] : []);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scope.horizontalPixelRatio, pts[0].y * scope.verticalPixelRatio);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scope.horizontalPixelRatio, pts[i].y * scope.verticalPixelRatio);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

class RangeLinePaneView {
  private _source: RangeLinePrimitive;
  private _points: any[];

  constructor(source: RangeLinePrimitive) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    this._points = this._source.pivots.map((p) => ({
      x: timeScale.timeToCoordinate(p.pivotTime),
      y: series.priceToCoordinate(p.price),
    }));
  }

  renderer() {
    return new RangeLineRenderer(this._points, this._source._options);
  }
}

class RangeLinePrimitive {
  pivots: Pivot[];
  _options: { color: string; lineWidth?: number; dashed?: boolean };
  _paneViews: RangeLinePaneView[];
  _chart: any;
  _series: any;

  // pivots: mindestens 2 Punkte, in Zeichenreihenfolge (nicht zwingend chronologisch, siehe
  // ClosedRange: low->middle->high ist bei einem Uptrend-Archiv automatisch auch chronologisch,
  // müsste es aber nicht sein).
  constructor(pivots: Pivot[], options: { color: string; lineWidth?: number; dashed?: boolean }) {
    this.pivots = pivots;
    this._options = options;
    this._paneViews = [new RangeLinePaneView(this)];
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

// Kurzer horizontaler Strich für ein Fib-Level (Chat 2026-07-30, siehe computeFibLevels) — sitzt
// exakt in der "Mitte der Zickzack-Linie" zwischen den beiden Fib-Ankern a/b: X ist der Pixel-
// Mittelwert der beiden Anker-Zeitpunkte (NICHT die Zeit-Mitte selbst durch timeToCoordinate
// gejagt — beides wäre hier äquivalent, aber der Pixel-Mittelwert braucht keine Annahme darüber,
// ob timeToCoordinate für einen nicht-existenten Zwischen-Zeitstempel sauber interpoliert), Y ist
// priceToCoordinate des ECHTEN 0,5-Preises (level.price), nicht der Pixel-Mittelwert der beiden
// Anker-Y-Koordinaten — bei stark unterschiedlicher Preisskala wäre das sonst nicht dasselbe.
// Feste Pixel-Halbbreite wie ArrowRenderer._size oben, kein Zoom-Skalieren nötig.
class FibTickRenderer {
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
      const x = p.x * scope.horizontalPixelRatio;
      const y = p.y * scope.verticalPixelRatio;
      const halfWidth = 8 * scope.horizontalPixelRatio;
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1) * scope.horizontalPixelRatio;
      ctx.beginPath();
      ctx.moveTo(x - halfWidth, y);
      ctx.lineTo(x + halfWidth, y);
      ctx.stroke();
    });
  }
}

class FibTickPaneView {
  private _source: FibTickPrimitive;
  private _point: any;

  constructor(source: FibTickPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const level = this._source._level;
    const xa = timeScale.timeToCoordinate(level.a.pivotTime);
    const xb = timeScale.timeToCoordinate(level.b.pivotTime);
    this._point = {
      x: xa != null && xb != null ? (xa + xb) / 2 : null,
      y: series.priceToCoordinate(level.price),
    };
  }

  renderer() {
    return new FibTickRenderer(this._point, this._source._options);
  }
}

export class FibTickPrimitive {
  _level: FibLevel;
  _options: { color: string; lineWidth?: number };
  _paneViews: FibTickPaneView[];
  _chart: any;
  _series: any;

  constructor(level: FibLevel, options: { color: string; lineWidth?: number }) {
    this._level = level;
    this._options = options;
    this._paneViews = [new FibTickPaneView(this)];
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

// Linienstärke ist seit Chat 2026-07-25 im Style-Modal konfigurierbar, EIN Wert PRO Farb-Key
// (rangeHigh/rangeLow/rangeProtectedLow/rangeLqSweep/rangeBreakOfStructure/rangeLiveUptrend/
// rangeLiveDowntrend/rangeClosed/rangeClosedDowntrend/rangeChoch —
// siehe chartLineWidths.js, zweite Runde: "bei jeder Linie, wo man schon die Farbe individuell
// anpassen kann"). rangeLqSweep bleibt per Default dünner als die übrigen (Chat 2026-07-24:
// "Linienstärke des 1h LQ Sweep auf 1px", seit ein Break of Structure existiert ist ein LQ-Sweep
// nur noch informativ) — kein Modul-Konstante mehr, `lineWidth(key)` wird direkt an jeder
// Verwendungsstelle aufgerufen, damit ein Style-Modal-Wechsel live greift.

function toLevel(pivot: Pivot, candles: Candle[]) {
  // Vereinfachung: Linie reicht immer bis zur letzten geladenen Kerze (nicht bis touchedAt-Zeit) —
  // für range.high/range.low/protected-low reicht das, weil sie per Definition der aktuell
  // gültige, unberührte Rand der Struktur sind (in Philips Beispiel sind alle drei `touched: false`).
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0);
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
}

// Gegenstück zu toLevel() oben, für Pivots, die per Definition BEREITS berührt sind (1h-LQ-Sweep-
// Linien, siehe markLqSweeps: ein Pivot wird erst dann zu 'LQ-sweep', wenn sein Touch schon Fakt
// ist) — die Linie darf hier nicht bis "jetzt" durchgezeichnet werden, sondern muss am
// tatsächlichen Sweep-Zeitpunkt enden, genau wie liquidity.js: buildLevel es für normale
// Liquiditäts-Level schon macht (Bug-Report Philip 2026-07-28: "bereits früher gesweepte 1h
// LQ-Sweeps werden aktuell durchgezeichnet, bis zur aktuellen Uhrzeit ... in liquidity.js ist es
// bereits korrekt umgesetzt"). Fällt auf "letzte Kerze" zurück, falls touchedTime ausnahmsweise
// fehlt (touched=true, aber kein Zeitstempel, siehe PivotTouched.touchedTime als optional).
function toTouchedLevel(pivot: Pivot, candles: Candle[]) {
  const touchedTime = pivot.touched ? pivot.touched.touchedTime : undefined;
  const endTime = touchedTime ?? (candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0));
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
}

// Wandelt einen Pivot in die von tradeSetup.js erwartete LqLevel-Form um (siehe liquidity.js:
// buildLevel — dieselben Felder: price/dir/pivotTime/touched/touchedTime/endTime). Bug-Report
// Philip 2026-07-28: Path A/B in tradeSetup.js nutzten bislang eine EIGENE, unabhängige
// H1-Fraktal-Erkennung (liquidity.js auf einem nur 300 Kerzen/≈12,5 Tage kurzen Fenster,
// TRADE_SETUP_H1_CANDLE_COUNT in PriceChart.vue) statt der hier längst vorhandenen, sauber
// gefilterten structurePivots — ein 32 Tage altes, aber gerade erst geswepptes Level (1.13545)
// war dadurch für Path A/B unsichtbar, obwohl es im Debug-Panel längst als "1h LQ-Sweep"
// angezeigt wurde ("das allermeiste [an der alten H1-Fraktal-Erkennung] ist nur Datenmüll" —
// Philip wollte explizit NICHT die Kerzenzahl hochsetzen, sondern die längst gefilterten
// structurePivots wiederverwenden). dir wird vom Aufrufer mitgegeben, siehe collectH1LqLevels.
function toLqLevel(pivot: Pivot, dir: 1 | -1) {
  const touchedTime = pivot.touched ? (pivot.touched.touchedTime ?? null) : null;
  return {
    price: pivot.price,
    dir,
    pivotTime: pivot.pivotTime ?? 0,
    touched: pivot.touched !== false,
    touchedTime,
    // Nur touched Pivots kommen hier überhaupt an (siehe collectH1LqLevels-Filter), und der
    // Algorithmus setzt touchedTime für echte (nicht synthetische Test-)Pivots immer — der
    // pivotTime-Fallback ist rein defensiv für den in der Praxis nicht vorkommenden Fall.
    endTime: touchedTime ?? (pivot.pivotTime ?? 0),
  };
}

// Sammelt alle H1-Level-Kandidaten für EINE tradeSetup-Richtung (dir: -1 Long braucht Low-Seite,
// 1 Short braucht High-Seite) aus structurePivots — sowohl vom Haupttrend als auch von einem
// gerade laufenden Nested-Gegentrend-Kandidaten (CHoCH), falls vorhanden. Welche der beiden
// Pivot-Listen die Low- bzw. High-Seite liefert, hängt vom jeweiligen state.trend ab (uptrend:
// Haupttrend=Low-Seite; downtrend gespiegelt) — dieselbe Zuordnung wie isDowntrend in
// renderMarketStructureAnalysis. Nur touched Pivots sind als LS-Kandidat überhaupt relevant
// (untouched = noch nichts geswept, das ist die Fraktal-Seite, nicht die LS-Seite).
export function collectH1LqLevels(state: MarketStructureState | null | undefined, dir: 1 | -1) {
  if (!state) return [];
  const wantTrend = dir === -1 ? "uptrend" : "downtrend";
  const pivots: Pivot[] = [];
  for (const level of collectNestedChain(state)) {
    if (level.trend === wantTrend) pivots.push(...level.structurePivots);
  }
  return pivots.filter((p) => p.touched !== false).map((p) => toLqLevel(p, dir));
}

// Läuft die Nested-Tracker-Kette ab state selbst ab (state zuerst, dann state.nestedTrend,
// state.nestedTrend.nestedTrend, ...) — seit der Rekursions-Freigabe in marketStructureAnalysis.ts
// (Chat 2026-08-09, "wie viele Ebenen wie möglich") kann state.nestedTrend beliebig tief
// verschachtelt sein, nicht mehr nur eine Ebene. Bricht am ersten `null` oder unbestätigten
// ('unknown') Glied ab — eine tiefere Ebene kann per Konstruktion nur existieren, wenn ihr
// Parent-Trend bereits bestätigt ist (siehe advanceNestedTrend). Ersetzt die vorher an drei Stellen
// (hier, collectFibLevels, renderMarketStructureAnalysis) fest auf `[state, state.nestedTrend]`
// gedeckelten Schleifen.
function collectNestedChain(state: MarketStructureState): MarketStructureState[] {
  const chain: MarketStructureState[] = [state];
  let level = state.nestedTrend;
  while (level && level.trend !== "unknown") {
    chain.push(level);
    level = level.nestedTrend;
  }
  return chain;
}

// --- Fibonacci-Level (Chat 2026-07-30) --------------------------------------------------------
// Zwei 0,5er-Fib-Varianten pro Trend-Ebene (Haupttrend UND Nested-Trend, siehe computeFibLevels
// unten) — Bug-Report/Korrektur Philip: die erste Annahme "Fib = currRange.low <-> currRange.high"
// war falsch. Philips tatsächliche Fib-Ziehweise zieht IMMER vom Pivot, der die ganze Bewegung
// EINGELEITET hat — das ist der zuletzt bestätigte protected-low/-high ("Strukturpunkt 2"), nicht
// currRange.low/.high selbst (die Range-Kante kann durch spätere Pullbacks längst weitergewandert
// sein, ohne dass sich am eigentlichen Ursprung der Bewegung etwas geändert hätte). Er will trotzdem
// BEIDE Varianten sehen: "Range-Fib" (low<->high der aktuell laufenden Range, reine Orientierung)
// UND "Protected-Fib" (PP<->gegenüberliegende Range-Kante, die eigentlich gemeinte Bewegung).
export const RANGE_FIB_MIN_PP_DISTANCE_PIPS = 50; // siehe PIP-SETTINGS.md
const RANGE_FIB_MIN_PP_DISTANCE = RANGE_FIB_MIN_PP_DISTANCE_PIPS * PIP_SIZE;

// a/b bewusst nicht "low"/"high" genannt — bei der Protected-Variante ist nicht immer klar, welcher
// der beiden Anker der numerisch höhere ist (nur die Mitte zählt), und die Reihenfolge ist für die
// Zeichnung (Linie zwischen zwei Punkten, Tick genau in der Mitte) irrelevant.
export interface FibLevel {
  a: Pivot;
  b: Pivot;
  price: number;
}

function fibBetween(a: Pivot, b: Pivot): FibLevel {
  return { a, b, price: (a.price + b.price) / 2 };
}

// state kann der Haupttrend ODER ein Nested-Trend sein (identischer Typ, siehe advanceNestedTrend)
// — eine Implementierung für beide Ebenen statt Verdopplung, wie der Rest dieser Datei es auch
// handhabt (evaluateConfirmingBreak, invalidateUptrend/-Downtrend, ...).
export function computeFibLevels(
  state: MarketStructureState,
  minProtectedDistance: number = RANGE_FIB_MIN_PP_DISTANCE,
): { rangeFib: FibLevel; protectedFib: FibLevel | null } {
  const { currRange, structurePivots, trend } = state;
  const isDown = trend === "downtrend";
  const rangeFib = fibBetween(currRange.low, currRange.high);

  const protectedType: "protected-low" | "protected-high" = isDown ? "protected-high" : "protected-low";
  const pp = structurePivots.find((p) => p.type === protectedType) ?? null;
  const edge = isDown ? currRange.low : currRange.high;
  const protectedFib = pp && Math.abs(pp.price - edge.price) >= minProtectedDistance ? fibBetween(pp, edge) : null;

  return { rangeFib, protectedFib };
}

// Sammelt alle Fib-Level (Haupttrend + Nested, falls vorhanden) in klickbarer Form — analog zu
// collectH1LqLevels, aber ohne dir-Parameter (ein Fib ist nicht long/short-spezifisch). Genutzt
// von PriceChart.vue für die Trade-Bestätigungs-Klick-Erfassung (kind='fib', siehe
// tradeConfirmations.ts) — dieselbe A/B-Form wie computeFibLevels, keine gesonderte Aufbereitung
// nötig, weil die Klick-Trefferprüfung dieselbe Pixel-Mittelpunkt-Berechnung braucht wie die
// Zeichnung selbst (siehe FibTickPrimitive).
export function collectFibLevels(
  state: MarketStructureState | null | undefined,
  minProtectedDistance: number = RANGE_FIB_MIN_PP_DISTANCE,
): FibLevel[] {
  if (!state) return [];
  const result: FibLevel[] = [];
  for (const level of collectNestedChain(state)) {
    if (level.trend === "unknown") continue;
    const { rangeFib, protectedFib } = computeFibLevels(level, minProtectedDistance);
    result.push(rangeFib);
    if (protectedFib) result.push(protectedFib);
  }
  return result;
}

// Erste Kerze (aus den ANGEZEIGTEN candles, i.d.R. feingranularer als die H1-Pivots selbst — z.B.
// M5, siehe Bug-Report Philip 2026-07-25) NACH fromTime, die tatsächlich unter price SCHLIESST.
// Erst auf reine Docht-Berührung umgestellt gewesen (Chat: "das reine Zeichnen ist doch nur bis
// Kerzenberührung, da reicht sogar ein Docht"), dann aber zurückgebaut (Bug-Report Philip:
// "entsteht der choch pivot im outer-pivot bereich und direkt paar minuten später berührt ein
// innerpivot den choch schon") — der H1-Periode-5-Ursprungspivot (chochAnchor) sitzt auf einer
// groben Stundenrasterung, sein `pivotTime` markiert nicht zwingend exakt den echten M5-Extrempunkt
// innerhalb dieser Stunde; ein reiner Docht-Check direkt danach greift dadurch fast immer sofort
// (normales Kerzenrauschen knapp nach einem frischen Swing-Low), lange bevor der eigentliche
// spätere Bruch passiert. Ein echter Kerzenschluss ist robust genug gegen dieses Rauschen (dieselbe
// Docht-vs-Bruch-Unterscheidung wie bei der Erkennung selbst, siehe closesBelowLevel — hier nur für
// die Zeichnung, nicht für die LQ-Sweep/Strukturbruch-Klassifizierung).
// Der bestätigende Pivot selbst (firstConfirmedAt) sitzt ebenfalls auf der groben H1-Periode-5-
// Rasterung und kann erst Stunden NACH dem eigentlichen Kerzenschluss offiziell als Fraktal
// bestätigt sein (braucht period=5 Kerzen danach, siehe detectLiquidityLevels) — "wo schließt eine
// Kerze tatsächlich unter dem Level" ist ein anderer, FRÜHERER Zeitpunkt als "wo wurde der Pivot
// als Fraktal bestätigt". Fällt auf `fallbackTime` zurück, falls keine Kerze im geladenen Fenster
// tatsächlich drunter schließt (z.B. Kerzendaten reichen nicht weit genug).
function firstCloseBelow(candles: Candle[], fromTime: number, price: number, fallbackTime: number): number {
  for (const c of candles) {
    if (c.time > fromTime && c.close < price) return c.time;
  }
  return fallbackTime;
}

// Spiegelbild von firstCloseBelow für die Nested-BOS-Linie (protected-high, real durch einen
// Kerzenschluss DRÜBER gebrochen) — sonst identische Begründung.
function firstCloseAbove(candles: Candle[], fromTime: number, price: number, fallbackTime: number): number {
  for (const c of candles) {
    if (c.time > fromTime && c.close > price) return c.time;
  }
  return fallbackTime;
}

// Zeichnet EINEN bestätigten Nested-Tracker (CHoCH) — Verbindungslinie, protected-high/-low,
// LQ-Sweeps, BOS-Linien, CHoCH-Label. Bis Chat 2026-08-09 gab es hierfür zwei fast identische ~80-
// Zeilen-Blöcke direkt in renderMarketStructureAnalysis (einen für `nestedTrend.trend==='downtrend'`
// — bärischer Kandidat innerhalb eines Uptrends —, einen gespiegelt für `'uptrend'`), die zusammen
// GENAU eine Verschachtelungsebene zeichnen konnten. Seit der Rekursions-Freigabe in
// marketStructureAnalysis.ts kann `state.nestedTrend.nestedTrend...` beliebig tief sein — diese
// Funktion, aufgerufen in einer Schleife über collectNestedChain (siehe renderMarketStructureAnalysis
// unten), zeichnet jede Ebene gleich, egal ob sie bärisch (nested.trend==='downtrend') oder
// bullisch (nested.trend==='uptrend') ist. `isDown` entscheidet dieselben Spiegelungen wie vorher
// die beiden getrennten Blöcke: protected-Typ, BOS/CHoCH-Labelseite, LQ-Sweep-Pfeilrichtung,
// welche firstCloseAbove/Below-Variante das CHoCH/BOS-Linienende bestimmt.
function renderNestedLevel(
  series: any,
  nested: MarketStructureState,
  candles: Candle[],
  existingPrimitives: any[],
  lqSweepLabel: (price: number, pivotTime: number | undefined) => string,
) {
  const isDown = nested.trend === "downtrend";
  const protectedType: "protected-high" | "protected-low" = isDown ? "protected-high" : "protected-low";
  const protectedLabel = isDown ? "1h protected high" : "1h protected low";
  // BOS/CHoCH sitzen im bärischen Fall unterhalb der Linie (spiegelbildlich zum Haupttrend-Block
  // oben, wo BOS im Uptrend oberhalb sitzt), im bullischen Fall oberhalb — siehe die beiden vorher
  // getrennten Blöcke.
  const labelSide = isDown ? "center-below" : "center-above";
  // LQ-Sweep-Pfeilrichtung ist gespiegelt zur eigenen Richtung (bärischer Sweep zeigt nach unten
  // weg -> ArrowRenderer direction:"up", bullischer nach oben weg -> direction:"down").
  const sweepArrowDirection: "up" | "down" = isDown ? "up" : "down";
  const firstClosePast = isDown ? firstCloseAbove : firstCloseBelow;

  const nestedLine = new RangeLinePrimitive([nested.currRange.low, nested.currRange.high], {
    color: cssColor("rangeChoch"),
    lineWidth: lineWidth("rangeChoch"),
  });
  series.attachPrimitive(nestedLine);
  existingPrimitives.push(nestedLine);

  const hasNestedBreakOfStructure = nested.structurePivots.some((p) => p.type === "break-of-structure");

  const protectedPivot = nested.structurePivots.find((p) => p.type === protectedType);
  if (protectedPivot) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedPivot, candles),
      { color: cssColor("rangeProtectedLow"), lineWidth: lineWidth("rangeProtectedLow"), label: protectedLabel, labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  for (const lqSweep of nested.structurePivots.filter((p) => p.type === "LQ-sweep")) {
    const lqColor = cssColor("rangeLqSweep");
    const line = new LiquidityLinePrimitive(
      toTouchedLevel(lqSweep, candles),
      { color: lqColor, lineWidth: lineWidth("rangeLqSweep"), label: lqSweepLabel(lqSweep.price, lqSweep.pivotTime), labelSide: bullBearLabelSide(isDown) },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
    if (!hasNestedBreakOfStructure) {
      const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: sweepArrowDirection }, candles);
      series.attachPrimitive(arrow);
      existingPrimitives.push(arrow);
    }
  }

  for (const bos of nested.structurePivots.filter((p) => p.type === "break-of-structure")) {
    const bosColor = cssColor("rangeBreakOfStructure");
    const bosFallback = candles.length > 0 ? candles[candles.length - 1].time : (bos.pivotTime ?? 0);
    const bosEndTime = firstClosePast(candles, bos.pivotTime ?? 0, bos.price, bosFallback);
    const bosLevel = { price: bos.price, pivotTime: bos.pivotTime ?? 0, endTime: bosEndTime };
    const line = new LiquidityLinePrimitive(
      bosLevel,
      { color: bosColor, lineWidth: lineWidth("rangeBreakOfStructure"), dashed: true, label: "BOS", labelSide },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // CHoCH-Label sitzt an der URSPRÜNGLICHEN Nested-Origin (appliedPivots[1] — advanceNestedTrend
  // seedet IMMER via initMarketStructureState(origin, wartenderPivot), appliedPivots[0]/[1] sind
  // damit garantiert Ursprung/wartende Seite), NICHT am aktuellen currRange (das ist der zuletzt
  // brechende Pivot, siehe Bug-Report Philip: "IST 1.34601, SOLL 1.35206").
  const chochAnchor = nested.appliedPivots[1];
  const chochEndTime = firstClosePast(candles, chochAnchor.pivotTime ?? 0, chochAnchor.price, pivotTimeOf(nested.firstConfirmedAt!));
  const chochLevel = { price: chochAnchor.price, pivotTime: chochAnchor.pivotTime ?? 0, endTime: chochEndTime };
  const chochLine = new LiquidityLinePrimitive(
    chochLevel,
    { color: cssColor("rangeChoch"), lineWidth: lineWidth("rangeChoch"), dashed: true, label: "CHoCH", labelSide },
    candles,
  );
  series.attachPrimitive(chochLine);
  existingPrimitives.push(chochLine);
}

// Ersetzt existingPrimitives komplett durch die aktuelle Marktstruktur-Darstellung: roter
// Pfeil+Linie an currRange.high, grüner Pfeil+Linie an currRange.low, bei bestätigtem Trend
// zusätzlich eine beschriftete Linie am protected-low (siehe Chat). state=null (oder zu wenig
// Kerzen) -> nur aufräumen, nichts zeichnen.
//
// Sobald ein Break of Structure existiert (Chat 2026-07-24: "damit ich nicht weiter nach Longs
// schaue"), werden alle bullischen "hier gibt's noch eine Long-Chance"-Pfeile unterdrückt — der
// grüne Pfeil an range.low UND jeder goldene LQ-Sweep-Pfeil —, die zugehörigen Linien/Labels
// bleiben aber stehen (weiterhin informativ, welches Level das war). range.low wird zusätzlich
// gestrichelt (signalisiert die Schwäche), unabhängig vom eigenen sweeped-low-Zustand.
export function renderMarketStructureAnalysis(
  series: any,
  state: MarketStructureState | null,
  existingPrimitives: any[],
  candles: Candle[],
  { nowSec, formatPrice }: { nowSec?: number; formatPrice?: (price: number) => string } = {},
) {
  // "Major LS 1,13545 (22d 19h alt)" statt "1h LQ-Sweep (22d 19h alt)" (Chat 2026-07-28: "damit sie
  // sich mit der Trade-Setup-LS-Linie 1:1 überlappen") — der Preis ist jetzt fester Bestandteil des
  // Labels (nicht mehr nur im Debug-Modus, siehe formatLsLabel in liquidity.js), daher immer über
  // formatPrice aufgelöst statt hinter debugPrices versteckt.
  const lqSweepLabel = (price: number, pivotTime: number | undefined) =>
    formatLsLabel(formatPrice ? formatPrice(price) : String(price), pivotTime, nowSec);
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state || candles.length === 0) return;

  const hasBreakOfStructure = state.structurePivots.some((p) => p.type === "break-of-structure");
  // Seit der Promotion-Funktion (Chat 2026-07-25) kann der HAUPTTREND selbst 'downtrend' sein
  // (übernommener Nested-Tracker) — vorher war state.trend hier praktisch immer 'uptrend', daher
  // war die gesamte Darstellung unten bis zum Bug-Report Philip 2026-07-26 ("1h-LQ-Sweeps ... mit
  // einem bullischen Pfeil nach oben angezeigt") hart auf bullisch verdrahtet. isDowntrend steuert
  // ab hier, welche Seite (high/low) die "geschützte", per Break-of-Structure unterdrückbare Seite
  // ist — analog zur bereits bestehenden Nested-Tracker-Darstellung weiter unten.
  const isDowntrend = state.trend === "downtrend";

  const highColor = cssColor("rangeHigh");
  const lowColor = cssColor("rangeLow");
  // Gestrichelt statt durchgezogen, solange range.high/low nur "sweeped" ist (Docht durchbrochen,
  // aber noch keine Kerze drüber/drunter geschlossen -> kein bestätigter Bruch, siehe Chat
  // 2026-07-19) — ODER sobald irgendwo ein Break of Structure steht (Schwäche-Signal, unabhängig
  // vom sweeped-low-Zustand von range.low selbst) — im Uptrend betrifft das range.low (die
  // geschützte Seite), im Downtrend gespiegelt range.high. Dreieck (ArrowPrimitive) bleibt
  // unverändert — nur die Linie ändert sich.
  const highDashed = state.currRange.high.type === "sweeped-high" || (isDowntrend && hasBreakOfStructure);
  const lowDashed = state.currRange.low.type === "sweeped-low" || (!isDowntrend && hasBreakOfStructure);
  const highLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.high, candles),
    { color: highColor, lineWidth: lineWidth("rangeHigh"), dashed: highDashed },
    candles,
  );
  const lowLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.low, candles),
    { color: lowColor, lineWidth: lineWidth("rangeLow"), dashed: lowDashed },
    candles,
  );
  // Bug-Report Philip 2026-07-26: keine Pfeile mehr an range.high/range.low (nur noch bei
  // LQ-Sweep, siehe unten) — die Dreiecke (ArrowPrimitive) wurden hier bewusst entfernt, die reine
  // Linie (inkl. gestrichelt bei sweeped-high/-low bzw. Break of Structure, siehe oben) bleibt.
  const primitives: LiquidityLinePrimitive[] = [highLine, lowLine];
  for (const primitive of primitives) {
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }

  const protectedPivot = state.structurePivots.find((p) => p.type === (isDowntrend ? "protected-high" : "protected-low"));
  if (protectedPivot) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedPivot, candles),
      {
        color: cssColor("rangeProtectedLow"),
        lineWidth: lineWidth("rangeProtectedLow"),
        label: isDowntrend ? "1h protected high" : "1h protected low",
        labelSide: "end",
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Goldene Linie + Pfeil je LQ-Sweep (siehe Chat 2026-07-19: "GOLDENE Linie ... mit dem label '1h
  // LQ-Sweep'", und Chat 2026-07-20: "noch mit nem goldenen Pfeil nach oben") — anders als
  // protected-low/-high (immer nur der jeweils jüngste) potenziell mehrere gleichzeitig, deshalb
  // hier eine Linie (+ ggf. Pfeil) PRO markiertem structurePivot statt nur die erste. Pfeilrichtung
  // folgt state.trend (Bug-Report Philip 2026-07-26: "1h-LQ-Sweeps ... bärisch aber mit
  // bullischem Pfeil nach oben angezeigt" — nach einer Promotion kann state.structurePivots
  // bärische LQ-Sweeps enthalten, direction war hier bis dahin hart auf "down"/bullisch verdrahtet,
  // siehe dieselbe gespiegelte direction bei der Nested-Tracker-Darstellung unten). Seit Chat
  // 2026-07-24 nur noch 1px breit (LQ_SWEEP_LINE_WIDTH) und OHNE Pfeil, sobald ein Break of
  // Structure existiert — der Long-/Short-Gedanke dahinter gilt dann nicht mehr, die Linie bleibt
  // aber als reine Information stehen.
  for (const lqSweep of state.structurePivots.filter((p) => p.type === "LQ-sweep")) {
    const lqColor = cssColor("rangeLqSweep");
    const line = new LiquidityLinePrimitive(
      toTouchedLevel(lqSweep, candles),
      // Rechtsbündig unter/über der Linie statt "end" (Chat 2026-07-28: "genauso wie schon in
      // trades die Protected Pivots und die LS") — bullischer Sweep (isDowntrend=false) unten,
      // bärischer oben, siehe bullBearLabelSide (liquidity.js).
      {
        color: lqColor,
        lineWidth: lineWidth("rangeLqSweep"),
        label: lqSweepLabel(lqSweep.price, lqSweep.pivotTime),
        labelSide: bullBearLabelSide(isDowntrend),
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
    if (!hasBreakOfStructure) {
      const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: isDowntrend ? "up" : "down" }, candles);
      series.attachPrimitive(arrow);
      existingPrimitives.push(arrow);
    }
  }

  // Gestrichelte rote Linie + Beschriftung je Break of Structure (Chat 2026-07-24) — analog zu
  // LQ-Sweep potenziell mehrere gleichzeitig (jedes gebrochene protected-low bekommt seine
  // eigene), kein eigener Pfeil (reines Warnsignal, keine Handelsrichtung wie bei LQ-Sweep). Label
  // nur "BOS" (kein Alter — anders als bei LQ-Sweep für die Handelsentscheidung nicht relevant,
  // siehe Chat), mittig über der Linie im Uptrend, mittig darunter im Downtrend — spiegelbildlich
  // zur Trendrichtung (labelSide unten liest dafür state.trend, nicht mehr hart 'uptrend').
  for (const bos of state.structurePivots.filter((p) => p.type === "break-of-structure")) {
    const bosColor = cssColor("rangeBreakOfStructure");
    // Anders als toLevel (das immer bis zur letzten geladenen Kerze zeichnet) endet diese Linie
    // bewusst an der ERSTEN tatsächlich unter bos.price schließenden Kerze (Chat 2026-07-25: "Die
    // BOS Linie soll auch nicht so weit gezeichnet werden, sondern nur bis Kerzenberührung, wie bei
    // CHOCH") — genau der Kerzenschluss, der diesen Pivot überhaupt erst zu 'break-of-structure'
    // reklassifiziert hat (siehe markLqSweeps). Fallback auf die letzte geladene Kerze (altes
    // toLevel-Verhalten), falls diese Kerze im gerade angezeigten (evtl. kürzeren) Fenster fehlt.
    const bosFallback = candles.length > 0 ? candles[candles.length - 1].time : (bos.pivotTime ?? 0);
    const bosEndTime = firstCloseBelow(candles, bos.pivotTime ?? 0, bos.price, bosFallback);
    const bosLevel = { price: bos.price, pivotTime: bos.pivotTime ?? 0, endTime: bosEndTime };
    const line = new LiquidityLinePrimitive(
      bosLevel,
      {
        color: bosColor,
        lineWidth: lineWidth("rangeBreakOfStructure"),
        dashed: true,
        label: "BOS",
        labelSide: state.trend === "uptrend" ? "center-above" : "center-below",
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Verbindungslinie der AKTUELL laufenden bestätigten Range (Chat 2026-07-25, Bug-Report Philip:
  // "auch den jetzigen bestätigten uptrend auch verbunden") — dieselbe einfache Linie wie bei
  // closedRanges unten, nur schon VOR einer Promotion/Invalidierung sichtbar. Farbe nach
  // Trendrichtung, aber EIGENE Keys statt rangeClosed/rangeChoch (Chat 2026-07-31, Bug-Report
  // Philip: "abgeschlossene range konfiguriert ... die aktuelle" — vorher teilten sich Live- und
  // Closed-Linie denselben Farb-Key, jetzt unabhängig einstellbar, siehe chartColors.js).
  if (state.trend !== "unknown") {
    const liveLineKey = state.trend === "uptrend" ? "rangeLiveUptrend" : "rangeLiveDowntrend";
    const liveLine = new RangeLinePrimitive([state.currRange.low, state.currRange.high], {
      color: cssColor(liveLineKey),
      lineWidth: lineWidth(liveLineKey),
    });
    series.attachPrimitive(liveLine);
    existingPrimitives.push(liveLine);
  }

  // Abgeschlossene Ranges (Chat 2026-07-25, Promotion bei Trend-Invalidierung mit bereits
  // bestätigtem Nested-Trend) — ZigZag low->middle->high (middle = zuletzt bestätigter
  // protected-low/-high dieser Range, siehe invalidateUptrend; ohne middle nur eine gerade Linie).
  // Farbe nach der ARCHIVIERTEN Trendrichtung (Chat 2026-07-25, zweite Runde: "kann die Zeichnung
  // dann noch den uptrend und downtrend farblich unterscheiden?"), nicht nach dem aktuellen
  // state.trend — war zuvor immer hart grün, unabhängig davon, was archiviert wurde. rangeClosed/
  // rangeClosedDowntrend statt rangeChoch fürs Downtrend-Pendant (Chat 2026-07-31) — eigener Key,
  // unabhängig von der Live-Linie UND von der CHoCH-Warnfarbe, siehe chartColors.js.
  for (const closed of state.closedRanges) {
    const closedKey = closed.trend === "uptrend" ? "rangeClosed" : "rangeClosedDowntrend";
    const points = closed.middle ? [closed.low, closed.middle, closed.high] : [closed.low, closed.high];
    const line = new RangeLinePrimitive(points, { color: cssColor(closedKey), lineWidth: lineWidth(closedKey) });
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Nested-Gegentrend-Struktur (CHoCH) je Ebene, sobald bestätigt, aber noch nicht promoted (Chat
  // 2026-07-25, Bug-Report Philip: "eine rote Verbindungslinie von 1.35583 bis 1.34601"). Bis Chat
  // 2026-08-09 gab es hier zwei feste Blöcke (ein bärischer für `nestedTrend.trend==='downtrend'`,
  // ein gespiegelter bullischer für `'uptrend'`) — GENAU eine Ebene. Seit der Rekursions-Freigabe in
  // marketStructureAnalysis.ts kann state.nestedTrend beliebig tief verschachtelt sein
  // (nestedTrend.nestedTrend.nestedTrend...); diese Schleife zeichnet jede bestätigte Ebene über
  // renderNestedLevel (siehe dort), egal ob bärisch oder bullisch, egal wie tief. Nach einer
  // Promotion rückt die jeweils tiefere Ebene automatisch nach — dann übernimmt für sie die
  // reguläre currRange-Darstellung (inkl. der Live-Verbindungslinie oben) den (jetzt promoteten)
  // neuen Haupttrend, exakt wie vorher.
  for (const nested of collectNestedChain(state).slice(1)) {
    renderNestedLevel(series, nested, candles, existingPrimitives, lqSweepLabel);
  }

  // Fib-Level (Chat 2026-07-30, siehe computeFibLevels für die volle Begründung) — EIN Durchlauf
  // für die GESAMTE Nested-Kette statt eines eigenen Blocks pro Ebene (alle sind derselbe
  // MarketStructureState-Typ, siehe collectNestedChain). Range-Fib nur als Tick (die
  // Verbindungslinie low<->high existiert schon, siehe rangeClosed/rangeChoch-Linien oben);
  // Protected-Fib zusätzlich als gestrichelte Zickzack-Linie PP<->gegenüberliegende Range-Kante,
  // weil es diese Linie (anders als bei Range-Fib) noch nirgends gibt.
  const fibColor = cssColor("rangeFib");
  const fibWidth = lineWidth("rangeFib");
  for (const level of collectNestedChain(state)) {
    if (level.trend === "unknown") continue;
    const { rangeFib, protectedFib } = computeFibLevels(level);

    const rangeTick = new FibTickPrimitive(rangeFib, { color: fibColor, lineWidth: fibWidth });
    series.attachPrimitive(rangeTick);
    existingPrimitives.push(rangeTick);

    if (protectedFib) {
      const zigzag = new RangeLinePrimitive([protectedFib.a, protectedFib.b], { color: fibColor, lineWidth: fibWidth, dashed: true });
      series.attachPrimitive(zigzag);
      existingPrimitives.push(zigzag);

      const protectedTick = new FibTickPrimitive(protectedFib, { color: fibColor, lineWidth: fibWidth });
      series.attachPrimitive(protectedTick);
      existingPrimitives.push(protectedTick);
    }
  }
}
