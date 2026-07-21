import { reactive, watch } from "vue";
import { snapToBarTime } from "./chartTimeUtils.js";

// Session-Indikator (Chat 2026-07-22: "es gibt mehrere sessions ... hinzufügen/editieren/löschen,
// von-bis Zeitangabe halbstunde genau, Hintergrundfarbe, Label") — frei konfigurierbare, TÄGLICH
// wiederkehrende Zeitfenster (z.B. "London Session 09:00–17:30") als halbtransparente
// Hintergrundbänder auf dem Chart. Anders als chartColors.js (feste, bekannte Keys) ist das hier
// eine dynamische LISTE — jede Session hat ihre eigene id/label/Zeitfenster/Farbe, kein festes
// Schema wie bei den übrigen Farb-Presets. Startet bewusst LEER (keine Asia/London/NY-Presets) —
// welche Sessions und welche genauen Zeiten Philip tatsächlich will, ist seine fachliche
// Entscheidung, nicht etwas, das wir raten sollten.
const STORAGE_KEY = "trading-monitor:sessions";

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // korrupter/fremder Wert unter dem Key -> leer starten statt zu crashen
  }
  return [];
}

export const sessions = reactive(loadInitial());

watch(
  sessions,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — Sessions gelten dann nur für die
      // aktuelle Sitzung, kein Show-Stopper.
    }
  },
  { deep: true },
);

let sessionIdSeq = 0;
export function addSession() {
  sessions.push({
    id: `session-${Date.now()}-${sessionIdSeq++}`,
    label: "Neue Session",
    fromMinutes: 8 * 60, // 08:00
    toMinutes: 16 * 60, // 16:00
    hex: "#2962ff",
    alpha: 0.08,
    // Chat 2026-07-22: "es gibt sessions, da ist das high und low entscheidend, aber auch
    // sessions, wo das nicht der Fall ist (valide Trading Entry Zeiten)" — reiner Konfigurations-
    // Flag je Session, noch von keinem Algorithmus konsumiert. Default true, weil das bisherige
    // (implizite) Verhalten war, jede Session als Range-relevant zu behandeln.
    highLowRelevant: true,
  });
}

export function removeSession(id) {
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) sessions.splice(idx, 1);
}

// --- Vorkommen berechnen -------------------------------------------------------------------------

const DAY_SEC = 24 * 3600;

// Findet den UTC-Zeitpunkt der LOKALEN Mitternacht des Tages, der "nearUtcSec" lokal enthält — pro
// KANDIDATENTAG einzeln über offsetMinutesFn abgefragt, statt EINES festen Offsets für den ganzen
// Bereich (Bug-Report Philip 2026-07-22: "prüf ob die sessions auch mit der Zeitumstellung
// einwandfrei funktionieren, wohne ja in Deutschland" — ein einzelner "jetzt"-Offset war für Kerzen
// auf der anderen Seite einer Sommer-/Winterzeit-Umstellung eine Stunde daneben, sobald der
// geladene Kerzenbereich, siehe renderSessions, per Lazy-Load Monate zurückreicht und damit über
// eine echte Umstellung hinausragt). Zwei Iterationen genügen: eine Zeitumstellung verschiebt den
// Offset nur an genau EINEM Tag im Jahr um höchstens ein paar Stunden — der zweite Durchlauf mit
// dem verfeinerten UTC-Schätzwert löst diesen Grenzfall auf (Fixpunkt-Iteration, ähnlich wie
// Timezone-Bibliotheken lokale Wanduhrzeit -> UTC auflösen).
function localMidnightUtc(nearUtcSec, offsetMinutesFn) {
  let utcGuess = nearUtcSec;
  for (let i = 0; i < 2; i++) {
    const offsetSec = offsetMinutesFn(utcGuess) * 60;
    const localMidnightLocalSec = Math.floor((utcGuess + offsetSec) / DAY_SEC) * DAY_SEC;
    utcGuess = localMidnightLocalSec - offsetSec;
  }
  return utcGuess;
}

