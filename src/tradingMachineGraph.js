// Statische Graph-Form der Backend-Maschine (supabase/functions/trading-monitor-mcp/tradingMachine.ts,
// State-Machine V2, siehe docs/state-machine.md#state-machine-v2) — NICHT die ausführbare XState-
// Maschine selbst (die bleibt Backend-only, kein Shared-Build zwischen Frontend/Deno-Edge-Function,
// siehe CLAUDE.md "Zwei Runtimes"), nur Knoten/Kanten/Labels als Daten fürs Live-Rendering in
// TradingFlow.vue. Von Hand synchron zu tradingMachine.ts gehalten — exakt dieselbe bewusste
// Duplikation wie bei orderBlocks.js/_shared/orderBlocks.ts heute schon Konvention ist.
//
// `id` ist die Mermaid-Knoten-ID (keine Punkte erlaubt); `statePath` ist der echte Dot-Pfad aus
// tradingMachine.ts/currentNodePath() (Default = id, wenn nicht abweichend) — darüber matcht
// buildMermaidSource() den aktuellen Knoten aus trading_loop_state.current_node.
export const NODES = [
  { id: "s1_handelszeit", label: "Schritt 1: Handelszeit" },
  { id: "s2_news", label: "Schritt 2: News" },
  { id: "newsPause", label: "News-Pause (Wecker)" },
  { id: "s3_computing", label: "Schritt 3: Bias berechnen", statePath: "s3_bias.computing" },
  { id: "s3_llm3", label: "Schritt 3: Kontext-Synthese", statePath: "s3_bias.llm3_kontextSynthese", llm: true },
  { id: "s45_entry", label: "Schritt 4/5: Einstieg", statePath: "s45.entry" },
  { id: "s45_mode", label: "Live oder Backtest?", statePath: "s45.mode", gate: true },
  { id: "s45_liveTick", label: "Live: Watch-Level vs. Kurs", statePath: "s45.liveTick" },
  { id: "s45_liveWait", label: "Kein Treffer (Cron in 5 Min)", statePath: "s45.liveWait" },
  { id: "s45_backtestBatch", label: "Kerzen-Batch holen", statePath: "s45.backtestBatch" },
  { id: "s45_newsBlackoutCheck", label: "News-Blackout aktiv?", statePath: "s45.backtestBatch", gate: true },
  { id: "s45_backtestSkip", label: "Batch pausiert (News)", statePath: "s45.backtestSkip" },
  { id: "s45_watchLevelHit", label: "Watch-Level im Batch berührt?", statePath: "s45.watchLevelHit", gate: true },
  { id: "s45_backtestHeartbeat", label: "Kein Treffer -> nächster Batch", statePath: "s45.backtestHeartbeat" },
  { id: "s45_refetch", label: "Voller Refetch", statePath: "s45.refetch" },
  { id: "s45_fallClassification", label: "Fall 1/2/3/4?", statePath: "s45.fallClassification", llm: true },
  { id: "s45_fall3Pin", label: "Fall 3: Watch-Level pinnen", statePath: "s45.fall3Pin" },
  { id: "s45_tscGet", label: "get_tsc_range", statePath: "s45.tscGet" },
  { id: "s45_tscExists", label: "Aktive Range vorhanden?", statePath: "s45.tscExists", gate: true },
  { id: "s45_tscBootstrap", label: "Range bootstrappen", statePath: "s45.tscBootstrap" },
  { id: "s45_tscAdd", label: "Bestätigung anhängen", statePath: "s45.tscAdd" },
  { id: "s45_pinCheck", label: "Stand-alone-Pin vorhanden?", statePath: "s45.pinCheck", gate: true },
  { id: "s45_pinRemove", label: "Pin aufräumen", statePath: "s45.pinRemove" },
  { id: "s45_fallAgainCheck", label: "Fall 1 komplett?", statePath: "s45.fallAgainCheck", llm: true },
  { id: "s45_findTargets", label: "find_targets", statePath: "s45.findTargets" },
  { id: "s45_llmPickTarget", label: "Ziel wählen", statePath: "s45.llmPickTarget", llm: true },
  { id: "s45_addTarget", label: "add_trade_target", statePath: "s45.addTarget" },
  { id: "s45_pinCheck2", label: "Stand-alone-Pin (Target)?", statePath: "s45.pinCheck2", gate: true },
  { id: "s45_pinRemove2", label: "Pin aufräumen", statePath: "s45.pinRemove2" },
  { id: "s45_notify", label: "Benachrichtigen", statePath: "s45.notify" },
  { id: "s6_evidence", label: "Schritt 6: Evidenz sammeln", statePath: "s6_validieren.evidenceGathering" },
  { id: "s6_llm6a", label: "Anti-Confluence-Auswahl", statePath: "s6_validieren.llm6a_antiConfluenceAuswahl", llm: true },
  { id: "s6_llm6", label: "VALIDE/INVALIDE?", statePath: "s6_validieren.llm6_valideInvalide", llm: true },
  { id: "s7_findEntry", label: "Schritt 7: Find Entry (Philip)" },
  { id: "s8_tradeManagement", label: "Schritt 8: Trade-Management" },
  { id: "end_keinTrade", label: "Kein Trade", end: true },
  { id: "end_positionGeschlossen", label: "Position geschlossen", end: true },
];

