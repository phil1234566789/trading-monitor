// Ursprünglich lokale Funktionen in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 3, 2026-08-25) hierher verschoben — die eigentliche Fraktal-/Level-Erkennung
// lebt weiterhin in liquidity.js, hier nur die Merge-Logik (Pin-Kontext, persistierte HTF-Level),
// die PriceChart.vue bisher über Closures (props, allCandles) statt über Parameter berechnet hat.
import { selectRelevantHtfLevels, liquidityLevelNaturalKey } from "./liquidity.js";
import { LQ_RELEVANCE } from "./liquidityRelevanceConfig.js";

// Liquiditäts-Level (Fractal-Pivots, siehe tv-indikator/src/liquidity.pine) gibt es bisher nicht
// aus dem Backend — deshalb direkt aus den geladenen Kerzen des aktuellen Chart-Timeframes neu
// erkannt, analog zur OB-Erkennung (siehe priceChartObZones.js).
// Gepinnte Level (liquidity_level + m5_liquidity_level) werden zusätzlich zur live erkannten Liste
// gerendert (Task "Pin-Kontext: gepinnte Objekte direkt rendern") — bewusst auch bei
// showLiquidity=false und UNABHÄNGIG vom aktuell gewählten currentBar (Philip 2026-08-18: ein
// gepinntes 1H-Level soll auch sichtbar bleiben, wenn der Chart gerade auf M5/4H steht, siehe
// Dashboard.vue: pinnedLiquidityLevels ohne currentBar-Filterung — anders als bei live/nicht
// gepinnten Leveln, die weiterhin nur für EINEN Timeframe gleichzeitig berechnet werden).
// touched===null (nur bei kind='m5_liquidity_level', reiner Snapshot ohne Live-Status) wird anhand
// der aktuell geladenen Kerzen self-geheilt, analog zu mergePinnedZones (priceChartObZones.js).
export function mergePinnedLevels(levels, pinnedLevels, candles) {
  if (!pinnedLevels || pinnedLevels.length === 0) return levels;
  const seen = new Set(levels.map((l) => liquidityLevelNaturalKey(l.dir, l.pivotTime)));
  const extra = [];
  for (const lvl of pinnedLevels) {
    const key = liquidityLevelNaturalKey(lvl.dir, lvl.pivotTime);
    if (seen.has(key)) continue;
    seen.add(key);
    if (lvl.touched != null) {
      extra.push({ ...lvl, endTime: lvl.endTime ?? candles[candles.length - 1]?.time ?? lvl.pivotTime });
      continue;
    }
    const touchCandle = candles.find(
      (c) => c.time > lvl.pivotTime && ((lvl.dir === 1 && c.high >= lvl.price) || (lvl.dir === -1 && c.low <= lvl.price)),
    );
    extra.push({ ...lvl, touched: touchCandle != null, endTime: touchCandle?.time ?? candles[candles.length - 1]?.time ?? lvl.pivotTime });
  }
  return [...levels, ...extra];
}

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12/13, Nachbesserung
// 2026-08-23 — die persistierten HTF-Level (1H+4H), unabhängig vom aktuell gewählten
// Chart-Timeframe (ein 1H/4H-Level bleibt z.B. auch auf M5 sichtbar, KEINE Kaskaden-Filterung wie
// bei Pins — Philip: "alles ist im M5-4H TF sichtbar"). Bis 2026-08-23 ein eigener Toggle,
// unabhängig von showLiquidity — jetzt Teil von showLiquidity selbst (siehe
// refreshLiquidityInternal in PriceChart.vue: nur im showLiquidity=true-Zweig aufgerufen).
//
// Auswahl läuft seit derselben Nachbesserung über selectRelevantHtfLevels statt
// filterRelevantLevels' Rezenz-Deckel (Bug: ein Monate altes, aber preisnahes Level fiel
// strukturell aus dem alten Top-10-nach-Rezenz-Cap raus, egal wie relevant es gerade war, siehe
// Git-Historie dieser Funktion) — pro Timeframe getrennt, mit eigener Stückzahl aus
// liquidityRelevanceConfig.js (1H: mehr/enger, 4H: weniger/gröber). highs+lows werden dafür VOR
// dem Aufruf gemischt (selectRelevantHtfLevels wählt nach Preis-Nähe, nicht nach Richtung).
// endTime wird selbst geheilt (wie mergePinnedLevels), da ein noch unberührtes DB-Level
// end_time=null führt (wächst live mit, statt eingefroren zu sein).
export function computeHtfLiquidityLevels(candles, dbLiquidityLevelsHtf, symbol, replayUntil, price) {
  const byInstrument = dbLiquidityLevelsHtf.filter((l) => l.instrument === symbol);
  const byReplay = replayUntil == null ? byInstrument : byInstrument.filter((l) => l.pivotTime <= replayUntil);
  const result = [];
  for (const timeframe of Object.keys(LQ_RELEVANCE)) {
    const forTf = byReplay.filter((l) => l.timeframe === timeframe);
    result.push(...selectRelevantHtfLevels(forTf, price, LQ_RELEVANCE[timeframe]));
  }
  return result.map((l) => ({ ...l, endTime: l.endTime ?? candles[candles.length - 1]?.time ?? l.pivotTime }));
}

// Merge per Natural Key (wie mergePinnedZones/-Levels) — Bug-Report Philip 2026-08-23 (die
// Live-Neuberechnung zeigte ein längst laut poi-watcher getouchtes 1H-Level trotzdem als bis
// "jetzt" durchgezeichnet an): bis dahin gewann bei einer Überschneidung die LIVE erkannte Version
// gegen die DB-Version — für 1H/4H ist das aber dieselbe Krankheit, die Punkt 7 bei den OB-Zonen
// schon behoben hat (die Live-Neuberechnung im Browser läuft über eine andere, potenziell
// unvollständige/andere Kerzenquelle als poi-watcher, siehe candleCache.js: mergeCandles-Fix vom
// selben Tag). Priorität deshalb umgedreht: die DB-Version (poi-watcher, `dbLevels`) gewinnt jetzt
// IMMER bei einer Überschneidung — nur was NUR live erkannt wurde (z.B. M5, oder ein 1H/4H-Pivot,
// den poi-watcher noch nicht persistiert hat, siehe CLAUDE.md poi-watcher-Throttling), kommt
// zusätzlich dazu. "Alte, aber relevante 1H-Level sichtbar machen" bleibt davon unberührt — das
// leistet weiterhin computeHtfLiquidityLevels, unabhängig von dieser Funktion hier.
export function mergeDbLiquidityLevels(levels, dbLevels) {
  if (dbLevels.length === 0) return levels;
  const dbKeys = new Set(dbLevels.map((l) => liquidityLevelNaturalKey(l.dir, l.pivotTime)));
  const liveOnly = levels.filter((l) => !dbKeys.has(liquidityLevelNaturalKey(l.dir, l.pivotTime)));
  return [...liveOnly, ...dbLevels];
}
