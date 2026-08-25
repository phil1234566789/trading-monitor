// Ursprünglich lokale Funktionen in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 2, 2026-08-25) hierher verschoben — die tatsächliche OB-Erkennung lebt
// weiterhin in orderBlocks.js, hier nur die Merge-/Filter-/Touch-Logik, die PriceChart.vue bisher
// über Closures (props, allCandles, tradeSetupM5Candles) statt über Parameter berechnet hat.
// Aufrufer bauen dafür ein `ctx`-Objekt ({ m5Candles, dbObZones, symbol, replayUntil, price }) statt
// die Closures direkt zu lesen — dieselben Werte, die vorher aus den PriceChart.vue-internen
// Variablen kamen.
import { detectOrderBlocks, obZoneNaturalKey } from "./orderBlocks.js";
import { PIP_SIZE } from "./pipConfig.js";

// Bug-Report Philip 2026-07-31 (Debug-Log bewies es: zone.startTime === zone.endTime): ">="
// ließ die eigene Entstehungs-Kerze des Targets als "Touch" durchgehen, weil deren High/Low die
// Kante ja per Definition selbst berührt (die Kante IST aus dieser Kerze abgeleitet) — endTime
// kollabierte dadurch praktisch immer auf sourceTime, Linie/Box wurden unsichtbar bzw. auf einen
// Punkt zusammengestaucht. ">" schließt die Entstehungs-Kerze aus, sucht nur nach einem SPÄTEREN
// echten Re-Touch.
// Nur für Pivot-Targets (eine einzelne, exakte Preis-Marke auf der GLEICHEN Zeitebene wie die
// gerade angezeigten Kerzen) — für OB-Targets als PRIMÄRER Weg bewusst NICHT verwendet, siehe
// Kommentar bei refreshTradeTargetLinksInternal (PriceChart.vue) (Zeitebenen-Mismatch M5-Kerzen vs.
// 1H/4H-OB). firstCandleTouchRange (direkt darunter) ist trotzdem KEIN Widerspruch dazu — die
// dient dort nur als letzter Fallback, nicht als primäre Quelle.
export function firstCandleTouch(candles, sourceTime, price) {
  const hit = candles.find((c) => c.time > sourceTime && c.low <= price && c.high >= price);
  return hit ? hit.time : null;
}

// Bug-Report Philip 2026-08-07 (OB 1,3466 #29, dealing_range #27 vom 03.08.): eine OB-Box ohne
// touchedTime UND ohne live wiederfindbare Zone (liveObZoneState) zog sich komplett durch den
// Chart bis "jetzt" — die schmale M5-Live-Lookback (~25h, tradeSetupM5Candles,
// Twelve-Data-Rate-Limit-bedingt bewusst eng gehalten) enthält eine 4 Tage alte Zone gar nicht
// mehr, liveObZoneState findet sie darum nie wieder, egal wie oft neu gerendert wird — anders als
// bei firstCandleTouch oben (Bug-Report 2026-07-30) gab es für die Box-Variante bisher GAR KEINEN
// Fallback, der selbst in den bereits geladenen Kerzen nachschaut. Analog zu firstCandleTouch,
// aber für eine Preis-SPANNE (rangeLow/rangeHigh) statt eines einzelnen Preises — dieselbe
// Touch-Definition wie orderBlockDetection.js (low<=top && high>=bottom). Bewusst NUR als
// Fallback NACH liveObZoneState eingesetzt, nicht als Ersatz dafür: `candles` ist hier die gerade
// angezeigte Chart-Zeitebene, die von der tatsächlichen OB-Zeitebene (meist 5M) abweichen kann
// (derselbe Zeitebenen-Mismatch, wegen dem firstCandleTouch oben für OBs nie primär genutzt wird)
// — als letzter Ausweg (Zone nicht mehr live auffindbar) ist eine etwas ungenauere, aber
// tatsächlich endliche Touch-Kerze klar besser als eine für immer bis "jetzt" wachsende Box.
export function firstCandleTouchRange(candles, sourceTime, rangeLow, rangeHigh) {
  const hit = candles.find((c) => c.time > sourceTime && c.low <= rangeHigh && c.high >= rangeLow);
  return hit ? hit.time : null;
}

// PriceChart.vue: currentPriceEstimate — Grundlage für die Pip-Distanz-Eingrenzung unten
// (filterDbObZones) UND für computeHtfLiquidityLevels (Liquidity-Level, siehe dort). Bewusst die
// ROHE, ungeclippte Kerzenliste (allCandles, nicht clipReplay(allCandles)) — war schon vor diesem
// Refactoring so, unverändert übernommen.
export function currentPriceEstimate(allCandles) {
  return allCandles.length > 0 ? allCandles[allCandles.length - 1].close : null;
}

