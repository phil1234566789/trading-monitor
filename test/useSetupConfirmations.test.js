import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useSetupConfirmations } from "../src/composables/useSetupConfirmations.js";
import * as intake from "../src/tradeIntake.js";
import goldRepro from "./fixtures/xauusd-tsc-sweeps-20260921.json";

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

it.each([1, -1])("imports only the three oldest sweeps before the OB (direction %s)", async (dir) => {
  const c = context(); c.tscBootstrapArmed.value = false;
  c.rangeConfirmationAddTrade.value = { dealingRangeId: 42, isTsc: true };
  // DB-Kindzeilen sind nicht sortiert; ein früherer Pivot ist nicht immer das älteste Level beim Touch.
  const sweeps = [
    { timeframe: "5M", level: { price: 11, pivotTime: 100, touchedTime: 200 } },
    { timeframe: "1H", level: { price: 12, pivotTime: 1000, touchedTime: 2000 } },
    { timeframe: "5M", level: { price: 13, pivotTime: 700, touchedTime: 1000 } },
    { timeframe: "5M", level: { price: 14, pivotTime: 600, touchedTime: 1000 } },
    { timeframe: "1H", level: { price: 15, pivotTime: 500, touchedTime: 1000 } },
  ];
  const original = structuredClone(sweeps);
  const action = useSetupConfirmations(c);
  await action.save({ ...setup, dir, sweeps });
  const evidence = intake.addRangeConfirmation.mock.calls.map(([, value]) => value);
  expect(evidence.map((e) => e.price)).toEqual([12, 15, 14, dir === 1 ? 18 : 20]);
  expect(evidence.filter((e) => e.kind === "pivot").map((e) => e.timeframe)).toEqual(["1H", "1H", "5M"]);
  expect(evidence.at(-1)).toMatchObject({ kind: "ob", sourceTime: 900, rangeLow: 18, rangeHigh: 20 });
  expect(sweeps).toEqual(original);
  expect(intake.linkTradeToSetup).toHaveBeenCalled();
  expect(intake.updateTrade).not.toHaveBeenCalled();
});

it("keeps all three sweeps when there are no extra levels", async () => {
  const c = context();
  const sweeps = [3, 2, 1].map((price) => ({ timeframe: "5M", level: { price, pivotTime: 100, touchedTime: 200 } }));
  await useSetupConfirmations(c).save({ ...setup, sweeps });
  expect(intake.addRangeConfirmation.mock.calls.map(([, value]) => value.kind)).toEqual(["pivot", "pivot", "pivot", "ob"]);
});

it("keeps the three strongest sweeps and unchanged OB from the Gold September 21 report", async () => {
  const c = context(); c.tscBootstrapArmed.value = false;
  c.rangeConfirmationAddTrade.value = { dealingRangeId: 124, isTsc: true };
  const toSec = (time) => Date.parse(time) / 1000;
  const sweeps = goldRepro.evidence.filter((e) => e.kind === "pivot").map((e) => ({
    timeframe: e.timeframe, level: { price: e.price, pivotTime: toSec(e.source_time), touchedTime: toSec(e.touched_time) },
  }));
  const ob = goldRepro.ob[0];
  await useSetupConfirmations(c).save({ dir: 1, sweeps, obTop: ob.top, obBottom: ob.bottom, obStartTime: toSec(ob.start_time) });
  const evidence = intake.addRangeConfirmation.mock.calls.map(([, value]) => value);
  expect(evidence).toHaveLength(4);
  expect(evidence.map((e) => goldRepro.evidence.find((source) => source.kind === e.kind && source.price === e.price)?.id))
    .toEqual(goldRepro.expectedEvidenceIds);
  expect(evidence.map((e) => e.price)).toEqual([4368.15, 4365.36, 4361.97, 4367.05]);
  expect(evidence.at(-1)).toMatchObject({ kind: "ob", rangeLow: 4367.05, rangeHigh: 4374.8, timeframe: "5M" });
  expect(goldRepro.evidence.filter((e) => e.kind === "pivot")).toHaveLength(5);
});
