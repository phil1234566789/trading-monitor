import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { useTscRange } from "../src/composables/useTscRange.js";
import { fetchActiveTscRangeId, fetchDealingRangeCockpit } from "../src/trades.js";

vi.mock("../src/trades.js", () => ({
  fetchActiveTscRangeId: vi.fn(),
  fetchDealingRangeCockpit: vi.fn(),
}));

let scope;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup() {
  scope = effectScope();
  const symbol = ref("GBPUSD");
  return { symbol, state: scope.run(() => useTscRange(symbol)) };
}
beforeEach(() => {
  vi.resetAllMocks();
  fetchActiveTscRangeId.mockResolvedValue(10);
  fetchDealingRangeCockpit.mockImplementation(async (id) => ({ id }));
});
afterEach(() => scope.stop());

describe("journal range selection", () => {
  it("opens the existing range and returns to the original idea without changing either", async () => {
    const { state } = setup();
    await settle();
    expect(state.rangeId.value).toBe(10);
    await state.openJournal(42, "GBPUSD");
    expect(state.fromJournal.value).toBe(true);
    expect(state.range.value.id).toBe(42);
    await state.closeJournal();
    expect(state.fromJournal.value).toBe(false);
    expect(state.range.value.id).toBe(10);
  });

  it("switches instrument and protects journal selection from a slow automatic load", async () => {
    let resolveActive;
    fetchActiveTscRangeId.mockImplementationOnce(() => new Promise((resolve) => { resolveActive = resolve; }));
    const { state, symbol } = setup();
    await state.openJournal(42, "EURUSD");
    resolveActive(10);
    await settle();
    expect(symbol.value).toBe("EURUSD");
    expect(state.range.value.id).toBe(42);
    expect(state.fromJournal.value).toBe(true);
    symbol.value = "GBPUSD";
    await settle();
    expect(state.fromJournal.value).toBe(false);
    expect(state.range.value.id).toBe(10);
  });

  it("keeps a failed journal load protected and allows returning to the active idea", async () => {
    const { state } = setup();
    await settle();
    fetchDealingRangeCockpit.mockRejectedValueOnce(new Error("offline"));
    await state.openJournal(42, "GBPUSD");
    expect(state.rangeId.value).toBeNull();
    expect(state.fromJournal.value).toBe(true);
    expect(state.error.value).toContain("offline");
    await state.closeJournal();
    expect(state.range.value.id).toBe(10);
  });
});
