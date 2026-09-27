import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNextCandle } from "../src/forexCandles.js";
import { supabase } from "../src/supabaseClient.js";

vi.mock("../src/supabaseClient.js", () => ({ supabase: { from: vi.fn() } }));
let query;
beforeEach(() => {
  query = Object.fromEntries(["select", "eq", "gt", "order"].map((method) => [method, vi.fn().mockReturnThis()]));
  query.limit = vi.fn();
  supabase.from.mockReturnValue(query);
});

describe("native replay candle request", () => {
  it("reads exactly one candle in ascending order after the current time", async () => {
    query.limit.mockResolvedValue({ data: [{ time: "2026-07-06T00:00:00Z", open: 1, high: 2, low: 0, close: 1.5, volume: 10 }], error: null });
    const after = Date.parse("2026-07-03T20:55:00Z") / 1000;
    const candle = await fetchNextCandle("GBPUSD", "5m", after);
    expect(query.limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(query.order).toHaveBeenCalledExactlyOnceWith("time", { ascending: true });
    expect(query.gt).toHaveBeenCalledExactlyOnceWith("time", new Date(after * 1000).toISOString());
    expect(query.eq).toHaveBeenCalledWith("instrument", "GBPUSD");
    expect(query.eq).toHaveBeenCalledWith("bar", "5m");
    expect(candle).toEqual({ time: Date.parse("2026-07-06T00:00:00Z") / 1000, open: 1, high: 2, low: 0, close: 1.5, volume: 10 });
  });
  it("returns no step at the feed end and propagates fetch errors", async () => {
    query.limit.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchNextCandle("GBPUSD", "5m", 300)).toBeNull();
    query.limit.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    await expect(fetchNextCandle("GBPUSD", "5m", 300)).rejects.toThrow("offline");
  });
});
