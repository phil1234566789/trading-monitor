import { expect, it } from 'vitest';
import { detectOrderBlocks } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as mcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as backend } from '../supabase/functions/_shared/orderBlocks.ts';
import { GOLD_H1_MIN_FVG_USD } from '../src/goldH1ObConfig.js';

const candle = (time,low,high) => ({time,low,high,open:low,close:high});
it('uses the Gold H1 absolute threshold consistently across all three detectors', () => {
  const rows = [candle(0,4390,4400),candle(3600,4390,4400),candle(7200,4399,4405),candle(10800,4402.53,4410)];
  for (const detect of [detectOrderBlocks,mcp,backend]) {
    expect(detect(rows,'1H',false,GOLD_H1_MIN_FVG_USD)).toHaveLength(1);
    expect(detect(rows.map((c,i)=>i===3?{...c,low:4402.52,open:4402.52}:c),'1H',false,GOLD_H1_MIN_FVG_USD)).toHaveLength(0);
    expect(detect(rows,'1H',false,GOLD_H1_MIN_FVG_USD)).toEqual(detectOrderBlocks(rows,'1H',false,GOLD_H1_MIN_FVG_USD));
  }
});
