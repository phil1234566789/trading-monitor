// Zeichnet Entry/Exit als exakte Marke + Preis-Strich auf den Kerzen-Chart (nicht nur
// "Kerze markiert", sondern der tatsächliche Einstiegs-/Austiegspreis als Marke).
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";

const TICK_LENGTH = 16; // px, Strich neben der Marke zur Preis-Ablesung
const DOT_RADIUS = 3; // px, Exit-Kreis-Fallback (Open/Invalid) — Bug-Report Philip 2026-07-31: klebte zu dominant an den Candles
const ENTRY_TRIANGLE_SIZE = 5; // px, Entry-Dreieck (Long = Spitze oben, Short = Spitze unten)
const EXIT_MARK_SIZE = 5; // px, Häkchen (Win) / X (Loss)

function drawTick(ctx, x, y, offset, tick, pixelRatio, color, colorKey) {
  ctx.strokeStyle = color;
  // Linienstärke folgt demselben Farb-Key (tradeWin/tradeLoss/tradeOpen/tradeInvalid), damit jeder
  // im Style-Modal individuell einstellbare Farb-Regler auch eine eigene Linienstärke hat (Chat
  // 2026-07-25, zweite Runde: "bei jeder Linie, wo man schon die Farbe individuell anpassen kann").
  ctx.lineWidth = Math.max(1, lineWidth(colorKey) * pixelRatio);
  ctx.beginPath();
  ctx.moveTo(x + offset, y);
  ctx.lineTo(x + tick, y);
  ctx.stroke();
}

function drawLabel(ctx, x, y, tick, pixelRatio, color, label) {
  ctx.font = `${Math.round(11 * pixelRatio)}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + tick + 4 * pixelRatio, y);
}

// Entry-Marke als Richtungs-Dreieck statt Kreis (Chat 2026-07-31: "tausche es aus gegen Dreiecke,
// Short Dreieck nach unten, Long Dreieck nach oben") — Spitze zeigt in Trade-Richtung.
function drawEntryPoint(ctx, point, pixelRatio, color, colorKey, label, direction, showLabels) {
  if (point.x === null || point.y === null) return;
  const x = Math.round(point.x * pixelRatio);
  const y = Math.round(point.y * pixelRatio);
  const size = ENTRY_TRIANGLE_SIZE * pixelRatio;
  const tick = TICK_LENGTH * pixelRatio;

  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === "short") {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size * 0.6);
    ctx.lineTo(x + size, y - size * 0.6);
  } else {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size * 0.6);
    ctx.lineTo(x + size, y + size * 0.6);
  }
  ctx.closePath();
  ctx.fill();

  // Bug-Report Philip 2026-07-31: der Strich blieb auch außerhalb des Debug-Modus stehen, obwohl
  // sein einziger Zweck ist, zur (debug-gated) Beschriftung hinzuführen — jetzt an dieselbe
  // showLabels-Bedingung gekoppelt wie das Label selbst.
  if (showLabels) drawTick(ctx, x, y, size, tick, pixelRatio, color, colorKey);
  if (label && showLabels) drawLabel(ctx, x, y, tick, pixelRatio, color, label);
}

// Exit-Marke: Häkchen bei Win, X bei Loss (Chat 2026-07-31 — sofort lesbar auch ohne Label);
// Open/Invalid haben kein sinnvolles Häkchen/X-Äquivalent, bleiben ein kleiner Kreis.
function drawExitPoint(ctx, point, pixelRatio, color, colorKey, label, outcome, showLabels) {
  if (point.x === null || point.y === null) return;
  const x = Math.round(point.x * pixelRatio);
  const y = Math.round(point.y * pixelRatio);
  const tick = TICK_LENGTH * pixelRatio;
  let offset;

  if (outcome === "win" || outcome === "loss") {
    const size = EXIT_MARK_SIZE * pixelRatio;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, lineWidth(colorKey) * pixelRatio);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (outcome === "win") {
      ctx.moveTo(x - size, y);
      ctx.lineTo(x - size * 0.25, y + size * 0.6);
      ctx.lineTo(x + size, y - size * 0.6);
    } else {
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.moveTo(x - size, y + size);
      ctx.lineTo(x + size, y - size);
    }
    ctx.stroke();
    offset = size;
  } else {
    const r = DOT_RADIUS * pixelRatio;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    offset = r;
  }

  if (showLabels) drawTick(ctx, x, y, offset, tick, pixelRatio, color, colorKey);
  if (label && showLabels) drawLabel(ctx, x, y, tick, pixelRatio, color, label);
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
        ctx.lineWidth = Math.max(1.5, lineWidth("tradeConnector") * pixelRatio);
        ctx.setLineDash([5 * pixelRatio, 4 * pixelRatio]);
        ctx.beginPath();
        ctx.moveTo(Math.round(entry.x * pixelRatio), Math.round(entry.y * pixelRatio));
        ctx.lineTo(Math.round(exit.x * pixelRatio), Math.round(exit.y * pixelRatio));
        ctx.stroke();
        ctx.restore();
      }

      drawEntryPoint(
        ctx,
        entry,
        pixelRatio,
        this._options.entryColor,
        this._options.entryColorKey,
        this._options.entryLabel,
        this._options.direction,
        this._options.showLabels,
      );
      if (exit) {
        drawExitPoint(
          ctx,
          exit,
          pixelRatio,
          this._options.exitColor,
          this._options.exitColorKey,
          this._options.exitLabel,
          this._options.outcome,
          this._options.showLabels,
        );
      }
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

function tradeOptions(t, showLabels) {
  const outcomeKey = { win: "tradeWin", loss: "tradeLoss", open: "tradeOpen", invalid: "tradeInvalid" };
  const entryColorKey = t.direction === "short" ? "tradeLoss" : "tradeWin";
  const exitColorKey = outcomeKey[t.outcome] ?? "tradeInvalid";
  const dirLabel = t.direction === "short" ? "Short" : "Long";
  return {
    entryColor: cssColor(entryColorKey),
    entryColorKey,
    direction: t.direction,
    exitColor: cssColor(exitColorKey),
    exitColorKey,
    outcome: t.outcome,
    connectorColor: cssColor("tradeConnector"),
    entryLabel: `${dirLabel} Entry ${t.entryPrice}`,
    exitLabel: t.exitPrice != null ? `${t.outcome?.toUpperCase() ?? "EXIT"} ${t.exitPrice}` : null,
    showLabels,
  };
}

// showLabels: Chat 2026-07-31 — Text-Labels verdecken die Sicht, jetzt hinter demselben "Debug"-
// Toggle (showLiquidityDebug) wie die übrigen Preis-Labels statt immer/zoomabhängig sichtbar.
export function renderTradeMarkers(series, trades, existingPrimitives, candles, showLabels) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const t of trades) {
    const primitive = new TradeMarkerPrimitive(t, tradeOptions(t, showLabels), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
