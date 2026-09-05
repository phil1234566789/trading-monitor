-- State-Machine V2 (docs/state-machine.md#state-machine-v2, Philip 05.09.2026): der komplette
-- Schritt-1-8-Entscheidungsbaum aus den beiden Mermaid-Diagrammen wird jetzt als echte XState-
-- Maschine (tradingMachine.ts) geführt statt nur grob über current_step/current_case. Diese Spalten
-- bleiben vorerst bestehen (weiterhin aus dem neuen Knoten abgeleitet mitgeschrieben) — kein
-- Breaking Change für die bestehende LoopStatus.vue-Anzeige während der Umstellung.
alter table trading_loop_state add column machine_snapshot jsonb not null default '{}'::jsonb;
alter table trading_loop_state add column current_node text;

-- current_step deckte bisher nur Schritt 3-5 ab (der Loop endete für den Code faktisch dort) — die
-- neue Maschine führt denselben Actor/dieselbe Zeile jetzt durchgehend bis Schritt 8 (Trade-
-- Management) bzw. bis zum echten Abschluss weiter, statt an Schritt 5 "loszulassen".
alter table trading_loop_state drop constraint trading_loop_state_current_step_check;
alter table trading_loop_state add constraint trading_loop_state_current_step_check check (current_step between 3 and 8);

comment on column trading_loop_state.machine_snapshot is
  'XState actor.getPersistedSnapshot() (tradingMachine.ts) — Rehydrierungs-Quelle für den nächsten Tool-Aufruf, siehe machineState.ts.';
comment on column trading_loop_state.current_node is
  'Dot-Pfad des aktuellen Blatt-Knotens (z.B. "s45.fallClassification"), aus machine_snapshot abgeleitet — für Queries/UI-Highlighting ohne Snapshot-Deserialisierung.';
