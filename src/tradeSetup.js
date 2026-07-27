// Trade-Setup-Erkennung, portiert aus tv-indikator/src/tradesetup.pine (checkShortSetup/
// checkLongSetup) — reine Erkennungslogik, batch-berechnet über das geladene `candles`-Array
// (analog zu liquidity.js/orderBlocks.js), kein persistenter Ringpuffer-State wie im Pine-
// Original. Short/Long sind dort aus einer Pine-spezifischen Einschränkung heraus dupliziert
// (globale var-Variablen dürfen nicht per := aus einer Funktion heraus neu zugewiesen werden,
// CE10088) — hier nicht nötig, daher eine einzige, dir-parametrisierte Version. Bei Änderungen
// an der Setup-Logik im Indikator diese Kopie (und die Deno-Kopie in
// supabase/functions/_shared/tradeSetup.ts) mitziehen.

// Eigene, von detectOrderBlocks() unabhängige 3-Kerzen-FVG-Existenzprüfung — bewusst OHNE Session-
// Filter/Schwäche-/Cap-Einschränkung (siehe pushSetupOb in tradesetup.pine): für die Setup-
// Erkennung zählt nur, ob die Preislücke überhaupt existiert, unabhängig von Uhrzeit oder Größe.
// Box-Konstruktion (top/bottom) folgt seit Bug-Report Philip 2026-07-27 ("das ist die FVG, nicht
// die M5-OB") derselben Konvention wie detectOrderBlocks() (orderBlocks.js): C1-Kante bis zur
// GEGENÜBERLIEGENDEN Kante der Impuls-Kerze (i-1), nicht bis zur aktuellen Kerze (i) — vorher
// schloss die Box die ganze FVG inklusive Impuls-Kerze ein, statt nur die eigentliche OB-Zone.
// Ändert NICHT, ob/wann ein Setup erkannt wird (dieselbe Lücken-Bedingung, derselbe Index i,
// dasselbe startTime) — nur die Zonen-Grenzen werden enger.
export function detectSetupObs(candles) {
  const obs = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const impulse = candles[i - 1];
    const cur = candles[i];
    if (c1.low - cur.high > 0) obs.push({ dir: -1, top: impulse.high, bottom: c1.low, startTime: impulse.time });
    if (cur.low - c1.high > 0) obs.push({ dir: 1, top: c1.high, bottom: impulse.low, startTime: impulse.time });
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
function findLsInArray(levels, fractal, dir, graceSec, lsMaxLeadSec, maxDistance) {
  const earliest = fractal.pivotTime - lsMaxLeadSec;
  const deadline = fractal.pivotTime + graceSec;
  let best = null;
  let bestTouchedTime = -1;
  for (const lvl of levels) {
    const onFarSide = dir === 1 ? lvl.price < fractal.price : lvl.price > fractal.price;
    const withinDistance = maxDistance == null || Math.abs(lvl.price - fractal.price) <= maxDistance;
    const eligible =
      lvl.touched &&
      lvl.touchedTime != null &&
      lvl.touchedTime >= earliest &&
      lvl.touchedTime <= deadline &&
      onFarSide &&
      withinDistance;
    if (eligible && lvl.touchedTime > bestTouchedTime) {
      bestTouchedTime = lvl.touchedTime;
      best = lvl;
    }
  }
  return best;
}

// Ein Fraktal kann sowohl durch einen größeren H1-Sweep als auch durch einen kleineren
// M5-Sweep entstehen, beide zählen gleichwertig — gewinnt das mit dem zeitlich spätesten
// Berührungszeitpunkt, unabhängig davon aus welchem Array es kommt. Distanzlimit (maxDistanceM5)
// gilt bewusst NUR fürs M5-Level (H1 bekommt null = kein Limit).
function findBestLsMatch(h1Levels, m5Levels, fractal, dir, graceSec, lsMaxLeadSecH1, lsMaxLeadSecM5, maxDistanceM5) {
  const h1Match = findLsInArray(h1Levels, fractal, dir, graceSec, lsMaxLeadSecH1, null);
  const m5Match = findLsInArray(m5Levels, fractal, dir, graceSec, lsMaxLeadSecM5, maxDistanceM5);
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
    if (ls) results.push({ fractal: candidate, ls });
  }
  return results; // chronologisch (fractalLevels ist es bereits)
}

// Prüft, ob seit `fromTime` (exklusiv) bis `toTime` (inklusiv) irgendeine M5-Kerze STRUKTURELL
// gegen `levelPrice` geschlossen hat — dieselbe Sweep-vs-Bruch-Unterscheidung wie
// closesBelowLevel/closesAboveLevel in marketStructureAnalysis.ts (Chat 2026-07-19: "LQ-Sweep
// darf kein BOS werden"), hier auf M5- statt H1-Kerzen. dir: -1 (Long) -> Bruch = Close UNTER
// levelPrice, dir: 1 (Short) -> Close DARÜBER.
function closesBeyondLevel(candles, fromTime, toTime, levelPrice, dir) {
  return candles.some((c) => c.time > fromTime && c.time <= toTime && (dir === -1 ? c.close < levelPrice : c.close > levelPrice));
}

