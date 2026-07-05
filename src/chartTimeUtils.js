// timeToCoordinate() liefert nur fuer exakt vorhandene Bar-Zeiten ein Ergebnis (sonst
// null) — Zeitstempel aus der DB (Trades, POI-Zonen) treffen aber nicht zwingend exakt
// auf eine Kerze des aktuell gewaehlten Timeframes. Deshalb hier auf die Kerze "snappen",
// die den Zeitpunkt enthaelt (letzte Kerze mit time <= target).
export function snapToBarTime(candles, targetTime) {
  if (!candles || candles.length === 0) return null;
  if (targetTime <= candles[0].time) return candles[0].time;
  if (targetTime >= candles[candles.length - 1].time) return candles[candles.length - 1].time;

  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (candles[mid].time <= targetTime) lo = mid;
    else hi = mid - 1;
  }
  return candles[lo].time;
}
