// Debug-Metadaten-Sammel-Panel (siehe PriceChart.vue: buildActiveMetadataSnapshot, Chat
// 2026-07-20: "damit ich dir nicht ständig die Daten von dem was ich in TradingView sehe hier
// schreiben muss"). Die Gating-Logik ("nur metadaten von den features im Menü, wenn sie
// angetoggelt sind") lebt bewusst hier als reine Funktion statt nur inline im Vue-Setup, damit sie
// sich ohne Chart/lightweight-charts/Component-Mount testen lässt (siehe test/debugMetadata.test.js,
// Chat: "hast du einen unit test geschrieben, welcher testet, dass nur metadaten von aktiven
// features beinhaltet sein sollen?").

// context (Symbol/Timeframe/Replay) und orderBlocks laufen IMMER mit, unabhängig von toggles —
// context, weil ein kopiertes Objekt sonst nicht einzuordnen ist (Chat: "fehlt ... replaymodus
// inputs, TF, Währungspaar"), orderBlocks, weil POI-/OB-Zonen anders als Liquidität/Trade-Setups/
// Structure keinen eigenen An/Aus-Schalter in der Toolbar haben.
export function selectActiveMetadataSections(toggles, sections) {
  const result = { context: sections.context, orderBlocks: sections.orderBlocks ?? [] };
  if (toggles.showLiquidity) result.liquidity = sections.liquidity ?? [];
  if (toggles.showTradeSetups) result.tradeSetups = sections.tradeSetups ?? [];
  if (toggles.showTradeSetupCockpit) result.tradeSetupCockpit = sections.tradeSetupCockpit ?? null;
  if (toggles.showRanges) result.structure = sections.structure ?? null;
  return result;
}

// "Option A" (Chat 2026-07-20): statt eines Schiebereglers oder eigenen Fetches sucht die App
// selbst den frühesten Zeitpunkt, auf den irgendeine AKTIVE Sektion verweist (z.B. eine OB-Zone
// mit startTime, ein Structure-Pivot mit pivotTime, ein Trade-Setup-Fraktal) — ab dort werden
// Kerzen mitgeliefert. times enthält je Sektion schon die vorab extrahierten Rohzeitpunkte (siehe
// PriceChart.vue), orderBlocks-Zeiten zählen ungated immer, der Rest nur bei aktivem Toggle.
export function earliestRelevantTime(toggles, times) {
  const relevant = [...(times.orderBlocks ?? [])];
  if (toggles.showLiquidity) relevant.push(...(times.liquidity ?? []));
  if (toggles.showTradeSetups) relevant.push(...(times.tradeSetups ?? []));
  if (toggles.showRanges) relevant.push(...(times.structure ?? []));
  const finite = relevant.filter((t) => typeof t === "number" && Number.isFinite(t));
  return finite.length > 0 ? Math.min(...finite) : null;
}
