// Trade-Setup-Erkennung, portiert aus tv-indikator/src/tradesetup.pine (checkShortSetup/
// checkLongSetup) — reine Erkennungslogik, batch-berechnet über das geladene `candles`-Array
// (analog zu liquidity.js/orderBlocks.js), kein persistenter Ringpuffer-State wie im Pine-
// Original. Short/Long sind dort aus einer Pine-spezifischen Einschränkung heraus dupliziert
// (globale var-Variablen dürfen nicht per := aus einer Funktion heraus neu zugewiesen werden,
// CE10088) — hier nicht nötig, daher eine einzige, dir-parametrisierte Version. Bei Änderungen
// an der Setup-Logik im Indikator diese Kopie (und die Deno-Kopie in
// supabase/functions/_shared/tradeSetup.ts) mitziehen.

// Eigene, von detectOrderBlocks() unabhängige 3-Kerzen-FVG-Erkennung — bewusst OHNE Session-
// Filter/Schwäche-/Cap-Einschränkung (siehe pushSetupOb in tradesetup.pine): für die Setup-
// Erkennung zählt nur, ob die Preislücke überhaupt existiert, unabhängig von Uhrzeit oder Größe.
export function detectSetupObs(candles) {
  const obs = [];
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
// zuerst) sortiert — die erste Übereinstimmung ist daher automatisch die zeitlich früheste.
function findFirstSetupObAfter(obs, obDir, afterTime, maxDelaySec) {
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
function findLsInArray(levels, fractal, dir, graceSec, lsMaxLeadSec) {
  const earliest = fractal.pivotTime - lsMaxLeadSec;
  const deadline = fractal.pivotTime + graceSec;
  let best = null;
  let bestTouchedTime = -1;
  for (const lvl of levels) {
    const onFarSide = dir === 1 ? lvl.price < fractal.price : lvl.price > fractal.price;
    const eligible =
      lvl.touched && lvl.touchedTime != null && lvl.touchedTime >= earliest && lvl.touchedTime <= deadline && onFarSide;
    if (eligible && lvl.touchedTime > bestTouchedTime) {
      bestTouchedTime = lvl.touchedTime;
      best = lvl;
    }
  }
  return best;
}

// Ein Fraktal kann sowohl durch einen größeren H1-Sweep als auch durch einen kleineren
// M5-Sweep entstehen, beide zählen gleichwertig — gewinnt das mit dem zeitlich spätesten
// Berührungszeitpunkt, unabhängig davon aus welchem Array es kommt.
function findBestLsMatch(h1Levels, m5Levels, fractal, dir, graceSec, lsMaxLeadSec) {
  const h1Match = findLsInArray(h1Levels, fractal, dir, graceSec, lsMaxLeadSec);
  const m5Match = findLsInArray(m5Levels, fractal, dir, graceSec, lsMaxLeadSec);
  if (m5Match && (!h1Match || m5Match.touchedTime > h1Match.touchedTime)) return m5Match;
  return h1Match;
}

// Jedes Fraktal im geladenen Fenster (unabhängig vom aktuellen touched-Status) unabhängig
// darauf prüfen, ob es damals ein gültiges LS hatte — anders als die "Live"-Suche im
// tv-indikator (findProtectedFractal dort verlangt touched=false, weil dort nur der GERADE
// aktive Setup gezeichnet wird). Hier soll auch die Historie sichtbar sein (siehe
// tradeSetupHistoryCount in PriceChart.vue), daher zählt jedes damals gültige Fraktal, ob es
// später gebrochen wurde oder nicht — wir haben ohnehin keinen bar-für-bar-State wie das
// Pine-Original, sondern rechnen bei jedem Refresh komplett neu aus dem geladenen Fenster.
function findAllProtectedFractals(fractalLevels, h1Levels, m5Levels, dir, params) {
  const results = [];
  for (const candidate of fractalLevels) {
    const ls = findBestLsMatch(h1Levels, m5Levels, candidate, dir, params.graceSec, params.lsMaxLeadSec);
    if (ls) results.push({ fractal: candidate, ls });
  }
  return results; // chronologisch (fractalLevels ist es bereits)
}

// Gültiges Setup = (1) ein "Protected High/Low" auf M5-Basis + der es sweepende H1- oder
// M5-LQ-Level, UND (2) ein bestätigendes M5-OB, das zeitlich NACH diesem M5-Fraktal
// entstanden ist. dir: 1 = Short (Protected High, braucht bärisches M5-OB), -1 = Long
// (Protected Low, braucht bullisches M5-OB). m5Levels ist i.d.R. dieselbe Array-Referenz wie
// fractalLevels (ein Fraktal kann auch von einem anderen M5-Fraktal geswept werden). Gibt ALLE
// im Fenster gefundenen Setups zurück (chronologisch, älteste zuerst) — Aufrufer schneidet
// selbst auf die gewünschte Anzahl zu (siehe lastTradeSetups im Original).
export function detectTradeSetups(dir, fractalLevels, h1Levels, m5Levels, setupObs, params) {
  const obDir = dir === 1 ? -1 : 1;
  const setups = [];
  for (const { fractal, ls } of findAllProtectedFractals(fractalLevels, h1Levels, m5Levels, dir, params)) {
    const ob = findFirstSetupObAfter(setupObs, obDir, fractal.pivotTime, params.obMaxDelaySec);
    if (ob) setups.push({ dir, fractal, ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime });
  }
  return setups;
}
