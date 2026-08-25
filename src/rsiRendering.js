// Divergenz-Konnektor-Primitive (Chat 2026-08-11) — gestrichelte Linie zwischen zwei beliebigen
// (time, price)-Punkten + Label, fürs Zeichnen der von detectRsiDivergence() (rsi.js) gefundenen
// Divergenzen. Eigene, kleine Datei statt in rsi.js: die muss dependency-frei bleiben (siehe
// dort — cross-directory Import in mcp-server/tools/reads.ts würde an Canvas-Primitives sofort
// scheitern), und statt in marketStructureRendering.ts (dessen RangeLinePrimitive strukturell
// dasselbe macht) an dessen strikten Pivot-Typ (touched/pivotAt/type als Pflichtfelder) zu binden,
// reicht hier ein eigenes, kleines Primitive mit zwei rohen Punkten — dieselbe Renderer/PaneView-
// Struktur (attached/updateAllViews/paneViews, useBitmapCoordinateSpace), aber ohne die Kopplung.
//
// EIN Primitive-Objekt wird an EINE Series angehängt (siehe attachPrimitive-Aufrufer in
// PriceChart.vue) — für eine Divergenz mit einem Preis- UND einem RSI-Bein braucht es zwei
// Instanzen (eine an candleSeries mit Preis-Werten, eine an rsiSeries mit RSI-Werten als
// "price" — priceToCoordinate() ist bei lightweight-charts generisch, kennt keinen Unterschied
// zwischen "Preis" und "RSI-Wert", solange es der Skala der jeweils angehängten Series entspricht).
import { canShowLabels } from "./chartZoom.js";

const PIN_HALO_EXTRA_WIDTH = 3; // px, zusätzlich zur normalen lineWidth (Chat 2026-08-17)
// Auswahl-Halo (Chat 2026-08-18, PinPanel.vue-Hover) — analog zu liquidity.js, breiter als der
// Pin-Halo und davor gezeichnet, damit beide gleichzeitig als Glow-Ringe sichtbar bleiben.
const SELECTED_HALO_EXTRA_WIDTH = 7; // px

class DivergenceLineRenderer {
  constructor(points, options, chart, candles) {
    this._points = points;
    this._options = options;
    this._chart = chart;
    this._candles = candles;
  }

  draw(target) {
    const pts = this._points;
    if (pts.some((p) => p.x === null || p.y === null)) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;

      // Auswahl-Halo bei Hover über die zugehörige PinPanel.vue-Zeile (Chat 2026-08-18) — VOR dem
      // Pin-Halo gezeichnet (breiter, liegt also dahinter), analog zu liquidity.js.
      if (this._options.isSelectedPin) {
        ctx.strokeStyle = this._options.hoverColor;
        ctx.lineWidth = ((this._options.lineWidth ?? 1.5) + SELECTED_HALO_EXTRA_WIDTH) * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scope.horizontalPixelRatio, pts[0].y * scope.verticalPixelRatio);
        ctx.lineTo(pts[1].x * scope.horizontalPixelRatio, pts[1].y * scope.verticalPixelRatio);
        ctx.stroke();
      }

