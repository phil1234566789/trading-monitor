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

// Tabelle 5 aus ergebnis-baender.txt: 3282 FXCM-Dealing-Ranges, Januar 2025 bis September 2026.
// Stopp auf 6 Pips gedeckelt; neu gerechnet nach dem Quellenwechsel.
// riskPips ist das STRUKTURELLE Risiko (rScale.js: bandRisk), nicht das gedeckelte: das Band
// beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
const BAENDER = [
  { hi: 3, quoten: { 2: 77, 3: 66, 4: 54, 5: 48, 6: 42, 7: 38, 8: 33, 9: 30, 10: 28 } },
  { hi: 5, quoten: { 2: 73, 3: 57, 4: 47, 5: 40, 6: 34, 7: 30, 8: 26, 9: 23, 10: 21 } },
  { hi: 7, quoten: { 2: 68, 3: 54, 4: 43, 5: 36, 6: 30, 7: 26, 8: 23, 9: 21, 10: 19 } },
  { hi: 10, quoten: { 2: 66, 3: 49, 4: 40, 5: 35, 6: 29, 7: 25, 8: 22, 9: 20, 10: 17 } },
  { hi: Infinity, quoten: { 2: 70, 3: 55, 4: 45, 5: 38, 6: 32, 7: 27, 8: 23, 9: 20, 10: 18 } },
];

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0,
// R-Stufe außerhalb der Tabelle). Der Aufrufer zeigt dann nur die R-Zahl.
export function rQuote(instrument, riskPips, r) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return BAENDER.find((b) => riskPips <= b.hi)?.quoten[r] ?? null;
}
