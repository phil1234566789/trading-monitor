// Ursprünglich lokale findClicked*-Funktionen in PriceChart.vue, per Refactoring-Task "Sehr große
// Dateien refactoren" (Phase 5, 2026-08-25) hierher verschoben. Anders als Phase 1-4 (dort waren
// die Funktionen bereits pure oder mit ein paar Parametern statt Closures pure zu machen) brauchen
// diese hier eigentlich chart/candleSeries für die Koordinaten-Umrechnung (coordinateToPrice/-Time,
// priceToCoordinate, timeToCoordinate) — statt das ganze chart/candleSeries-Objekt zu mocken, wird
// hier nur die JEWEILS gebrauchte einzelne Umrechnungsfunktion als Parameter injiziert
// (price-/timeToCoordinate als (value) => number|null). Das hält die Matching-Logik komplett pure
// und ohne jede lightweight-charts-Abhängigkeit testbar, ohne neue Mock-Infrastruktur im Repo zu
// brauchen. PriceChart.vue selbst löst die Koordinaten einmalig gegen chart/candleSeries auf und
// ruft dann diese Funktionen auf — siehe findClickedSetup/-LiquidityLevel/-OBZone/-FibLevel/
// -Divergence dort.
import { tradeSetupObBoxBounds } from "./tradeSetup.js";
import { OrderBlockPrimitive } from "./orderBlocks.js";

// Trade-Modus-Klick-Hittest (Chat 2026-07-27) — testet gegen genau die Box, die
// renderTradeSetupsInternal (PriceChart.vue) tatsächlich zeichnet (tradeSetupObBoxBounds +
// obStartTime/-breite), nicht gegen setup.obTop/obBottom direkt (das ist der rohe M5-OB, der für
// setupEntry/invalidation gebraucht wird, aber optisch eine andere Fläche als die gezeichnete Box
// sein kann). Respektiert dieselben Sichtbarkeits-Filter wie renderTradeSetupsInternal (Long/
// Short-Toggle, Replay-Cutoff) — man soll nichts anklicken können, was gerade gar nicht gezeichnet ist.
export function matchTradeSetup(currentTradeSetups, price, time, { replayUntil, showTradeSetupsShort, showTradeSetupsLong, obWidthSec }) {
  return (
    currentTradeSetups.find((s) => {
      if (replayUntil != null && s.fractal.pivotTime > replayUntil) return false;
      if (s.dir === 1 && !showTradeSetupsShort) return false;
      if (s.dir === -1 && !showTradeSetupsLong) return false;
      const { top, bottom } = tradeSetupObBoxBounds(s);
      const inTime = time >= s.obStartTime && time <= s.obStartTime + obWidthSec;
      const inPrice = price <= top && price >= bottom;
      return inTime && inPrice;
    }) ?? null
  );
}

// Ziel-Modus-Klick-Hittest (Chat 2026-07-27: "Können wir die Linien klickbar machen?") — Level sind
// horizontale Linien (keine Fläche), daher Pixel-Toleranz auf der Y-Achse statt eines Preisbereichs
// (bleibt so bei jedem Zoom-Stand gleich "breit" anklickbar). Zeitbereich [pivotTime, endTime] wie
// tatsächlich gezeichnet (siehe liquidity.js: buildLevel) — endTime wächst bei einem noch
// unberührten Level bis zur zuletzt geladenen Kerze mit, ist also praktisch "bis jetzt".
export const LIQUIDITY_LINE_CLICK_TOLERANCE_PX = 6;
export function matchLiquidityLevel(currentLiquidityLevels, time, pointY, priceToCoordinate, tolerancePx = LIQUIDITY_LINE_CLICK_TOLERANCE_PX) {
  return (
    currentLiquidityLevels.find((lvl) => {
      if (time < lvl.pivotTime || time > lvl.endTime) return false;
      const y = priceToCoordinate(lvl.price);
      if (y == null) return false;
      return Math.abs(y - pointY) <= tolerancePx;
    }) ?? null
  );
}

