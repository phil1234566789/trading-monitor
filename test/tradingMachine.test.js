// State-Machine V2 (docs/state-machine.md#state-machine-v2) — reine Maschinen-Tests, keine DB
// (siehe biasEngine.test.js fürs gleiche Import-Muster einer Deno-Datei ohne Supabase-Abhängigkeit).
// npm:xstate@5.32.6 wird per vite.config.js-Alias auf das lokal installierte xstate umgebogen.
import { describe, expect, it } from "vitest";
import { createTradingActor, sendGuarded, currentNodePath } from "../supabase/functions/trading-monitor-mcp/tradingMachine.ts";

describe("tradingMachine happy path", () => {
  it("läuft den kompletten Schritt-1-8-Baum durch (Long, Fall 1, valide, Live)", () => {
    const actor = createTradingActor();
    expect(currentNodePath(actor)).toBe("s1_handelszeit");

    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    expect(currentNodePath(actor)).toBe("s2_news");

    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
    expect(currentNodePath(actor)).toBe("s3_bias.computing");

    sendGuarded(actor, { type: "BIAS_COMPUTED" });
    expect(currentNodePath(actor)).toBe("s3_bias.llm3_kontextSynthese");

    sendGuarded(actor, { type: "CONTEXT_SYNTHESIS_DONE" });
    expect(currentNodePath(actor)).toBe("s45.entry");

    sendGuarded(actor, { type: "S45_ENTER" });
    sendGuarded(actor, { type: "MODE_SELECTED", mode: "live" });
    expect(currentNodePath(actor)).toBe("s45.liveTick");

    sendGuarded(actor, { type: "LIVE_LEVEL_CHECKED", hit: true });
    expect(currentNodePath(actor)).toBe("s45.refetch");

    sendGuarded(actor, { type: "REFETCH_DONE" });
    expect(currentNodePath(actor)).toBe("s45.fallClassification");

    sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 1 });
    expect(currentNodePath(actor)).toBe("s45.tscGet");

    sendGuarded(actor, { type: "TSC_FETCHED" });
    sendGuarded(actor, { type: "TSC_EXISTS_CHECKED", exists: false });
    expect(currentNodePath(actor)).toBe("s45.tscBootstrap");

    sendGuarded(actor, { type: "TSC_BOOTSTRAPPED" });
    expect(currentNodePath(actor)).toBe("s45.pinCheck");

    sendGuarded(actor, { type: "PIN_CHECKED", found: false });
    // pinNone ist ein reiner Pass-through (always), landet ohne weiteres Event direkt bei fallAgainCheck.
    expect(currentNodePath(actor)).toBe("s45.fallAgainCheck");

    sendGuarded(actor, { type: "FALL_AGAIN_CHECKED", complete: true });
    expect(currentNodePath(actor)).toBe("s45.findTargets");

    sendGuarded(actor, { type: "TARGETS_FOUND" });
    sendGuarded(actor, { type: "TARGET_PICKED" });
    sendGuarded(actor, { type: "TARGET_ADDED" });
    expect(currentNodePath(actor)).toBe("s45.pinCheck2");

    sendGuarded(actor, { type: "PIN2_CHECKED", found: false });
    expect(currentNodePath(actor)).toBe("s45.notify");

    sendGuarded(actor, { type: "NOTIFIED" });
    expect(currentNodePath(actor)).toBe("s6_validieren.evidenceGathering");

    sendGuarded(actor, { type: "EVIDENCE_GATHERED" });
    sendGuarded(actor, { type: "CONFIRMATIONS_ADDED" });
    expect(currentNodePath(actor)).toBe("s6_validieren.llm6_valideInvalide");

    sendGuarded(actor, { type: "VALID_INVALID_JUDGED", verdict: "valide" });
    expect(currentNodePath(actor)).toBe("s7_findEntry");

    sendGuarded(actor, { type: "ENTRY_FOUND" });
    expect(currentNodePath(actor)).toBe("s8_tradeManagement");

    sendGuarded(actor, { type: "POSITION_CLOSED" });
    expect(currentNodePath(actor)).toBe("end_positionGeschlossen");
  });

  it("Handelszeit-Gate: außerhalb -> end_keinTrade, kein Weiterlaufen", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: true });
    expect(currentNodePath(actor)).toBe("end_keinTrade");
  });

  it("News-Gate: unmittelbar bevorstehend -> newsPause -> Wecker feuert -> Schritt 3", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: true });
    expect(currentNodePath(actor)).toBe("newsPause");
    sendGuarded(actor, { type: "NEWS_PAUSE_FIRED" });
    expect(currentNodePath(actor)).toBe("s3_bias.computing");
  });
});

