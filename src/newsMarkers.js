import { snapToBarTime } from "./chartTimeUtils.js";
import { canShowLabels } from "./chartZoom.js";

// Vertikale Marker für High-Impact-News auf dem Chart (Chat 2026-07-26: "ich würd die News gern
// visuell irgendwo sehen") — rein visuell, liest nur die schon geladene news_events-Liste (siehe
// newsEvents.js), keine eigene Erkennung. Gleiche Signalfarbe wie das TSC-No-Go-Banner
// (NO_GO_COLOR in tradeSetupCockpit.ts), damit "News" im ganzen Dashboard dieselbe Warnfarbe hat.
const NEWS_COLOR = "rgba(239, 83, 80, 0.9)";

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

      ctx.strokeStyle = NEWS_COLOR;
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
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = NEWS_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(this._label, x, 4 * scope.verticalPixelRatio);
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
    const primitive = new NewsMarkerPrimitive(event.eventTime, `${event.currency} · ${event.title}`, candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