// Ziel-Modus, zweite Klick-Fläche (Chat 2026-07-28: "ein Pivot targetiere ich oder einen OB") —
// testet gegen dieselben allgemeinen OB-Zonen, die auch gezeichnet werden (poiZonesMetadata in
// PriceChart.vue, respektiert also automatisch showObsM5/-1h/-4h/showHistoricalObs, siehe
// refreshPoiZonesInternal: die Liste ist schon leer, wenn alle drei Timeframe-Toggles aus sind).
// Nur der Preis (nicht die ganze Box) wird als Target übernommen — die dem Klick NÄHERE Kante,
// nicht fest nach Richtung, weil ein Klick näher an der Oberkante eher "ich will die Oberkante"
// meint als andersrum.
export function matchOBZone(zones, price, time, symbol) {
  const zone = (zones ?? []).find((z) => !z.invalidated && time >= z.startTime && time <= z.endTime && price <= z.top && price >= z.bottom);
  if (!zone) return null;
  const nearEdge = Math.abs(price - zone.top) < Math.abs(price - zone.bottom) ? zone.top : zone.bottom;
  // endTime friert bei detectOrderBlocks() auf die berührende Kerze ein, sobald touched=true wird
  // (siehe orderBlocks.js) — praktisch also "touchedTime", ohne dass die Zone das Feld extra führt.
  // rangeLow/rangeHigh (Bug-Report Philip 2026-07-31: "es zeichnet sich weder Linie noch Box, nur
  // das Label" — price allein reicht für eine Box nicht) — beide Kanten der Zone, damit
  // refreshTradeTargetLinksInternal/-ConfirmationLinksInternal daraus eine echte OB-Box zeichnen
  // können statt nur eine Linie an der näheren Kante.
  return {
    kind: "ob",
    price: nearEdge,
    sourceTime: zone.startTime,
    touchedTime: zone.touched ? zone.endTime : null,
    rangeLow: zone.bottom,
    rangeHigh: zone.top,
    // Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren" — instrument/direction
    // (dieselbe long/short-Konvention wie poi-watcher: dir===1 -> "long", siehe dortiger
    // Kommentar) werden mitgegeben, damit tradeIntake.js beim Anlegen der Bestätigung die
    // zugehörige ob_zones-Zeile per Natural Key finden/anlegen und referenzieren kann, statt nur
    // den Preis-Snapshot zu speichern.
    instrument: symbol,
    direction: zone.dir === 1 ? "long" : "short",
    // Bug-Report Philip 2026-07-31, dritte Runde: außerhalb Replay wollte die Box exakt wie die
    // live gezeichneten OB-Zonen laufen (bis zum echten Touch, sonst frei wachsend) — dafür muss
    // refreshTradeTargetLinksInternal wissen, von welcher Zeitebene die Zone stammt, um dieselbe
    // detectOrderBlocks()-Erkennung live nachzuvollziehen statt nur einen statischen Snapshot zu
    // zeigen (siehe dort).
    timeframe: zone.timeframe,
  };
}

