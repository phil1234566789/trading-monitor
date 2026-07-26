// Portiert aus tv-indikator/src/tradesetup.pine (checkShortSetup/checkLongSetup) für die
// Deno-Edge-Function-Laufzeit — reine Erkennungslogik, kein Chart-Rendering. Short/Long sind
// dort aus einer Pine-spezifischen Einschränkung heraus dupliziert (globale var-Variablen
// dürfen nicht per := aus einer Funktion heraus neu zugewiesen werden, CE10088) — hier nicht
// nötig, daher eine einzige, dir-parametrisierte Version. Bei Änderungen an der Setup-Logik
// im Indikator diese Kopie mitziehen. Alle Zeiten in Sekunden (Unix-Time), wie der Rest dieser
// Codebase (liquidity.ts/orderBlocks.ts) — nicht Millisekunden wie im Pine-Original.
import type { Candle } from "./orderBlocks.ts";
import type { LiquidityLevel } from "./liquidity.ts";

export interface SetupOb {
  dir: 1 | -1; // 1 = bullische Lücke, -1 = bärische Lücke
  top: number;
  bottom: number;
  startTime: number; // Zeitpunkt der mittleren Impuls-Kerze, siehe detectSetupObs
}

export interface DetectedTradeSetup {
  dir: 1 | -1; // 1 = Short (Protected High), -1 = Long (Protected Low)
  fractal: LiquidityLevel; // M5-Fraktal ("Protected High/Low")
  ls: LiquidityLevel; // sweependes LQ-Level (H1 oder M5) — das "Liquidity Sweep"
  obTop: number;
  obBottom: number;
  obStartTime: number;
  // "A" = eigenes bestätigtes Protected-Pivot (fractal !== ls), "B" = fractal === ls (Chat
  // 2026-07-26: "möchte es visuell unterschieden haben") — reine Anzeige-Info, keine eigene
  // Erkennungslogik. Aktuell nur von der JS-Kopie (tradeSetup.js/PriceChart.vue-Label/TSC)
  // konsumiert, hier trotzdem mitgeführt, damit beide Kopien strukturell in Sync bleiben.
  pathType: "A" | "B";
}

export interface TradeSetupParams {
  graceSec: number; // Toleranz NACH dem Fraktal, bis zu der der LS noch zählt (i.d.R. eine M5-Kerzenlänge)
  lsMaxLeadSecH1: number; // wie weit VOR dem Fraktal ein H1-LS liegen darf — eigenes, größeres
  // Fenster als M5, da ein H1-Sweep typischerweise deutlich länger vor dem bestätigenden
  // M5-Fraktal liegt (Bug-Report 2026-07-17: ein gemeinsames Fenster war für M5 zu großzügig
  // oder für H1 zu eng, siehe tv-indikator "fix short setups für 1h LS und M5 LS").
  lsMaxLeadSecM5: number; // dito für M5-LS.
  maxDistanceM5: number | null; // Preiseinheiten, NICHT Pip. Ein M5-LS, das weiter als das vom
  // Fraktal entfernt liegt, ist fachlich kein Liquidity Sweep mehr, sondern ein gewöhnlicher
  // Strukturbruch (Klärung Philip, 2026-07-17). Gilt bewusst NUR für M5-LS — H1 bekommt (noch)
  // kein Distanzlimit (null), siehe tv-indikator "M5 LS auf 5 pips eingrenzen".
  maxLookbackSec: number; // wie weit rückwärts nach einem gültigen Fraktal gesucht wird
  obMaxDelaySec: number; // maximale Verzögerung Fraktal → bestätigendes M5-OB
  nowTime: number; // Referenzzeitpunkt für maxLookbackSec (i.d.R. Zeit der letzten M5-Kerze)
}

