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
  // beim Aufruf von detectRsiDivergence in PriceChart.vue.
  constructor(from, to, options, candles) {
    this._from = from;
    this._to = to;
    this._options = options; // {color, lineWidth, label}
    this._candles = candles;
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
}