// Bestätigungs-Modus, dritte Klick-Fläche (Chat 2026-07-30, siehe collectFibLevels in
// marketStructureAnalysis.ts) — NUR im Bestätigungs-Modus aktiv, nicht im Ziel-Modus (ein Fib ist
// keine sinnvolle Preis-Erwartung wie Pivot/OB, siehe onSelectTarget in Dashboard.vue). Anders als
// die Liquiditäts-Linie (horizontal, Zeitbereich [pivotTime, endTime]) ist der Fib-Tick ein PUNKT
// (kurzer Strich in der Mitte der Fib-Spanne, siehe FibTickPrimitive) — Hit-Test vergleicht deshalb
// den 2D-Pixel-Abstand zum exakt selben Mittelpunkt, den die Zeichnung auch benutzt, statt eines
// Zeitbereichs + Y-Toleranz.
export const FIB_TICK_CLICK_TOLERANCE_PX = 8;
export function matchFibLevel(currentFibLevels, pointX, pointY, timeToCoordinate, priceToCoordinate, tolerancePx = FIB_TICK_CLICK_TOLERANCE_PX) {
  for (const level of currentFibLevels) {
    const xa = timeToCoordinate(level.a.pivotTime);
    const xb = timeToCoordinate(level.b.pivotTime);
    if (xa == null || xb == null) continue;
    const x = (xa + xb) / 2;
    const y = priceToCoordinate(level.price);
    if (y == null) continue;
    const dx = pointX - x;
    const dy = pointY - y;
    if (Math.sqrt(dx * dx + dy * dy) > tolerancePx) continue;
    return {
      kind: "fib",
      price: level.price,
      // Der spätere der beiden Anker-Zeitpunkte — erst ab da existiert dieser konkrete Fib-Wert
      // überhaupt (vorher stand mindestens einer der beiden Anker noch nicht fest).
      sourceTime: Math.max(level.a.pivotTime, level.b.pivotTime),
      touchedTime: null, // kein "getoucht"-Konzept für ein Fib-Level, siehe tradeConfirmations.ts
      rangeLow: Math.min(level.a.price, level.b.price),
      rangeHigh: Math.max(level.a.price, level.b.price),
    };
  }
  return null;
}

// Bestätigungs-Modus, vierte Klick-Fläche (milk-city Task "Divergenzen zur Dealing Range
// verknüpfen (klickbar)", 2026-08-15) — NUR im Bestätigungs-Modus aktiv (analog zu Fib: eine
// Divergenz ist bereits passierte Evidenz, keine sinnvolle künftige Preis-Erwartung wie Pivot/OB).
// Nutzt dieselben Primitives wie die live Divergenz-Zeichnung (divergencePriceLinePrimitives in
// PriceChart.vue) samt ihrer bereits vorhandenen distanceTo()-Punkt-zu-Strecke-Projektion — eine
// Divergenz ist also nur klickbar, wenn sie gerade sichtbar gezeichnet ist (showRsiDivergence/
// -History + showRsi an), wie ein Fib-Tick nur bei aktiver Struktur-Anzeige. Braucht (anders als
// die anderen Match-Funktionen hier) gar keine Koordinaten-Umrechnung — distanceTo() ist bereits
// eine Methode der Primitive-Instanz selbst, die intern ihre gecachten Bildschirm-Koordinaten nutzt.
// price=toPrice/sourceTime=fromTime/touchedTime=toTime (wie ein Pivot: Linie von Entstehung bis
// späterem "Touch", hier: von Referenz- bis geprüfter Schwungmarke) — fromPrice/fromRsi/toRsi/
// divergenceType zusätzlich, sonst wäre die Divergenz später nicht mehr nachzeichenbar (siehe
// Migration 20260815120000_trade_confirmations_rsi_divergence.sql).
export const DIVERGENCE_CLICK_TOLERANCE_PX = 10;
export function matchDivergence(divergencePrimitives, pointX, pointY, tolerancePx = DIVERGENCE_CLICK_TOLERANCE_PX) {
  for (const p of divergencePrimitives) {
    if (p.distanceTo(pointX, pointY) > tolerancePx) continue;
    const d = p.divergence;
    return {
      kind: "rsi_divergence",
      price: d.toPrice,
      sourceTime: d.fromTime,
      touchedTime: d.toTime,
      fromPrice: d.fromPrice,
      fromRsi: d.fromRsi,
      toRsi: d.toRsi,
      divergenceType: d.type,
    };
  }
  return null;
}

// Pin-Rechtsklick (Chat 2026-08-01, zweite Runde) — großzügiger Fang-Radius statt exaktem Treffen,
// siehe findNearbyPinCandidates in PriceChart.vue. PIN_MAX_CANDIDATES deckelt die Auswahl-Liste,
// damit ein dicht bevölkerter Chart-Bereich kein unübersichtlich langes Menü erzeugt.
export const PIN_SEARCH_RADIUS = 40; // px
export const PIN_MAX_CANDIDATES = 6;

