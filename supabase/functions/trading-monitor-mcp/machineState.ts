import { supabase } from "./supabaseClient.ts";
import { createTradingActor, sendGuarded, sendIfPossible, currentNodePath, type TradingActor, type TradingEvent } from "./tradingMachine.ts";
import { logDecision } from "./stateMachineLog.ts";
import { berlinDateStrFor } from "./berlinTime.ts";
import { getLoopStateForDay, type TradingLoopStateRow } from "./loopState.ts";

// Persistenz-Glue für tradingMachine.ts (State-Machine V2, docs/state-machine.md#state-machine-v2)
// — Stil wie loopState.ts. Jeder Tool-Aufruf ist ein eigener Deno-Edge-Function-Request (kein
// dauerhaft laufender Prozess) — der Actor wird deshalb PRO Aufruf aus trading_loop_state.
// machine_snapshot rehydriert, bekommt EIN Event, wird sofort wieder persistiert. Genau das
// XState-v5-Muster für "State lebt in der DB, nicht im Prozess" (getPersistedSnapshot/
// createActor(machine, { snapshot })).
//
// Permanente Pro-Tag-Identität (Philip, 06.09.2026: "der state soll dauerhaft bleiben ... egal
// welcher Schritt ... nur wenn ich den state löschen lasse, geht er weg") — (instrument, dateStr)
// ist seit der Migration 20260906140000_trading_loop_state_permanent_per_day.sql die permanente
// Identität einer Zeile, nicht mehr status='active'. Jede hier ladende/anlegende Funktion braucht
// deshalb einen dateStr (live: heutiges Berlin-Datum, Backtest: das Replay-Datum) statt nur das
// Instrument — sonst würde z.B. ein live durchgeführter Gate-Check die Zeile eines gerade laufenden
// Backtests für einen anderen Tag treffen.

// Node-Pfad -> current_step/current_case-Ableitung, rein für die bestehende LoopStatus.vue-Anzeige
// (current_step/current_case bleiben laut Migration 20260905140000 vorerst bestehen, siehe
// tradingMachine.ts für den vollständigen Knoten-Katalog).
function deriveStepAndCase(node: string, fallCase: number | null): { currentStep: TradingLoopStateRow["currentStep"]; currentCase: number | null } {
  // end_keinTrade ist laut tradingMachine.ts nur über s1_handelszeits HANDELSZEIT_CHECKED-Kante
  // erreichbar, deshalb immer Schritt 1 — siehe bekannte Einschränkung dazu in docs/state-machine.md.
  if (node === "s1_handelszeit" || node === "end_keinTrade") return { currentStep: 1, currentCase: null };
  if (node === "s2_news" || node === "newsPause") return { currentStep: 2, currentCase: null };
  if (node.startsWith("s3_bias")) return { currentStep: 3, currentCase: null };
  if (node === "s45.entry" || node === "s45.mode") return { currentStep: 4, currentCase: null };
  if (node.startsWith("s45")) return { currentStep: 5, currentCase: fallCase };
  if (node.startsWith("s6_validieren")) return { currentStep: 6, currentCase: null };
  if (node === "s7_findEntry") return { currentStep: 7, currentCase: null };
  return { currentStep: 8, currentCase: null };
}

export interface LoadedMachine {
  loopId: number;
  actor: TradingActor;
}

