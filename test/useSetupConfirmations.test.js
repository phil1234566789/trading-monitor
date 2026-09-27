import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useSetupConfirmations } from "../src/composables/useSetupConfirmations.js";
import * as intake from "../src/tradeIntake.js";

vi.mock("../src/tradeIntake.js", () => ({
  directionForSetup: (s) => s.dir === 1 ? "short" : "long",
  deriveSetupEntryInvalidation: () => ({ invalidation: 20 }),
  createDealingRange: vi.fn(), addRangeConfirmation: vi.fn(),
  addConfirmationToTrade: vi.fn(), updateTrade: vi.fn(), linkTradeToSetup: vi.fn(),
}));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const setup = { dir: 1, obTop: 20, obBottom: 18, obStartTime: 900,
  sweeps: [1, 2].map((price) => ({ timeframe: "5M", level: { price, pivotTime: 300 } })) };
function context() {
  return { currentSymbol: ref("XAUUSD"), confirmationAddTrade: ref(null),
    rangeConfirmationAddTrade: ref(null), tscBootstrapArmed: ref(true), tscRangeId: ref(null),
    refreshTscRange: vi.fn().mockResolvedValue(true), refreshTrades: vi.fn().mockResolvedValue(true) };
}
beforeEach(() => {
  vi.resetAllMocks();
  intake.createDealingRange.mockResolvedValue({ id: 42 });
  for (const name of ["addRangeConfirmation", "addConfirmationToTrade", "updateTrade", "linkTradeToSetup"]) intake[name].mockResolvedValue(true);
});
it("saves evidence concurrently, links only afterwards and stays busy through refresh", async () => {
  const writes = [deferred(), deferred(), deferred()];
  writes.forEach((d) => intake.addRangeConfirmation.mockImplementationOnce(() => d.promise));
  const c = context(); const reload = deferred(); c.refreshTscRange.mockReturnValue(reload.promise);
  const action = useSetupConfirmations(c);
  const pending = action.save(setup);
  expect(action.saving.value).toBe(true);
  await vi.waitFor(() => expect(intake.addRangeConfirmation).toHaveBeenCalledTimes(3));
  expect(intake.linkTradeToSetup).not.toHaveBeenCalled();
  await action.save(setup);
  expect(intake.createDealingRange).toHaveBeenCalledTimes(1);
  c.currentSymbol.value = "GBPUSD";
  writes.forEach((d) => d.resolve(true));
  await vi.waitFor(() => expect(c.refreshTscRange).toHaveBeenCalled());
  expect(intake.linkTradeToSetup).toHaveBeenCalledWith(42, "XAUUSD", setup);
  expect(action.saving.value).toBe(true);
  reload.resolve(true); await pending;
  expect(action.saving.value).toBe(false);
  expect(action.error.value).toBe("");
});
it("waits for remaining writes on failure, refreshes partial data and reports the failure", async () => {
  const slow = deferred(); const c = context();
  intake.addRangeConfirmation.mockResolvedValueOnce(false).mockReturnValueOnce(slow.promise);
  const action = useSetupConfirmations(c); const pending = action.save(setup);
  await vi.waitFor(() => expect(intake.addRangeConfirmation).toHaveBeenCalledTimes(3));
  expect(action.saving.value).toBe(true);
  expect(c.refreshTscRange).not.toHaveBeenCalled();
  slow.resolve(true); await pending;
  expect(action.saving.value).toBe(false);
  expect(action.error.value).toContain("nicht vollständig");
  expect(c.refreshTscRange).toHaveBeenCalled();
  expect(intake.linkTradeToSetup).not.toHaveBeenCalled();
});
it("keeps position confirmations and stop-loss on the execution, including legacy single-sweep setups", async () => {
  const c = context(); c.tscBootstrapArmed.value = false;
  c.confirmationAddTrade.value = { id: 9, dealingRangeId: 42 };
  const action = useSetupConfirmations(c);
  await action.save({ ...setup, sweeps: undefined, ls: { price: 15, pivotTime: 300 } });
  expect(intake.addConfirmationToTrade).toHaveBeenCalledTimes(2);
  expect(intake.addConfirmationToTrade).toHaveBeenCalledWith(9, expect.objectContaining({ kind: "pivot", timeframe: "5M" }), "confirmation");
  expect(intake.addRangeConfirmation).not.toHaveBeenCalled();
  expect(intake.updateTrade).toHaveBeenCalledWith(9, { stopLoss: 20 });
  expect(c.refreshTrades).toHaveBeenCalled();
});
it("clears busy and reports a failed refresh after successful writes", async () => {
  const c = context(); c.refreshTscRange.mockRejectedValue(new Error("offline"));
  const action = useSetupConfirmations(c); await action.save(setup);
  expect(action.saving.value).toBe(false);
  expect(action.error.value).toContain("Anzeige konnte nicht aktualisiert werden");
});
