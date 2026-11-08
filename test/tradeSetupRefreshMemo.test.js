import { afterEach, expect, it, vi } from 'vitest';
import * as detection from '../src/tradeSetup.js';
import { usePriceChartTradeSetups } from '../src/composables/usePriceChartTradeSetups.js';
afterEach(() => vi.restoreAllMocks());

it('detects equal H1/M5/DB refresh inputs only once, but retries corrected/history/settings inputs', () => {
  const calls = vi.spyOn(detection, 'detectTradeSetups');
  const api = usePriceChartTradeSetups();
  const input = { symbol: 'XAUUSD', marketStructureState: null, dbTradeSetups: [], tradeSetupHistoryCount: 1,
    candles: Array.from({ length: 20 }, (_, i) => ({ time: 1790000000 + i * 300, open: 2, high: 3, low: 1, close: 2 })) };
  api.computeTradeSetups(input);
  api.computeTradeSetups(structuredClone(input));
  expect(calls).toHaveBeenCalledTimes(2); // Eine Erkennung je Richtung.
  const corrected = structuredClone(input); corrected.candles[3].high = 4;
  api.computeTradeSetups(corrected);
  expect(calls).toHaveBeenCalledTimes(4);
  api.computeTradeSetups({ ...corrected, tradeSetupHistoryCount: 2 });
  expect(calls).toHaveBeenCalledTimes(6);
  api.computeTradeSetups({ ...input, candles: [] });
  api.computeTradeSetups(input);
  expect(calls).toHaveBeenCalledTimes(8);
});