export const EDGES = [
  { from: "s1_handelszeit", to: "end_keinTrade", label: "außerhalb Handelszeit" },
  { from: "s1_handelszeit", to: "s2_news", label: "innerhalb" },
  { from: "s2_news", to: "newsPause", label: "unmittelbar bevorstehend" },
  { from: "s2_news", to: "s3_computing", label: "frei" },
  { from: "newsPause", to: "s3_computing", label: "Wecker feuert" },
  { from: "s3_computing", to: "s3_llm3" },
  { from: "s3_llm3", to: "s45_entry" },
  { from: "s45_entry", to: "s45_mode" },
  { from: "s45_mode", to: "s45_liveTick", label: "live" },
  { from: "s45_mode", to: "s45_backtestBatch", label: "backtest" },
  { from: "s45_liveTick", to: "s45_refetch", label: "Treffer" },
  { from: "s45_liveTick", to: "s45_liveWait", label: "kein Treffer" },
  { from: "s45_liveWait", to: "s45_mode", label: "nächster Cron-Tick" },
  { from: "s45_backtestBatch", to: "s45_backtestSkip", label: "News-Blackout" },
  { from: "s45_backtestBatch", to: "s45_watchLevelHit", label: "frei" },
  { from: "s45_backtestSkip", to: "s45_backtestBatch", label: "nächster Batch" },
  { from: "s45_watchLevelHit", to: "s45_refetch", label: "Treffer" },
  { from: "s45_watchLevelHit", to: "s45_backtestHeartbeat", label: "kein Treffer" },
  { from: "s45_backtestHeartbeat", to: "s45_backtestBatch", label: "nächster Batch" },
  { from: "s45_refetch", to: "s45_fallClassification" },
  { from: "s45_fallClassification", to: "s45_tscGet", label: "Fall 1/2" },
  { from: "s45_fallClassification", to: "s45_fall3Pin", label: "Fall 3 (auto)" },
  { from: "s45_fallClassification", to: "s3_computing", label: "Fall 4 (auto)" },
  { from: "s45_fall3Pin", to: "s45_entry" },
  { from: "s45_tscGet", to: "s45_tscExists" },
  { from: "s45_tscExists", to: "s45_tscAdd", label: "ja" },
  { from: "s45_tscExists", to: "s45_tscBootstrap", label: "nein" },
  { from: "s45_tscBootstrap", to: "s45_pinCheck" },
  { from: "s45_tscAdd", to: "s45_pinCheck" },
  { from: "s45_pinCheck", to: "s45_pinRemove", label: "ja" },
  { from: "s45_pinCheck", to: "s45_fallAgainCheck", label: "nein" },
  { from: "s45_pinRemove", to: "s45_fallAgainCheck" },
  { from: "s45_fallAgainCheck", to: "s45_findTargets", label: "ja (Fall 1)" },
  { from: "s45_fallAgainCheck", to: "s45_entry", label: "nein (Fall 2)" },
  { from: "s45_findTargets", to: "s45_llmPickTarget" },
  { from: "s45_llmPickTarget", to: "s45_addTarget" },
  { from: "s45_addTarget", to: "s45_pinCheck2" },
  { from: "s45_pinCheck2", to: "s45_pinRemove2", label: "ja" },
  { from: "s45_pinCheck2", to: "s45_notify", label: "nein" },
  { from: "s45_pinRemove2", to: "s45_notify" },
  { from: "s45_notify", to: "s6_evidence" },
  { from: "s6_evidence", to: "s6_llm6a" },
  { from: "s6_llm6a", to: "s6_llm6" },
  { from: "s6_llm6", to: "s7_findEntry", label: "VALIDE" },
  { from: "s6_llm6", to: "s45_entry", label: "INVALIDE" },
  { from: "s7_findEntry", to: "s8_tradeManagement" },
  { from: "s8_tradeManagement", to: "end_positionGeschlossen" },
];

function mermaidEscape(text) {
  return text.replace(/"/g, "&quot;");
}

// Baut den Mermaid-Flowchart-Text, mit `class active` auf dem Knoten, dessen statePath dem
// übergebenen current_node (Dot-Pfad aus trading_loop_state.current_node) entspricht. Fehlt
// currentNode (kein aktiver Loop) oder passt keiner (Loop von vor State-Machine V2), wird einfach
// nichts hervorgehoben.
export function buildMermaidSource(currentNode) {
  const lines = ["flowchart TB"];
  for (const node of NODES) {
    const shape = node.end ? `(["${mermaidEscape(node.label)}"])` : node.gate ? `{"${mermaidEscape(node.label)}"}` : `["${mermaidEscape(node.label)}"]`;
    lines.push(`  ${node.id}${shape}`);
  }
  for (const edge of EDGES) {
    lines.push(edge.label ? `  ${edge.from} -->|${mermaidEscape(edge.label)}| ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  lines.push("  classDef llmNode fill:#fdeee0,stroke:#c97a2b,stroke-width:2px,color:#6b3d0f;");
  lines.push("  classDef activeNode fill:#2962ff,stroke:#5b8dff,stroke-width:3px,color:#ffffff;");
  lines.push("  classDef endNode fill:transparent,stroke-width:1.5px;");
  const llmIds = NODES.filter((n) => n.llm).map((n) => n.id);
  if (llmIds.length > 0) lines.push(`  class ${llmIds.join(",")} llmNode;`);
  const endIds = NODES.filter((n) => n.end).map((n) => n.id);
  if (endIds.length > 0) lines.push(`  class ${endIds.join(",")} endNode;`);
  const active = currentNode ? NODES.find((n) => (n.statePath ?? n.id) === currentNode) : null;
  if (active) lines.push(`  class ${active.id} activeNode;`);
  return lines.join("\n");
}
