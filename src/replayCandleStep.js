import { nextCandleAfter } from "./chartTimeUtils.js";

export function isPreparedReplayStep(step, previous, until) {
  return previous != null && step?.from === previous && step?.to === until;
}

// Ein Replay-Schritt gibt nur die nächste Kerze frei. Das Initialfenster würde die
// per Scroll geladene Historie verlieren und im herausgezoomten Chart erneut laden.
export async function nextReplayCandle(candles, after, fetchNext) {
  const time = after == null ? candles[0]?.time : nextCandleAfter(candles, after);
  if (time != null) return candles.find((c) => c.time === time);
  return after == null ? null : fetchNext(after);
}
