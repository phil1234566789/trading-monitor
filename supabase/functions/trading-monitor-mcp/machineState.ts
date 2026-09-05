import { supabase } from "./supabaseClient.ts";
import { createTradingActor, sendGuarded, sendIfPossible, currentNodePath, type TradingActor, type TradingEvent } from "./tradingMachine.ts";
import { logDecision } from "./stateMachineLog.ts";
import { berlinDateStrFor } from "./berlinTime.ts";
import { getActiveLoopState, type TradingLoopStateRow } from "./loopState.ts";

// Persistenz-Glue für tradingMachine.ts (State-Machine V2, docs/state-machine.md#state-machine-v2)
// — Stil wie loopState.ts. Jeder Tool-Aufruf ist ein eigener Deno-Edge-Function-Request (kein
// dauerhaft laufender Prozess) — der Actor wird deshalb PRO Aufruf aus trading_loop_state.
// machine_snapshot rehydriert, bekommt EIN Event, wird sofort wieder persistiert. Genau das
// XState-v5-Muster für "State lebt in der DB, nicht im Prozess" (getPersistedSnapshot/
// createActor(machine, { snapshot })).

// Node-Pfad -> current_step/current_case-Ableitung, rein für die bestehende LoopStatus.vue-Anzeige
// (current_step/current_case bleiben laut Migration 20260905140000 vorerst bestehen, siehe
// tradingMachine.ts für den vollständigen Knoten-Katalog). s1/s2 erzeugen bewusst noch keine Zeile
// (siehe loadOrCreateActor) — ein Loop existiert laut bisherigem Schema erst ab Schritt 3.
function deriveStepAndCase(node: string, fallCase: number | null): { currentStep: TradingLoopStateRow["currentStep"]; currentCase: number | null } {
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

// Lädt den Actor für den aktiven Loop eines Instruments. Wirft, wenn kein aktiver Loop existiert —
// wie bisher legt erst run_bias_check (Schritt 3) über startLoopState einen neuen an; alles davor
// (Schritt 1/2, check_pretrade_gates) läuft ohne persistenten Loop, siehe stateMachineLog.ts-
// Kopfkommentar zum geblockten-Gate-ohne-Loop-Fall.
export async function loadMachineForInstrument(instrument: string): Promise<LoadedMachine> {
  const loaded = await loadMachineForInstrumentOrNull(instrument);
  if (!loaded) {
    throw new Error(`Kein aktiver Loop für ${instrument} — zuerst run_bias_check aufrufen (Schritt 3), das den Loop-State inkl. Maschinen-Snapshot anlegt.`);
  }
  return loaded;
}

export async function loadMachineForInstrumentOrNull(instrument: string): Promise<LoadedMachine | null> {
  const loopState = await getActiveLoopState(instrument);
  if (!loopState) return null;
  if (loopState.currentNode == null) {
    // Loop wurde VOR State-Machine V2 angelegt (kein machine_snapshot) — ein frischer Actor bei
    // s1_handelszeit würde hier still am tatsächlichen Fortschritt (z.B. schon in Schritt 5) vorbei
    // laufen und dann tief in performFullTick mit einer kryptischen sendGuarded-Meldung crashen.
    // Klarer, direkter Fehler statt dessen: einmalig run_bias_check erneut aufrufen, das ersetzt den
    // Loop komplett (startLoopState) und legt einen frischen, kompatiblen Snapshot an.
    throw new Error(
      `Der aktive Loop für ${instrument} (id=${loopState.id}) wurde vor State-Machine V2 angelegt und hat keinen Maschinen-Snapshot — ` +
        `einmalig run_bias_check erneut aufrufen (ersetzt den Loop komplett), dann normal weitermachen.`,
    );
  }
  const actor = createTradingActor(loopState.machineSnapshot && Object.keys(loopState.machineSnapshot as object).length > 0 ? (loopState.machineSnapshot as any) : undefined);
  return { loopId: loopState.id, actor };
}

// Schickt EIN Event an den Actor (hart geblockt bei ungültigem Übergang, siehe sendGuarded), dann
// Snapshot + abgeleiteten current_node/current_step/current_case zurückschreiben + die Transition
// ins bestehende state_machine_log (stateMachineLog.ts) loggen — Wiederverwendung derselben
// Log-Tabelle/UI-Gewichtung statt einer zweiten Tabelle.
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

// Initialisiert den Maschinen-Snapshot einer frisch von startLoopState angelegten Zeile auf den
// Zustand direkt NACH der Bias-Berechnung (s3_bias.llm3_kontextSynthese) — run_bias_check hat zu
// diesem Zeitpunkt Schritt 1+2 (Gates) bereits geprüft und Schritt 3 mechanisch berechnet, es fehlt
// nur noch Lanas freie Kontext-Synthese (siehe tradingMachine.ts). Separat von `transition()`, weil
// hier noch kein vorheriger Snapshot existiert, aus dem rehydriert werden könnte.
export async function initMachineAfterBiasComputed(loopId: number, instrument: string, atSec: number): Promise<string> {
  const actor = createTradingActor();
  sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
  sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
  sendGuarded(actor, { type: "BIAS_COMPUTED" });
  const node = currentNodePath(actor);

  const { error } = await supabase
    .from("trading_loop_state")
    .update({ machine_snapshot: actor.getPersistedSnapshot(), current_node: node, current_step: 3, current_case: null })
    .eq("id", loopId);
  if (error) throw new Error(error.message);

  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(atSec),
    sec: atSec,
    step: 3,
    tool: "tradingMachine",
    decision: "node_transition",
    result: { from: "start", to: node, event: "BIAS_COMPUTED" },
    message: `start --(BIAS_COMPUTED)--> ${node}`,
    loopStateId: loopId,
  });

  return node;
}