// Liefert alle Vorkommen (Start/Ende in echten UTC-Sekunden) einer täglich wiederkehrenden Session
// im Fenster [rangeStartSec, rangeEndSec]. fromMinutes/toMinutes sind Minuten seit Mitternacht in
// LOKALER Zeit — toMinutes <= fromMinutes bedeutet eine Session, die über Mitternacht läuft (z.B.
// Sydney 22:00–06:00).
// tzOffsetMinutes ist entweder eine Zahl (fester Offset, für deterministische Tests) ODER eine
// Funktion (utcSec) => Offset-Minuten (für echte DST-Korrektheit — siehe localMidnightUtc oben).
// Für den echten Chart übergibt PriceChart.vue `(utcSec) => -new Date(utcSec * 1000).getTimezoneOffset()`
// — Date().getTimezoneOffset() kennt (über die Timezone-Datenbank des Betriebssystems) die
// historischen/zukünftigen deutschen DST-Regeln für JEDES Datum, nicht nur für "jetzt".
export function sessionOccurrences(fromMinutes, toMinutes, rangeStartSec, rangeEndSec, tzOffsetMinutes = 0) {
  if (rangeStartSec == null || rangeEndSec == null || rangeEndSec <= rangeStartSec) return [];
  const offsetMinutesFn = typeof tzOffsetMinutes === "function" ? tzOffsetMinutes : () => tzOffsetMinutes;

  // Ein Tag Puffer VOR dem Fenster: eine über Mitternacht laufende Session, die am Vortag beginnt,
  // kann noch bis in rangeStartSec hineinreichen.
  let dayStart = localMidnightUtc(rangeStartSec - DAY_SEC, offsetMinutesFn);

  const results = [];
  // Puffer-Tag NACH dem Fenster ebenso großzügig — der Überlappungs-Filter unten verwirft ohnehin
  // jedes Vorkommen, das tatsächlich außerhalb liegt, eine Iteration zu viel ist also harmlos.
  while (dayStart <= rangeEndSec + DAY_SEC) {
    const startSec = dayStart + fromMinutes * 60;
    let endSec = dayStart + toMinutes * 60;
    if (toMinutes <= fromMinutes) endSec += DAY_SEC;
    if (endSec > rangeStartSec && startSec < rangeEndSec) {
      results.push({ startSec, endSec });
    }
    dayStart = localMidnightUtc(dayStart + DAY_SEC, offsetMinutesFn);
  }
  return results;
}

// --- Zeichnung ------------------------------------------------------------------------------------

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

class SessionBandRenderer {
  constructor(p1, p2, options) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p2.x === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const x1 = Math.round(p1.x * scope.horizontalPixelRatio);
      const x2 = Math.round(p2.x * scope.horizontalPixelRatio);
      const left = Math.min(x1, x2);
      const width = Math.max(1, Math.abs(x2 - x1));
      // Chat 2026-07-22: "die session box soll dann nur bis zum high und low gezeichnet werden ...
      // nicht über die gesamte vertikale fläche" — p1.y/p2.y sind nur gesetzt, wenn die Session
      // highLowRelevant ist UND im sichtbaren Kerzenfenster tatsächlich Kerzen lagen (siehe
      // renderSessions/highLowInWindow); sonst (reines Entry-Zeitfenster oder noch keine Kerzendaten
      // in dem Vorkommen) bleibt es bei der alten vollen Höhe.
      const hasHighLow = p1.y !== null && p2.y !== null;
      const top = hasHighLow ? Math.round(Math.min(p1.y, p2.y) * scope.verticalPixelRatio) : 0;
      const height = hasHighLow
        ? Math.max(1, Math.round(Math.abs(p2.y - p1.y) * scope.verticalPixelRatio))
        : scope.bitmapSize.height;
      ctx.fillStyle = this._options.fill;
      ctx.fillRect(left, top, width, height);

      if (this._options.label) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = this._options.labelColor;
        ctx.fillText(this._options.label, left + 4 * scope.horizontalPixelRatio, top + 4 * scope.verticalPixelRatio);
      }
    });
  }

  get p1() {
    return this._p1;
  }

  get p2() {
    return this._p2;
  }
}

