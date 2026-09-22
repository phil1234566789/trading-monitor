// Zeichnung der R-Skala als Lineal (Philips Skizze 2026-09-20): EINE senkrechte Linie am
// OB-Startzeitpunkt, von der nahen OB-Kante bis zur letzten R-Marke, mit kurzen waagrechten
// Strichen nach rechts und der Zahl links daneben. Ersetzt die erste Fassung (fünf durchgezogene
// Linien bis zum Chart-Rand, je eine LiquidityLinePrimitive) — die war zu unübersichtlich, sobald
// mehrere Setups gleichzeitig sichtbar waren.
//
// Ein Primitive pro Setup statt eines pro Marke: die Skala ist ein zusammenhängendes Objekt, und
// die senkrechte Linie braucht ohnehin alle Marken auf einmal.
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { R_SCALE_MINIMUM } from "./rScale.js";

const TICK_LENGTH_PX = 28;
const LABEL_GAP_PX = 5;
const LABEL_FONT_PX = 11;

// Farb-/Breiten-Key je Marke — 3 R ist laut Strategie das Minimum und deshalb eigenständig
// einstellbar (siehe chartColors.js).
function styleKey(r) {
  return r === R_SCALE_MINIMUM ? "rScaleMinimum" : "rScale";
}

// Zahl ohne "R"-Suffix (Philips Skizze) — die Skala als Ganzes ist durch ihre Form erkennbar,
// neun Mal "R" wäre nur Rauschen. Dahinter die historische Trefferquote des Risiko-Bands, sofern
// für das Instrument gemessen (drQuoten.js) — sonst bleibt es bei der reinen R-Zahl.
function labelText(r, quote) {
  return quote == null ? String(r) : `${r} – ${quote} %`;
}

class RScaleRenderer {
  constructor(point) {
    this._point = point;
  }

  draw(target) {
    const { x, anchorY, ticks } = this._point;
    if (x === null || anchorY === null || ticks.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const px = Math.round(x * scope.horizontalPixelRatio) + 0.5; // halber Pixel = scharfe 1px-Linie
      const lastY = ticks[ticks.length - 1].y;
      if (lastY === null) return;

      ctx.setLineDash([]);
      ctx.strokeStyle = cssColor("rScale");
      ctx.lineWidth = lineWidth("rScale") * scope.horizontalPixelRatio;
      ctx.beginPath();
      ctx.moveTo(px, anchorY * scope.verticalPixelRatio);
      ctx.lineTo(px, lastY * scope.verticalPixelRatio);
      ctx.stroke();

      ctx.font = `${Math.round(LABEL_FONT_PX * scope.verticalPixelRatio)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const { r, quote, y } of ticks) {
        if (y === null) continue;
        const py = Math.round(y * scope.verticalPixelRatio) + 0.5;
        const color = cssColor(styleKey(r));
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth(styleKey(r)) * scope.horizontalPixelRatio;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + TICK_LENGTH_PX * scope.horizontalPixelRatio, py);
        ctx.stroke();
        // Label links der senkrechten Linie, siehe labelText.
        ctx.fillStyle = color;
        ctx.fillText(labelText(r, quote), px - LABEL_GAP_PX * scope.horizontalPixelRatio, py);
      }
    });
  }
}

class RScalePaneView {
  constructor(source) {
    this._source = source;
    this._point = { x: null, anchorY: null, ticks: [] };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const { startTime, anchorPrice, levels } = this._source._scale;
    const barTime = snapToBarTime(this._source._candles, startTime);
    this._point = {
      x: barTime != null ? timeScale.timeToCoordinate(barTime) : null,
      anchorY: series.priceToCoordinate(anchorPrice),
      ticks: levels.map(({ r, price, quote }) => ({ r, quote, y: series.priceToCoordinate(price) })),
    };
  }

  renderer() {
    return new RScaleRenderer(this._point);
  }
}

export class RScalePrimitive {
  constructor(scale, candles) {
    this._scale = scale;
    this._candles = candles;
    this._paneViews = [new RScalePaneView(this)];
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