// Eigene, von detectOrderBlocks() unabhängige 3-Kerzen-FVG-Erkennung — bewusst OHNE Session-
// Filter/Schwäche-/Cap-Einschränkung (siehe pushSetupOb in tradesetup.pine): für die Setup-
// Erkennung zählt nur, ob die Preislücke überhaupt existiert, unabhängig von Uhrzeit oder Größe.
export function detectSetupObs(candles: Candle[]): SetupOb[] {
  const obs: SetupOb[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const impulse = candles[i - 1];
    const cur = candles[i];
    if (c1.low - cur.high > 0) obs.push({ dir: -1, top: c1.low, bottom: cur.high, startTime: impulse.time });
    if (cur.low - c1.high > 0) obs.push({ dir: 1, top: cur.low, bottom: c1.high, startTime: impulse.time });
  }
  return obs;
}

// Sucht die zeitlich erste FVG einer Richtung, deren Impuls-Kerze auf afterTime folgt, aber
// innerhalb von maxDelaySec danach entstanden sein muss. obs ist chronologisch (älteste
// zuerst) sortiert (siehe detectSetupObs) — die erste Übereinstimmung ist daher automatisch
// die zeitlich früheste.
function findFirstSetupObAfter(obs: SetupOb[], obDir: 1 | -1, afterTime: number, maxDelaySec: number): SetupOb | null {
  const deadline = afterTime + maxDelaySec;
  for (const ob of obs) {
    if (ob.dir === obDir && ob.startTime >= afterTime && ob.startTime <= deadline) return ob;
  }
  return null;
}

// Sucht in EINEM LQ-Level-Array das auf der GEGENÜBERLIEGENDEN Seite des Fraktals liegende
// Level, das innerhalb des Fraktal-Zeitfensters berührt wurde — und zwar dasjenige mit dem
// zeitlich spätesten Berührungszeitpunkt (der jüngste, relevanteste Sweep). Fenster liegt um
// pivotTime herum: lsMaxLeadSec als Untergrenze (Sweep meist kurz VOR dem Fraktal), graceSec
// als Obergrenze (Sweep und Fraktal-Entstehung auch als dasselbe Preisereignis möglich).
function findLsInArray(
  levels: LiquidityLevel[],
  fractal: LiquidityLevel,
  dir: 1 | -1,
  graceSec: number,
  lsMaxLeadSec: number,
  maxDistance: number | null,
): LiquidityLevel | null {
  const earliest = fractal.pivotTime - lsMaxLeadSec;
  const deadline = fractal.pivotTime + graceSec;
  let best: LiquidityLevel | null = null;
  let bestTouchedTime = -1;
  for (const lvl of levels) {
    const onFarSide = dir === 1 ? lvl.price < fractal.price : lvl.price > fractal.price;
    const withinDistance = maxDistance == null || Math.abs(lvl.price - fractal.price) <= maxDistance;
    const eligible =
      lvl.touched &&
      lvl.touchedTime !== null &&
      lvl.touchedTime >= earliest &&
      lvl.touchedTime <= deadline &&
      onFarSide &&
      withinDistance;
    if (eligible && lvl.touchedTime! > bestTouchedTime) {
      bestTouchedTime = lvl.touchedTime!;
      best = lvl;
    }
  }
  return best;
}

// Ein Fraktal kann sowohl durch einen größeren H1-Sweep als auch durch einen kleineren
// M5-Sweep entstehen, beide zählen gleichwertig — gewinnt das mit dem zeitlich spätesten
// Berührungszeitpunkt, unabhängig davon aus welchem Array es kommt. Distanzlimit (maxDistanceM5)
// gilt bewusst NUR fürs M5-Level (H1 bekommt null = kein Limit).
function findBestLsMatch(
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  fractal: LiquidityLevel,
  dir: 1 | -1,
  graceSec: number,
  lsMaxLeadSecH1: number,
  lsMaxLeadSecM5: number,
  maxDistanceM5: number | null,
): LiquidityLevel | null {
  const h1Match = findLsInArray(h1Levels, fractal, dir, graceSec, lsMaxLeadSecH1, null);
  const m5Match = findLsInArray(m5Levels, fractal, dir, graceSec, lsMaxLeadSecM5, maxDistanceM5);
  if (m5Match && (!h1Match || m5Match.touchedTime! > h1Match.touchedTime!)) return m5Match;
  return h1Match;
}

