// Historische Trefferquoten je R-Marke (PLAN-dr-statistik-ui.md, Stufe 2) — bewusst eine
// Nachschlagetabelle statt Serverarbeit: die Vergleichsgruppe ist ein FESTES Risiko-Band, kein
// pro-DR gebildeter Schnitt, und ein weiterer Monat verschiebt eine Quote um 1-2 Punkte (volle
// Begründung im PLAN unter "Warum statisch und nicht über eine dr_reach-Tabelle").
//
// Eigene Datei neben rScale.js: dort steht reine Geometrie, hier Empirie mit eigenem
// Aktualisierungszyklus — aktualisieren heißt analysis/dr-reichweite/baenderTabellen.py laufen
// lassen und die Konstante unten ersetzen.

// Gemessen wurde ausschließlich GBPUSD; EURUSD bleibt bewusst ungemessen (Philip 20.09.2026).
// Ohne diesen Guard zeigte der Chart dort Zahlen, die für das Instrument nie gerechnet wurden.
export const QUOTEN_INSTRUMENT = "GBPUSD";

// Tabelle 5 aus ergebnis-baender.txt: 1361 FXCM-Dealing-Ranges, Jan–Sep 2026.
// Stopp auf 6 Pips gedeckelt; neu gerechnet nach dem Quellenwechsel.
// riskPips ist das STRUKTURELLE Risiko (rScale.js: bandRisk), nicht das gedeckelte: das Band
// beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
const BAENDER = [
  { hi: 3, quoten: { 2: 77, 3: 64, 4: 52, 5: 44, 6: 38, 7: 34, 8: 29, 9: 26, 10: 24 } },
  { hi: 5, quoten: { 2: 74, 3: 59, 4: 50, 5: 43, 6: 37, 7: 31, 8: 25, 9: 23, 10: 22 } },
  { hi: 7, quoten: { 2: 70, 3: 55, 4: 45, 5: 38, 6: 31, 7: 27, 8: 24, 9: 21, 10: 19 } },
  { hi: 10, quoten: { 2: 65, 3: 47, 4: 39, 5: 36, 6: 28, 7: 26, 8: 21, 9: 18, 10: 15 } },
  { hi: Infinity, quoten: { 2: 74, 3: 56, 4: 45, 5: 39, 6: 33, 7: 28, 8: 24, 9: 22, 10: 19 } },
];

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0,
// R-Stufe außerhalb der Tabelle). Der Aufrufer zeigt dann nur die R-Zahl.
export function rQuote(instrument, riskPips, r) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return BAENDER.find((b) => riskPips <= b.hi)?.quoten[r] ?? null;
}
