import { createMachine, createActor, type ActorRefFrom, type Snapshot } from "npm:xstate@5.32.6";

// Der komplette Entscheidungsbaum aus docs/diagrams/trading-steps-ablauf.html (Schritt 1-8) +
// docs/diagrams/dealing-range-loop.html (Detail zu Schritt 4⇄5, als `s45`-Compound-State
// eingebettet) — 1:1 als XState-Maschine, siehe docs/state-machine.md#state-machine-v2. Jeder
// Knoten aus beiden Diagrammen ist ein echter State, jede beschriftete Kante ein Event (Philip,
// 05.09.2026: "jeder Knoten, jede Aktion muss in der state machine implementiert sein").
//
// Bewusst dependency-frei von Supabase — reine, testbare Maschine (siehe test/tradingMachine.test.js),
// analog zu biasEngine.ts/fallClassifier.ts. Persistenz/Rehydrierung sitzt in machineState.ts.
//
// Die vier reinen Pass-through-Diamanten ohne eigene Aktion (PINOK/PINOK2 im Diagramm) laufen als
// `always`-Transition durch, ohne auf ein Event von außen zu warten — echte Handlungsknoten (auch
// mechanische wie ein DB-Lookup) warten dagegen auf das Event, das der jeweilige Tool-Aufruf nach
// getaner Arbeit schickt. Die vier dauerhaft bei Lana liegenden Urteilsknoten
// (`llm3_kontextSynthese`, `fallClassification`, `llmPickTarget`, `llm6a_antiConfluenceAuswahl`,
// `llm6_valideInvalide`, siehe docs/state-machine.md "Was dauerhaft bei Lana bleibt") haben ebenfalls
// keine automatische Transition — der Actor parkt dort, bis das passende Tool das Urteil einträgt.
//
// Reine Kanten-Labels aus dem Diagramm ohne eigene Box (z.B. "Fall 4 -> zurück zu Schritt 3",
// "add_trade_confirmation" von LLM6A zu LLM6) werden NICHT als Zwischen-State modelliert, nur als
// direktes Transition-Target — an diesen Stellen passiert nichts Beobachtbares zwischen zwei
// Tool-Aufrufen, ein Zwischenknoten wäre reine Karteikarte ohne Informationswert.

export type TradingEvent =
  | { type: "HANDELSZEIT_CHECKED"; outsideHours: boolean }
  | { type: "NEWS_CHECKED"; imminent: boolean }
  | { type: "NEWS_PAUSE_FIRED" }
  | { type: "BIAS_COMPUTED" }
  | { type: "CONTEXT_SYNTHESIS_DONE" }
  | { type: "S45_ENTER" }
  | { type: "MODE_SELECTED"; mode: "live" | "backtest" }
  | { type: "LIVE_LEVEL_CHECKED"; hit: boolean }
  | { type: "NEWS_BLACKOUT_CHECKED"; active: boolean }
  | { type: "BACKTEST_BATCH_FETCHED" }
  | { type: "BATCH_LEVEL_CHECKED"; hit: boolean }
  | { type: "REFETCH_DONE" }
  | { type: "FALL_CLASSIFIED"; case: 1 | 2 | 3 | 4 }
  | { type: "PIN_SET" }
  | { type: "TSC_FETCHED" }
  | { type: "TSC_EXISTS_CHECKED"; exists: boolean }
  | { type: "TSC_BOOTSTRAPPED" }
  | { type: "TSC_ADDED" }
  | { type: "PIN_CHECKED"; found: boolean }
  | { type: "PIN_REMOVED" }
  | { type: "FALL_AGAIN_CHECKED"; complete: boolean }
  | { type: "TARGETS_FOUND" }
  | { type: "TARGET_PICKED" }
  | { type: "TARGET_ADDED" }
  | { type: "PIN2_CHECKED"; found: boolean }
  | { type: "PIN2_REMOVED" }
  | { type: "NOTIFIED" }
  | { type: "EVIDENCE_GATHERED" }
  | { type: "ANTI_CONFLUENCE_JUDGED" }
  | { type: "CONFIRMATIONS_ADDED" }
  | { type: "VALID_INVALID_JUDGED"; verdict: "valide" | "invalide" }
  | { type: "ENTRY_FOUND" }
  | { type: "POSITION_CLOSED" };

