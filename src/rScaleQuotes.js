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

// Tabelle 1 aus analysis/dr-reichweite/ergebnis-baender.txt, 915 Dealing Ranges Jan-Sep 2026.
// Bandgrenzen exklusiv unten, inklusiv oben (lo < Risiko <= hi), wie in baenderTabellen.py.
const BAENDER = [
  { hi: 3, quoten: { 2: 82, 3: 72, 4: 61, 5: 55, 6: 48 } },
  { hi: 5, quoten: { 2: 78, 3: 60, 4: 49, 5: 41, 6: 35 } },
  { hi: 7, quoten: { 2: 74, 3: 57, 4: 44, 5: 38, 6: 33 } },
  { hi: 10, quoten: { 2: 60, 3: 46, 4: 36, 5: 28, 6: 21 } },
  { hi: Infinity, quoten: { 2: 49, 3: 36, 4: 26, 5: 22, 6: 13 } },
];

// Quote in Prozent, oder null wenn nichts Gemessenes passt (anderes Instrument, Risiko <= 0,
// R-Stufe außerhalb der Tabelle). Der Aufrufer zeigt dann nur die R-Zahl.
export function rQuote(instrument, riskPips, r) {
  if (instrument !== QUOTEN_INSTRUMENT || !(riskPips > 0)) return null;
  return BAENDER.find((b) => riskPips <= b.hi)?.quoten[r] ?? null;
}