// Sucht von der neuesten Uhrzeit aus rückwärts das erste noch ungebrochene (touched=false)
// Fraktal, für das ein gültiges LS existiert (H1 und M5 zählen gleichwertig). fractalLevels
// ist chronologisch sortiert — bricht ab, sobald ein Fraktal älter als maxLookbackSec ist.
function findProtectedFractal(
  fractalLevels: LiquidityLevel[],
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  dir: 1 | -1,
  params: TradeSetupParams,
): { fractal: LiquidityLevel; ls: LiquidityLevel } | null {
  const oldestAllowed = params.nowTime - params.maxLookbackSec;
  for (let i = fractalLevels.length - 1; i >= 0; i--) {
    const candidate = fractalLevels[i];
    if (candidate.pivotTime < oldestAllowed) break;
    if (!candidate.touched) {
      const ls = findBestLsMatch(
        h1Levels,
        m5Levels,
        candidate,
        dir,
        params.graceSec,
        params.lsMaxLeadSecH1,
        params.lsMaxLeadSecM5,
        params.maxDistanceM5,
      );
      if (ls) return { fractal: candidate, ls };
    }
  }
  return null;
}

// Prüft, ob seit `fromTime` (exklusiv) bis `toTime` (inklusiv) irgendeine M5-Kerze STRUKTURELL
// gegen `levelPrice` geschlossen hat — dieselbe Sweep-vs-Bruch-Unterscheidung wie
// closesBelowLevel/closesAboveLevel in marketStructureAnalysis.ts (Chat 2026-07-19: "LQ-Sweep
// darf kein BOS werden"), hier auf M5- statt H1-Kerzen. dir: -1 (Long) -> Bruch = Close UNTER
// levelPrice, dir: 1 (Short) -> Close DARÜBER.
function closesBeyondLevel(candles: Candle[], fromTime: number, toTime: number, levelPrice: number, dir: 1 | -1): boolean {
  return candles.some((c) => c.time > fromTime && c.time <= toTime && (dir === -1 ? c.close < levelPrice : c.close > levelPrice));
}

// Path B (Chat 2026-07-26, Bug-Report "M5 OB wird nicht als Trade-Setup erkannt"): laut Philips
// Strategie reicht es AUCH, wenn sich der bestätigende M5-OB sofort (oder kurz) nach einem LS
// bildet, ohne dass sich zusätzlich noch ein eigenes, per period-5-Williams-Fraktal bestätigtes
// Protected-Pivot ausbildet (das braucht mindestens 5 M5-Kerzen/25min Bestätigungszeit). Ergänzt
// findProtectedFractal (Path A), ersetzt es NICHT — explizite Ansage von Philip: "Path A nicht
// rausschmeißen, es ist laut Strategie BEIDES möglich" (z.B. hält ein 1H-LS-Sweep auch dann, wenn
// zwischenzeitlich M5-Kerzen dagegen schließen, weil dort weiterhin nur Path A über das spätere
// Protected-Pivot zählt, siehe gbp_h1_uptrend_LQ_sweep_long_setup Replay-Beispiel 08.07.2026
// 11:50). Ohne fractal-Kandidat: der LS-Level selbst ist der Referenzpunkt, einzige Bedingung
// außer dem OB-Timing ist closesBeyondLevel seit dem Sweep — anders als bei Path A gilt das hier
// für JEDES LS (H1 oder M5), weil kein separat bestätigter Fraktal-Puffer zwischenzeitliche
// Gegenbewegungen abfedert. Gibt das AKTUELLSTE gültige (LS, OB)-Paar zurück (nicht die erste
// Übereinstimmung wie findProtectedFractal, weil hier — anders als dort — keine vorsortierte
// Fraktal-Liste durchsucht wird, sondern h1Levels+m5Levels gemischt).
function findImmediateLsSetup(
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  m5Candles: Candle[],
  dir: 1 | -1,
  setupObs: SetupOb[],
  params: TradeSetupParams,
): { ls: LiquidityLevel; ob: SetupOb } | null {
  const oldestAllowed = params.nowTime - params.maxLookbackSec;
  const obDir: 1 | -1 = dir === 1 ? -1 : 1;
  let best: { ls: LiquidityLevel; ob: SetupOb } | null = null;
  for (const ls of [...h1Levels, ...m5Levels]) {
    if (!ls.touched || ls.touchedTime == null || ls.touchedTime < oldestAllowed) continue;
    if (closesBeyondLevel(m5Candles, ls.touchedTime, params.nowTime, ls.price, dir)) continue;
    const ob = findFirstSetupObAfter(setupObs, obDir, ls.touchedTime, params.obMaxDelaySec);
    if (!ob) continue;
    if (!best || ob.startTime > best.ob.startTime) best = { ls, ob };
  }
  return best;
}

