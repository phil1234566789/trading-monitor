import { afterEach, expect, it, vi } from "vitest";
import { fetchCandlesCached } from "../src/candleCache.js";

afterEach(() => vi.unstubAllGlobals());

it("refetches the full live window instead of keeping an interior month-long cache gap", async () => {
  const candle = (time) => ({ time, open: 1, high: 1, low: 1, close: 1 });
  const base = Math.floor(Date.now() / 1000) - 40 * 86400;
  const full = Array.from({ length: 960 }, (_, i) => candle(base + i * 3600));
  let stored = { candles: [...full.slice(0, 10), ...full.slice(-10)], completeUpTo: full.at(-1).time };
  // Kleiner asynchroner IndexedDB-Adapter: geprüft wird der echte Ladepfad, nicht ein Helper.
  vi.stubGlobal("indexedDB", {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          transaction() {
            const tx = {
              objectStore: () => ({
                get() {
                  const read = {};
                  queueMicrotask(() => { read.result = stored; read.onsuccess(); });
                  return read;
                },
                put(value) {
                  stored = value;
                  queueMicrotask(() => tx.oncomplete());
                },
              }),
            };
            return tx;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  });
  const fetch = vi.fn(async (_symbol, _bar, count) => full.slice(-count));
  const result = await fetchCandlesCached(fetch, "GBPUSD", "1h", full.length, undefined);
  expect(fetch).toHaveBeenCalledWith("GBPUSD", "1h", full.length, undefined);
  expect(result).toEqual(full);
  expect(stored.candles).toEqual(full);
});
