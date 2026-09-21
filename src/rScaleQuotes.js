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

// Tabelle 5 aus analysis/dr-reichweite/ergebnis-baender.txt, 915 Dealing Ranges Jan-Sep 2026:
// Stopp auf STOPP_DECKEL_PIPS gedeckelt, wie die Skala selbst rechnet. Die ungedeckelte Tabelle 1
// von vorher war eine ANDERE Messung, keine andere Skalierung — mit Deckel fällt der Stopp, während
// die Range strukturell noch lebt.
// riskPips ist das STRUKTURELLE Risiko (rScale.js: bandRisk), nicht das gedeckelte: das Band
// beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
const BAENDER = [
  { hi: 3, quoten: { 2: 82, 3: 72, 4: 61, 5: 55, 6: 47, 7: 38, 8: 34, 9: 32, 10: 28 } },
  { hi: 5, quoten: { 2: 78, 3: 60, 4: 49, 5: 41, 6: 36, 7: 33, 8: 27, 9: 25, 10: 23 } },
  { hi: 7, quoten: { 2: 75, 3: 59, 4: 47, 5: 41, 6: 36, 7: 32, 8: 29, 9: 25, 10: 22 } },
  { hi: 10, quoten: { 2: 66, 3: 52, 4: 44, 5: 38, 6: 31, 7: 29, 8: 22, 9: 19, 10: 16 } },
  { hi: Infinity, quoten: { 2: 71, 3: 53, 4: 46, 5: 37, 6: 32, 7: 29, 8: 24, 9: 22, 10: 17 } },
];

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0,
// R-Stufe außerhalb der Tabelle). Der Aufrufer zeigt dann nur die R-Zahl.
export function rQuote(instrument, riskPips, r) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return BAENDER.find((b) => riskPips <= b.hi)?.quoten[r] ?? null;
}