export const tradingMachine = createMachine({
  id: "trading",
  types: {} as { events: TradingEvent },
  initial: "s1_handelszeit",
  states: {
    s1_handelszeit: {
      id: "s1_handelszeit",
      on: {
        HANDELSZEIT_CHECKED: [
          { guard: ({ event }) => event.outsideHours, target: "#end_keinTrade" },
          { target: "#s2_news" },
        ],
      },
    },
    s2_news: {
      id: "s2_news",
      on: {
        NEWS_CHECKED: [
          { guard: ({ event }) => event.imminent, target: "newsPause" },
          { target: "#s3_bias" },
        ],
      },
    },
    newsPause: {
      id: "newsPause",
      on: { NEWS_PAUSE_FIRED: "#s3_bias" },
    },
    s3_bias: {
      id: "s3_bias",
      initial: "computing",
      states: {
        computing: { on: { BIAS_COMPUTED: "llm3_kontextSynthese" } },
        llm3_kontextSynthese: { on: { CONTEXT_SYNTHESIS_DONE: "#s45" } },
      },
    },
    s45: {
      id: "s45",
      initial: "entry",
      states: {
        entry: { on: { S45_ENTER: "mode" } },
        mode: {
          on: {
            MODE_SELECTED: [
              { guard: ({ event }) => event.mode === "live", target: "liveTick" },
              { target: "backtestBatch" },
            ],
          },
        },
        // Live: ein einzelner Tick, Cron feuert bei Nicht-Treffer in 5 Min erneut (kein eigener
        // Timer in der Maschine — das Re-Entering passiert per S45_ENTER beim nächsten Cron-Tick).
        liveTick: {
          on: {
            LIVE_LEVEL_CHECKED: [
              { guard: ({ event }) => event.hit, target: "refetch" },
              { target: "liveWait" },
            ],
          },
        },
        liveWait: { on: { S45_ENTER: "mode" } },
        // Backtest: Kerzen-Batch holen -> News-Blackout? -> Watch-Level-Treffer? -> nächster Batch
        // (BHEART) oder News-Pause übersprungen (BSKIP), beide münden in denselben nächsten Batch.
        backtestBatch: {
          on: {
            NEWS_BLACKOUT_CHECKED: [
              { guard: ({ event }) => event.active, target: "backtestSkip" },
              { target: "watchLevelHit" },
            ],
          },
        },
        backtestSkip: { on: { BACKTEST_BATCH_FETCHED: "backtestBatch" } },
        watchLevelHit: {
          on: {
            BATCH_LEVEL_CHECKED: [
              { guard: ({ event }) => event.hit, target: "refetch" },
              { target: "backtestHeartbeat" },
            ],
          },
        },
        backtestHeartbeat: { on: { BACKTEST_BATCH_FETCHED: "backtestBatch" } },
        refetch: { on: { REFETCH_DONE: "fallClassification" } },
        // Fall 1-4: bewusst dauerhaft Lanas Urteil (docs/state-machine.md), keine mechanische
        // Ableitung aus touched/invalidated — die Maschine parkt hier, bis run_dealing_range_loop
        // das Urteil einträgt.
        fallClassification: {
          on: {
            FALL_CLASSIFIED: [
              { guard: ({ event }) => event.case === 1 || event.case === 2, target: "tscGet" },
              { guard: ({ event }) => event.case === 3, target: "fall3Pin" },
              // Fall 4: Target/Invalidierung erreicht -> kompletter Bias-Neudurchlauf (Schritt 3).
              { target: "#s3_bias" },
            ],
          },
        },
        fall3Pin: { on: { PIN_SET: "#s45" } },
        tscGet: { on: { TSC_FETCHED: "tscExists" } },
        tscExists: {
          on: {
            TSC_EXISTS_CHECKED: [
              { guard: ({ event }) => event.exists, target: "tscAdd" },
              { target: "tscBootstrap" },
            ],
          },
        },
        tscBootstrap: { on: { TSC_BOOTSTRAPPED: "pinCheck" } },
        tscAdd: { on: { TSC_ADDED: "pinCheck" } },
        pinCheck: {
          on: {
            PIN_CHECKED: [
              { guard: ({ event }) => event.found, target: "pinRemove" },
              { target: "pinNone" },
            ],
          },
        },
        pinRemove: { on: { PIN_REMOVED: "fallAgainCheck" } },
        pinNone: { always: "fallAgainCheck" },
        fallAgainCheck: {
          on: {
            // Fall 1 komplett -> weiter zur Ziel-Auswahl. Fall 2 (noch nicht komplett) -> zurück zu
            // Schritt 4 (neuer Entry-Zyklus dieses Loops).
            FALL_AGAIN_CHECKED: [
              { guard: ({ event }) => event.complete, target: "findTargets" },
              { target: "#s45" },
            ],
          },
        },
        findTargets: { on: { TARGETS_FOUND: "llmPickTarget" } },
        // Ziel-Auswahl aus find_targets-Kandidatenliste: heute noch Lana (Kandidat für spätere
        // Mechanisierung laut docs/state-machine.md), Maschine parkt bis add_trade_target.
        llmPickTarget: { on: { TARGET_PICKED: "addTarget" } },
        addTarget: { on: { TARGET_ADDED: "pinCheck2" } },
        pinCheck2: {
          on: {
            PIN2_CHECKED: [
              { guard: ({ event }) => event.found, target: "pinRemove2" },
              { target: "pinNone2" },
            ],
          },
        },
        pinRemove2: { on: { PIN2_REMOVED: "notify" } },
        pinNone2: { always: "notify" },
        notify: { on: { NOTIFIED: "#s6_validieren" } },
      },
    },
    s6_validieren: {
      id: "s6_validieren",
      initial: "evidenceGathering",
      states: {
        evidenceGathering: { on: { EVIDENCE_GATHERED: "llm6a_antiConfluenceAuswahl" } },
        // Welche find_anti_confluences-Kandidaten tatsächlich zählen: heute noch Lana (Kandidat für
        // spätere Mechanisierung). add_trade_confirmation ist hier reines Kanten-Label, kein eigener
        // Knoten (siehe Diagramm), deshalb direkt weiter zur finalen Abwägung.
        llm6a_antiConfluenceAuswahl: { on: { CONFIRMATIONS_ADDED: "llm6_valideInvalide" } },
        // Finale VALIDE/INVALIDE-Abwägung: dauerhaft Lana-Sache, qualitativ laut Doku, kein
        // Schwellenwert-Cutoff (docs/state-machine.md).
        llm6_valideInvalide: {
          on: {
            VALID_INVALID_JUDGED: [
              { guard: ({ event }) => event.verdict === "valide", target: "#s7_findEntry" },
              { target: "#s45" },
            ],
          },
        },
      },
    },
    s7_findEntry: {
      id: "s7_findEntry",
      on: { ENTRY_FOUND: "#s8_tradeManagement" },
    },
    s8_tradeManagement: {
      id: "s8_tradeManagement",
      on: { POSITION_CLOSED: "#end_positionGeschlossen" },
    },
    end_keinTrade: { id: "end_keinTrade", type: "final" },
    end_positionGeschlossen: { id: "end_positionGeschlossen", type: "final" },
  },
});

