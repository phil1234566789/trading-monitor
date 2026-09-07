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
//
// `hint`/`nextTool` (06.09.2026, Philip: "woher weiß Lana, welche Tool-Aufrufe sie gerade machen
// soll?") — Frontend-Pendant zur Knoten-Zuordnung im Backend
// (supabase/functions/trading-monitor-mcp/nextActionMap.ts, get_next_action-Tool), dieselbe
// bewusste Zwei-Runtimes-Duplizierung wie orderBlocks.js/orderBlocks.ts. Nur an den Knoten gesetzt,
// die tatsächlich als Ruhepunkt zwischen zwei Tool-Aufrufen beobachtet werden — reine
// Zwischenknoten (innerhalb eines einzigen Tool-Aufrufs automatisch durchlaufen) bleiben ohne
// hint/nextTool, TradingFlow.vue zeigt dort nichts an.
export const NODES = [
  { id: "s1_handelszeit", label: "Schritt 1: Handelszeit" },
  { id: "s2_news", label: "Schritt 2: News" },
  { id: "newsPause", label: "News-Pause (Wecker)", hint: "News-Pause aktiv — exakte Freigabe-Zeit steht in news.retryAtSec/retryAt der letzten check_pretrade_gates-Antwort, damit erneut aufrufen (nicht raten/pollen).", nextTool: "check_pretrade_gates" },
  { id: "s3_computing", label: "Schritt 3: Bias berechnen", statePath: "s3_bias.computing", hint: "Bias-Berechnung steht noch aus.", nextTool: "run_bias_check" },
  { id: "s3_llm3", label: "Schritt 3: Kontext-Synthese", statePath: "s3_bias.llm3_kontextSynthese", llm: true, hint: "Bias steht (Trend/Targets/Invalidierung schon auf der Zeile) — Kontext-Synthese im Chat machen, dann Schritt 4.", nextTool: "check_session_window" },
  { id: "s45_entry", label: "Schritt 4/5: Einstieg", statePath: "s45.entry", hint: "Session-Fakten geprüft — Schritt 5 starten/fortsetzen.", nextTool: "run_dealing_range_loop" },
  { id: "s45_mode", label: "Live oder Backtest?", statePath: "s45.mode", gate: true },
  { id: "s45_liveTick", label: "Live: Watch-Level vs. Kurs", statePath: "s45.liveTick" },
  { id: "s45_liveWait", label: "Kein Treffer (Cron in 5 Min)", statePath: "s45.liveWait", hint: "Kein Watch-Level-Treffer (live) — beim nächsten Cron-Tick erneut aufrufen.", nextTool: "run_dealing_range_loop" },
  { id: "s45_backtestBatch", label: "Kerzen-Batch holen", statePath: "s45.backtestBatch", hint: "Backtest pausiert (maxBatches erreicht) — mit demselben replayUntilSec erneut aufrufen, um weiterzuspulen.", nextTool: "run_dealing_range_loop" },
  { id: "s45_newsBlackoutCheck", label: "News-Blackout aktiv?", statePath: "s45.backtestBatch", gate: true },
  { id: "s45_backtestSkip", label: "Batch pausiert (News)", statePath: "s45.backtestSkip" },
  { id: "s45_watchLevelHit", label: "Watch-Level im Batch berührt?", statePath: "s45.watchLevelHit", gate: true },
  { id: "s45_backtestHeartbeat", label: "Kein Treffer -> nächster Batch", statePath: "s45.backtestHeartbeat" },
  { id: "s45_refetch", label: "Voller Refetch", statePath: "s45.refetch" },
  { id: "s45_fallClassification", label: "Fall 1/2/3/4?", statePath: "s45.fallClassification", llm: true, hint: "Evidenz liegt vor (get_data_snapshot/get_recent_reactions bei Bedarf erneut aufrufen) — Fall 1 vs. 2 beurteilen.", nextTool: "log_fall_classification" },
  { id: "s45_fall3Pin", label: "Fall 3: Watch-Level pinnen", statePath: "s45.fall3Pin" },
  // get_tsc_range (vormals eigene tscGet/tscExists-Knoten) ist bewusst KEIN Graph-Knoten mehr
  // (Philip 05.09.2026: "kann aus der State Machine und aus dem Graphen heraus") —
  // add_trade_confirmation prueft/legt die Range beim Bootstrap-oder-Reuse-Zweig selbst an
  // (siehe tradingMachine.ts: s45.tscLink), get_tsc_range bleibt als eigenstaendiges Lese-Tool
  // fuer Lana nutzbar, ohne dass die Maschine einen separaten Aufruf dafuer erzwingt.
  { id: "s45_tscLink", label: "Bestätigung anhängen (Range anlegen/wiederverwenden)", statePath: "s45.tscLink", hint: "Bestätigung/Bootstrap der Dealing Range anhängen (level='range').", nextTool: "add_trade_confirmation" },
  { id: "s45_pinCheck", label: "Stand-alone-Pin vorhanden?", statePath: "s45.pinCheck", gate: true, hint: "Prüfen, ob ein Stand-alone-Pin aufzuräumen ist (get_pin_context) — falls ja remove_pin_entry, sonst direkt find_targets (räumt automatisch mit auf).", nextTool: "find_targets" },
  { id: "s45_pinRemove", label: "Pin aufräumen", statePath: "s45.pinRemove" },
  { id: "s45_fallAgainCheck", label: "Fall 1 komplett?", statePath: "s45.fallAgainCheck", llm: true, hint: "Ist Fall 1 komplett? find_targets liefert die Ziel-Kandidaten und löst diesen Schritt automatisch mit aus.", nextTool: "find_targets" },
  { id: "s45_findTargets", label: "find_targets", statePath: "s45.findTargets" },
  { id: "s45_llmPickTarget", label: "Ziel wählen", statePath: "s45.llmPickTarget", llm: true, hint: "Ziel aus find_targets' Kandidatenliste wählen und mit add_trade_target anhängen — falls doch Fall 2, retract_fall1_classification aufrufen.", nextTool: "add_trade_target" },
  { id: "s45_addTarget", label: "add_trade_target", statePath: "s45.addTarget" },
  { id: "s45_pinCheck2", label: "Stand-alone-Pin (Target)?", statePath: "s45.pinCheck2", gate: true, hint: "Zweiten Stand-alone-Pin (Target) prüfen/aufräumen — danach automatisch weiter zu Schritt 6.", nextTool: "remove_pin_entry" },
  { id: "s45_pinRemove2", label: "Pin aufräumen", statePath: "s45.pinRemove2" },
  { id: "s45_notify", label: "Benachrichtigen", statePath: "s45.notify" },
  { id: "s6_evidence", label: "Schritt 6: Evidenz sammeln", statePath: "s6_validieren.evidenceGathering", hint: "Evidenz für Schritt 6 sammeln (Confluences/Anti-Confluences/Score).", nextTool: "get_validation_evidence" },
  { id: "s6_llm6a", label: "Anti-Confluence-Auswahl", statePath: "s6_validieren.llm6a_antiConfluenceAuswahl", llm: true, hint: "Welche find_anti_confluences-Kandidaten wirklich zählen entscheiden, dann add_trade_confirmation aufrufen.", nextTool: "add_trade_confirmation" },
  { id: "s6_llm6", label: "VALIDE/INVALIDE?", statePath: "s6_validieren.llm6_valideInvalide", llm: true, hint: "Finale VALIDE/INVALIDE-Abwägung treffen und eintragen.", nextTool: "log_validation_verdict" },
  { id: "s7_findEntry", label: "Schritt 7: Find Entry (Philip)", llm: true, hint: "Entry-Timing ist deine eigene Verantwortung — sobald ein Entry feststeht, add_trade_position aufrufen.", nextTool: "add_trade_position" },
  { id: "s8_tradeManagement", label: "Schritt 8: Trade-Management", hint: "Position läuft — bei Abschluss update_trade_position mit dem Outcome aufrufen.", nextTool: "update_trade_position" },
  { id: "end_keinTrade", label: "Kein Trade", end: true, hint: "Kein Trade heute (außerhalb Handelszeit) — nichts zu tun." },
  { id: "end_positionGeschlossen", label: "Position geschlossen", end: true, hint: "Trade abgeschlossen." },
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
  { from: "s45_fallClassification", to: "s45_tscLink", label: "Fall 1/2" },
  { from: "s45_fallClassification", to: "s45_fall3Pin", label: "Fall 3 (auto)" },
  { from: "s45_fallClassification", to: "s3_computing", label: "Fall 4 (auto)" },
  { from: "s45_fall3Pin", to: "s45_entry" },
  { from: "s45_tscLink", to: "s45_pinCheck" },
  { from: "s45_pinCheck", to: "s45_pinRemove", label: "ja" },
  { from: "s45_pinCheck", to: "s45_fallAgainCheck", label: "nein" },
  { from: "s45_pinRemove", to: "s45_fallAgainCheck" },
  { from: "s45_fallAgainCheck", to: "s45_findTargets", label: "ja (Fall 1)" },
  { from: "s45_fallAgainCheck", to: "s45_entry", label: "nein (Fall 2)" },
  { from: "s45_findTargets", to: "s45_llmPickTarget" },
  { from: "s45_llmPickTarget", to: "s45_addTarget" },
  { from: "s45_llmPickTarget", to: "s45_entry", label: "doch Fall 2 (retract_fall1_classification)" },
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

// Wegweiser fürs aktuelle currentNode (siehe hint/nextTool oben) — null, wenn kein aktiver Loop
// oder der Knoten ein reiner Zwischenschritt ohne eigenen Ruhepunkt ist (dort wartet nie jemand).
export function getNextActionHint(currentNode) {
  if (!currentNode) return null;
  const node = NODES.find((n) => (n.statePath ?? n.id) === currentNode);
  if (!node?.hint) return null;
  return { hint: node.hint, tool: node.nextTool ?? null, judgment: node.llm === true };
}

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
    // Labels in Anführungszeichen im Pipe-Syntax (nicht nackt) — sonst brechen Klammern wie in
    // "Fall 3 (auto)"/"ja (Fall 1)" den Mermaid-Parser (Bug-Report Philip 05.09.2026).
    lines.push(edge.label ? `  ${edge.from} -->|"${mermaidEscape(edge.label)}"| ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
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
