// Historische Trefferquoten je Ziel (PLAN-dr-statistik-ui.md) — bewusst eine Nachschlagetabelle
// statt Serverarbeit: die Vergleichsgruppe ist ein FESTES Risiko-Band, kein pro-DR gebildeter
// Schnitt, und ein weiterer Monat verschiebt eine Quote um 1-2 Punkte (volle Begründung im PLAN
// unter "Warum statisch und nicht über eine dr_reach-Tabelle").
//
// Hieß bis 22.09.2026 rScaleQuotes.js, als hier nur die R-Leiter für die Chart-Skala stand — mit
// der Pip-Leiter und der Vergleichszeile fürs TSC ist "R-Skala" nicht mehr der Rahmen.
//
// Eigene Datei neben rScale.js: dort steht reine Geometrie, hier Empirie mit eigenem
// Aktualisierungszyklus — aktualisieren heißt analysis/dr-reichweite/baenderTabellen.py laufen
// lassen und die Konstanten unten ersetzen.

// Gemessen wurde ausschließlich GBPUSD; EURUSD bleibt bewusst ungemessen (Philip 20.09.2026).
// Ohne diesen Guard zeigte der Chart dort Zahlen, die für das Instrument nie gerechnet wurden.
export const QUOTEN_INSTRUMENT = "GBPUSD";

// Einordnung für JEDE Anzeige dieser Zahlen (Chart-Toggle in Dashboard.vue, TSC-Block) — steht
// hier neben den Tabellen, damit sie beim nächsten Messlauf mit ihnen zusammen nachgezogen wird:
// getrennt gehalten war sie genau das schon einmal nicht (der Chart-Tooltip nannte noch 915 Ranges
// aus Jan-Sep 2026, als die Tabellen längst auf 3282 aus 2025+2026 standen).
export const QUOTEN_HERKUNFT =
  "Historische Häufigkeiten, keine Wahrscheinlichkeiten: 3282 GBPUSD-Dealing-Ranges, Januar 2025 bis September 2026. " +
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
  { hi: 5, quoten: { 2: 73, 3: 57, 4: 47, 5: 40, 6: 34, 7: 30, 8: 26, 9: 23, 10: 21 } },
  { hi: 7, quoten: { 2: 68, 3: 54, 4: 43, 5: 36, 6: 30, 7: 26, 8: 23, 9: 21, 10: 19 } },
  { hi: 10, quoten: { 2: 66, 3: 49, 4: 40, 5: 35, 6: 29, 7: 25, 8: 22, 9: 20, 10: 17 } },
  { hi: Infinity, quoten: { 2: 70, 3: 55, 4: 45, 5: 38, 6: 32, 7: 27, 8: 23, 9: 20, 10: 18 } },
];

// Tabelle 6, ergänzt 22.09.2026 — dasselbe Feld wie Tabelle 5, nur in Pips statt in R gemessen,
// und gegen DENSELBEN gedeckelten Stopp. Die ungedeckelten Zahlen (Tabelle 1) wären hier falsch:
// beide Leitern stehen im TSC nebeneinander und dürfen nicht zwei verschiedene Fragen beantworten.
const PIP_BAENDER = [
  { hi: 3, quoten: { 10: 53, 15: 38, 20: 30, 25: 25, 30: 22, 35: 19, 40: 16 } },
  { hi: 5, quoten: { 10: 64, 15: 49, 20: 40, 25: 33, 30: 28, 35: 24, 40: 21 } },
  { hi: 7, quoten: { 10: 74, 15: 59, 20: 49, 25: 40, 30: 35, 35: 29, 40: 26 } },
  { hi: 10, quoten: { 10: 72, 15: 58, 20: 46, 25: 39, 30: 35, 35: 30, 40: 27 } },
  { hi: Infinity, quoten: { 10: 77, 15: 61, 20: 52, 25: 44, 30: 38, 35: 33, 40: 29 } },
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

// Vergleichszeilen zur Band-Zeile (Tabelle 2) — bewusst NICHT nach Risiko-Band geschnitten: die
// Gruppe hat insgesamt n=188, eine Aufteilung nach Band fiele unter die 50er-Schwelle. Als Record
// je Gruppe statt als eine einzelne "reif"-Funktion, weil die Gegenkraft-Zeile (das stärkere
// Merkmal, aber mit ungelöster Vorbedingung, siehe PLAN) als zweiter Eintrag danebenpassen soll.
//
// ACHTUNG: die R-Spalten von Tabelle 2 sind UNGEDECKELT (Stopp = Invalidierung), die Leitern oben
// gedeckelt. Die Zeile trägt deshalb eine Richtung, keinen sauberen 1:1-Vergleich — und der
// Alters-Effekt ist auf der größeren Stichprobe ohnehin geschrumpft (bei 15 Pips von +25 Punkten
// auf +10, Intervall [3, 17]). Nüchtern darstellen, nicht als der große Hebel.
const VERGLEICHSGRUPPEN = {
  reif: {
    label: "Mit reifem Sweep (≥ 24 h)",
    pip: { 10: 78, 15: 66, 20: 55, 25: 46, 30: 41 },
    r: { 2: 58, 3: 44, 4: 33, 6: 19 },
  },
};

// Angezeigte Stufen im TSC-Block — vier je Leiter, mehr als das passt nicht in die 360px-Spalte.
// Die Vergleichszeile zeigt nur je ein Ziel, sonst stünden zwei volle Leitern untereinander und
// die eigene Zeile ginge optisch unter.
const PIP_ZIELE = [10, 15, 20, 30];
const R_ZIELE = [2, 3, 4, 6];
const VERGLEICH_PIP_ZIEL = 15;
const VERGLEICH_R_ZIEL = 3;

function leiter(quoteFn, instrument, riskPips, ziele, einheit) {
  const stufen = ziele.map((ziel) => ({ ziel, einheit, quote: quoteFn(instrument, riskPips, ziel) }));
  return stufen.some((s) => s.quote == null) ? null : stufen;
}

// Der fertige Block zur laufenden Dealing Range: beide Leitern für ihr Risiko-Band und — nur bei
// einem Minor-Sweep — die Vergleichszeile dazu (bei einem schon reifen Sweep wiederholt sie bloß
// die Leitern darüber). null, sobald für eine der Stufen nichts Gemessenes vorliegt (EURUSD,
// Risiko <= 0): der Aufrufer blendet dann den ganzen Block aus, statt leere Zellen zu zeigen.
// sweepTier kommt als AgeTier herein (ageTier.ts), damit hier keine zweite Alters-Einstufung
// entsteht — die Einstufung der Sweep-Zeile selbst ist die maßgebliche.
export function drQuotenBlock(instrument, riskPips, sweepTier) {
  const pipLeiter = leiter(pipQuote, instrument, riskPips, PIP_ZIELE, "P");
  const rLeiter = leiter(rQuote, instrument, riskPips, R_ZIELE, "R");
  if (!pipLeiter || !rLeiter) return null;
  const reif = sweepTier === "minor" ? VERGLEICHSGRUPPEN.reif : null;
  return {
    pipLeiter,
    rLeiter,
    vergleich: reif
      ? {
          label: reif.label,
          stufen: [
            { ziel: VERGLEICH_PIP_ZIEL, einheit: "P", quote: reif.pip[VERGLEICH_PIP_ZIEL] },
            { ziel: VERGLEICH_R_ZIEL, einheit: "R", quote: reif.r[VERGLEICH_R_ZIEL] },
          ],
        }
      : null,
  };
}
