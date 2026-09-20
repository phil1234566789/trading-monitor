// Trade-Setup-Erkennung, portiert aus tv-indikator/src/tradesetup.pine (checkShortSetup/
// checkLongSetup) — reine Erkennungslogik, batch-berechnet über das geladene `candles`-Array
// (analog zu liquidity.js/orderBlocks.js), kein persistenter Ringpuffer-State wie im Pine-
// Original. Short/Long sind dort aus einer Pine-spezifischen Einschränkung heraus dupliziert
// (globale var-Variablen dürfen nicht per := aus einer Funktion heraus neu zugewiesen werden,
// CE10088) — hier nicht nötig, daher eine einzige, dir-parametrisierte Version. Bei Änderungen
// an der Setup-Logik im Indikator diese Kopie (und die Deno-Kopie in
// supabase/functions/_shared/tradeSetup.ts) mitziehen.
import { detectOrderBlocks } from "./orderBlocks.js";

// Bis Bug-Report Philip 2026-07-29 ("M5 OBs bei trade-setup passen noch nicht") eine EIGENE, von
// detectOrderBlocks() unabhängige 3-Kerzen-FVG-Existenzprüfung — bewusst OHNE Mindestgröße (jede
// positive Lücke zählte), während detectOrderBlocks() für M5 längst ein Pip-Minimum hat (siehe
// orderBlocks.js: LOWER_TF_MIN_GAP_PIPS). Dadurch konnte ein für Path A/B verwendetes "M5-OB"
// winziger sein als das, was der normale OB-Zonen-Toggle überhaupt als Zone zeichnet — sichtbar
// als Diskrepanz zwischen Trade-Setup-Box und OB-Overlay für dieselbe Kerzenfolge. Jetzt direkte
// Wiederverwendung von detectOrderBlocks() statt einer eigenen Parallel-Kopie, damit beide exakt
// dieselben Lücken als relevant ansehen — "5m" fest verdrahtet, da detectSetupObs ausschließlich
// auf M5-Kerzen läuft (siehe Aufrufer in PriceChart.vue/poi-watcher). Box-Grenzen (top/bottom)
// waren bereits identisch mit detectOrderBlocks() (Bug-Report Philip 2026-07-27), nur die
// Relevanz-Schwelle war unterschiedlich — das übernimmt detectOrderBlocks() jetzt komplett, hier
// bleibt nur noch die Reduktion aufs von tradeSetup.js erwartete Feld-Subset.
export function detectSetupObs(candles) {
  return detectOrderBlocks(candles, "5m").map((z) => ({ dir: z.dir, top: z.top, bottom: z.bottom, startTime: z.startTime }));
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

// Erweitert die OB-Box um die tatsächliche Kraft-Zone zwischen Sweep und FVG (Chat 2026-07-29:
// "ich möchte die höheren Preise, die vor der FVG zustande kamen, mit dabei haben" — die
// FVG-nächstgelegene Kante war bisher exakt eine Kerze breit). Die FVG-anknüpfende Kante bleibt
// unangetastet (bottom bei Short/top bei Long, siehe deriveSetupEntryInvalidation), die GEGENÜBERLIEGENDE
// Kante wird auf den Extremwert (höchstes High bei Short, tiefstes Low bei Long) aller M5-Kerzen
// zwischen dem Sweep-Touch (`ls.touchedTime`, inklusive) und der FVG-Impuls-Kerze (`ob.startTime`,
// inklusive — Philip: "Impulskerze, welche FVG beinhaltet, ist dabei") erweitert.
// Diese erweiterte Kante IST seit 2026-09-20 zugleich die Invalidierung des Setups (siehe
// deriveSetupEntryInvalidation): über 889 Path-A-Zeilen gemessen stimmt sie in 96 % auf unter
// 1 Pip mit dem später bestätigten Extrem-Fraktal überein, in 87 % punktgenau — der
// period-5-Pivot bestätigt also nur einen Preis, der beim Entstehen des OB längst feststeht.
// Wo beide auseinanderliegen, liegt die Kante in 30 von 33 Fällen WEITER weg, also nie zu eng
// (die fraktalbildende Kerze liegt immer im Fenster unten).
function widenObForSweep(ob, ls, dir, m5Candles) {
  if (!m5Candles || ls.touchedTime == null) return ob;
  const windowCandles = m5Candles.filter((c) => c.time >= ls.touchedTime && c.time <= ob.startTime);
  if (windowCandles.length === 0) return ob;
  if (dir === 1) {
    // Short: FVG-Kante ist bottom (siehe deriveSetupEntryInvalidation) — top wird erweitert.
    return { ...ob, top: Math.max(ob.top, ...windowCandles.map((c) => c.high)) };
  }
  // Long: FVG-Kante ist top — bottom wird erweitert.
  return { ...ob, bottom: Math.min(ob.bottom, ...windowCandles.map((c) => c.low)) };
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
// Sonderfall funktionsfähig.
//
// EIN Setup je bestätigender M5-OB (Philip 2026-09-20: "fachlich gesehen ist mir scheissegal, ob
// Path A oder B ... sobald es erkannt worden ist, gilt es halt einfach als Trade Setup"). Vorher
// schlüsselte die Entduplizierung auf (ls, ob) — derselbe OB ergab damit zwei Setups, sobald die
// Pfade auf verschiedene Sweeps liefen, und JEDER Verbraucher musste selbst zusammenfassen.
// Gewinnt bei Path A das JÜNGSTE Fraktal (deshalb Map-Overwrite statt `seen`-Guard) — dieselbe
// Wahl wie findProtectedFractal in der Deno-Kopie, die rückwärts sucht; beide Laufzeiten sollen
// für denselben OB dasselbe Setup melden. Path B füllt nur OBs, die Path A nicht beansprucht.
// `pathType` ("A"/"B") bleibt als reine Debug-Info erhalten (A = eigenes bestätigtes
// Protected-Pivot, B = fractal===ls) — seit 2026-09-20 steuert es weder Anzeige noch Auswertung.
export function detectTradeSetups(dir, fractalLevels, h1Levels, m5Levels, setupObs, params, m5Candles) {
  const obDir = dir === 1 ? -1 : 1;
  const byObStartTime = new Map();

  for (const { fractal, ls } of findAllProtectedFractals(fractalLevels, h1Levels, m5Levels, dir, params)) {
    let ob = findFirstSetupObAfter(setupObs, obDir, fractal.pivotTime, params.obMaxDelaySec);
    if (ob) {
      ob = widenObForSweep(ob, ls, dir, m5Candles);
      byObStartTime.set(ob.startTime, { dir, fractal, ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime, pathType: "A" });
    }
  }

  if (m5Candles) {
    for (const ls of findImmediateLsSetups(h1Levels, m5Levels, m5Candles, dir, params)) {
      let ob = findFirstSetupObAfter(setupObs, obDir, ls.touchedTime, params.obMaxDelaySec);
      if (!ob || byObStartTime.has(ob.startTime)) continue;
      ob = widenObForSweep(ob, ls, dir, m5Candles);
      byObStartTime.set(ob.startTime, { dir, fractal: ls, ls, obTop: ob.top, obBottom: ob.bottom, obStartTime: ob.startTime, pathType: "B" });
    }
  }

  return [...byObStartTime.values()].sort((a, b) => a.obStartTime - b.obStartTime);
}

// These-Ebene (Soll): "setupEntry ist bärische M5-OB-Unterkante, invalidation ist Oberkante"
// (Chat 2026-07-27, Philips eigene Definition, bewusst nicht die "Standard"-OB-Lesart) — beim
// Long spiegelbildlich. Stand ursprünglich in tradeIntake.js, seit der R-Skala (rScale.js) hier:
// beide Aufrufer brauchen nur die Geometrie, rScale.js soll aber nicht über tradeIntake.js den
// Supabase-Client mitziehen.
//
// setupEntry ist die Kante, die sich der OB mit seiner FVG teilt — Bug-Report Philip 2026-07-29
// ("Box Oberkante = OB Oberkante = FVG Unterkante, alles dasselbe"): ein bull-OB ({top: c1.high,
// bottom: impulse.low}, siehe orderBlocks.js) teilt sich mit seiner bullischen FVG GENAU eine
// Kante, c1.high = obTop; Long/Short waren hier damals vertauscht.
//
// invalidation ist die gegenüberliegende Kante, also das von widenObForSweep aufgezogene
// Sweep-Extrem (siehe dort) — seit 2026-09-20 die EINZIGE Invalidierungsquelle, unabhängig vom
// Pfad. Bis dahin las der Chart dafür `fractal.price`, das bei einem Path-B-Setup auf `ls` und
// damit auf das gesweepte Level statt aufs Extrem zeigte (Median 1,1 Pip daneben, max 12,4 — bei
// ~5 Pip typischem Risiko).
export function deriveSetupEntryInvalidation(setup) {
  return setup.dir === 1
    ? { setupEntry: setup.obBottom, invalidation: setup.obTop }
    : { setupEntry: setup.obTop, invalidation: setup.obBottom };
}
