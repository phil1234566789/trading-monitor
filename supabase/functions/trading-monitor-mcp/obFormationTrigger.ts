import { detectOrderBlocks } from "./orderBlockDetection.js";
import { barSecondsFor } from "./timeframes.ts";

export interface TriggerCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Ein NEU ENTSTEHENDER M5-OB muss den Loop selbst wecken, statt erst beim naechsten Tick zum
// Watch-Level zu werden (docs/attention-levels.md, Level b/c: "oder ein neuer M5-OB entsteht" —
// bis 10.09.2026 offen). Sonst Henne-Ei: der naechste Tick kommt nur, wenn ein ALTES Watch-Level
// getroffen wird. GBPUSD 09.09.2026: der 09:20-Tick wartete auf einen 12 Tage alten OB-Rand 3,5
// Pips ueber dem Kurs, waehrend um 09:20 die eigentliche Entry-Zone 1.35647-1.3568 entstand —
// deren Rand haette die 09:45-Kerze (High 1.35649) getroffen. Der naechste Tick kam erst um 10:00,
// der Trade (+8,5R) war weg.
//
// detectOrderBlocks legt eine Zone auf der FVG-Kerze an: startTime ist die MITTLERE der drei
// Kerzen, entdeckt wird die Zone auf der darauffolgenden — bekannt ist sie also erst mit deren
// Schluss. Genau dieser Zeitpunkt ist der Trigger; frueher zu wecken waere derselbe
// Lookahead-Leak wie in replayAsOf.ts.
export function firstObFormationTimeAfter(candles: TriggerCandle[], sinceSec: number, untilSec: number): number | null {
  const barSec = barSecondsFor("5m");
  let earliest: number | null = null;
  for (const zone of detectOrderBlocks(candles, "5m", true)) {
    const startIdx = candles.findIndex((c) => c.time === zone.startTime);
    const formingCandle = startIdx < 0 ? null : candles[startIdx + 1];
    if (formingCandle == null) continue;
    const knownAtSec = formingCandle.time + barSec;
    if (knownAtSec <= sinceSec || knownAtSec > untilSec) continue;
    if (earliest == null || knownAtSec < earliest) earliest = knownAtSec;
  }
  return earliest;
}