// Gültiges Setup = ENTWEDER (Path A) ein aktuell gültiges "Protected High/Low" auf M5-Basis + der
// es sweepende H1- oder M5-LQ-Level, ODER (Path B) ein LS-Level, das seit dem Sweep strukturell
// nicht gebrochen wurde (siehe findImmediateLsSetup) — jeweils UND ein bestätigendes M5-OB, das
// zeitlich danach entstanden ist. dir: 1 = Short (Protected High, braucht bärisches M5-OB), -1 =
// Long (Protected Low, braucht bullisches M5-OB). m5Levels ist i.d.R. dieselbe Array-Referenz wie
// fractalLevels (ein Fraktal kann auch von einem anderen M5-Fraktal geswept werden). Treffen
// beide Pfade zu, gewinnt das AKTUELLERE (spätere obStartTime) — bei Gleichstand Path A, weil das
// einen echten Fraktal-Datensatz mitbringt. Fehlt Path A ein eigenes Fraktal (Path-B-Treffer),
// wird `fractal` auf `ls` gesetzt — dieselbe Semantik wie "der Level, der halten muss", nur ohne
// separat bestätigten Pivot; hält den Dedupe-Key (`fractal_pivot_time`, siehe poi-watcher) und
// die DB-NOT-NULL-Spalten ohne Sonderfall funktionsfähig.
export function detectTradeSetup(
  dir: 1 | -1,
  fractalLevels: LiquidityLevel[],
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  setupObs: SetupOb[],
  params: TradeSetupParams,
  m5Candles: Candle[],
): DetectedTradeSetup | null {
  const obDir: 1 | -1 = dir === 1 ? -1 : 1;

  let pathA: DetectedTradeSetup | null = null;
  const foundA = findProtectedFractal(fractalLevels, h1Levels, m5Levels, dir, params);
  if (foundA) {
    const ob = findFirstSetupObAfter(setupObs, obDir, foundA.fractal.pivotTime, params.obMaxDelaySec);
    if (ob) pathA = { dir, fractal: foundA.fractal, ls: foundA.ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime, pathType: "A" };
  }

  let pathB: DetectedTradeSetup | null = null;
  const foundB = findImmediateLsSetup(h1Levels, m5Levels, m5Candles, dir, setupObs, params);
  if (foundB) {
    pathB = { dir, fractal: foundB.ls, ls: foundB.ls, obTop: foundB.ob.top, obBottom: foundB.ob.bottom, obStartTime: foundB.ob.startTime, pathType: "B" };
  }

  if (pathA && pathB) return pathB.obStartTime > pathA.obStartTime ? pathB : pathA;
  return pathA ?? pathB;
}