      // Pin-Halo (Chat 2026-08-17, analog zu liquidity.js/LiquidityLineRenderer) — dickere,
      // durchgezogene Linie in der Pin-Akzentfarbe HINTER dem gestrichelten Konnektor.
      if (this._options.inPinContext) {
        ctx.strokeStyle = this._options.pinColor;
        ctx.lineWidth = ((this._options.lineWidth ?? 1.5) + PIN_HALO_EXTRA_WIDTH) * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scope.horizontalPixelRatio, pts[0].y * scope.verticalPixelRatio);
        ctx.lineTo(pts[1].x * scope.horizontalPixelRatio, pts[1].y * scope.verticalPixelRatio);
        ctx.stroke();
      }

      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1.5) * scope.horizontalPixelRatio;
      ctx.setLineDash([6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scope.horizontalPixelRatio, pts[0].y * scope.verticalPixelRatio);
      ctx.lineTo(pts[1].x * scope.horizontalPixelRatio, pts[1].y * scope.verticalPixelRatio);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sobald mehrere Divergenzen gleichzeitig sichtbar sind (v.a. weit rausgezoomt, siehe
      // canShowLabels/chartZoom.js), überlappen sich die Labels sonst zu einem unlesbaren Brei —
      // dieselbe Schwelle wie bei Liquidität/Sessions/News/OBs: Linie bleibt stehen, nur der Text
      // verschwindet, bis wieder genug Platz da ist.
      if (this._options.label && canShowLabels(this._chart, this._candles)) {
        ctx.font = `${11 * scope.verticalPixelRatio}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = this._options.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          this._options.label,
          pts[1].x * scope.horizontalPixelRatio + 6 * scope.horizontalPixelRatio,
          pts[1].y * scope.verticalPixelRatio - 4 * scope.verticalPixelRatio,
        );
      }
    });
  }
}

class DivergenceLinePaneView {
  constructor(source) {
    this._source = source;
    this._points = [
      { x: null, y: null },
      { x: null, y: null },
    ];
  }

  update() {
    const { _chart, _series, _from, _to } = this._source;
    const timeScale = _chart.timeScale();
    this._points = [
      { x: timeScale.timeToCoordinate(_from.time), y: _series.priceToCoordinate(_from.price) },
      { x: timeScale.timeToCoordinate(_to.time), y: _series.priceToCoordinate(_to.price) },
    ];
  }

  renderer() {
    return new DivergenceLineRenderer(this._points, this._source._options, this._source._chart, this._source._candles);
  }
}

export class DivergenceLinePrimitive {
  // from/to: {time, price} — bei der RSI-Bein-Instanz ist "price" der RSI-Wert (0-100). candles:
  // fürs canShowLabels-Zoom-Gating (siehe Renderer), dieselbe clipReplay(allCandles)-Referenz wie
  // beim Aufruf von detectRsiDivergence in PriceChart.vue. divergence: das rohe rsi.js-Objekt
  // ({type, fromTime, toTime, fromPrice, toPrice, fromRsi, toRsi}) — nur für den Pin-
  // Kontextmenü-Kandidaten gebraucht (siehe PriceChart.vue: findNearbyPinCandidates), nicht
  // fürs Zeichnen selbst (from/to reichen dafür).
  constructor(from, to, options, candles, divergence) {
    this._from = from;
    this._to = to;
    this._options = options; // {color, lineWidth, label}
    this._candles = candles;
    this.divergence = divergence;
    this._paneViews = [new DivergenceLinePaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }) {
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

  // Fürs Pin-Kontextmenü (Chat 2026-08-11, siehe PriceChart.vue: findNearbyPinCandidates)
  // — anders als LiquidityLinePrimitive.distanceTo (horizontale Strecke, siehe liquidity.js) ist
  // dieser Konnektor diagonal, deshalb echte Punkt-zu-Strecke-Projektion statt der horizontalen
  // Abkürzung dort. x/y in CSS-Pixeln relativ zum Chart-Container, wie bei allen anderen
  // Primitives hier.
  distanceTo(x, y) {
    const [p1, p2] = this._paneViews[0]._points;
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return Infinity;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(x - p1.x, y - p1.y);
    const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared));
    return Math.hypot(x - (p1.x + t * dx), y - (p1.y + t * dy));
  }
}

// Ursprünglich lokale Funktion in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 4, 2026-08-25) hierher verschoben — war bereits pure. Gepinnte Divergenz
// zusätzlich zur Live-/Historie-Liste rendern (Task "Pin-Kontext: gepinnte Objekte direkt
// rendern") — bewusst NUR bei exaktem Zeit-Treffer (kein Snap-Toleranz wie bei Zonen/Leveln):
// rsi_divergence speichert keine eigene Timeframe-Spalte (siehe pinContext.js), ein exakter
// Treffer von fromTime/toTime auf eine aktuell geladene Kerze ist der einzige verfügbare Proxy
// dafür, dass der Chart gerade auf demselben Timeframe steht, auf dem die Divergenz erkannt wurde
// (Philip 2026-08-18, bestätigt: RSI-Werte sind timeframe-abhängig, ANDERS als Zonen/Level bewusst
// NICHT timeframe-entkoppeln) — ein M5-Zeitstempel trifft auf einem 1H-Chart so gut wie nie exakt
// eine Kerzenzeit.
export function mergePinnedDivergences(divergences, pinnedDivergences, candles) {
  if (!pinnedDivergences || pinnedDivergences.length === 0) return divergences;
  const seen = new Set(divergences.map((d) => `${d.type}|${d.fromTime}|${d.toTime}`));
  const candleTimes = new Set(candles.map((c) => c.time));
  const extra = [];
  for (const d of pinnedDivergences) {
    const key = `${d.type}|${d.fromTime}|${d.toTime}`;
    if (seen.has(key) || !candleTimes.has(d.fromTime) || !candleTimes.has(d.toTime)) continue;
    seen.add(key);
    extra.push(d);
  }
  return [...divergences, ...extra];
}