// "Historische OBs"-Toggle (Dashboard-Toolbar) blendet bereits angetestete, aber noch nicht
// invalidierte Zonen aus (analog zum tv-indikator-Toggle, siehe PLAN-notifications.md) —
// invalidierte Zonen bleiben unabhängig davon immer ausgeblendet (eigene, ältere Regel). Gilt
// einheitlich für alle drei Timeframes, kein eigener Feinschalter pro Timeframe nötig.
export function filterHistorical(zones, showHistoricalObs) {
  return showHistoricalObs ? zones : zones.filter((z) => !z.touched);
}

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 9 (Pip-Distanz-
// Eingrenzung): läuft hier client-seitig statt als SQL-WHERE, weil die Kosten bei der hier
// vorliegenden Zeilenzahl ohnehin vernachlässigbar sind (siehe PLAN-chart-objekte-forex.md
// Abschnitt 4a/4b) UND weil "aktueller Preis" für den Vergleich nur hier (im Chart, über die
// gerade geladenen Kerzen) ohne Zusatz-Parameter verfügbar ist — der Dashboard-seitige Poll in
// obZones.js kennt keinen Preis. 200 Pips von Philip bestätigt (2026-08-22), gilt einheitlich für
// OB-Zonen UND (Punkt 12/13) Liquidity-Level.
export const PIP_RELEVANCE_THRESHOLD = 200 * PIP_SIZE;

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7 — 1H/4H kommen aus
// den von poi-watcher persistierten ob_zones statt live über ein fest begrenztes Kerzenfenster
// neu erkannt zu werden (Bug: die alte, inzwischen entfernte 4H-Kerzenladung/das Ranges-Lookback-
// Fenster begrenzten, wie weit zurück eine Zone überhaupt gefunden werden konnte — ältere Zonen
// tauchten nie auf, bis man manuell zurückscrollte). Im Replay zusätzlich auf Zonen bis replayUntil
// beschränkt, damit nicht schon Zonen auftauchen, die "in der Zukunft" (relativ zum Replay-Stand)
// erst entdeckt wurden — analog zum alten filterBtcObsZones-Muster.
export function filterDbObZones(dbObZones, symbol, replayUntil, timeframe, price) {
  const byTf = dbObZones.filter((z) => z.instrument === symbol && z.timeframe === timeframe);
  const byReplay = replayUntil == null ? byTf : byTf.filter((z) => z.startTime <= replayUntil);
  if (price == null) return byReplay;
  return byReplay.filter((z) => z.bottom - PIP_RELEVANCE_THRESHOLD <= price && price <= z.top + PIP_RELEVANCE_THRESHOLD);
}

// Sammelt die Zonen aller AKTIVIERTEN Timeframe-Toggles (Chat 2026-07-30: "Indikatoren > OBs" bekam
// unabhängige M5-/1H-/4H-Checkboxen statt eines einzelnen showOrderBlocks-Schalters, der bisher
// immer nur den gerade angezeigten Chart-Timeframe zeigte). M5 läuft weiterhin live auf Kerzen, die
// ohnehin schon für andere Features geladen werden (m5Candles, bereits clipReplay-gefiltert vom
// Aufrufer) — nur die tatsächlich referenzierte Teilmenge der M5-OBs wird persistiert (siehe
// PLAN-chart-objekte-forex.md Abschnitt 5), das volle M5-Universum bleibt bewusst Live-Recompute.
export function collectObsZones({ showObs4h, showObs1h, showObsM5, dbObZones, symbol, replayUntil, price, m5Candles }) {
  const zones = [];
  if (showObs4h) zones.push(...filterDbObZones(dbObZones, symbol, replayUntil, "4H", price).filter((z) => !z.invalidated));
  if (showObs1h) zones.push(...filterDbObZones(dbObZones, symbol, replayUntil, "1H", price).filter((z) => !z.invalidated));
  if (showObsM5) {
    zones.push(
      ...detectOrderBlocks(m5Candles, "5m", true)
        .filter((z) => !z.invalidated)
        .map((z) => ({ ...z, timeframe: "5M" })),
    );
  }
  return zones;
}

// Bug-Report Philip 2026-07-31, dritte Runde zur OB-Target-Box: außerhalb Replay zog sich die Box
// bis "jetzt" durch, weil sie ohne echten Touch einfach bis zur letzten geladenen Kerze reicht —
// Philip will stattdessen exakt dasselbe Verhalten wie die live gezeichneten OB-Zonen (dieselbe
// detectOrderBlocks()-Erkennung auf derselben Zeitebene, nicht nur ein einmaliger Snapshot vom
// Klick-Zeitpunkt). Sucht die Original-Zone anhand ihrer beim Klick festgehaltenen Kanten
// (rangeLow/rangeHigh) in der GERADE aktuellen Zonen-Liste derselben Zeitebene — bewusst
// unabhängig von showObs1h/-4h/-M5 (ein Target soll sichtbar bleiben, auch wenn der zugehörige
// Live-OB-Indikator-Toggle gerade aus ist), deshalb hier direkt filterDbObZones/detectOrderBlocks
// statt collectObsZones. 1H/4H seit Punkt 7 (DB-Read) dieselbe Quelle wie die gezeichneten Zonen
// selbst — sonst könnte eine Target-/Confirmation-Box einen anderen touched/endTime-Stand zeigen
// als die daneben gezeichnete Indikator-Zone.
export function liveObZonesForTimeframe(timeframe, { m5Candles, dbObZones, symbol, replayUntil, price }) {
  if (timeframe === "5M") return detectOrderBlocks(m5Candles, "5m", true);
  return filterDbObZones(dbObZones, symbol, replayUntil, timeframe, price);
}

export function liveObZoneState(item, ctx) {
  if (item.timeframe == null || item.rangeLow == null || item.rangeHigh == null) return null;
  const zone = liveObZonesForTimeframe(item.timeframe, ctx).find((z) => z.top === item.rangeHigh && z.bottom === item.rangeLow);
  return zone ? { touched: zone.touched, endTime: zone.endTime } : null;
}

// Bug-Report Philip 2026-08-25: eine OB-Target-/Bestätigungs-Box mit längst bekanntem touchedTime
// wurde trotzdem bis zur letzten geladenen Kerze gezeichnet, nicht bis zum Touch. Ursache: der
// hier berechnete endTime-Wert kam zwar korrekt (kurz) an, aber ZonePaneView.update()
// (orderBlocks.js) nutzt endTime NUR, wenn z.touched||z.invalidated wahr ist — sonst IMMER
// Infinity (= letzte Kerze). refreshTradeTargetLinksInternal/-TradeConfirmationLinksInternal
// (PriceChart.vue) setzten dieses touched-Flag auf der Zone bisher gar nicht mit, endTime wurde
// dadurch faktisch ignoriert. Bündelt touched+endTime jetzt in EINER Funktion (vorher zweimal fast
// wortgleich dupliziert), damit dieselbe Prioritätskette (bekanntes touchedTime -> live erkannte
// Zone -> Selbstheilung in geladenen Kerzen -> noch aktiv bis jetzt) nur an einer Stelle steht.
export function obBoxTouchState(item, candles, ctx) {
  if (item.touchedTime != null) return { touched: true, endTime: item.touchedTime };
  const live = liveObZoneState(item, ctx);
  if (live) return { touched: live.touched, endTime: live.endTime };
  const selfHealed = firstCandleTouchRange(candles, item.sourceTime, item.rangeLow, item.rangeHigh);
  if (selfHealed != null) return { touched: true, endTime: selfHealed };
  return { touched: false, endTime: candles[candles.length - 1].time };
}

// Gepinnte Zonen (ob_zone, alle Timeframes inkl. M5) werden zusätzlich zur live erkannten Liste
// gerendert (Task "Pin-Kontext: gepinnte Objekte direkt rendern"), damit ein Pin unabhängig von
// showObsX-Toggles/showHistoricalObs/dem aktuell live neu erkannten Ergebnis trotzdem ein
// Chart-Objekt zum Anheften bekommt. touched===null (nur bei einer M5-ob_zones-Zeile, die nie live
// nachverfolgt wird, siehe Dashboard.vue: pinnedObZones) wird anhand der aktuell geladenen Kerzen
// self-geheilt (dieselbe firstCandleTouchRange-Technik wie refreshTradeConfirmationLinksInternal)
// — sonst würde eine längst gesweepte M5-OB-Pin-Box für immer als "aktiv" bis "jetzt" gezeichnet.
export function mergePinnedZones(zones, pinnedZones, candles) {
  if (!pinnedZones || pinnedZones.length === 0) return zones;
  const seen = new Set(zones.map((z) => obZoneNaturalKey(z.timeframe, z.dir, z.startTime)));
  const extra = [];
  for (const z of pinnedZones) {
    const key = obZoneNaturalKey(z.timeframe, z.dir, z.startTime);
    if (seen.has(key)) continue;
    seen.add(key);
    if (z.touched != null) {
      extra.push({ ...z, endTime: z.endTime ?? candles[candles.length - 1]?.time ?? z.startTime });
      continue;
    }
    const touchTime = firstCandleTouchRange(candles, z.startTime, z.top, z.bottom);
    extra.push({ ...z, touched: touchTime != null, endTime: touchTime ?? candles[candles.length - 1]?.time ?? z.startTime });
  }
  return [...zones, ...extra];
}
