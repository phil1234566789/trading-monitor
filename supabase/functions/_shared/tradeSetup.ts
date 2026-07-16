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
}

export interface TradeSetupParams {
  graceSec: number; // Toleranz NACH dem Fraktal, bis zu der der LS noch zählt (i.d.R. eine M5-Kerzenlänge)
  lsMaxLeadSec: number; // wie weit VOR dem Fraktal der LS liegen darf
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
): LiquidityLevel | null {
  const earliest = fractal.pivotTime - lsMaxLeadSec;
  const deadline = fractal.pivotTime + graceSec;
  let best: LiquidityLevel | null = null;
  let bestTouchedTime = -1;
  for (const lvl of levels) {
    const onFarSide = dir === 1 ? lvl.price < fractal.price : lvl.price > fractal.price;
    const eligible =
      lvl.touched && lvl.touchedTime !== null && lvl.touchedTime >= earliest && lvl.touchedTime <= deadline && onFarSide;
    if (eligible && lvl.touchedTime! > bestTouchedTime) {
      bestTouchedTime = lvl.touchedTime!;
      best = lvl;
    }
  }
  return best;
}

// Ein Fraktal kann sowohl durch einen größeren H1-Sweep als auch durch einen kleineren
// M5-Sweep entstehen, beide zählen gleichwertig — gewinnt das mit dem zeitlich spätesten
// Berührungszeitpunkt, unabhängig davon aus welchem Array es kommt.
function findBestLsMatch(
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  fractal: LiquidityLevel,
  dir: 1 | -1,
  graceSec: number,
  lsMaxLeadSec: number,
): LiquidityLevel | null {
  const h1Match = findLsInArray(h1Levels, fractal, dir, graceSec, lsMaxLeadSec);
  const m5Match = findLsInArray(m5Levels, fractal, dir, graceSec, lsMaxLeadSec);
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
      const ls = findBestLsMatch(h1Levels, m5Levels, candidate, dir, params.graceSec, params.lsMaxLeadSec);
      if (ls) return { fractal: candidate, ls };
    }
  }
  return null;
}

// Gültiges Setup = (1) aktuell gültiges "Protected High/Low" auf M5-Basis + der es sweepende
// H1- oder M5-LQ-Level, UND (2) ein bestätigendes M5-OB, das zeitlich NACH diesem M5-Fraktal
// entstanden ist. dir: 1 = Short (Protected High, braucht bärisches M5-OB), -1 = Long
// (Protected Low, braucht bullisches M5-OB). m5Levels ist i.d.R. dieselbe Array-Referenz wie
// fractalLevels (ein Fraktal kann auch von einem anderen M5-Fraktal geswept werden).
export function detectTradeSetup(
  dir: 1 | -1,
  fractalLevels: LiquidityLevel[],
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  setupObs: SetupOb[],
  params: TradeSetupParams,
): DetectedTradeSetup | null {
  const found = findProtectedFractal(fractalLevels, h1Levels, m5Levels, dir, params);
  if (!found) return null;
  const obDir: 1 | -1 = dir === 1 ? -1 : 1;
  const ob = findFirstSetupObAfter(setupObs, obDir, found.fractal.pivotTime, params.obMaxDelaySec);
  if (!ob) return null;
  return { dir, fractal: found.fractal, ls: found.ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime };
}
