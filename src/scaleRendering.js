// Zeichnung einer Skala an der Dealing Range als Lineal (Philips Skizze 2026-09-20): EINE
// senkrechte Linie am OB-Startzeitpunkt, von der nahen OB-Kante bis zur letzten Marke, mit kurzen
// waagrechten Strichen zur Seite und der Zahl gegenüber. Ersetzt die erste Fassung (fünf
// durchgezogene Linien bis zum Chart-Rand, je eine LiquidityLinePrimitive) — die war zu
// unübersichtlich, sobald mehrere Setups gleichzeitig sichtbar waren.
//
// Ein Primitive pro Setup und Leiter statt eines pro Marke: die Skala ist ein zusammenhängendes
// Objekt, und die senkrechte Linie braucht ohnehin alle Marken auf einmal.
//
// Hieß bis 2026-09-23 rScaleRendering.js und leitete Label und Farbe intern aus der R-Stufe ab.
// Seit der Pip-Leiter (pipScale.js) bringt jede Marke beides fertig mit — der Renderer kennt
// weder R noch Pips und zeichnet beide Leitern.
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";

const TICK_LENGTH_PX = 28;
const LABEL_GAP_PX = 5;
const LABEL_FONT_PX = 11;

class ScaleRenderer {
  constructor(point) {
    this._point = point;
  }

  draw(target) {
    const { x, anchorY, ticks, axisStyleKey, side } = this._point;
    if (x === null || anchorY === null || ticks.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const px = Math.round(x * scope.horizontalPixelRatio) + 0.5; // halber Pixel = scharfe 1px-Linie
      const lastY = ticks[ticks.length - 1].y;
      if (lastY === null) return;

      ctx.setLineDash([]);
      ctx.strokeStyle = cssColor(axisStyleKey);
      ctx.lineWidth = lineWidth(axisStyleKey) * scope.horizontalPixelRatio;
      ctx.beginPath();
      ctx.moveTo(px, anchorY * scope.verticalPixelRatio);
      ctx.lineTo(px, lastY * scope.verticalPixelRatio);
      ctx.stroke();

      ctx.font = `${Math.round(LABEL_FONT_PX * scope.verticalPixelRatio)}px sans-serif`;
      // Label immer gegenüber den Strichen — sonst überschreiben sich bei zwei gleichzeitig
      // eingeblendeten Leitern (R links, Pips rechts) Striche und Zahlen gegenseitig.
      ctx.textAlign = side === 1 ? "right" : "left";
      ctx.textBaseline = "middle";
      for (const { label, styleKey, y } of ticks) {
        if (y === null) continue;
        const py = Math.round(y * scope.verticalPixelRatio) + 0.5;
        const color = cssColor(styleKey);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth(styleKey) * scope.horizontalPixelRatio;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + side * TICK_LENGTH_PX * scope.horizontalPixelRatio, py);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(label, px - side * LABEL_GAP_PX * scope.horizontalPixelRatio, py);
      }
    });
  }
}

class ScalePaneView {
  constructor(source) {
    this._source = source;
    this._point = { x: null, anchorY: null, ticks: [], axisStyleKey: null, side: 1 };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const { startTime, anchorPrice, levels, axisStyleKey, side } = this._source._scale;
    const barTime = snapToBarTime(this._source._candles, startTime);
    this._point = {
      x: barTime != null ? timeScale.timeToCoordinate(barTime) : null,
      anchorY: series.priceToCoordinate(anchorPrice),
      axisStyleKey,
      side,
      ticks: levels.map(({ price, label, styleKey }) => ({
        label,
        styleKey,
        y: series.priceToCoordinate(price),
      })),
    };
  }

  renderer() {
    return new ScaleRenderer(this._point);
  }
}

export class ScalePrimitive {
  constructor(scale, candles) {
    this._scale = scale;
    this._candles = candles;
    this._paneViews = [new ScalePaneView(this)];
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