export type TradingActor = ActorRefFrom<typeof tradingMachine>;
export type TradingSnapshot = Snapshot<unknown>;

// Wirft mit einer für Lana verwertbaren Fehlermeldung, statt das Event (XState-Default) still zu
// verwerfen — genau der "harte Block" gegen den Bug-Vorfall (run_dealing_range_loop lief mangels
// jeglicher Zustandsprüfung in einen stillen No-op statt in die dafür gebaute Logik). `validNext`
// ist eine reine Doku-Liste fürs Fehlerbild (kein Reflection-Zauber über die Maschinen-Definition),
// von Hand parallel zu den States oben gepflegt.
export function sendGuarded(actor: TradingActor, event: TradingEvent): void {
  if (!actor.getSnapshot().can(event)) {
    const node = currentNodePath(actor);
    const validNext = VALID_NEXT_EVENTS[node] ?? [];
    throw new Error(
      `Ungültiger Übergang von '${node}' mit Event '${event.type}' — gültige nächste Events an ` +
        `diesem Knoten: ${validNext.length > 0 ? validNext.join(", ") : "(keiner, Endzustand oder wartet auf Lana-Urteil)"}.`,
    );
  }
  actor.send(event);
}

// Weiche Variante für Tools, die bewusst frei/wiederholt aufrufbar bleiben sollen (z.B.
// check_session_window — reiner Fakten-Check, auch von Schritt 5 intern wiederverwendet) und NICHT
// bei jedem Aufruf zwingend einen Übergang auslösen sollen: schickt das Event nur, wenn es am
// aktuellen Knoten gültig ist, sonst No-op (kein Fehler). Rückgabewert zeigt an, ob tatsächlich
// transitioniert wurde — Aufrufer kann das fürs eigene Logging nutzen.
export function sendIfPossible(actor: TradingActor, event: TradingEvent): boolean {
  if (!actor.getSnapshot().can(event)) return false;
  actor.send(event);
  return true;
}

