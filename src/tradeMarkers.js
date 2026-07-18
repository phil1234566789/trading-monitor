// Zeichnet Entry/Exit als exakten Punkt + Preis-Strich auf den Kerzen-Chart (nicht nur
// "Kerze markiert", sondern der tatsächliche Einstiegs-/Austiegspreis als Marke).
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";

const TICK_LENGTH = 16; // px, Strich neben dem Punkt zur Preis-Ablesung
const DOT_RADIUS = 4; // px

function drawPoint(ctx, point, pixelRatio, color, label) {
  if (point.x === null || point.y === null) return;
  const x = Math.round(point.x * pixelRatio);
  const y = Math.round(point.y * pixelRatio);
  const r = DOT_RADIUS * pixelRatio;
  const tick = TICK_LENGTH * pixelRatio;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.5 * pixelRatio);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + tick, y);
  ctx.stroke();

  if (label) {
    ctx.font = `${Math.round(11 * pixelRatio)}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + tick + 4 * pixelRatio, y);
  }
}

class TradeMarkerRenderer {
  constructor(entry, exit, options) {
    this._entry = entry;
    this._exit = exit;
    this._options = options;
  }

  draw(target) {
    const { entry, exit } = this;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const pixelRatio = scope.horizontalPixelRatio;

      if (entry.x !== null && exit && exit.x !== null && entry.y !== null && exit.y !== null) {
        ctx.save();
        ctx.strokeStyle = this._options.connectorColor;
        ctx.lineWidth = Math.max(1.5, 2 * pixelRatio);
        ctx.setLineDash([5 * pixelRatio, 4 * pixelRatio]);
        ctx.beginPath();
        ctx.moveTo(Math.round(entry.x * pixelRatio), Math.round(entry.y * pixelRatio));
        ctx.lineTo(Math.round(exit.x * pixelRatio), Math.round(exit.y * pixelRatio));
        ctx.stroke();
        ctx.restore();
      }

      drawPoint(ctx, entry, pixelRatio, this._options.entryColor, this._options.entryLabel);
      if (exit) drawPoint(ctx, exit, pixelRatio, this._options.exitColor, this._options.exitLabel);
    });
  }

  get entry() {
    return this._entry;
  }

  get exit() {
    return this._exit;
  }
}

class TradeMarkerPaneView {
  constructor(source) {
    this._source = source;
    this._entry = { x: null, y: null };
    this._exit = null;
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const t = this._source._trade;
    const candles = this._source._candles;

    const entryBarTime = snapToBarTime(candles, t.entryTime);
    this._entry = {
      x: entryBarTime != null ? timeScale.timeToCoordinate(entryBarTime) : null,
      y: series.priceToCoordinate(t.entryPrice),
    };

    const exitBarTime = t.exitTime != null ? snapToBarTime(candles, t.exitTime) : null;
    this._exit =
      exitBarTime != null && t.exitPrice != null
        ? {
            x: timeScale.timeToCoordinate(exitBarTime),
            y: series.priceToCoordinate(t.exitPrice),
          }
        : null;
  }

  renderer() {
    return new TradeMarkerRenderer(this._entry, this._exit, this._source._options);
  }
}

export class TradeMarkerPrimitive {
  constructor(trade, options, candles) {
    this._trade = trade;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new TradeMarkerPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series }) {
    this._chart = chart;
    this._series = series;
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

function tradeOptions(t) {
  const outcomeKey = { win: "tradeWin", loss: "tradeLoss", open: "tradeOpen", invalid: "tradeInvalid" };
  const entryColor = cssColor(t.direction === "short" ? "tradeLoss" : "tradeWin");
  const exitColor = cssColor(outcomeKey[t.outcome] ?? "tradeInvalid");
  const dirLabel = t.direction === "short" ? "Short" : "Long";
  return {
    entryColor,
    exitColor,
    connectorColor: cssColor("tradeConnector"),
    entryLabel: `${dirLabel} Entry ${t.entryPrice}`,
    exitLabel: t.exitPrice != null ? `${t.outcome?.toUpperCase() ?? "EXIT"} ${t.exitPrice}` : null,
  };
}

export function renderTradeMarkers(series, trades, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const t of trades) {
    const primitive = new TradeMarkerPrimitive(t, tradeOptions(t), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
