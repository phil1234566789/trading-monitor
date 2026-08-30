// Dreieck-Marker für die persistierten 1D-Periode-4-Struktur-Pivots (siehe dailyPivots.js/
// usePriceChartDailyPivots.js) — Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots". Über
// alle Timeframes hinweg sichtbar (M5 aufwärts), Positionierung über snapToBarTime (wie HTF-
// Liquidity-Level, src/liquidity.js) statt pivotMarkers.ts' Drop-wenn-außerhalb-Verhalten — ein
// Pivot bleibt damit auch bei weggescrolltem Zeitfenster sichtbar (an den Rand geklemmt). Primitive/
// PaneView/Renderer-Aufbau wie pivotMarkers.ts, Dreieck-Pfad-Geometrie wie tradeMarkers.js'
// Entry-Dreieck (dort Long/Short, hier High/Low: Spitze hoch = High-Pivot, Spitze runter =
// Low-Pivot).
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";

const TRIANGLE_SIZE = 6; // px, etwas größer als das Trade-Entry-Dreieck (5px) — eigenständiger HTF-Marker
// Bug-Report Philip 2026-08-30: Dreieck klebte direkt an der Kerze/dem Docht, dessen Preis es
// markiert — Abstand zwischen Preis-Koordinate und Dreieck-Basis, in dieselbe Richtung wie die
// Spitze zeigt (High-Pivot nach oben weg vom Preis, Low-Pivot nach unten).
const PRICE_GAP = 10;

function drawTriangle(ctx, x, y, size, dir, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 1) {
    // High-Pivot: Spitze nach oben.
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size * 0.6);
    ctx.lineTo(x + size, y + size * 0.6);
  } else {
    // Low-Pivot: Spitze nach unten.
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size * 0.6);
    ctx.lineTo(x + size, y - size * 0.6);
  }
  ctx.closePath();
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
      const size = TRIANGLE_SIZE * scope.horizontalPixelRatio;

      pts.forEach((p) => {
        drawTriangle(ctx, toX(p.x), toY(p.y), size, p.dir, p.color);
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
      // Bug-Report Philip 2026-08-30: Dreieck saß auf p.pivotTime (dem 1D-Kerzen-Open, IMMER
      // 21:00 UTC/23:00 Berlin, siehe cTraders D1-Rollover) statt auf der tatsächlichen 1H-Kerze,
      // die den Pivot-Preis gebildet hat (structureStartTime, siehe resolveStructureStartTime.ts)
      // — genau der Zeitpunkt, den structureStartTime auflösen soll. Fallback auf pivotTime nur
      // für Alt-Pivots ohne aufgelösten Wert (1H-Archiv deckt ihren Tag noch nicht ab).
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