// Dot-Pfad des aktuellen Blatt-Knotens (z.B. "s45.fallClassification") — fürs Persistieren in
// trading_loop_state.current_node und für UI-Highlighting, ohne den vollen Snapshot zu deserialisieren.
export function currentNodePath(actor: TradingActor): string {
  return flattenStateValue(actor.getSnapshot().value);
}

function flattenStateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => `${key}.${flattenStateValue(child)}`)
      .join(".");
  }
  return String(value);
}

// Nur für Fehlermeldungen (sendGuarded) — Node -> Liste der laut States oben tatsächlich möglichen
// Event-Typen. Bei Bedarf erweitern, wenn die Maschine oben wächst; keine Reflection, damit die
// Fehlermeldung nicht von XStates interner Struktur abhängt.
const VALID_NEXT_EVENTS: Record<string, string[]> = {
  s1_handelszeit: ["HANDELSZEIT_CHECKED"],
  s2_news: ["NEWS_CHECKED"],
  newsPause: ["NEWS_PAUSE_FIRED"],
  "s3_bias.computing": ["BIAS_COMPUTED"],
  "s3_bias.llm3_kontextSynthese": ["CONTEXT_SYNTHESIS_DONE"],
  "s45.entry": ["S45_ENTER"],
  "s45.mode": ["MODE_SELECTED"],
  "s45.liveTick": ["LIVE_LEVEL_CHECKED"],
  "s45.liveWait": ["S45_ENTER"],
  "s45.backtestBatch": ["NEWS_BLACKOUT_CHECKED"],
  "s45.backtestSkip": ["BACKTEST_BATCH_FETCHED"],
  "s45.watchLevelHit": ["BATCH_LEVEL_CHECKED"],
  "s45.backtestHeartbeat": ["BACKTEST_BATCH_FETCHED"],
  "s45.refetch": ["REFETCH_DONE"],
  "s45.fallClassification": ["FALL_CLASSIFIED"],
  "s45.fall3Pin": ["PIN_SET"],
  "s45.tscGet": ["TSC_FETCHED"],
  "s45.tscExists": ["TSC_EXISTS_CHECKED"],
  "s45.tscBootstrap": ["TSC_BOOTSTRAPPED"],
  "s45.tscAdd": ["TSC_ADDED"],
  "s45.pinCheck": ["PIN_CHECKED"],
  "s45.pinRemove": ["PIN_REMOVED"],
  "s45.fallAgainCheck": ["FALL_AGAIN_CHECKED"],
  "s45.findTargets": ["TARGETS_FOUND"],
  "s45.llmPickTarget": ["TARGET_PICKED"],
  "s45.addTarget": ["TARGET_ADDED"],
  "s45.pinCheck2": ["PIN2_CHECKED"],
  "s45.pinRemove2": ["PIN2_REMOVED"],
  "s45.notify": ["NOTIFIED"],
  "s6_validieren.evidenceGathering": ["EVIDENCE_GATHERED"],
  "s6_validieren.llm6a_antiConfluenceAuswahl": ["CONFIRMATIONS_ADDED"],
  "s6_validieren.llm6_valideInvalide": ["VALID_INVALID_JUDGED"],
  s7_findEntry: ["ENTRY_FOUND"],
  s8_tradeManagement: ["POSITION_CLOSED"],
};

export function createTradingActor(snapshot?: TradingSnapshot): TradingActor {
  const actor = snapshot ? createActor(tradingMachine, { snapshot }) : createActor(tradingMachine);
  actor.start();
  return actor;
}
