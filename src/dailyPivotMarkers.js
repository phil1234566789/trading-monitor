// Kreis-Marker für persistierte 1D-Periode-4-Struktur-Pivots (siehe dailyPivots.js).
// snapToBarTime hält den Pivot über alle Timeframes (M5 aufwärts) sichtbar und klemmt ihn
// bei weggescrolltem Zeitfenster an den Rand, wie die HTF-Liquidity-Level.
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";

const CIRCLE_RADIUS = 6; // px, Außenring mit getrenntem Kern unterscheidet sich von einfachen Pivot-/Exit-Punkten.
// Abstand zum Docht beibehalten (Bug-Report 2026-08-30): High nach oben, Low nach unten.
const PRICE_GAP = 10;

function drawCircle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = radius / 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius / 2, 0, Math.PI * 2);
  ctx.fill();
}

class DailyPivotMarkerRenderer {
  constructor(points) {
    this._points = points; // [{x,y,dir}] in Pane-Koordinaten
  }

  draw(target) {
    const pts = this._points.filter((p) => p.x !== null && p.y !== null);
    if (pts.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const toX = (x) => Math.round(x * scope.horizontalPixelRatio);
      const toY = (y) => Math.round(y * scope.verticalPixelRatio);
      const radius = CIRCLE_RADIUS * scope.horizontalPixelRatio;

      pts.forEach((p) => {
        drawCircle(ctx, toX(p.x), toY(p.y), radius, p.color);
      });
    });
  }
}

class DailyPivotMarkerPaneView {
  constructor(source) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;

    this._points = this._source._pivots.map((p) => {
      // Marker auf der preisbildenden 1H-Kerze statt dem D1-Open (Bug-Report 2026-08-30).
      // Fallback auf pivotTime nur für Alt-Pivots ohne aufgelösten structureStartTime.
      const barTime = snapToBarTime(candles, p.structureStartTime ?? p.pivotTime);
      const priceY = series.priceToCoordinate(p.price);
      return {
        x: barTime != null ? timeScale.timeToCoordinate(barTime) : null,
        y: priceY != null ? priceY + (p.dir === 1 ? -PRICE_GAP : PRICE_GAP) : null,
        dir: p.dir,
        color: cssColor(p.dir === 1 ? "dailyPivotHigh" : "dailyPivotLow"),
      };
    });
  }

  renderer() {
    return new DailyPivotMarkerRenderer(this._points);
  }
}

export class DailyPivotMarkerPrimitive {
  constructor(pivots, candles) {
    this._pivots = pivots;
    this._candles = candles;
    this._paneViews = [new DailyPivotMarkerPaneView(this)];
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

// Ersetzt existingPrimitives komplett durch die aktuellen Pivots — analog zu renderPivotMarkers
// (pivotMarkers.ts)/renderLiquidityLevels (liquidity.js).
export function renderDailyPivotMarkers(series, pivots, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!pivots || pivots.length === 0 || candles.length === 0) return;

  const primitive = new DailyPivotMarkerPrimitive(pivots, candles);
  series.attachPrimitive(primitive);
  existingPrimitives.push(primitive);
}
