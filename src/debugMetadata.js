// Debug-Metadaten-Sammel-Panel (Chat 2026-07-20: "damit ich dir nicht ständig die Daten von dem
// was ich in TradingView sehe hier schreiben muss"). Reine Funktionen statt inline im Vue-Setup,
// damit sie sich ohne Chart/lightweight-charts/Component-Mount testen lassen (siehe
// test/debugMetadata.test.js, Chat: "hast du einen unit test geschrieben, welcher testet, dass nur
// metadaten von aktiven features beinhaltet sein sollen?"). buildActiveMetadataSnapshot/
// hasActiveMetadata kamen per Refactoring-Task "Sehr große Dateien refactoren" (Phase 6e,
// 2026-08-26) aus PriceChart.vue hierher — dort nur noch ein dünner Wrapper, der ctx aus
// Props/lokalen Refs zusammenbaut (siehe buildActiveMetadataSnapshotInternal dort).
import { fmtDateTime } from "./format.js";

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

// Baut den kompletten Snapshot fürs Panel zusammen — Gating über selectActiveMetadataSections/
// earliestRelevantTime oben, plus die Zusammenstellung von context/structure/candles/dataExport.
// ctx = plain object statt Vue-Refs/Props direkt (siehe PriceChart.vue:
// buildActiveMetadataSnapshotInternal für die Übersetzung), macht die Funktion hier unabhängig
// testbar. ctx.candles ist bereits das clipReplay-gefilterte allCandles-Fenster.
export function buildActiveMetadataSnapshot(ctx) {
  const toggles = {
    showLiquidity: ctx.showLiquidity,
    showTradeSetups: ctx.showTradeSetups,
    showTradeSetupCockpit: ctx.showTradeSetupCockpit,
    showRanges: ctx.showRanges,
  };
  const tradeSetupTimes = (ctx.tradeSetupsMetadata ?? [])
    .flatMap((s) => [s.fractal?.pivotTime, s.ls?.pivotTime, s.obStartTime])
    .filter((t) => t != null);

  const sections = selectActiveMetadataSections(toggles, {
    context: ctx.context,
    orderBlocks: ctx.poiZonesMetadata ?? [],
    liquidity: ctx.liquidityMetadata ?? [],
    tradeSetups: ctx.tradeSetupsMetadata,
    tradeSetupCockpit: ctx.cockpitMetadata,
    structure: {
      state: ctx.marketStructureTree,
      window:
        ctx.rangesFixedStartActive && ctx.rangesFixedStartTime != null
          ? { mode: "fixed", since: ctx.rangesFixedStartTime, sinceAt: fmtDateTime(ctx.rangesFixedStartTime) }
          : { mode: "lookback" },
      period5: { period: ctx.rangesPeriod, lookbackHours: ctx.rangesLookbackHours, pivots: ctx.rangesMetadata ?? [] },
      period2Embedded: { period: ctx.ranges2Period, lookbackHours: ctx.ranges2LookbackHours, pivots: ctx.rangesMetadata2 ?? [] },
    },
  });

  const since = earliestRelevantTime(toggles, {
    orderBlocks: (ctx.poiZonesMetadata ?? []).map((z) => z.startTime).filter((t) => t != null),
    liquidity: ctx.liquidityEarliestTime != null ? [ctx.liquidityEarliestTime] : [],
    tradeSetups: tradeSetupTimes,
    structure: ctx.structureEarliestTime != null ? [ctx.structureEarliestTime] : [],
  });
  if (since != null) {
    const candles = ctx.candles.filter((c) => c.time >= since);
    sections.candles = { since, sinceAt: fmtDateTime(since), timeframe: ctx.timeframe, count: candles.length, data: candles };
  }
  // Zuletzt generierter Daten-Export (siehe DataExportModal.vue/useLastDataExport.js, Chat
  // 2026-07-28) — ungated, unabhängig vom Symbol/Timeframe des gerade offenen Charts, da der
  // Export sein eigenes Asset+Datum mitbringt. undefined/null, solange in dieser Session noch
  // keiner generiert wurde.
  if (ctx.lastDataExport != null) {
    sections.dataExport = ctx.lastDataExport;
  }
  return sections;
}

// Panel-"leer"-Zustand — dieselben Toggles wie oben, plus ob überhaupt schon OB-Zonen (ungated)
// oder ein Daten-Export vorliegen.
export function hasActiveMetadata(snapshot, toggles) {
  return (
    snapshot.orderBlocks.length > 0 ||
    toggles.showLiquidity ||
    toggles.showTradeSetups ||
    toggles.showTradeSetupCockpit ||
    toggles.showRanges ||
    snapshot.dataExport != null
  );
}

// Einziger side-effecting Export hier (Rest der Datei bewusst pure Funktionen, siehe oben) — lokal
// in .debug/metadata.json schreiben (Dev-only, siehe vite.config.js), aber NUR die eigene Sektion.
// Der Dev-Server merged serverseitig in die bestehende Datei, statt sie komplett zu überschreiben
// (Chat 2026-07-27) — zwei unabhängige Schreiber (PriceChart.vue: Autosave alle 30s unter "chart",
// DataExportModal.vue: bei jedem "Generieren" unter "dataExport") sollen sich nicht
// gegenseitig wegräumen, Philip will beide gleichzeitig zum Vergleichen nachlesen können (Bug-
// Report: Daten-Export zeigte einen anderen Structure-Trend als der Chart selbst). Schlägt der
// POST fehl (z.B. Production-Build ohne den Dev-Endpoint), still ignorieren.
export async function saveDebugMetadataSection(section, data) {
  try {
    await fetch("/__debug-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, data }, null, 2),
    });
  } catch (err) {
    console.error("Debug-Metadaten lokal speichern fehlgeschlagen:", err);
  }
}
