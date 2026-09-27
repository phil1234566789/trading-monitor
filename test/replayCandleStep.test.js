import { describe, expect, it, vi } from "vitest";
import { nextReplayCandle, isPreparedReplayStep } from "../src/replayCandleStep.js";

describe("nextReplayCandle", () => {
  it("only preserves the window for the prepared step, never live/replay switches or date jumps", () => {
    const step = { from: 300, to: 600 };
    expect(isPreparedReplayStep(step, 300, 600)).toBe(true);
    expect(isPreparedReplayStep(step, null, 600)).toBe(false);
    expect(isPreparedReplayStep(step, 300, null)).toBe(false);
    expect(isPreparedReplayStep(null, 300, 600)).toBe(false);
    expect(isPreparedReplayStep(step, 300, 900)).toBe(false);
    expect(isPreparedReplayStep(step, 600, 900)).toBe(false);
  });
  it("uses the loaded lookahead without requesting or replacing weeks of history", async () => {
    const candles = Array.from({ length: 6000 }, (_, i) => ({ time: i * 300 }));
    const fetchNext = vi.fn();
    const result = await nextReplayCandle(candles, 5998 * 300, fetchNext);
    expect(result).toBe(candles[5999]);
    expect(candles).toHaveLength(6000);
    expect(fetchNext).not.toHaveBeenCalled();
  });

  it("requests only the next candle when lookahead is exhausted, including weekends", async () => {
    const candles = [{ time: 300 }];
    const next = { time: 300 + 2 * 86400 };
    const fetchNext = vi.fn().mockResolvedValue(next);
    expect(await nextReplayCandle(candles, 300, fetchNext)).toBe(next);
    expect(fetchNext).toHaveBeenCalledExactlyOnceWith(300);
    expect(candles).toEqual([{ time: 300 }]);
  });

  it("does not invent a candle at the end of the available feed", async () => {
    expect(await nextReplayCandle([{ time: 300 }], 300, async () => null)).toBeNull();
  });
});