// Path B (Chat 2026-07-26, Bug-Report "M5 OB wird nicht als Trade-Setup erkannt"): laut Philips
// Strategie reicht es AUCH, wenn sich der bestätigende M5-OB sofort (oder kurz) nach einem LS
// bildet, ohne dass sich zusätzlich noch ein eigenes, per period-5-Williams-Fraktal bestätigtes
// Protected-Pivot ausbildet — das braucht mindestens 5 M5-Kerzen (25min) Bestätigungszeit und
// würde ein sofort reagierendes Setup künstlich verzögern. Ergänzt findAllProtectedFractals
// (Path A), ersetzt es NICHT (explizite Ansage von Philip: "Path A nicht rausschmeißen, es ist
// laut Strategie BEIDES möglich" — z.B. hält ein 1H-LS-Sweep auch dann, wenn zwischenzeitlich
// M5-Kerzen dagegen schließen, weil dort weiterhin nur Path A über das spätere Protected-Pivot
// zählt, siehe gbp_h1_uptrend_LQ_sweep_long_setup Replay-Beispiel 08.07.2026 11:50).
//
// Ohne fractal-Kandidat: der LS-Level selbst ist hier der Referenzpunkt. Einzige Bedingung außer
// dem OB-Timing: seit dem Sweep (ls.touchedTime) darf keine M5-Kerze STRUKTURELL dagegen
// geschlossen haben (closesBeyondLevel) — das gilt bei Path B (anders als bei Path A) für JEDES
// LS, ob H1- oder M5-Ursprungs, weil es hier keinen separat bestätigten Fraktal-Puffer gibt, der
// zwischenzeitliche Gegenbewegungen sonst abfedern würde.
function findImmediateLsSetups(h1Levels, m5Levels, m5Candles, dir, params) {
  const oldestAllowed = params.nowTime - params.maxLookbackSec;
  const results = [];
  for (const ls of [...h1Levels, ...m5Levels]) {
    if (!ls.touched || ls.touchedTime == null || ls.touchedTime < oldestAllowed) continue;
    if (closesBeyondLevel(m5Candles, ls.touchedTime, params.nowTime, ls.price, dir)) continue;
    results.push(ls);
  }
  return results;
}

// Eindeutiger Schlüssel für ein (ls, ob)-Paar — verhindert, dass Path A und Path B dasselbe
// Setup doppelt melden, falls beide für dieselbe LS-Sweep/OB-Kombination zutreffen.
function setupKey(ls, ob) {
  return `${ls.pivotTime}_${ob.startTime}`;
}

// Gültiges Setup = ENTWEDER (Path A) ein "Protected High/Low" auf M5-Basis + der es sweepende
// H1- oder M5-LQ-Level, ODER (Path B) ein LS-Level, das seit dem Sweep strukturell nicht
// gebrochen wurde (siehe findImmediateLsSetups) — jeweils UND ein bestätigendes M5-OB, das
// zeitlich danach entstanden ist. dir: 1 = Short (Protected High, braucht bärisches M5-OB), -1 =
// Long (Protected Low, braucht bullisches M5-OB). m5Levels ist i.d.R. dieselbe Array-Referenz wie
// fractalLevels (ein Fraktal kann auch von einem anderen M5-Fraktal geswept werden). m5Candles:
// für Path B's closesBeyondLevel-Prüfung. Gibt ALLE im Fenster gefundenen Setups zurück
// (chronologisch, älteste zuerst) — Aufrufer schneidet selbst auf die gewünschte Anzahl zu
// (siehe lastTradeSetups im Original). Fehlt Path A ein eigenes Fraktal (Path-B-Treffer), wird
// `fractal` auf `ls` gesetzt — dieselbe Semantik wie "der Level, der halten muss", nur ohne
// separat bestätigten Pivot; hält Downstream-Code (Chart-Rendering, poi-watcher-Dedupe) ohne
// Sonderfall funktionsfähig. `pathType` ("A"/"B", Chat 2026-07-26: "möchte es visuell
// unterschieden haben") — reine Anzeige-Info für Aufrufer (PriceChart.vue-Label, TSC), keine
// eigene Erkennungslogik: A = eigenes bestätigtes Protected-Pivot, B = fractal===ls.
export function detectTradeSetups(dir, fractalLevels, h1Levels, m5Levels, setupObs, params, m5Candles) {
  const obDir = dir === 1 ? -1 : 1;
  const setups = [];
  const seen = new Set();

  for (const { fractal, ls } of findAllProtectedFractals(fractalLevels, h1Levels, m5Levels, dir, params)) {
    const ob = findFirstSetupObAfter(setupObs, obDir, fractal.pivotTime, params.obMaxDelaySec);
    if (ob) {
      setups.push({ dir, fractal, ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime, pathType: "A" });
      seen.add(setupKey(ls, ob));
    }
  }

  if (m5Candles) {
    for (const ls of findImmediateLsSetups(h1Levels, m5Levels, m5Candles, dir, params)) {
      const ob = findFirstSetupObAfter(setupObs, obDir, ls.touchedTime, params.obMaxDelaySec);
      if (!ob) continue;
      const key = setupKey(ls, ob);
      if (seen.has(key)) continue;
      seen.add(key);
      setups.push({ dir, fractal: ls, ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime, pathType: "B" });
    }
  }

  setups.sort((a, b) => a.obStartTime - b.obStartTime);
  return setups;
}
