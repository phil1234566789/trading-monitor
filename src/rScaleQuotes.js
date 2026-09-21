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

// Tabelle 5 aus analysis/dr-reichweite/ergebnis-baender.txt, 1314 Dealing Ranges Jan-Sep 2026
// (921 mehr als in der Fassung vom 20.09., weil die Erkennung seit dem 21.09. nicht mehr auf die
// Fraktal-Bestätigung wartet — dieselbe Stichprobe, nur früher erkannt und dadurch größer):
// Stopp auf STOPP_DECKEL_PIPS gedeckelt, wie die Skala selbst rechnet. Die ungedeckelte Tabelle 1
// von vorher war eine ANDERE Messung, keine andere Skalierung — mit Deckel fällt der Stopp, während
// die Range strukturell noch lebt.
// riskPips ist das STRUKTURELLE Risiko (rScale.js: bandRisk), nicht das gedeckelte: das Band
// beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
const BAENDER = [
  { hi: 3, quoten: { 2: 75, 3: 63, 4: 50, 5: 44, 6: 38, 7: 31, 8: 28, 9: 26, 10: 23 } },
  { hi: 5, quoten: { 2: 74, 3: 57, 4: 47, 5: 39, 6: 34, 7: 30, 8: 25, 9: 22, 10: 21 } },
  { hi: 7, quoten: { 2: 73, 3: 58, 4: 46, 5: 39, 6: 33, 7: 30, 8: 26, 9: 24, 10: 21 } },
  { hi: 10, quoten: { 2: 66, 3: 50, 4: 43, 5: 37, 6: 31, 7: 29, 8: 23, 9: 21, 10: 18 } },
  { hi: Infinity, quoten: { 2: 72, 3: 56, 4: 47, 5: 39, 6: 33, 7: 28, 8: 25, 9: 23, 10: 17 } },
];

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0,
// R-Stufe außerhalb der Tabelle). Der Aufrufer zeigt dann nur die R-Zahl.
export function rQuote(instrument, riskPips, r) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return BAENDER.find((b) => riskPips <= b.hi)?.quoten[r] ?? null;
}