// Kandidatensuche im Radius statt Exakt-Hittest (Chat 2026-08-01, zweite Runde — Bug-Report Philip:
// "tu mir schwer die Box zu treffen ... lass mal die anderen Lösungsmöglichkeiten anschauen") —
// Rechtsklick funktioniert jetzt IRGENDWO in der Nähe eines Objekts statt exakt darauf; sammelt
// alle Trade-Marker/1H-4H-OB-Zonen im Radius um den Klick, nach Distanz sortiert (nächstes zuerst),
// gekappt auf maxCandidates. Bei genau einem Treffer öffnet Dashboard.vue direkt das Notiz-Popup,
// bei mehreren eine Auswahl-Liste (siehe dort: onPinContextMenu) — Philip wählt dann aus, statt
// pixelgenau zielen zu müssen.
//
// primitives = { tradePrimitives, orderBlockPrimitives, liquidityPrimitives, tradeSetupLinkPrimitives,
// tradeConfirmationLinkPrimitives, divergencePrimitives } — dieselben Primitive-Arrays, die
// PriceChart.vue fürs Zeichnen führt, hier nur gelesen (keine chart/candleSeries-Abhängigkeit,
// jedes Primitive kennt seine eigenen Bildschirm-Koordinaten bereits über distanceTo()).
export function findNearbyPinCandidates(x, y, primitives, { symbol, currentBar }, radius = PIN_SEARCH_RADIUS, maxCandidates = PIN_MAX_CANDIDATES) {
  const { tradePrimitives, orderBlockPrimitives, liquidityPrimitives, tradeSetupLinkPrimitives, tradeConfirmationLinkPrimitives, divergencePrimitives } =
    primitives;
  const candidates = [];
  for (const p of tradePrimitives) {
    const distance = p.distanceTo(x, y);
    if (distance <= radius) candidates.push({ kind: "trade_position", trade: p.trade, distance });
  }
  // OB-Zonen — 1H/4H lösen sich gegen die bereits persistierte ob_zones-Zeile auf (kind="ob_zone",
  // resolveObZoneId, SELECT-only). M5-Boxen existieren dort meist NOCH NICHT (nur die referenzierte
  // Teilmenge wird persistiert, siehe PLAN-chart-objekte-forex.md Abschnitt 5) — bekommen deshalb
  // weiterhin einen eigenen Kandidaten-Kind (kind="m5_ob", Chat 2026-08-02: "Rohdaten-Snapshot",
  // JEDE M5-Box soll klickbar sein, nicht nur bereits zu einem Trade-Setup gehörende), der beim
  // tatsächlichen Pinnen die ob_zones-Zeile per find-or-create nachzieht (siehe pinContext.js:
  // addPinM5ObEntry, Punkt 6) statt weiter einen reinen Snapshot zu schreiben.
  for (const p of orderBlockPrimitives) {
    const distance = p.distanceTo(x, y);
    if (distance > radius) continue;
    if (p.zone.timeframe === "5M") {
      candidates.push({
        kind: "m5_ob",
        zone: { instrument: symbol, dirNum: p.zone.dir, top: p.zone.top, bottom: p.zone.bottom, startTime: p.zone.startTime },
        distance,
      });
    } else {
      candidates.push({
        kind: "ob_zone",
        zone: { instrument: symbol, timeframe: p.zone.timeframe, dir: p.zone.dir, startTime: p.zone.startTime },
        distance,
      });
    }
  }
  // Liquiditäts-Level — ein 1H/4H-Level entspricht einer echten liquidity_levels-Zeile (poi-watcher
  // persistiert seit 2026-08-23 beide, siehe supabase/functions/poi-watcher/index.ts), löst sich
  // also per Natural-Key auf (kind="liquidity_level"). Auf jedem anderen Timeframe (Bug-Report
  // Philip 2026-08-02: "ich will eine M5 LQ-Linie anklicken") gibt es dafür keine DB-Zeile, deshalb
  // Rohdaten-Snapshot (kind="m5_liquidity_level", analog zu m5_ob oben).
  // Entscheidend ist das Level-EIGENE timeframe-Feld, NICHT der aktuell gewählte Chart-Timeframe
  // (currentBar) — seit derselben 2026-08-23-Änderung werden 1H/4H-Level unabhängig vom
  // Chart-Timeframe gezeichnet (siehe computeHtfLiquidityLevels), ein `currentBar === "1h"`-Check
  // hätte auf M5 jedes dort mitgezeichnete 1H/4H-Level fälschlich als M5-Rohdaten-Snapshot
  // eingeordnet statt gegen seine echte liquidity_levels-Zeile aufzulösen (Bug-Report Philip
  // 2026-08-26: "wenn ich rechtsklick mache, zum anpinnen, dann sind nur die M5 Level verfügbar").
  // Vergleich case-insensitiv + normalisiert auf Großschreibung (Bug-Report Philip 2026-08-26,
  // zweite Runde: ein Pivot, der zwar auf dem 1h-Chart live erkannt, aber NICHT in die kuratierte
  // HTF-Auswahl aufgenommen wurde — computeHtfLiquidityLevels/selectRelevantHtfLevels deckeln die
  // Anzahl, siehe liquidityRelevanceConfig.js — behält sein timeframe-Feld auf currentBar ("1h",
  // kleingeschrieben) statt der DB-Form "1H" (liquidityStyleTimeframe in liquidity.js macht dieselbe
  // Normalisierung fürs Farb-Styling, hier bisher übersehen). Ohne die Normalisierung landete so ein
  // Level als m5_liquidity_level-Rohdaten-Snapshot statt gegen seine echte liquidity_levels-Zeile
  // aufgelöst zu werden — beim späteren Rendern auf einem anderen Timeframe (M5) musste
  // mergePinnedLevels den Sweep-Stand dann blind aus den dort geladenen Kerzen raten, was bei einem
  // Pivot außerhalb des geladenen Fensters eine falsch (rückwärts) gezeichnete Linie ergab.
  // Fallback auf currentBar nur für den Fall eines Levels ganz ohne eigenes timeframe-Feld.
  for (const p of liquidityPrimitives) {
    const distance = p.distanceTo(x, y);
    if (distance > radius) continue;
    const rawTimeframe = p.level.timeframe ?? currentBar;
    const normalizedTimeframe = String(rawTimeframe).toUpperCase();
    if (normalizedTimeframe === "1H" || normalizedTimeframe === "4H") {
      candidates.push({
        kind: "liquidity_level",
        level: { instrument: symbol, timeframe: normalizedTimeframe, dirNum: p.level.dir, pivotTime: p.level.pivotTime },
        distance,
      });
    } else {
      candidates.push({
        kind: "m5_liquidity_level",
        level: { instrument: symbol, timeframe: rawTimeframe, dirNum: p.level.dir, price: p.level.price, pivotTime: p.level.pivotTime },
        distance,
      });
    }
  }
  // Trade-Setup-Link-Box (dritte Art, Chat 2026-08-01, dritte Runde) — eigener Primitive-Array
  // (tradeSetupLinkPrimitives), tradeSetupId ist bereits die echte trade_setups.id, siehe
  // refreshTradeSetupLinksInternal (PriceChart.vue).
  for (const p of tradeSetupLinkPrimitives) {
    const distance = p.distanceTo(x, y);
    if (distance <= radius) {
      candidates.push({ kind: "trade_setup", tradeSetupId: p.zone.tradeSetupId, direction: p.zone.direction, instrument: p.zone.instrument, distance });
    }
  }
  // Trade-Bestätigungs-Box, kind='ob' (vierte Art, Chat 2026-08-01, vierte Runde — Bug-Report
  // Philip: "✔ OB 1,15229 #22" wurde mit der Trade-Setup-Link-Box verwechselt, bisher komplett
  // unverdrahtet). tradeConfirmationLinkPrimitives ist GEMISCHT (OrderBlockPrimitive für kind='ob',
  // LiquidityLinePrimitive für kind='pivot'/'fib', siehe refreshTradeConfirmationLinksInternal) —
  // instanceof-Guard statt einfach .distanceTo() aufzurufen, sonst Crash auf einer Linie ohne diese
  // Methode. confirmationId ist bereits die echte trade_confirmations.id.
  for (const p of tradeConfirmationLinkPrimitives) {
    if (!(p instanceof OrderBlockPrimitive)) continue;
    const distance = p.distanceTo(x, y);
    if (distance <= radius) {
      candidates.push({ kind: "trade_confirmation", confirmationId: p.zone.confirmationId, instrument: p.zone.instrument, distance });
    }
  }
  // RSI-Divergenz-Konnektoren (Chat 2026-08-11, Philip: "ich will DIR paar Stellen zeigen ... wir
  // haben ja die Funktion da") — nur das Preis-Bein (divergencePrimitives), nicht auch das RSI-Bein
  // in der eigenen Pane: dessen priceToCoordinate()-Y ist relativ zur RSI-Pane, nicht zum ganzen
  // Chart-Container wie hier gerechnet — für "eine Divergenz anklicken" reicht das Preis-Bein, beide
  // Beine wären ohnehin derselbe DB-Eintrag.
  for (const p of divergencePrimitives) {
    const distance = p.distanceTo(x, y);
    if (distance <= radius) {
      candidates.push({ kind: "rsi_divergence", divergence: p.divergence, instrument: symbol, distance });
    }
  }
  // Dedupe (Chat 2026-08-01, dritte Runde) — mehrere Ausführungen (trade_positions) derselben
  // Dealing Range teilen sich dasselbe verlinkte Setup, tauchten deshalb als exakt gleicher
  // Kandidat mehrfach in der Liste auf ("Short-Setup #105" zweimal).
  const candidateKey = (c) => {
    if (c.kind === "trade_position") return `trade_position:${c.trade.id}`;
    if (c.kind === "ob_zone") return `ob_zone:${c.zone.timeframe}|${c.zone.dir}|${c.zone.startTime}`;
    if (c.kind === "m5_ob") return `m5_ob:${c.zone.dirNum}|${c.zone.top}|${c.zone.bottom}|${c.zone.startTime}`;
    if (c.kind === "trade_setup") return `trade_setup:${c.tradeSetupId}`;
    if (c.kind === "liquidity_level") return `liquidity_level:${c.level.dirNum}|${c.level.pivotTime}`;
    if (c.kind === "m5_liquidity_level") return `m5_liquidity_level:${c.level.timeframe}|${c.level.dirNum}|${c.level.pivotTime}`;
    if (c.kind === "rsi_divergence") return `rsi_divergence:${c.divergence.type}|${c.divergence.fromTime}|${c.divergence.toTime}`;
    return `trade_confirmation:${c.confirmationId}`;
  };
  const seen = new Set();
  const deduped = [];
  for (const c of candidates.sort((a, b) => a.distance - b.distance)) {
    const key = candidateKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return deduped.slice(0, maxCandidates);
}

// Leichtgewichtiger Boolean-Check fürs Cursor-Feedback (jede Mausbewegung) — baut anders als
// findNearbyPinCandidates() keine Objekte/kein Sortieren, nur "gibt's überhaupt was in der Nähe".
export function hasNearbyPinCandidate(x, y, primitives, radius = PIN_SEARCH_RADIUS) {
  const { tradePrimitives, orderBlockPrimitives, liquidityPrimitives, tradeSetupLinkPrimitives, tradeConfirmationLinkPrimitives, divergencePrimitives } =
    primitives;
  return (
    tradePrimitives.some((p) => p.distanceTo(x, y) <= radius) ||
    orderBlockPrimitives.some((p) => p.distanceTo(x, y) <= radius) ||
    tradeSetupLinkPrimitives.some((p) => p.distanceTo(x, y) <= radius) ||
    tradeConfirmationLinkPrimitives.some((p) => p instanceof OrderBlockPrimitive && p.distanceTo(x, y) <= radius) ||
    liquidityPrimitives.some((p) => p.distanceTo(x, y) <= radius) ||
    divergencePrimitives.some((p) => p.distanceTo(x, y) <= radius)
  );
}
