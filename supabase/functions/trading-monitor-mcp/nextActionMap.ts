// Knoten -> Klartext-Wegweiser fürs get_next_action-Tool (docs/state-machine.md#naechster-schritt,
// Philip 06.09.2026: "Lana kommt mit den Steps durcheinander ... woher weiß Lana, welche Tool-
// Aufrufe sie machen soll?"). Reine, gepruefte Zuordnung Knoten -> welches Tool als Nächstes ruft —
// jede Zeile gegen die tatsächlichen safeTransitionChain-Aufrufe in db.ts/tools/*.ts verifiziert
// (nicht aus tradingMachine.ts abgeleitet/geraten), siehe Kommentare unten für die Fundstelle.
//
// Bewusst NUR die tatsächlich als Ruhepunkt beobachtbaren Knoten (der Actor parkt hier zwischen
// zwei Tool-Aufrufen) — die vielen Zwischenknoten, die innerhalb EINES Tool-Aufrufs automatisch
// durchlaufen werden (z.B. s45.entry/mode/liveTick, s45.findTargets selbst — find_targets schickt
// TARGETS_FOUND als eigenen Nebeneffekt und rutscht im selben Call sofort weiter zu llmPickTarget),
// fehlen hier absichtlich — sie sind für "was rufe ich als Nächstes" nie relevant, der Actor steht
// nach jedem Tool-Aufruf nie dort.
//
// Frontend-Pendant: src/tradingMachineGraph.js (NODES-Array, dieselben hint-Texte) — dieselbe
// bewusste Zwei-Runtimes-Duplizierung wie orderBlocks.js/orderBlocks.ts (siehe CLAUDE.md).
export interface NextActionEntry {
  hint: string;
  tool: string | null;
  // true = echtes LLM-Urteil, das die Maschine hart durchsetzt (kein anderer Weg weiter) — false =
  // der genannte Tool-Aufruf treibt den Actor als Nebeneffekt seiner eigentlichen Aufgabe voran.
  judgment: boolean;
}

