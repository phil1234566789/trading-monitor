import { describe, expect, it, vi } from "vitest";
import { setupInvalidationTarget } from "../src/setupInvalidationTarget.js";
import { linkTradeToSetup } from "../src/tradeIntake.js";
import { supabase } from "../src/supabaseClient.js";

vi.mock("../src/supabaseClient.js", () => ({ supabase: { from: vi.fn() } }));

describe("setup invalidation chart object", () => {
  it.each([1, -1])("links the extremum instead of the swept level for direction %s", (dir) => {
    const setup = { dir, obTop: 1.2, obBottom: 1.1, obStartTime: 900, ls: { price: 1.15, touchedTime: 300 } };
    const price = dir === 1 ? 1.2 : 1.1;
    const levels = [
      { dir, price: 1.15, pivotTime: 100 },
      { dir, price, pivotTime: 100 },
      { dir, price, pivotTime: 600 },
      { dir, price, pivotTime: 1200 },
    ];
    expect(setupInvalidationTarget(setup, levels, "GBPUSD")).toMatchObject({
      price, sourceTime: 600, timeframe: "5M", levelDirection: dir === 1 ? "high" : "low",
    });
    expect(setupInvalidationTarget(setup, levels.filter((l) => l.pivotTime !== 600), "GBPUSD")).toBeNull();
  });

  it("uses the earliest sweep in a multi-sweep setup", () => {
    const setup = { dir: 1, obTop: 1.2, obStartTime: 900, sweeps: [{ level: { touchedTime: 800 } }, { level: { touchedTime: 300 } }] };
    expect(setupInvalidationTarget(setup, [{ dir: 1, price: 1.2, pivotTime: 600 }], "EURUSD").sourceTime).toBe(600);
  });

  it.each([true, false])("persists the price and replaces stale object links (has level: %s)", async (hasLevel) => {
    const update = vi.fn();
    const upsert = vi.fn();
    supabase.from.mockImplementation((table) => {
      const q = { select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: { id: 7 } }),
        single: async () => ({ data: { id: 99 } }),
        update: (fields) => { update(fields); return q; },
        upsert: (...args) => { upsert(...args); return q; },
      };
      return q;
    });
    await linkTradeToSetup(42, "GBPUSD", {
      dir: 1, obTop: 1.2, obBottom: 1.1, obStartTime: 900,
      invalidationTarget: hasLevel ? { kind: "pivot", instrument: "GBPUSD", timeframe: "5M", levelDirection: "high", price: 1.2, sourceTime: 600 } : null,
    });
    expect(update).toHaveBeenCalledWith({ trade_setup_id: 7, invalidation: 1.2,
      invalidation_liquidity_level_id: hasLevel ? 99 : null, invalidation_ob_zone_id: null });
    expect(upsert).toHaveBeenCalledTimes(hasLevel ? 1 : 0);
  });
});
