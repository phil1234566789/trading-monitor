// Zeichnung "Liquidität 2.0 > Liquidity-Sweeps" — eigener Indikator neben dem alten LQ-Algo, damit Philip
// vorher/nachher vergleichen kann. Erkennung in liquidity2.js; Linie und Label über LiquidityLinePrimitive wie
// beim alten Algo, nur mit eigenen Chart-Style-Farben (liquidity2High/-Low/-Sweep).
import { LiquidityLinePrimitive, bullBearLabelSide, formatLiquidityLevelLabel } from "../liquidity.js";
import { detectStrongLiquidityLevels, formatStrongLiquidityLabel } from "../liquidity2.js";
import { markIgnored } from "../ignoredCandles.js";
import { cssColor } from "../chartColors.js";
import { lineWidth } from "../chartLineWidths.js";

const styleKey = (lvl) => (lvl.touched ? "liquidity2Sweep" : lvl.dir === 1 ? "liquidity2High" : "liquidity2Low");

export function usePriceChartLiquidity2() {
  const primitives = [];

  function clear(series) {
    for (const p of primitives) series?.detachPrimitive(p);
    primitives.length = 0;
  }

  // candles = bereits replay-geschnittene Kerzen des Chart-Timeframes; Sweeps nach dem Replay-Zeitpunkt sind
  // dadurch noch nicht bekannt, der LS bleibt dort aktiv.
  function refresh(series, candles, { show, symbol, nowSec }) {
    clear(series);
    if (!series || !show || candles.length === 0) return;
    for (const lvl of detectStrongLiquidityLevels(markIgnored(candles, symbol), { instrument: symbol })) {
      const key = styleKey(lvl);
      const primitive = new LiquidityLinePrimitive(
        lvl,
        {
          color: cssColor(key),
          lineWidth: lineWidth(key),
          label: formatStrongLiquidityLabel(lvl, formatLiquidityLevelLabel(lvl, { nowSec })),
          labelSide: bullBearLabelSide(lvl.dir === 1),
        },
        candles,
      );
      series.attachPrimitive(primitive);
      primitives.push(primitive);
    }
  }

  return { refresh, clear };
}
