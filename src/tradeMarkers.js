// Zeichnet Entry/Exit als exakte Marke + Preis-Strich auf den Kerzen-Chart (nicht nur
// "Kerze markiert", sondern der tatsächliche Einstiegs-/Austiegspreis als Marke).
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";

const TICK_LENGTH = 16; // px, Strich neben der Marke zur Preis-Ablesung
const DOT_RADIUS = 3; // px, Exit-Kreis-Fallback (Open/Invalid) — Bug-Report Philip 2026-07-31: klebte zu dominant an den Candles
const ENTRY_TRIANGLE_SIZE = 5; // px, Entry-Dreieck (Long = Spitze oben, Short = Spitze unten)
const EXIT_MARK_SIZE = 5; // px, Häkchen (Win) / X (Loss)
const HOVER_HALO_RADIUS = 11; // px, Halo-Ring bei Hover über die TradesTable-Zeile (Chat 2026-08-01)
const HOVER_HALO_LINE_WIDTH = 2; // px, reiner Rand statt Füllung (Bug-Report Philip 2026-08-01: "fetter goldener Kreis" verdeckte zu viel)
// Laniakea-Ring (Chat 2026-08-01) bewusst größer als der Hover-Ring UND unabhängig von ihm
// gezeichnet — ein Trade kann gleichzeitig gehovert UND dauerhaft im Laniakea-Kontext sein
// (zwei ineinanderliegende Ringe statt einer, der den anderen überdeckt).
const LANIAKEA_HALO_RADIUS = 16; // px
const HIT_TEST_RADIUS = 12; // px, Rechtsklick-Toleranz auf Entry/Exit (siehe TradeMarkerPrimitive.hitTest)

// Ungefüllter Ring-Rand hinter Entry/Exit — für Hover (Tabellenzeile) UND für "dauerhaft im
// Laniakea-Kontext" (siehe TradeMarkerRenderer.draw), eigene Funktion statt in
// drawEntryPoint/drawExitPoint verwoben, weil er unabhängig von Richtung/Outcome immer gleich
// aussieht.
function drawHaloRing(ctx, x, y, pixelRatio, color, radius) {
  ctx.strokeStyle = color;
  ctx.lineWidth = HOVER_HALO_LINE_WIDTH * pixelRatio;
  ctx.beginPath();
  ctx.arc(x, y, radius * pixelRatio, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTick(ctx, x, y, offset, tick, pixelRatio, color, colorKey) {
  ctx.strokeStyle = color;
  // Linienstärke folgt demselben Farb-Key (tradeWin/tradeLoss/tradeInvalid), damit jeder
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
        // Hervorgehobene Verbindung ist doppelt so dick statt einer eigenen Style-Modal-Linienstärke
        // — reine Hover-Betonung, kein dauerhaft einstellbares Chart-Layer-Element wie die Farbe selbst.
        ctx.lineWidth = Math.max(1.5, lineWidth("tradeConnector") * pixelRatio) * (this._options.hovered ? 2 : 1);
        ctx.setLineDash([5 * pixelRatio, 4 * pixelRatio]);
        ctx.beginPath();
        ctx.moveTo(Math.round(entry.x * pixelRatio), Math.round(entry.y * pixelRatio));
        ctx.lineTo(Math.round(exit.x * pixelRatio), Math.round(exit.y * pixelRatio));
        ctx.stroke();
        ctx.restore();
      }

      for (const point of [entry, exit]) {
        if (!point || point.x === null || point.y === null) continue;
        const x = Math.round(point.x * pixelRatio);
        const y = Math.round(point.y * pixelRatio);
        if (this._options.hovered) drawHaloRing(ctx, x, y, pixelRatio, this._options.hoverColor, HOVER_HALO_RADIUS);
        if (this._options.inLaniakeaContext) drawHaloRing(ctx, x, y, pixelRatio, this._options.laniakeaColor, LANIAKEA_HALO_RADIUS);
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

  // Rechtsklick-Hittest fürs Laniakea-Kontextmenü (Chat 2026-08-01, siehe PriceChart.vue:
  // contextmenu-Listener auf chartContainerRef) — liest die beim letzten Render aktualisierten
  // Pixel-Koordinaten (_entry/_exit), statt Zeit/Preis erneut selbst umzurechnen. x/y sind
  // CSS-Pixel relativ zum Chart-Container, exakt derselbe Koordinatenraum wie timeToCoordinate/
  // priceToCoordinate liefern (kein pixelRatio-Faktor hier, der gilt nur fürs Bitmap-Zeichnen).
  hitTest(x, y) {
    const { _entry: entry, _exit: exit } = this._paneViews[0];
    for (const point of [entry, exit]) {
      if (!point || point.x === null || point.y === null) continue;
      const dx = point.x - x;
      const dy = point.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_TEST_RADIUS) return true;
    }
    return false;
  }

  get trade() {
    return this._trade;
  }
}

// win/loss sind die einzigen Outcomes mit eigener Marker-Farbe — "open" hat in der Praxis nie
// gleichzeitig einen Exit-Preis (eine wirklich noch offene Position hat keinen Exit zu markieren),
// "invalid" gibt's als Outcome seit Chat 2026-07-31 gar nicht mehr (0 Zeilen genutzt, siehe
// Migration 20260731220000_drop_invalid_outcome.sql). tradeInvalid bleibt als generischer
// Fallback für den Rest-Fall "Exit-Preis gesetzt, aber noch kein Ergebnis gewählt".
function tradeOptions(t, showLabels, hovered, inLaniakeaContext) {
  const outcomeKey = { win: "tradeWin", loss: "tradeLoss" };
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
    // Gehoverte/im Laniakea-Kontext gespeicherte Trades zeigen ihr Label immer, unabhängig vom
    // Debug-Toggle (Chat 2026-08-01) — der ganze Sinn ist ja, Philip beim Reden mit Lana genau
    // diesen Preis dauerhaft lesbar zu machen.
    showLabels: showLabels || hovered || inLaniakeaContext,
    hovered,
    inLaniakeaContext,
    hoverColor: cssColor("tradeHover"),
    laniakeaColor: cssColor("laniakea"),
  };
}

// showLabels: Chat 2026-07-31 — Text-Labels verdecken die Sicht, jetzt hinter demselben "Debug"-
// Toggle (showLiquidityDebug) wie die übrigen Preis-Labels statt immer/zoomabhängig sichtbar.
// hoveredTradeId (Chat 2026-08-01): trade_positions.id der gerade in TradesTable.vue gehoverten
// Zeile. laniakeaTradeIds (Chat 2026-08-01): Set von trade_positions.id, die dauerhaft im
// Laniakea-Kontext gespeichert sind (siehe laniakeaContext.js) — beide zeichnen unabhängig
// voneinander einen Halo-Ring um Entry/Exit (siehe TradeMarkerRenderer.draw).
export function renderTradeMarkers(series, trades, existingPrimitives, candles, showLabels, hoveredTradeId, laniakeaTradeIds) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const t of trades) {
    const hovered = hoveredTradeId != null && t.id === hoveredTradeId;
    const inLaniakeaContext = laniakeaTradeIds?.has(t.id) ?? false;
    const primitive = new TradeMarkerPrimitive(t, tradeOptions(t, showLabels, hovered, inLaniakeaContext), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
