// Live-Setup-1 für poi-watcher und get_data_snapshot: die Chart-Pipeline (src/setup1Detection.js) plus
// der Live-Preis-Touch, den nur die Backend-Seite braucht (sie sieht nur geschlossene Kerzen).
import type { Candle } from "./orderBlocks.ts";
import type { LiquidityLevel } from "./liquidityDetection.ts";
import type { DetectedTradeSetup, TradeSetupParams } from "./tradeSetup.ts";
import { setup1Inputs, setup1H1Structure, setup1H1Levels, detectSetup1, setup1AlarmCandidates } from "../../../src/setup1Detection.js";

export interface LiveSetup1 {
  detected: DetectedTradeSetup[];
  params: TradeSetupParams;
  minGap: number | null;
}

// m5Candles/h1Candles: markiert (ignored), älteste zuerst. currentPrice null = nur Kerzenschluss.
export function detectLiveSetup1({ instrument, m5Candles, h1Candles, nowSec, structureStartSec, currentPrice }: {
  instrument: string; m5Candles: Candle[]; h1Candles: Candle[]; nowSec: number; structureStartSec: number | null; currentPrice: number | null;
}): LiveSetup1 {
  const h1 = setup1H1Levels(setup1H1Structure(h1Candles, { nowSec, structureStartSec }));
  const inputs = setup1Inputs(instrument, m5Candles);
  // Sonst gälte ein schon gebrochenes Level bis zum nächsten Kerzenschluss (bis zu 1h bei H1) als unberührt.
  const touch = (levels: LiquidityLevel[], high: boolean) => {
    if (currentPrice == null) return;
    for (const lvl of levels) {
      if (!lvl.touched && (high ? currentPrice >= lvl.price : currentPrice <= lvl.price)) {
        lvl.touched = true;
        lvl.touchedTime = nowSec;
      }
    }
  };
  touch(inputs.m5Highs, true);
  touch(inputs.m5Lows, false);
  touch(h1.highs, true);
  touch(h1.lows, false);
  return { detected: setup1AlarmCandidates(detectSetup1(inputs, h1.highs, h1.lows), inputs.params), params: inputs.params, minGap: inputs.minGap };
}