// Rehydrierung mit Kompatibilitäts-Absicherung. Ein persistierter Snapshot kann auf einen Knoten
// zeigen, der in einer SPÄTEREN tradingMachine.ts-Änderung umbenannt/entfernt wurde (Bug-Vorfall
// 05.09.2026: die tscGet/tscExists-Entfernung ließ einen live geparkten Loop mit inkompatiblem
// Snapshot zurück, dessen Verhalten je nach Tool-Aufruf unterschiedlich kaputt war — mal ein
// sofortiger XState-Fehler, mal ein Actor ohne funktionierendes getSnapshot().can(), mal ein
// Hänger, der erst nach mehreren Minuten vom MCP-Client abgebrochen wurde). Statt dieses Risiko bei
// jeder künftigen Maschinen-Änderung erneut einzugehen: Actor-Konstruktion UND ein Sanity-Check auf
// das Ergebnis hart absichern, damit eine Inkompatibilität IMMER sofort als klarer, fangbarer
// Fehler auftritt (den safeTransitionChain bereits abfängt) statt in unvorhersehbares Verhalten zu
// laufen. Reparatur seit der permanenten Pro-Tag-Identität (06.09.2026) bewusst NICHT mehr
// automatisch (kein "startLoopState ersetzt die Zeile" mehr) — Philip löscht die betroffene Zeile
// selbst, ein frischer loadOrCreateMachineForDay-Aufruf legt sie dann sauber neu an.
function rehydrateActor(loopState: TradingLoopStateRow, instrument: string): TradingActor {
  if (loopState.currentNode == null) {
    throw new Error(
      `Die Zeile für ${instrument}/${loopState.dateStr} (id=${loopState.id}) wurde vor State-Machine V2 angelegt und hat keinen ` +
        `Maschinen-Snapshot — Zeile löschen lassen, dann legt der nächste Aufruf sie sauber neu an.`,
    );
  }
  const rawSnapshot = loopState.machineSnapshot && Object.keys(loopState.machineSnapshot as object).length > 0 ? (loopState.machineSnapshot as any) : undefined;
  try {
    const actor = createTradingActor(rawSnapshot);
    if (typeof actor.getSnapshot !== "function" || typeof actor.getSnapshot().can !== "function") {
      throw new Error("Actor nach Rehydrierung ohne funktionsfähiges getSnapshot().can() zurückbekommen.");
    }
    return actor;
  } catch (err) {
    throw new Error(
      `Die Zeile für ${instrument}/${loopState.dateStr} (id=${loopState.id}) hat einen mit der aktuellen tradingMachine.ts inkompatiblen ` +
        `Maschinen-Snapshot (vermutlich nach einer Änderung an der Maschinen-Definition) — Zeile löschen lassen, dann legt der nächste ` +
        `Aufruf sie sauber neu an. Ursprünglicher Fehler: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Lädt den Actor für (instrument, dateStr), oder null, wenn dieser Tag+Instrument noch nie
// initialisiert wurde.
export async function loadMachineForDayOrNull(instrument: string, dateStr: string): Promise<LoadedMachine | null> {
  const loopState = await getLoopStateForDay(instrument, dateStr);
  if (!loopState) return null;
  return { loopId: loopState.id, actor: rehydrateActor(loopState, instrument) };
}

// Wie oben, wirft statt null zurückzugeben — für Tools, bei denen ein noch nicht initialisierter
// Tag ein echter Bedienfehler ist (Schritt 6+, die zwingend nach Schritt 1-5 kommen).
export async function loadMachineForDay(instrument: string, dateStr: string): Promise<LoadedMachine> {
  const loaded = await loadMachineForDayOrNull(instrument, dateStr);
  if (!loaded) {
    throw new Error(`${instrument}/${dateStr} wurde noch nicht initialisiert — zuerst check_pretrade_gates/run_bias_check aufrufen (Schritt 1-3).`);
  }
  return loaded;
}

// Get-or-create für (instrument, dateStr) — legt eine frische Zeile bei s1_handelszeit an, wenn
// dieser Tag+Instrument noch nie initialisiert wurde, sonst wird die bestehende (permanente, siehe
// Datei-Kopfkommentar) Zeile rehydriert, egal in welchem Schritt/Fall/Status sie gerade steht. Kein
// "Supersede" mehr nötig — (instrument, dateStr) ist die Unique-Identität, ein anderer Tag desselben
// Instruments ist einfach eine andere, koexistierende Zeile.
export async function loadOrCreateMachineForDay(instrument: string, dateStr: string, atSec: number): Promise<LoadedMachine> {
  const existing = await loadMachineForDayOrNull(instrument, dateStr);
  if (existing) return existing;
  const actor = createTradingActor();
  const { data, error } = await supabase
    .from("trading_loop_state")
    .insert({
      instrument,
      date_str: dateStr,
      status: "active",
      current_step: 1,
      current_case: null,
      direction: null,
      heartbeat_log: [],
      last_analysis_time_sec: atSec,
      machine_snapshot: actor.getPersistedSnapshot(),
      current_node: currentNodePath(actor),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { loopId: data.id as number, actor };
}

// Schickt EIN Event an den Actor (hart geblockt bei ungültigem Übergang, siehe sendGuarded), dann
// Snapshot + abgeleiteten current_node/current_step/current_case zurückschreiben + die Transition
// ins bestehende state_machine_log (stateMachineLog.ts) loggen — Wiederverwendung derselben
// Log-Tabelle/UI-Gewichtung statt einer zweiten Tabelle. last_analysis_time_sec wird NUR hier
// (bei einer tatsächlichen Transition) mitgeschrieben, bewusst NICHT bei jedem bloßen Re-Check ohne
// Fortschritt (Philip, 06.09.2026: "Stand" soll den Analyse-Fortschritt zeigen, nicht wie oft
// jemand nachgeschaut hat — sonst wäre "Stand" == "Jetzt" bei jedem Live-Poll, der Vergleich damit
// witzlos).
async function persistTransition(loaded: LoadedMachine, instrument: string, fromNode: string, toNode: string, event: TradingEvent, atSec: number): Promise<void> {
  const eventType = event.type;
  const fallCase = event.type === "FALL_CLASSIFIED" ? event.case : null;
  const { currentStep, currentCase } = deriveStepAndCase(toNode, fallCase);

  const { error } = await supabase
    .from("trading_loop_state")
    .update({
      machine_snapshot: loaded.actor.getPersistedSnapshot(),
      current_node: toNode,
      current_step: currentStep,
      current_case: currentCase,
      last_analysis_time_sec: atSec,
    })
    .eq("id", loaded.loopId);
  if (error) throw new Error(error.message);

  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(atSec),
    sec: atSec,
    step: (currentStep <= 6 ? currentStep : 6) as 3 | 4 | 5 | 6,
    tool: "tradingMachine",
    decision: "node_transition",
    result: { from: fromNode, to: toNode, event: eventType },
    message: `${fromNode} --(${eventType})--> ${toNode}`,
    loopStateId: loaded.loopId,
  });
}

// Harter Übergang — wirft (sendGuarded), wenn das Event am aktuellen Knoten nicht gültig ist. Für
// Tools, bei denen eine falsche Reihenfolge ein echter Bedienfehler ist (genau der Bug-Vorfall vom
// 05.09.2026, siehe tradingMachine.ts-Kopfkommentar).
export async function transition(loaded: LoadedMachine, instrument: string, event: TradingEvent, atSec: number): Promise<string> {
  const fromNode = currentNodePath(loaded.actor);
  sendGuarded(loaded.actor, event);
  const toNode = currentNodePath(loaded.actor);
  await persistTransition(loaded, instrument, fromNode, toNode, event, atSec);
  return toNode;
}

// Weicher Übergang — No-op statt Fehler, wenn das Event am aktuellen Knoten nicht gültig ist. Für
// Tools, die bewusst frei/wiederholt aufrufbar bleiben (z.B. check_session_window, auch von
// Schritt 5 intern wiederverwendet) und nicht bei jedem Aufruf zwingend den Baum vorantreiben sollen.
export async function transitionIfPossible(loaded: LoadedMachine, instrument: string, event: TradingEvent, atSec: number): Promise<string | null> {
  const fromNode = currentNodePath(loaded.actor);
  if (!sendIfPossible(loaded.actor, event)) return null;
  const toNode = currentNodePath(loaded.actor);
  await persistTransition(loaded, instrument, fromNode, toNode, event, atSec);
  return toNode;
}

// Verdrahtung der restlichen TSC-Verknüpfungs-Kette (Schritt 5 Ende) + Schritt 6-8 (Task
// "State-Machine bis zum letzten Schritt durchziehen", 2026-09-05) — die dafür nötigen Events
// existieren bereits vollständig in tradingMachine.ts, nur kein Tool-Aufruf schickte sie bisher
// (siehe docs/state-machine.md: "Bewusst noch nicht verdrahtet"). Diese Tools (add_trade_confirmation/
// add_trade_target/remove_pin_entry/add_trade_position/update_trade_position) werden AUCH für
// Trade-Journal-Aktionen weit außerhalb eines aktiven Loops benutzt (freies Nachpflegen alter
// Trades, kein Instrument mit laufendem Loop) — deshalb ausschließlich weiche Übergänge
// (transitionIfPossible) UND ein Fehler beim Verdrahten selbst darf NIE den eigentlichen
// Journal-/TSC-Schreibvorgang zum Scheitern bringen (gleiche Fire-and-forget-Philosophie wie
// logDecision in stateMachineLog.ts). Mehrere Events werden am SELBEN, einmal geladenen Actor
// nacheinander versucht (statt pro Event neu zu laden) — nur das jeweils am aktuellen Knoten
// gültige feuert tatsächlich, der Rest ist ein harmloser No-op (siehe transitionIfPossible), das
// deckt sowohl "Zwischenschritte nachholen, die kein eigenes Tool ausgelöst hat" (z.B. 'kein
// Stand-alone-Pin gefunden', PIN_CHECKED{found:false}) als auch "der eigentliche Übergang" in
// einem einzigen, robusten Aufruf ab. dateStr wird aus atSec abgeleitet (Berlin-Datum) — bei diesen
// Aufrufern (Trade-Journal/TSC-Aktionen) ist atSec bereits der semantisch richtige Zeitpunkt
// (live "jetzt" oder ein expliziter Backtest-Zeitpunkt), keine Signatur-Änderung an den vielen
// Aufrufstellen in db.ts/tools/pins.ts/tools/tsc.ts nötig.
export async function safeTransitionChain(instrument: string, events: TradingEvent[], atSec: number): Promise<{ loopId: number; node: string } | null> {
  try {
    const loaded = await loadMachineForDayOrNull(instrument, berlinDateStrFor(atSec));
    if (!loaded) return null;
    for (const event of events) {
      await transitionIfPossible(loaded, instrument, event, atSec);
    }
    return { loopId: loaded.loopId, node: currentNodePath(loaded.actor) };
  } catch (err) {
    console.error(`safeTransitionChain fehlgeschlagen (${events.map((e) => e.type).join(",")}) für ${instrument}:`, err);
    return null;
  }
}
