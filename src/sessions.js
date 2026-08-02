import { reactive, watch, nextTick } from "vue";
import { snapToBarTime } from "./chartTimeUtils.js";
import { canShowLabels } from "./chartZoom.js";
import { supabase } from "./supabaseClient.js";
// ALL_DAYS/sessionOccurrences leben seit Chat 2026-08-02 dependency-frei in sessionOccurrences.js
// (siehe dort — gleicher Schnitt wie liquidity.js/orderBlocks.js), hier nur re-exportiert, damit
// sich an der öffentlichen API dieses Moduls nichts ändert.
import { ALL_DAYS, sessionOccurrences } from "./sessionOccurrences.js";

export { ALL_DAYS, sessionOccurrences };

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

// true während ein DB-Fetch die Liste reinschreibt — verhindert, dass genau dieser Merge sofort
// wieder einen Save auslöst (siehe chartColors.js, gleiches Muster).
let suppressSave = false;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

watch(
  sessions,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — Sessions gelten dann nur für die
      // aktuelle Sitzung, kein Show-Stopper.
    }
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToRemote, SAVE_DEBOUNCE_MS);
  },
  { deep: true },
);

// Voller Delete+Insert statt eines reinen upsert (anders als chartColors.js) — Sessions sind
// eine dynamische Liste mit Löschen, ein upsert allein würde eine auf einem anderen Gerät
// gelöschte Session nie remote entfernen. Unkritisch bei den paar Zeilen, die hier realistisch
// vorkommen (Ein-Nutzer-App, kein Concurrent-Multi-Autor-Risiko wie bei einer echten
// Mehrbenutzer-Tabelle).
async function saveToRemote() {
  const rows = sessions.map((s) => ({
    id: s.id,
    label: s.label,
    from_minutes: s.fromMinutes,
    to_minutes: s.toMinutes,
    hex: s.hex,
    alpha: s.alpha,
    high_low_relevant: s.highLowRelevant,
    instrument: s.instrument,
    danger: s.danger,
    days: s.days ?? null,
  }));
  const { error: deleteError } = await supabase.from("sessions").delete().not("id", "is", null);
  if (deleteError) {
    console.error("Sessions in DB löschen (vor Neuschreiben) fehlgeschlagen:", deleteError);
    return;
  }
  if (rows.length === 0) return;
  const { error: insertError } = await supabase.from("sessions").insert(rows);
  if (insertError) console.error("Sessions in DB speichern fehlgeschlagen:", insertError);
}

// Geräteübergreifender Sync (Chat 2026-07-23: "session indikator war leer, den ich auf meinem
// haupt pc schon eingestellt hab") — genau wie chartColors.js: leere Tabelle (noch nie von
// irgendeinem Gerät gespeichert) lässt die lokalen Werte unangetastet, ABER schiebt sie dann
// aktiv einmal hoch (Bootstrap) — sonst würde das Geraet mit den einzigen echten Daten (hier:
// der Haupt-PC) nie von selbst pushen, weil `watch` nur auf ECHTE Änderungen reagiert, nicht
// auf den initialen Ladezustand.
async function syncFromRemote() {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, label, from_minutes, to_minutes, hex, alpha, high_low_relevant, instrument, danger, days");
    if (error) throw error;
    if (data && data.length > 0) {
      suppressSave = true;
      sessions.splice(
        0,
        sessions.length,
        ...data.map((r) => ({
          id: r.id,
          label: r.label,
          fromMinutes: r.from_minutes,
          toMinutes: r.to_minutes,
          hex: r.hex,
          alpha: r.alpha,
          highLowRelevant: r.high_low_relevant,
          instrument: r.instrument,
          danger: r.danger,
          days: r.days,
        })),
      );
      nextTick(() => {
        suppressSave = false;
      });
    } else if (sessions.length > 0) {
      await saveToRemote();
    }
  } catch (err) {
    console.error("Sessions aus DB laden fehlgeschlagen:", err);
  }
}
syncFromRemote();

// "normal" | "caution" | "forbidden" (siehe sessions_instrument_danger-Migration) — Chat
// 2026-07-25: verbindet die Handelszeiten-Seite (trading_schedules) mit den Chart-Sessions,
// statt ein eigenes Konzept für Vorsicht-/Sperr-Zeitfenster zu bauen (z.B. MMM-Session
// 10:30-13:00 = caution, ein täglich verbotenes Zeitfenster = forbidden).
export const DANGER_LEVELS = [
  { value: "normal", label: "Normal" },
  { value: "caution", label: "Vorsicht (mehr Bestätigungen nötig)" },
  { value: "forbidden", label: "Verboten (kein Trade-Entry)" },
];

// Bisher rein visuell (siehe DANGER_LEVELS oben) — hier zum ersten Mal tatsächlich konsumiert,
// als automatischer No-Go/Anti-Confluence-Input fürs Trade-Setup-Cockpit (Chat 2026-07-26:
// "ein No-Go könnte direkt Gewichtung 10 sein", siehe computeCockpitState in tradeSetupCockpit.ts).
// "forbidden" schlägt "caution" schlägt "normal", falls mehrere Sessions eines Instruments
// gleichzeitig aktiv sind (z.B. eine weite Session + eine engere Caution-/Forbidden-Session darin).
const DANGER_SEVERITY = { normal: 0, caution: 1, forbidden: 2 };

