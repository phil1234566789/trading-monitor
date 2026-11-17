// Historische Trefferquoten je Ziel (PLAN-dr-statistik-ui.md) — bewusst eine Nachschlagetabelle
// statt Serverarbeit: die Vergleichsgruppe ist ein FESTES Risiko-Band, kein pro-DR gebildeter
// Schnitt, und ein weiterer Monat verschiebt eine Quote um 1-2 Punkte (volle Begründung im PLAN
// unter "Warum statisch und nicht über eine dr_reach-Tabelle").
//
// Hieß bis 22.09.2026 rScaleQuotes.js, als hier nur die R-Leiter für die Chart-Skala stand — mit
// der Pip-Leiter ist "R-Skala" nicht mehr der Rahmen.
//
// Eigene Datei neben rScale.js: dort steht reine Geometrie, hier Empirie mit eigenem
// Aktualisierungszyklus — aktualisieren heißt analysis/dr-reichweite/baenderTabellen.py laufen
// lassen und die Konstanten unten ersetzen.

// Gemessen wurde ausschließlich GBPUSD; EURUSD bleibt bewusst ungemessen (Philip 20.09.2026).
// Ohne diesen Guard zeigte der Chart dort Zahlen, die für das Instrument nie gerechnet wurden.
const QUOTEN_INSTRUMENT = "GBPUSD";

// Einordnung für JEDE Anzeige dieser Zahlen (Chart-Toggle in Dashboard.vue, TSC-Block) — steht
// hier neben den Tabellen, damit sie beim nächsten Messlauf mit ihnen zusammen nachgezogen wird:
// getrennt gehalten war sie genau das schon einmal nicht (der Chart-Tooltip nannte noch 915 Ranges
// aus Jan-Sep 2026, als die Tabellen längst auf 3179 aus 2025+2026 standen).
export const QUOTEN_HERKUNFT =
  "Historische Häufigkeiten, keine Wahrscheinlichkeiten: 3179 GBPUSD-Dealing-Ranges, Januar 2025 bis September 2026. " +
  "Die 2026er Hälfte ist live erkannt, die 2025er aus einer Simulation über das Archiv — nicht deckungsgleich erhoben. " +
  "EURUSD ist ungemessen, dort steht keine Quote.";

// riskPips ist überall hier das STRUKTURELLE Risiko (rScale.js: bandRisk), nicht das gedeckelte:
// das Band beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
// Das kleinste Band hat n=447, die 50er-Schwelle (Philip: "glaub 50 reichen mir für ne
// Prozentanzahl") ist also mit Abstand erfüllt — ein feinerer Schnitt müsste sie neu prüfen.

// Tabelle 5 aus ergebnis-baender.txt: Stopp auf 6 Pips gedeckelt (rScale.js: STOPP_DECKEL_PIPS).
const R_BAENDER = [
  { hi: 3, quoten: { 2: 77, 3: 66, 4: 54, 5: 48, 6: 42, 7: 38, 8: 33, 9: 30, 10: 28 } },
  { hi: 5, quoten: { 2: 72, 3: 57, 4: 47, 5: 40, 6: 34, 7: 30, 8: 25, 9: 23, 10: 21 } },
  { hi: 7, quoten: { 2: 68, 3: 54, 4: 43, 5: 36, 6: 29, 7: 26, 8: 23, 9: 21, 10: 19 } },
  { hi: 10, quoten: { 2: 66, 3: 49, 4: 40, 5: 35, 6: 29, 7: 25, 8: 22, 9: 20, 10: 17 } },
  { hi: Infinity, quoten: { 2: 69, 3: 53, 4: 43, 5: 36, 6: 32, 7: 26, 8: 23, 9: 19, 10: 17 } },
];

// Tabelle 6, ergänzt 22.09.2026 — dasselbe Feld wie Tabelle 5, nur in Pips statt in R gemessen,
// und gegen DENSELBEN gedeckelten Stopp. Die ungedeckelten Zahlen (Tabelle 1) wären hier falsch:
// beide Leitern stehen im TSC nebeneinander und dürfen nicht zwei verschiedene Fragen beantworten.
const PIP_BAENDER = [
  { hi: 3, quoten: { 10: 53, 15: 38, 20: 30, 25: 25, 30: 22, 35: 19, 40: 16 } },
  { hi: 5, quoten: { 10: 63, 15: 49, 20: 40, 25: 32, 30: 27, 35: 24, 40: 21 } },
  { hi: 7, quoten: { 10: 74, 15: 59, 20: 49, 25: 40, 30: 35, 35: 29, 40: 26 } },
  { hi: 10, quoten: { 10: 72, 15: 58, 20: 47, 25: 39, 30: 35, 35: 30, 40: 27 } },
  { hi: Infinity, quoten: { 10: 77, 15: 59, 20: 50, 25: 42, 30: 36, 35: 32, 40: 28 } },
];

function quoteAusBaendern(baender, instrument, riskPips, ziel) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return baender.find((b) => riskPips <= b.hi)?.quoten[ziel] ?? null;
}

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0, Ziel
// außerhalb der Tabelle). Der Aufrufer zeigt dann nur die Zielzahl bzw. gar nichts.
export function rQuote(instrument, riskPips, r) {
  return quoteAusBaendern(R_BAENDER, instrument, riskPips, r);
}

export function pipQuote(instrument, riskPips, pips) {
  return quoteAusBaendern(PIP_BAENDER, instrument, riskPips, pips);
}

// Label einer Chart-Marke (rScale.js, pipScale.js): Ziel allein, oder Ziel + Quote. Hier statt in
// den beiden Leitern, damit sie dieselbe Schreibweise benutzen.
export function labelMitQuote(ziel, quote) {
  return quote == null ? ziel : `${ziel} – ${quote} %`;
}