describe("tradingMachine Rückspränge (Loopbacks laut Diagramm)", () => {
  function actorAtFallClassification() {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
    sendGuarded(actor, { type: "BIAS_COMPUTED" });
    sendGuarded(actor, { type: "CONTEXT_SYNTHESIS_DONE" });
    sendGuarded(actor, { type: "S45_ENTER" });
    sendGuarded(actor, { type: "MODE_SELECTED", mode: "backtest" });
    sendGuarded(actor, { type: "NEWS_BLACKOUT_CHECKED", active: false });
    sendGuarded(actor, { type: "BATCH_LEVEL_CHECKED", hit: true });
    sendGuarded(actor, { type: "REFETCH_DONE" });
    return actor;
  }

  it("Fall 3 (keine DR) pinnt Watch-Level und springt zurück zu Schritt 4 (s45.entry)", () => {
    const actor = actorAtFallClassification();
    sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 3 });
    expect(currentNodePath(actor)).toBe("s45.fall3Pin");
    sendGuarded(actor, { type: "PIN_SET" });
    expect(currentNodePath(actor)).toBe("s45.entry");
  });

  it("Fall 4 (Target/Invalidierung erreicht) springt zurück zu Schritt 3 (kompletter Bias-Neudurchlauf)", () => {
    const actor = actorAtFallClassification();
    sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 4 });
    expect(currentNodePath(actor)).toBe("s3_bias.computing");
  });

  it("Fall 2 (noch nicht komplett) springt nach dem Pin-Aufräumen zurück zu Schritt 4", () => {
    const actor = actorAtFallClassification();
    sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 2 });
    sendGuarded(actor, { type: "TSC_FETCHED" });
    sendGuarded(actor, { type: "TSC_EXISTS_CHECKED", exists: true });
    sendGuarded(actor, { type: "TSC_ADDED" });
    sendGuarded(actor, { type: "PIN_CHECKED", found: true });
    sendGuarded(actor, { type: "PIN_REMOVED" });
    expect(currentNodePath(actor)).toBe("s45.fallAgainCheck");
    sendGuarded(actor, { type: "FALL_AGAIN_CHECKED", complete: false });
    expect(currentNodePath(actor)).toBe("s45.entry");
  });

  it("INVALIDE-Abwägung in Schritt 6 springt zurück zu Schritt 4/5", () => {
    const actor = actorAtFallClassification();
    sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 1 });
    sendGuarded(actor, { type: "TSC_FETCHED" });
    sendGuarded(actor, { type: "TSC_EXISTS_CHECKED", exists: true });
    sendGuarded(actor, { type: "TSC_ADDED" });
    sendGuarded(actor, { type: "PIN_CHECKED", found: false });
    sendGuarded(actor, { type: "FALL_AGAIN_CHECKED", complete: true });
    sendGuarded(actor, { type: "TARGETS_FOUND" });
    sendGuarded(actor, { type: "TARGET_PICKED" });
    sendGuarded(actor, { type: "TARGET_ADDED" });
    sendGuarded(actor, { type: "PIN2_CHECKED", found: false });
    sendGuarded(actor, { type: "NOTIFIED" });
    sendGuarded(actor, { type: "EVIDENCE_GATHERED" });
    sendGuarded(actor, { type: "CONFIRMATIONS_ADDED" });
    sendGuarded(actor, { type: "VALID_INVALID_JUDGED", verdict: "invalide" });
    expect(currentNodePath(actor)).toBe("s45.entry");
  });

  it("Live: kein Watch-Level-Treffer -> liveWait, nächster Cron-Tick reentered bei mode", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
    sendGuarded(actor, { type: "BIAS_COMPUTED" });
    sendGuarded(actor, { type: "CONTEXT_SYNTHESIS_DONE" });
    sendGuarded(actor, { type: "S45_ENTER" });
    sendGuarded(actor, { type: "MODE_SELECTED", mode: "live" });
    sendGuarded(actor, { type: "LIVE_LEVEL_CHECKED", hit: false });
    expect(currentNodePath(actor)).toBe("s45.liveWait");
    sendGuarded(actor, { type: "S45_ENTER" });
    expect(currentNodePath(actor)).toBe("s45.mode");
  });
});

describe("sendGuarded — harter Block bei ungültigem Übergang", () => {
  it("blockt ein Event, das am aktuellen Knoten nicht vorgesehen ist, mit sprechender Fehlermeldung", () => {
    const actor = createTradingActor();
    // Regressionstest für den Bug-Vorfall vom 05.09.2026: ein Aufruf, der nicht zum aktuellen Knoten
    // passt (hier: ein Fall-Urteil, bevor überhaupt Handelszeit/News geprüft wurden), darf nicht
    // still nichts tun (wie der alte cursorSec<replayUntilSec-No-op), sondern muss klar sagen, wo
    // wir stehen und was stattdessen gültig wäre.
    expect(() => sendGuarded(actor, { type: "FALL_CLASSIFIED", case: 1 })).toThrow(
      /Ungültiger Übergang von 's1_handelszeit'.*HANDELSZEIT_CHECKED/s,
    );
    // Zustand bleibt unverändert nach dem geblockten Versuch.
    expect(currentNodePath(actor)).toBe("s1_handelszeit");
  });

  it("blockt einen doppelten Aufruf desselben Schritts (z.B. zweimal BIAS_COMPUTED)", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
    sendGuarded(actor, { type: "BIAS_COMPUTED" });
    expect(() => sendGuarded(actor, { type: "BIAS_COMPUTED" })).toThrow(/Ungültiger Übergang/);
  });

  it("Endzustand (end_keinTrade) akzeptiert gar kein Event mehr", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: true });
    expect(() => sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false })).toThrow(/Ungültiger Übergang/);
  });
});

describe("Persistenz-Rehydrierung (getPersistedSnapshot / createActor mit snapshot)", () => {
  it("ein aus einem Snapshot rehydrierter Actor macht an derselben Stelle weiter", () => {
    const actor = createTradingActor();
    sendGuarded(actor, { type: "HANDELSZEIT_CHECKED", outsideHours: false });
    sendGuarded(actor, { type: "NEWS_CHECKED", imminent: false });
    sendGuarded(actor, { type: "BIAS_COMPUTED" });
    const snapshot = actor.getPersistedSnapshot();

    const rehydrated = createTradingActor(snapshot);
    expect(currentNodePath(rehydrated)).toBe("s3_bias.llm3_kontextSynthese");
    sendGuarded(rehydrated, { type: "CONTEXT_SYNTHESIS_DONE" });
    expect(currentNodePath(rehydrated)).toBe("s45.entry");
  });
});