class SessionBandPaneView {
  constructor(source) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = { x: null, y: null };
  }

  update() {
    const timeScale = this._source._chart.timeScale();
    const series = this._source._series;
    const { highPrice, lowPrice, _candles: candles } = this._source;
    // Bug-Report Philip 2026-07-22: "session indikator wird mir für 02.07. 23:00 - 03.07. 07:00
    // nicht angezeigt, bei dem tag davor und danach schon" — wenn startSec/endSec (echte Session-
    // Grenzen) über den geladenen Kerzenbereich hinausragen (z.B. während des Replay-Scrubbens endet
    // der geladene Bereich MITTEN in dieser Session), liefert timeToCoordinate für den Randpunkt
    // AUSSERHALB `null` zurück — draw() bricht dann bei p1.x===null||p2.x===null KOMPLETT ab, auch
    // der eigentlich sichtbare Teil der Box verschwindet mit. snapToBarTime (schon von
    // orderBlocks.js/liquidity.js für exakt dasselbe Problem genutzt, siehe chartTimeUtils.js) klemmt
    // auf die erste/letzte geladene Kerze, statt den Randpunkt unverändert zu lassen.
    const startBarTime = snapToBarTime(candles, this._source._startSec);
    const endBarTime = snapToBarTime(candles, this._source._endSec);
    this._p1 = {
      x: startBarTime != null ? timeScale.timeToCoordinate(startBarTime) : null,
      y: highPrice != null ? series.priceToCoordinate(highPrice) : null,
    };
    this._p2 = {
      x: endBarTime != null ? timeScale.timeToCoordinate(endBarTime) : null,
      y: lowPrice != null ? series.priceToCoordinate(lowPrice) : null,
    };
  }

  renderer() {
    return new SessionBandRenderer(this._p1, this._p2, this._source._options);
  }

  // "bottom": hinter den Kerzen zeichnen (lightweight-charts hat kein natives "Hintergrund"-Konzept
  // für Primitives, zOrder 'bottom' ist die dafür vorgesehene Annäherung) — sonst würde die
  // Session-Fläche die Kerzen selbst verdecken/einfärben.
  zOrder() {
    return "bottom";
  }
}

export class SessionBandPrimitive {
  constructor(startSec, endSec, options, { highPrice = null, lowPrice = null, candles = [] } = {}) {
    this._startSec = startSec;
    this._endSec = endSec;
    this._options = options;
    this.highPrice = highPrice;
    this.lowPrice = lowPrice;
    this._candles = candles;
    this._paneViews = [new SessionBandPaneView(this)];
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

// High/Low aller Kerzen, deren Öffnungszeit im Vorkommen-Fenster [startSec, endSec) liegt — die
// vertikale Ausdehnung der Session-Box (siehe SessionBandRenderer). null, wenn keine Kerze in das
// Fenster fällt (z.B. Vorkommen liegt noch komplett in der Zukunft) -> Aufrufer fällt dann auf die
// alte volle Höhe zurück, statt eine unsichtbare Box zu zeichnen.
export function highLowInWindow(candles, startSec, endSec) {
  let high = null;
  let low = null;
  for (const c of candles) {
    if (c.time < startSec || c.time >= endSec) continue;
    if (high === null || c.high > high) high = c.high;
    if (low === null || c.low < low) low = c.low;
  }
  return high === null ? null : { high, low };
}

// Ersetzt existingPrimitives komplett — analog zu renderLiquidityLevels/renderPersistedZones.
// candles bestimmen das Fenster, für das Vorkommen berechnet werden (siehe sessionOccurrences) —
// weit genug hinaus reicht clipReplay(allCandles) im Aufrufer bereits.
export function renderSessions(series, sessionConfigs, existingPrimitives, candles, { tzOffsetMinutes = 0 } = {}) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (candles.length === 0) return;

  const rangeStartSec = candles[0].time;
  const rangeEndSec = candles[candles.length - 1].time;

  for (const session of sessionConfigs) {
    const occurrences = sessionOccurrences(session.fromMinutes, session.toMinutes, rangeStartSec, rangeEndSec, tzOffsetMinutes);
    for (const { startSec, endSec } of occurrences) {
      const highLow = session.highLowRelevant ? highLowInWindow(candles, startSec, endSec) : null;
      const primitive = new SessionBandPrimitive(
        startSec,
        endSec,
        {
          fill: hexToRgba(session.hex, session.alpha),
          label: session.label || null,
          labelColor: hexToRgba(session.hex, Math.min(1, session.alpha + 0.55)),
        },
        { highPrice: highLow?.high ?? null, lowPrice: highLow?.low ?? null, candles },
      );
      series.attachPrimitive(primitive);
      existingPrimitives.push(primitive);
    }
  }
}