// Wochentage-Labels fürs Sessions-Modal (Chat 2026-07-26) — ALL_DAYS selbst lebt jetzt in
// sessionOccurrences.js (siehe Import oben), hier nur noch das reine UI-Label-Array.
export const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// sessionConfigs: schon auf ein Instrument gefiltert (siehe PriceChart.vue: `sessions.filter((s) =>
// s.instrument === props.symbol)`), sonst würde z.B. eine BTC-Sperrzeit auch EURUSD sperren.
// nowSec/tzOffsetMinutes wie sessionOccurrences — ruft es mit einem 1-Sekunden-Fenster um nowSec
// auf, um "ist JETZT eine Session mit danger != 'normal' aktiv" statt eines Zeitraums zu prüfen.
export function currentSessionDanger(sessionConfigs, nowSec, tzOffsetMinutes = 0) {
  let best = null;
  for (const session of sessionConfigs) {
    if (!session.danger || session.danger === "normal") continue;
    const occurrences = sessionOccurrences(session.fromMinutes, session.toMinutes, nowSec, nowSec + 1, tzOffsetMinutes, session.days);
    if (occurrences.length === 0) continue;
    if (!best || DANGER_SEVERITY[session.danger] > DANGER_SEVERITY[best.level]) {
      best = { level: session.danger, label: session.label || "" };
    }
  }
  return best;
}

// Dünner Wrapper um currentSessionDanger für "war zu DIESEM Zeitpunkt eine 'forbidden'-Session
// aktiv" (Chat 2026-07-29: "meine Regel, wann ich niemals einen Trade setze" — z.B. Asia
// 00:00-07:00 und Spread Hour 23:00-00:00, beide als danger="forbidden" im Sessions-Modal
// gepflegt) — Trade-Setups sollen das direkt rausfiltern statt es nur als TSC-No-Go anzuzeigen
// (siehe computeTradeSetups in PriceChart.vue). atSec ist bewusst kein "jetzt" wie bei
// currentSessionDanger, sondern ein beliebiger Zeitpunkt in der Vergangenheit (z.B. setup.obStartTime).
// "caution" zählt hier bewusst NICHT als forbidden (nur zusätzliche Bestätigung nötig, kein
// hartes Verbot, siehe DANGER_LEVELS).
export function isForbiddenAt(sessionConfigs, atSec, tzOffsetMinutes = 0) {
  return currentSessionDanger(sessionConfigs, atSec, tzOffsetMinutes)?.level === "forbidden";
}

let sessionIdSeq = 0;
// instrument ist Pflicht (Chat 2026-07-25: "getrennte Listen pro Asset" statt einer Session, die
// für mehrere Assets gilt) — jede Session gehört zu genau einem Instrument, wird nur auf dessen
// Chart gerendert/im Sessions-Modal angezeigt (siehe PriceChart.vue/SessionsModal.vue).
export function addSession(instrument) {
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
    instrument,
    danger: "normal",
    // Default "jeden Tag" (siehe daysOrAll) — bewusst kein weekday-Vorurteil hier, weil addSession
    // instrumentübergreifend genutzt wird (BTC läuft 24/7, bei Forex-Sessions muss Philip Sa/So
    // bewusst über die Checkboxen im Sessions-Modal abwählen).
    days: [...ALL_DAYS],
  });
}

export function removeSession(id) {
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) sessions.splice(idx, 1);
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
  constructor(p1, p2, options, chart, candles) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
    this._chart = chart;
    this._candles = candles;
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

      // Chat 2026-07-25: "wenn ich im 1h den chart etwas herauszoome, dann verdecken mir die
      // Labels die Sicht" — Band selbst bleibt, nur das Label verschwindet bei zu dünnen Kerzen.
      if (this._options.label && canShowLabels(this._chart, this._candles)) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = this._options.labelColor;
        if (hasHighLow) {
          // Bug-Report Philip 2026-07-25 (zwei Runden): bei einer High/Low-Box (schmaler als die
          // volle Pane-Höhe) saß das Label zuerst innen am oberen Rand (überlappte die Box/das
          // Session-High) -> über die Box gehoben; dann noch immer linksbündig am Rand statt
          // "mittig über der Box" -> jetzt horizontal zentriert über der Box-Breite.
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(this._options.label, left + width / 2, top - 2 * scope.verticalPixelRatio);
        } else {
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(this._options.label, left + 4 * scope.horizontalPixelRatio, top + 4 * scope.verticalPixelRatio);
        }
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
    return new SessionBandRenderer(this._p1, this._p2, this._source._options, this._source._chart, this._source._candles);
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
    const occurrences = sessionOccurrences(session.fromMinutes, session.toMinutes, rangeStartSec, rangeEndSec, tzOffsetMinutes, session.days);
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
