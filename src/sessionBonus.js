// Session-Kontext ("Asia-High", "NY-Low", "MMM-High") für die gerade geladenen Kerzen — ein
// Auflöser, den alle Chart-Beschriftungen teilen.
//
// Stand bis 2026-09-21 als private attachBonus-Funktion nur in usePriceChartLiquidity.js. Philip
// will den Kontext jetzt auch an den Sweep-Linien ("wenn ein Liquidity Sweep gleichzeitig ein Asia
// High ist, dann schon bitte dazuschreiben"), und die hängen an zwei weiteren Stellen: der
// Trade-Setup-Zeichnung und der 1h-LQ-Sweep-Linie. Die beiden müssen dasselbe Label zeigen, weil
// sie oft exakt übereinander liegen (siehe collectStructureLqLevels) — drei Kopien desselben
// Lookup-Aufbaus wären genau der Weg, auf dem sie auseinanderlaufen.
import { sessions } from "./sessions.js";
import { buildSessionContextLookup, bonusLabelForPivot } from "./sessionOccurrences.js";

// tzOffsetMinutes exakt wie bei den Sessions-Bändern selbst (usePriceChartSessionsAndNews.js:
// refreshSessions) — Browser-Lokalzeit statt eines fest verdrahteten Berlin-Intl-Offsets, damit ein
// Bonus-Label niemals von den Bändern abweicht, die Philip auf demselben Chart ohnehin sieht.
export function createSessionBonusResolver(candles, symbol) {
  if (!candles || candles.length === 0) return () => null;
  const lookup = sessionLookup(candles, symbol);
  // dir: 1 = High, -1 = Low — dieselbe Konvention wie im Liquidity-Level-Objekt.
  return (pivotTime, dir, price) => bonusLabelForPivot(pivotTime, dir, price, lookup);
}

// Session-Name zu einem Zeitpunkt ("NY", "MMM", "Asia", "London", sonst null) — wie sessionLabel in
// analysis/lq2-sweeps/merkmale.mjs. London steht nicht in der sessions-Tabelle, es ist die Lücke 07:00–10:30.
export function createSessionLabelResolver(candles, symbol) {
  if (!candles || candles.length === 0) return () => null;
  const lookup = sessionLookup(candles, symbol);
  return (t) => {
    for (const { label, occurrences } of lookup) if (label && occurrences.some((o) => t >= o.startSec && t < o.endSec)) return label;
    const minute = (((t / 60 - new Date(t * 1000).getTimezoneOffset()) % 1440) + 1440) % 1440;
    return minute >= 420 && minute < 630 ? "London" : null;
  };
}

function sessionLookup(candles, symbol) {
  return buildSessionContextLookup(
    sessions.filter((s) => s.instrument === symbol),
    candles[0]?.time ?? 0,
    (candles[candles.length - 1]?.time ?? 0) + 1,
    (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset(),
    candles,
  );
}
