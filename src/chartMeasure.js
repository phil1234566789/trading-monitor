// Messwerkzeug (Philip 2026-09-23, erstes Zeichen-Werkzeug im Chart): zwei Klicks -> eine
// dauerhafte Strecke mit Pip-Label. Bewusst KEINE eigene Tabelle/Primitive, sondern eine
// Claude-Notiz-Zeile (claude_annotations, type "line") — die kann schon zwei Punkte + Label,
// wird gerendert, ist einzeln aus-/einblendbar und löschbar, und landet im Debug-Snapshot,
// damit beim Debuggen sichtbar ist, wo gemessen wurde.
import { ref } from "vue";
import { toPips } from "./pipConfig.js";
import { formatDatedTime } from "./berlinTime.js";

// Sonst im Chart ungenutztes Türkis — klar unterscheidbar von ANNOTATION_COLOR (Claudes Pink),
// damit eine eigene Messung im Chart nicht wie eine Claude-Notiz aussieht.
export const MEASURE_COLOR = "#00d1b2";

// Betrag, nicht vorzeichenbehaftet — die Richtung sieht man an der Strecke selbst.
export function formatPips(priceDiff) {
  return `${Math.abs(toPips(priceDiff)).toFixed(1).replace(".", ",")} Pips`;
}

// from/to = { time: Unix-Sekunden, price } aus den beiden Chart-Klicks. Zeiten als datiertes
// "YYYY-MM-DD HH:mm" (nicht nur "HH:mm"), damit eine Messung über einen Tageswechsel hinweg
// nicht auf den Tag der Zeile zurückfällt (siehe resolveTime in claudeAnnotations.js).
export function measureDrawing(from, to) {
  const text = formatPips(to.price - from.price);
  return {
    title: `📏 ${text} · ${formatDatedTime(from.time)}`,
    annotations: [
      {
        type: "line",
        from: { price: from.price, time: formatDatedTime(from.time) },
        to: { price: to.price, time: formatDatedTime(to.time) },
        text,
        color: MEASURE_COLOR,
      },
    ],
  };
}

// Modus-Zustand global (Muster wie tradingAccounts.js) — der Umschalter sitzt in der Statusleiste
// (App.vue, neben "Claude-Notizen"), ausgewertet wird er im Chart (Dashboard.vue -> PriceChart.vue).
// Bewusst nicht persistiert: ein Reload soll nie mitten im Mess-Modus starten.
export const measureModeActive = ref(false);
