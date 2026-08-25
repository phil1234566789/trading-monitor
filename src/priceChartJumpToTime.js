// Kernlogik von jumpToTimeRange (PriceChart.vue: jumpToTrade/jumpToPin/jumpToDivergence) — per
// Kommentar-Verschlankung (2026-08-25) hierher extrahiert, damit die Bug-Historie in Testfällen
// statt als Fließtext-Kommentar lebt (Philip: "so würde ich es als Software Dev machen"). Zwei
// unabhängig testbare Teile: das Nachladen/Verbrücken der Kerzen (async, braucht einen injizierten
// Fetch statt echtem Netzwerk) und die reine Viewport-Positionierung (synchron, keine chart/
// candleSeries-Abhängigkeit — anders als der Rest von PriceChart.vue).
import { isTimeCovered, snapToBarTime } from "./chartTimeUtils.js";

// Bug-Report Philip 2026-07-30, zweite Runde: die erste Version lud Seite für Seite RÜCKWÄRTS ab
// dem aktuellen Datenanfang, bis entryTime erreicht war — bei einem 16 Tage alten Trade schon
// spürbar langsam, bei einem echt alten Trade (Philip: "2022 Trade der Supergau") wären das
// hunderte sequentielle Requests gewesen. Stattdessen ein GEZIELTER Fetch direkt um den Trade herum
// (Anker kurz nach dem Exit, siehe bufferBars), unabhängig davon, wie weit der Trade zurückliegt.
// maxPages ist nur eine Notbremse für ungewöhnlich lange Trades (Entry Wochen vor Exit), keine
// Regelgröße.
//
// Bug-Report Philip 2026-08-18: der Anker startete IMMER nah am Trade selbst — das Ergebnis landet
// vorne an allCandles, MIT einer bewussten Lücke zum bisherigen Datenanfang dazwischen
// (lightweight-charts braucht nur strikt aufsteigende Zeiten, keine Lückenlosigkeit). Scrollt man
// danach über das Trade-Fenster hinaus Richtung "jetzt", landet man sichtbar in genau dieser Lücke.
//
// Bug-Report Philip 2026-08-19 (DR#40, 03.06., über zwei Monate alt): ein erster Fix-Versuch hat
// per Kalender-Sekunden GESCHÄTZT, ob die Lücke ins Budget passt — zu ungenau, Wochenenden ohne
// Kerzen lassen sich in Wirklichkeit viel weiter zurückbrücken, als eine reine Kalendertage-Rechnung
// annimmt (leeres Wochenende kostet 0 vom Kerzen-Budget, aber 2 Kalendertage). Jetzt stattdessen ECHT
// versuchen statt schätzen: zuerst gezielt um den Trade herum laden, danach mit eigenem Page-Budget
// versuchen, die entstandene Lücke per Splice INS Array einzufügen (nicht per concat davor, die
// Brücke gehört zeitlich dazwischen) — nur übernehmen, wenn sie auch WIRKLICH lückenlos verbindet,
// sonst lieber die alte, bewusste Lücke behalten als eine neue, nur halb gefüllte zu hinterlassen.
//
// fetchOlderCandles(anchorTime): Promise<candle[]> — injiziert statt fest verdrahtet, damit hier
// ohne echtes Netzwerk getestet werden kann (PriceChart.vue übergibt fetchOlderForexCandles).
export async function loadCandlesAroundTrade(allCandles, entryTime, exitTime, barSeconds, fetchOlderCandles, { bufferBars, maxPages }) {
  if (isTimeCovered(allCandles, entryTime, barSeconds)) return allCandles;

  const preexistingOldest = allCandles.length > 0 ? allCandles[0].time : null;
  let candles = allCandles;
  let anchor = (exitTime ?? entryTime) + bufferBars * barSeconds;
  let pages = 0;
  while (pages < maxPages && !isTimeCovered(candles, entryTime, barSeconds)) {
    const older = await fetchOlderCandles(anchor);
    if (older.length === 0) break;
    candles = older.concat(candles);
    anchor = candles[0].time;
    pages++;
  }

  if (preexistingOldest != null) {
    const boundaryIdx = candles.findIndex((c) => c.time === preexistingOldest);
    if (boundaryIdx > 0) {
      let bridge = [];
      let bridgeAnchor = preexistingOldest;
      let bridgePages = 0;
      while (bridgePages < maxPages) {
        const older = await fetchOlderCandles(bridgeAnchor);
        if (older.length === 0) break;
        bridge = older.concat(bridge);
        bridgeAnchor = bridge[0].time;
        bridgePages++;
        if (bridgeAnchor <= candles[boundaryIdx - 1].time) break;
      }
      if (bridge.length > 0 && bridgeAnchor <= candles[boundaryIdx - 1].time) {
        candles = [...candles.slice(0, boundaryIdx), ...bridge, ...candles.slice(boundaryIdx)];
      }
    }
  }
  return candles;
}

// Für den "auf einen Trade/Divergenz/Pin springen"-Sprung (Chat 2026-07-27: "auf den Trade klicken
// und dann im Chart gleich an diese Stelle springen") — bewusst NICHT über Replay gelöst (das würde
// alle Kerzen nach dem Trade ausblenden, man will beim Review aber gerade sehen, wie's danach
// weiterging), sondern eine reine Viewport-Verschiebung. Per Bar-Index (Logical Range) statt Zeit
// UND mit der aktuell schon eingestellten Zoomweite reproduziert — ein fester Bar-Count hätte bei
// jedem Sprung immer dieselbe (zu enge) Zoomstufe erzwungen, unabhängig davon, wie weit der User
// gerade rausgezoomt hatte (Bug-Report Philip 2026-07-27: "muss immer ein ganzes Stück rauszoomen,
// Candles zu riesig"). Nur wenn die aktuelle Zoomweite den Trade selbst (Entry bis Exit) nicht
// einmal abdecken würde, wird sie für diesen einen Sprung testweise erweitert (minBarsPastSpan).
//
// currentVisibleRange = chart.timeScale().getVisibleLogicalRange() (oder null), von PriceChart.vue
// übergeben — reine Eingabe, kein chart-Zugriff hier. Rückgabe null, wenn candles leer sind oder
// entryTime/exitTime auf keine geladene Kerze snappen (Aufrufer tut in dem Fall nichts).
export function computeJumpViewport(candles, entryTime, exitTime, currentVisibleRange, { minBarsPastSpan = 15 } = {}) {
  if (candles.length === 0) return null;
  const from = snapToBarTime(candles, entryTime) ?? entryTime;
  const to = exitTime != null ? (snapToBarTime(candles, exitTime) ?? exitTime) : from;
  const fromIdx = candles.findIndex((c) => c.time === from);
  const toIdx = candles.findIndex((c) => c.time === to);
  if (fromIdx === -1 || toIdx === -1) return null;

  const centerIdx = (fromIdx + toIdx) / 2;
  const tradeSpanBars = Math.abs(toIdx - fromIdx);
  const currentBars = currentVisibleRange ? currentVisibleRange.to - currentVisibleRange.from : 100;
  const halfBars = Math.max(currentBars / 2, tradeSpanBars / 2 + minBarsPastSpan);
  return { from: centerIdx - halfBars, to: centerIdx + halfBars };
}
