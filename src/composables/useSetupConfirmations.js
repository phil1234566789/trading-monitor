import { ref } from "vue";
import { strongestSetupSweeps } from "../tradeSetup.js";
import { addRangeConfirmation, addConfirmationToTrade, createDealingRange,
  directionForSetup, deriveSetupEntryInvalidation, linkTradeToSetup, updateTrade } from "../tradeIntake.js";

export function useSetupConfirmations({ currentSymbol, confirmationAddTrade, rangeConfirmationAddTrade,
  tscBootstrapArmed, tscRangeId, refreshTscRange, refreshTrades }) {
  const saving = ref(false);
  const error = ref("");

  async function save(setup) {
    const trade = confirmationAddTrade.value ?? rangeConfirmationAddTrade.value;
    if (saving.value || (!trade && !tscBootstrapArmed.value)) return;
    const bootstrapping = tscBootstrapArmed.value && !trade;
    const isRangeLevel = bootstrapping || rangeConfirmationAddTrade.value != null;
    // Ein Symbolwechsel während der Requests darf die Setup-Verknüpfung nicht umlenken.
    const instrument = currentSymbol.value;
    const refresh = bootstrapping || trade?.isTsc ? refreshTscRange : refreshTrades;
    confirmationAddTrade.value = null;
    rangeConfirmationAddTrade.value = null;
    tscBootstrapArmed.value = false;
    saving.value = true;
    error.value = "";
    let dealingRangeId = trade?.dealingRangeId;
    try {
      if (bootstrapping) {
        const range = await createDealingRange({ instrument, direction: directionForSetup(setup) });
        if (!range) throw new Error("Dealing Range konnte nicht angelegt werden.");
        dealingRangeId = range.id;
        if (currentSymbol.value === instrument) tscRangeId.value = range.id;
      }
      // Nur die drei stärksten übernehmen; DB-Kindzeilen sind anders als Live-Sweeps nicht sortiert.
      const sweeps = strongestSetupSweeps(setup.sweeps ?? [{ level: setup.ls, timeframe: "5M" }]);
      const confirmations = sweeps.map((sw) => ({
        kind: "pivot", price: sw.level.price, sourceTime: sw.level.pivotTime,
        touchedTime: sw.level.touchedTime ?? null, instrument, timeframe: sw.timeframe,
        levelDirection: setup.dir === 1 ? "high" : "low",
      }));
      confirmations.push({ kind: "ob", price: setup.dir === 1 ? setup.obBottom : setup.obTop,
        sourceTime: setup.obStartTime, touchedTime: null, rangeLow: setup.obBottom,
        rangeHigh: setup.obTop, timeframe: "5M", instrument, direction: directionForSetup(setup) });
      const add = isRangeLevel
        ? (c) => addRangeConfirmation(dealingRangeId, c, "confirmation")
        : (c) => addConfirmationToTrade(trade.id, c, "confirmation");
      // Auch im Fehlerfall alle gestarteten Writes abwarten, bevor die UI wieder freigegeben wird.
      const results = await Promise.allSettled([
        ...confirmations.map(add),
        ...(!bootstrapping && !trade?.isTsc
          ? [updateTrade(trade.id, { stopLoss: deriveSetupEntryInvalidation(setup).invalidation })] : []),
      ]);
      if (results.some((r) => r.status === "rejected" || r.value === false)) {
        throw new Error("Bestätigungen konnten nicht vollständig gespeichert werden. Bitte die Einträge prüfen.");
      }
      // Der OB setzt ggf. eine Default-Invalidierung. Erst danach die genaue Setup-Verknüpfung setzen.
      if (!await linkTradeToSetup(dealingRangeId, instrument, setup)) {
        throw new Error("Setup-Verknüpfung konnte nicht gespeichert werden.");
      }
    } catch (cause) {
      error.value = cause.message || "Trade-Setup konnte nicht übernommen werden.";
    } finally {
      try {
        // Teilweise gespeicherte Einträge ebenfalls anzeigen, damit ein Retry keine blinden Duplikate erzeugt.
        if (dealingRangeId != null && await refresh() === false) throw new Error();
      } catch {
        error.value = [error.value, "Anzeige konnte nicht aktualisiert werden. Bitte Daten neu laden."].filter(Boolean).join(" ");
      } finally {
        saving.value = false;
      }
    }
  }
  return { saving, error, save };
}
