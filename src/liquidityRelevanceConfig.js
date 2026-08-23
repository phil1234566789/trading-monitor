// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Nachbesserung 2026-08-23 —
// konfigurierbare Stückzahlen für die "relevante HTF-Liquiditäts-Level"-Auswahl
// (selectRelevantHtfLevels in liquidityDetection.js, aufgerufen von PriceChart.vue:
// computeHtfLiquidityLevels), an einer Stelle statt verstreuter Zahlen-Literale. Ersetzt den
// alten Rezenz-Deckel (filterRelevantLevels' maxRelevant) für den persistierten HTF-Fall
// komplett — Philip wollte Preis-Nähe statt "die letzten paar egal wie weit vom Kurs entfernt".
//
// untouchedAbove/untouchedBelow: die N unberührten Level mit dem geringsten Preis-Abstand über
// bzw. unter dem aktuellen Kurs (Richtung "high"/"low" spielt dabei keine Rolle, nur der Preis).
// recentSwept: die N zuletzt tatsächlich gesweepten Level (nach touchedTime, unabhängig vom Preis).
//
// Node-safe (keine Imports), damit sowohl das Frontend (PriceChart.vue) als auch spätere
// MCP-Server-Nutzung (Lana) dieselbe Konfiguration lesen können, ohne sie zu duplizieren.
export const LQ_RELEVANCE = {
  "1H": { untouchedAbove: 4, untouchedBelow: 4, recentSwept: 4 },
  "4H": { untouchedAbove: 2, untouchedBelow: 2, recentSwept: 4 },
};
