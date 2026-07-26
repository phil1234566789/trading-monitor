import { snapToBarTime } from "./chartTimeUtils.js";
import { canShowLabels } from "./chartZoom.js";
import { cssColor } from "./chartColors.js";

// Vertikale Marker für High-Impact-News auf dem Chart (Chat 2026-07-26: "ich würd die News gern
// visuell irgendwo sehen") — rein visuell, liest nur die schon geladene news_events-Liste (siehe
// newsEvents.js), keine eigene Erkennung. Farbe über den zentralen chartColors-Store (Chat:
// "Chart-Style bitte noch Farbkonfiguration hinzufügen", siehe StyleModal.vue-Gruppe "News") statt
// eines Literals — Default ist dasselbe Rot wie das TSC-No-Go-Banner (NO_GO_COLOR in
// tradeSetupCockpit.ts), aber jetzt individuell änderbar.

// Wochentag (abgekürzt) + Uhrzeit, Europe/Berlin (Chat 2026-07-26: "damit man sie leichter
// zuordnen kann") — bewusst NICHT Währung/Titel im Label (das steht nicht in Philips Wunsch, und
// beides zusammen wäre bei mehreren dicht beieinanderliegenden Terminen schnell unleserlich).
// Intl.DateTimeFormat mit fester Zeitzone statt Browser-Lokalzeit (siehe CLAUDE.md "Trading-hours /
// timezone handling") — DST-aware, unabhängig davon, wo der Rechner tatsächlich steht.
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" });
const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" });

export function formatEventLabel(eventTimeSec) {
  const d = new Date(eventTimeSec * 1000);
  const weekday = WEEKDAY_FORMATTER.format(d).replace(".", ""); // de-DE liefert "Do." mit Punkt
  return `${weekday} ${TIME_FORMATTER.format(d)}`;
}

class NewsMarkerRenderer {
  constructor(x, label, chart, candles) {
    this._x = x;
    this._label = label;
    this._chart = chart;
    this._candles = candles;
  }

  draw(target) {
    if (this._x === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const x = Math.round(this._x * scope.horizontalPixelRatio);
      const color = cssColor("newsEvent");

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(scope.horizontalPixelRatio));
      ctx.setLineDash([4 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, scope.bitmapSize.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label ausblenden, wenn zu viele Kerzen sichtbar sind (siehe sessions.js: gleiches Problem
      // mit sich überlappenden Labels beim Herauszoomen).
      if (canShowLabels(this._chart, this._candles)) {
        // Schrift ganz unten, um 90° gedreht (Chat 2026-07-26) — translate+rotate(-90°) verschiebt
        // die lokale +x-Achse nach oben (Richtung Bildschirm-oben), der Text wächst also vom
        // unteren Anker-Punkt aus nach oben, liest sich von unten nach oben.
        const bottomY = scope.bitmapSize.height - 6 * scope.verticalPixelRatio;
        ctx.save();
        // Abstand zur Linie (Chat 2026-07-26: "bissl zu nah an der Linie") — 8px statt 3px.
        ctx.translate(x + 8 * scope.horizontalPixelRatio, bottomY);
        ctx.rotate(-Math.PI / 2);
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this._label, 0, 0);
        ctx.restore();
      }
    });
  }
}

class NewsMarkerPaneView {
  constructor(source) {
    this._source = source;
    this._x = null;
  }

  update() {
    const { _chart: chart, _eventTime: eventTime, _candles: candles } = this._source;
    const barTime = snapToBarTime(candles, eventTime);
    this._x = barTime != null ? chart.timeScale().timeToCoordinate(barTime) : null;
  }

  renderer() {
    return new NewsMarkerRenderer(this._x, this._source._label, this._source._chart, this._source._candles);
  }

  // "top": über den Kerzen (anders als sessions.js' "bottom") — eine dünne gestrichelte Linie soll
  // auch bei vollen Kerzenkörpern noch sichtbar sein, kein Flächen-Element wie die Session-Bänder.
  zOrder() {
    return "top";
  }
}

class NewsMarkerPrimitive {
  constructor(eventTime, label, candles) {
    this._eventTime = eventTime;
    this._label = label;
    this._candles = candles;
    this._paneViews = [new NewsMarkerPaneView(this)];
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

// events: schon auf das aktuelle Instrument gefiltert (siehe newsEventsForInstrument in
// newsEvents.js) — ein Marker pro Termin, unabhängig davon, ob er gerade im No-Go-Fenster liegt
// (das ist eine TSC-Entscheidung, hier geht es nur um "wann war/ist etwas Wichtiges").
export function renderNewsMarkers(series, events, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (candles.length === 0) return;

  for (const event of events) {
    const primitive = new NewsMarkerPrimitive(event.eventTime, formatEventLabel(event.eventTime), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
