// Historische Trefferquoten je Ziel (PLAN-dr-statistik-ui.md) — bewusst eine Nachschlagetabelle
// statt Serverarbeit: die Vergleichsgruppe ist ein FESTES Risiko-Band, kein pro-DR gebildeter
// Schnitt, und ein weiterer Monat verschiebt eine Quote um 1-2 Punkte (volle Begründung im PLAN
// unter "Warum statisch und nicht über eine dr_reach-Tabelle").
//
// Hieß bis 22.09.2026 rScaleQuotes.js, als hier nur die R-Leiter für die Chart-Skala stand — mit
// der Pip-Leiter und der FVG-Tabelle ist "R-Skala" nicht mehr der Rahmen.
//
// Die beiden Quoten-Leitern fürs TSC (drQuotenBlock samt Vergleichszeile) standen bis 23.09.2026
// hier und sind ersatzlos raus (Philip: "das alte zeug zur statistik im TSC muss weg") — die
// Einordnung macht jetzt fvgBewertung im Bewertungs-Bereich.
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

// --- Zweiter Schnitt: FVG-Groesse (gemessen 23.09.2026, siehe PLAN "Die FVG-Groesse") ----------
// Dieselben 3179 Ranges, nur anders gruppiert: nach der Luecke, die den bestaetigenden M5-OB
// ausgemacht hat. Staerkstes Einzelmerkmal bisher, und es haelt in R (47 auf 91 % bei 3 R,
// Bootstrap +37 bis +50 Punkte) — anders als Saisonalitaet oder Handelszeit also nicht bloss
// Volatilitaet. Quelle: analysis/dr-reichweite/ergebnis-fvg.txt, Tabelle 1.
//
// ACHTUNG BEIM ANZEIGEN: das ist ein ZWEITER Schnitt derselben Grundgesamtheit, keine
// Verfeinerung des Risiko-Bands. Die beiden Quoten sind nicht kombinierbar ("enge Range UND grosse
// FVG" ist ungemessen) — sie duerfen nebeneinander stehen, aber nicht multipliziert oder als
// Filterkette gelesen werden.
//
// Bandgrenzen inklusiv unten, exklusiv oben (lo <= FVG < hi), wie in fvgBaender.py -- und damit
// ANDERS herum als bei den Risiko-Baendern oben, weil die Untergrenze hier die harte
// Erkennungsschwelle von 0,5 Pip ist und ins erste Band gehoert.
// Das kleinste Band hat n=98, die 50er-Schwelle ist erfuellt; ein feinerer Schnitt muesste sie neu
// pruefen.
const FVG_BAENDER = [
  { hi: 1, r: { 2: 61, 3: 47, 4: 37, 5: 32, 6: 26, 7: 22, 8: 18, 9: 17, 10: 15 }, pip: { 10: 56, 15: 42, 20: 33, 25: 27, 30: 23, 35: 19, 40: 17 } },
  { hi: 2, r: { 2: 68, 3: 52, 4: 43, 5: 36, 6: 31, 7: 28, 8: 25, 9: 22, 10: 20 }, pip: { 10: 65, 15: 50, 20: 39, 25: 33, 30: 28, 35: 25, 40: 22 } },
  { hi: 3, r: { 2: 72, 3: 57, 4: 47, 5: 40, 6: 34, 7: 30, 8: 27, 9: 24, 10: 22 }, pip: { 10: 69, 15: 54, 20: 44, 25: 37, 30: 32, 35: 28, 40: 26 } },
  { hi: 5, r: { 2: 79, 3: 62, 4: 50, 5: 42, 6: 36, 7: 31, 8: 28, 9: 25, 10: 21 }, pip: { 10: 82, 15: 64, 20: 52, 25: 44, 30: 38, 35: 32, 40: 29 } },
  { hi: 8, r: { 2: 89, 3: 74, 4: 64, 5: 51, 6: 44, 7: 38, 8: 33, 9: 31, 10: 27 }, pip: { 10: 91, 15: 73, 20: 66, 25: 55, 30: 45, 35: 39, 40: 33 } },
  { hi: Infinity, r: { 2: 99, 3: 90, 4: 82, 5: 77, 6: 70, 7: 62, 8: 51, 9: 47, 10: 42 }, pip: { 10: 100, 15: 96, 20: 89, 25: 77, 30: 71, 35: 65, 40: 59 } },
];

// Besetzung je Band, fuer die Einordnung neben der Quote (ein Band mit n=98 traegt weniger als
// eines mit n=972). Reihenfolge wie FVG_BAENDER.
export const FVG_BAND_N = [952, 946, 516, 473, 201, 91];

// Beschriftung der Baender, Reihenfolge wie FVG_BAENDER. Steht hier statt im Bauteil, damit die
// Grenzen an EINER Stelle gepflegt werden: eine verschobene hi-Grenze ohne passendes Label waere
// eine still falsche Anzeige.
const FVG_BAND_LABELS = ["unter 1 P", "1–2 P", "2–3 P", "3–5 P", "5–8 P", "über 8 P"];

// Die sechs Ziele der Bewertungstabelle, in Anzeigereihenfolge. Drei R-Stufen und drei
// Pip-Stufen nebeneinander (Philip 2026-09-23), weil ein Merkmal je nach Leiter unterschiedlich
// weit traegt — die FVG verliert mit steigendem Ziel an Vorsprung, das sieht man nur so.
const FVG_ZIELE = [
  { label: "3R", einheit: "R", ziel: 3 },
  { label: "5R", einheit: "R", ziel: 5 },
  { label: "8R", einheit: "R", ziel: 8 },
  { label: "20P", einheit: "P", ziel: 20 },
  { label: "30P", einheit: "P", ziel: 30 },
  { label: "40P", einheit: "P", ziel: 40 },
];

// Referenzzeile "alle Setups" — der mit FVG_BAND_N gewichtete Mittelwert der Baender oben, NICHT
// eine separat gemessene Zahl: so bleibt sie garantiert aus demselben Messlauf wie die Baender und
// liegt per Konstruktion in deren Mitte. Eine fremd gemessene Zeile waere nach dem naechsten
// Backfill still inkonsistent. Reihenfolge wie FVG_ZIELE.
const FVG_REFERENZ = [55, 38, 25, 43, 31, 24];

function fvgBandIndex(fvgPips) {
  const i = FVG_BAENDER.findIndex((b) => fvgPips < b.hi);
  return i === -1 ? FVG_BAENDER.length - 1 : i;
}

// Die ganze Tabelle fuer den Bewertungs-Bereich: ALLE Baender (nicht nur das eigene), damit die
// Einordnung sichtbar ist, und ein Treffer-Flag auf dem Band der laufenden Dealing Range. null,
// sobald nichts Gemessenes vorliegt (anderes Instrument) — der Aufrufer blendet dann aus, statt
// leere Zellen zu zeigen. fvgPips darf null sein: dann steht die Tabelle ohne Markierung da.
export function fvgBewertung(instrument, fvgPips) {
  if (instrument !== QUOTEN_INSTRUMENT) return null;
  const treffer = fvgPips > 0 ? fvgBandIndex(fvgPips) : -1;
  return {
    ziele: FVG_ZIELE,
    referenz: FVG_REFERENZ,
    baender: FVG_BAENDER.map((b, i) => ({
      label: FVG_BAND_LABELS[i],
      n: FVG_BAND_N[i],
      treffer: i === treffer,
      quoten: FVG_ZIELE.map((z) => (z.einheit === "P" ? b.pip : b.r)[z.ziel] ?? null),
    })),
  };
}


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