export const NEXT_ACTION_MAP: Record<string, NextActionEntry> = {
  end_keinTrade: { hint: "Kein Trade heute (außerhalb Handelszeit) — nichts zu tun.", tool: null, judgment: false },
  newsPause: { hint: "News-Pause aktiv — exakte Freigabe-Zeit steht in news.retryAtSec/retryAt der letzten check_pretrade_gates-Antwort, damit erneut aufrufen (nicht raten/pollen).", tool: "check_pretrade_gates", judgment: false },
  "s3_bias.computing": { hint: "Bias-Berechnung steht noch aus.", tool: "run_bias_check", judgment: false },
  "s3_bias.llm3_kontextSynthese": {
    hint: "Bias steht (Trend/Targets/Invalidierung schon auf der Zeile) — Kontext-Synthese im Chat machen, dann Schritt 4.",
    tool: "check_session_window",
    judgment: true, // Kontext-Synthese selbst ist Lanas freie Einordnung, der Tool-Call danach ist nur der Trigger
  },
  "s45.entry": {
    hint: "Session-Fakten geprüft — Schritt 5 starten/fortsetzen.",
    tool: "run_dealing_range_loop",
    judgment: false, // fundstelle: sessionWindow.ts-Kommentar — run_dealing_range_loop übernimmt S45_ENTER/MODE_SELECTED bei jedem Einstieg in Schritt 5
  },
  "s45.liveWait": { hint: "Kein Watch-Level-Treffer (live) — beim nächsten Cron-Tick erneut aufrufen.", tool: "run_dealing_range_loop", judgment: false },
  "s45.backtestBatch": { hint: "Backtest pausiert (maxBatches erreicht) — mit demselben replayUntilSec erneut aufrufen, um weiterzuspulen.", tool: "run_dealing_range_loop", judgment: false },
  "s45.fallClassification": {
    hint: "Evidenz liegt vor (get_data_snapshot/get_recent_reactions bei Bedarf erneut aufrufen) — Fall 1 vs. 2 beurteilen.",
    tool: "log_fall_classification",
    judgment: true, // fundstelle: dealingRangeLoop.ts logFallClassification, tradingMachine.ts-Kopfkommentar "dauerhaft bei Lana"
  },
  "s45.tscLink": {
    hint: "Bestätigung/Bootstrap der Dealing Range anhängen (level='range').",
    tool: "add_trade_confirmation",
    judgment: false, // fundstelle: db.ts addTradeConfirmation, safeTransitionChain(TSC_ADDED/TSC_BOOTSTRAPPED)
  },
  "s45.pinCheck": {
    hint: "Prüfen, ob ein Stand-alone-Pin aufzuräumen ist (get_pin_context) — falls ja remove_pin_entry(id), sonst remove_pin_entry(instrument, ohne id) zum Bestätigen von 'kein Pin'.",
    tool: "remove_pin_entry",
    judgment: false, // fundstelle: pins.ts removePinEntry (PIN_CHECKED{true/false} je nach id)
  },
  "s45.fallAgainCheck": {
    hint: "Ist Fall 1 komplett (Ziel-Auswahl macht jetzt Sinn) oder Fall 2 (Bewegung noch im Gange)? log_fall_again_check(complete) eintragen — bei true geht's weiter zu find_targets, bei false zurück zu Schritt 4.",
    tool: "log_fall_again_check",
    judgment: true, // fundstelle: dealingRangeLoop.ts logFallAgainCheck, tradingMachine.ts fallAgainCheck-Diamant
  },
  "s45.llmPickTarget": {
    hint: "Ziel aus find_targets' Kandidatenliste wählen und mit add_trade_target anhängen — falls sich beim Blick auf die Kandidaten doch Fall 2 herausstellt (Bewegung noch im Gange, kein passendes Ziel), stattdessen retract_fall1_classification aufrufen.",
    tool: "add_trade_target",
    judgment: true, // Zielwahl selbst ist Lanas Entscheidung, siehe docs/state-machine.md "Kandidat für spätere Mechanisierung"
  },
  "s45.pinCheck2": {
    hint: "Zweiten Stand-alone-Pin (Target) prüfen/aufräumen (remove_pin_entry) — danach automatisch weiter zu Schritt 6.",
    tool: "remove_pin_entry",
    judgment: false, // fundstelle: pins.ts removePinEntry (PIN2_CHECKED/PIN2_REMOVED)
  },
  // Echter Ruhepunkt (nicht nur Zwischenknoten) — pinNone2s always-Übergang landet synchron hier,
  // aber NOTIFIED kommt erst von AUSSEN (get_validation_evidence). Fehlte bisher in dieser Map
  // (Bug-Report Philip 07.09.2026, GBPUSD-Backtest 28.08.: get_next_action zeigte "kein bekannter
  // Ruhepunkt" statt auf Schritt 6 zu verweisen).
  "s45.notify": {
    hint: "Benachrichtigungspflicht (05-dealing-range-bestaetigen.md) — get_validation_evidence aufrufen, das feuert NOTIFIED als Nebeneffekt und startet direkt Schritt 6.",
    tool: "get_validation_evidence",
    judgment: false, // fundstelle: tools/validationEvidence.ts, safeTransitionChain(...NOTIFIED...)
  },
  "s6_validieren.evidenceGathering": {
    hint: "Evidenz für Schritt 6 sammeln (Confluences/Anti-Confluences/Score).",
    tool: "get_validation_evidence",
    judgment: false, // fundstelle: tools/validationEvidence.ts, safeTransitionChain(PIN2_CHECKED/NOTIFIED/EVIDENCE_GATHERED)
  },
  "s6_validieren.llm6a_antiConfluenceAuswahl": {
    hint: "Welche find_anti_confluences-Kandidaten wirklich als Confluence/Anti-Confluence zählen entscheiden, dann add_trade_confirmation aufrufen.",
    tool: "add_trade_confirmation",
    judgment: true, // fundstelle: db.ts addTradeConfirmation, safeTransitionChain(CONFIRMATIONS_ADDED); Auswahl selbst ist Lanas Urteil
  },
  "s6_validieren.llm6_valideInvalide": {
    hint: "Finale VALIDE/INVALIDE-Abwägung (qualitativ, kein Schwellenwert) treffen und eintragen.",
    tool: "log_validation_verdict",
    judgment: true,
  },
  s7_findEntry: { hint: "Entry-Timing ist deine eigene Verantwortung (siehe CLAUDE.md) — sobald ein Entry feststeht, create_trade/add_trade_position aufrufen.", tool: "add_trade_position", judgment: true },
  s8_tradeManagement: { hint: "Position läuft — bei Abschluss update_trade_position mit dem Outcome aufrufen.", tool: "update_trade_position", judgment: false },
  end_positionGeschlossen: { hint: "Trade abgeschlossen.", tool: null, judgment: false },
};

// Fallback für einen Knoten, der (noch) keinen Eintrag hat — z.B. ein reiner Zwischenknoten, den
// wir bewusst nicht gemappt haben, weil er nie als Ruhepunkt beobachtet werden sollte. Kein throw:
// get_next_action soll nie hart crashen, nur ehrlich sagen "kann das gerade nicht einordnen".
export const NEXT_ACTION_FALLBACK: NextActionEntry = {
  hint: "Kein bekannter Ruhepunkt für diesen Knoten (sollte laut tradingMachine.ts ein reiner Zwischenschritt sein, der sich beim nächsten passenden Tool-Aufruf von selbst löst) — falls das dauerhaft so bleibt, docs/state-machine.md/nextActionMap.ts prüfen.",
  tool: null,
  judgment: false,
};
