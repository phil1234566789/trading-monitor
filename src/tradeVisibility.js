// Einheitliche Sichtbarkeits-Regel für alles, was zu einem Trade gehört (Setup-Box, Invalidierung,
// Targets, Bestätigungen) — genutzt sowohl vom eigenen Zeichenpfad in PriceChart.vue als auch vom
// Pin-Highlight-Pfad in Dashboard.vue (siehe Task "1H-Struktur-Pivots auf kanonische
// liquidity_levels-ID konsolidieren", 2026-08-24/25).
//
// Code-Review Philip 2026-08-25: dieselbe Regel (showTradeSetups UND showTrades) stand vorher
// viermal wortgleich in PriceChart.vue da (refreshTradeSetupLinksInternal/-TradeTargetLinksInternal/
// -TradeConfirmationLinksInternal/-InvalidationLinesInternal) und wurde beim neuen
// Dashboard.vue-Pfad für Pivot-Targets/-Bestätigungen prompt ein fünftes Mal separat nachgebaut,
// mit demselben Risiko, beim nächsten Feature auseinanderzudriften — eine gemeinsame Funktion macht
// das strukturell unmöglich statt nur unwahrscheinlicher.
export function tradesVisible(showTradeSetups, showTrades) {
  return showTradeSetups && showTrades;
}
