// Session-Kontext ("Asia-High", "NY-Low", "MMM-High") für die gerade geladenen Kerzen — ein
// Auflöser, den alle Chart-Beschriftungen teilen.
//
// Stand bis 2026-09-21 als private attachBonus-Funktion nur in usePriceChartLiquidity.js. Philip
// will den Kontext jetzt auch an den Sweep-Linien ("wenn ein Liquidity Sweep gleichzeitig ein Asia
// High ist, dann schon bitte dazuschreiben"), und die hängen an zwei weiteren Stellen: der
// Trade-Setup-Zeichnung und der 1h-LQ-Sweep-Linie. Die beiden müssen dasselbe Label zeigen, weil
// sie oft exakt übereinander liegen (siehe collectH1LqLevels) — drei Kopien desselben
// Lookup-Aufbaus wären genau der Weg, auf dem sie auseinanderlaufen.
import { sessions } from "./sessions.js";
import { buildSessionContextLookup, bonusLabelForPivot } from "./sessionOccurrences.js";

// tzOffsetMinutes exakt wie bei den Sessions-Bändern selbst (usePriceChartSessionsAndNews.js:
// refreshSessions) — Browser-Lokalzeit statt eines fest verdrahteten Berlin-Intl-Offsets, damit ein
// Bonus-Label niemals von den Bändern abweicht, die Philip auf demselben Chart ohnehin sieht.
export function createSessionBonusResolver(candles, symbol) {
  if (!candles || candles.length === 0) return () => null;
  const lookup = buildSessionContextLookup(
    sessions.filter((s) => s.instrument === symbol),
    candles[0]?.time ?? 0,
    (candles[candles.length - 1]?.time ?? 0) + 1,
    (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset(),
    candles,
  );
  // dir: 1 = High, -1 = Low — dieselbe Konvention wie im Liquidity-Level-Objekt.
  return (pivotTime, dir, price) => bonusLabelForPivot(pivotTime, dir, price, lookup);
}
