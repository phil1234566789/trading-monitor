// Portiert aus tv-indikator/src/tradesetup.pine (checkShortSetup/checkLongSetup) für die
// Deno-Edge-Function-Laufzeit — reine Erkennungslogik, kein Chart-Rendering. Short/Long sind
// dort aus einer Pine-spezifischen Einschränkung heraus dupliziert (globale var-Variablen
// dürfen nicht per := aus einer Funktion heraus neu zugewiesen werden, CE10088) — hier nicht
// nötig, daher eine einzige, dir-parametrisierte Version. Bei Änderungen an der Setup-Logik
// im Indikator diese Kopie mitziehen. Alle Zeiten in Sekunden (Unix-Time), wie der Rest dieser
// Codebase (liquidity.ts/orderBlocks.ts) — nicht Millisekunden wie im Pine-Original.
import { detectOrderBlocks, type Candle } from "./orderBlocks.ts";
import { businessSecondsBetween } from "./ageTier.ts";
import type { LiquidityLevel } from "./liquidity.ts";

export interface SetupOb {
  dir: 1 | -1; // 1 = bullische Lücke, -1 = bärische Lücke
  top: number;
  bottom: number;
  startTime: number; // Zeitpunkt der mittleren Impuls-Kerze, siehe detectSetupObs
  fvg: number; // Groesse der FVG in Preiseinheiten, siehe Zone.fvg
}

// Ein abgeräumtes Level samt seiner Herkunft. Den Timeframe vergibt die Erkennung selbst, weil
// nur sie weiß, aus welchem Array das Level kam — vorher hat ihn jeder Aufrufer per
// `h1Levels.includes(...)` nachgebaut (poi-watcher und backfillTradeSetups je einmal).
export interface SetupSweep {
  level: LiquidityLevel;
  timeframe: "1H" | "5M";
}

export interface DetectedTradeSetup {
  dir: 1 | -1; // 1 = Short (Protected High), -1 = Long (Protected Low)
  fractal: LiquidityLevel; // M5-Fraktal ("Protected High/Low")
  ls: LiquidityLevel; // sweependes LQ-Level (H1 oder M5) — das "Liquidity Sweep"
  sweeps: SetupSweep[]; // ALLE Level, die dieser OB abgeräumt hat, ältester zuerst — sweeps[0].level === ls
  obTop: number;
  obBottom: number;
  obStartTime: number;
  obFvg: number; // Groesse der bestaetigenden FVG in Preiseinheiten, siehe SetupOb.fvg
  // "A" = eigenes bestätigtes Protected-Pivot (fractal !== ls), "B" = fractal === ls — reine
  // Debug-Info, keine eigene Erkennungslogik. Seit 2026-09-20 steuert sie nichts mehr (Philip:
  // "fachlich gesehen ist mir scheissegal, ob Path A oder B"), bleibt aber mitgeführt, damit beide
  // Kopien strukturell in Sync bleiben.
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
  maxSweepDistance: number; // Preiseinheiten, NICHT Pip. Wie weit ein MITGESAMMELTER Sweep vom
  // Level entfernt liegen darf, über das der Pfad das Setup gefunden hat (siehe collectObSweeps).
  maxLookbackSec: number; // wie weit rückwärts nach einem gültigen Fraktal gesucht wird
  closeCheckMaxAgeSec: number; // Regel 2 (Philip 2026-09-21): der Close-Check (closesBeyondLevel)
  // gilt nur für Sweep-Level, die beim Sweep JÜNGER als das waren. Ein frisches Level, durch das
  // der Preis schließt, IST gebrochen; an einem alten Level (Wochenhoch) ist ein kurzer Close mit
  // Reclaim normales Rauschen. 0 = Check nie, Infinity = Check immer (Verhalten bis 2026-09-21).
  obMaxDelaySec: number; // maximale Verzögerung Fraktal → bestätigendes M5-OB
  nowTime: number; // Referenzzeitpunkt für maxLookbackSec (i.d.R. Zeit der letzten M5-Kerze)
}

// Zentrale Tuning-Konstanten, 1:1 aus tv-indikator/src/inputs.pine übernommen (nicht neu erraten) —
// vormals in poi-watcher/index.ts dupliziert, jetzt hierher gezogen, weil get_data_snapshot
// (trading-monitor-mcp) dieselbe Live-Erkennung mit denselben Werten braucht (DRY innerhalb
// derselben Deno-Runtime, Task "Live-Trade-Setup-Erkennung serverseitig für Lana", 2026-09-05).
export const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
export const TRADE_SETUP_H1_FRACTAL_PERIOD = 10; // liqH1Period — bewusst ANDERS als LIQUIDITY_FRACTAL_PERIOD (eigene 1H-Notification, andere Abstimmung)
export const TRADE_SETUP_PIP_SIZE = 0.0001; // gilt für beide FX-Paare (GBPUSD/EURUSD)

export const DEFAULT_TRADE_SETUP_PARAMS: Omit<TradeSetupParams, "nowTime"> = {
  graceSec: 5 * 60, // eine M5-Kerzenlänge
  // H1-Sweep liegt typischerweise deutlich länger vor dem Fraktal als ein M5-Sweep, daher eigenes
  // größeres Fenster (Bug-Report 2026-07-17: ein gemeinsames Fenster war für M5 zu großzügig oder
  // für H1 zu eng, siehe tv-indikator "fix short setups für 1h LS und M5 LS").
  lsMaxLeadSecH1: 120 * 60,
  lsMaxLeadSecM5: 45 * 60,
  // Preiseinheiten, NICHT Pip — 5 Pips, NUR für M5 (H1 bekommt kein Limit, siehe
  // tv-indikator "M5 LS auf 5 pips eingrenzen").
  maxDistanceM5: 5.0 * TRADE_SETUP_PIP_SIZE,
  // 10 Pips (Philip 2026-09-21). Ohne dieses Limit sammelte collectObSweeps jedes Level ein, das
  // zeitlich ins Fenster fiel — gemessen über 994 Setups lagen 136 der 748 Nebensweeps weiter als
  // 10 Pip weg, im Extremfall 57,8 (GBPUSD-Setup #1139, 17.04.2026: vier alte M5-Hochs 40-58 Pip
  // unter dem tragenden 1H-Sweep, schlicht Level, durch die der Preis auf dem Weg nach oben lief).
  // Bewusst großzügiger als maxDistanceM5 (5 Pip): das dort begrenzt den Abstand LS<->Fraktal, hier
  // geht es um zwei Level, die zusammen eine Zone abräumen.
  maxSweepDistance: 10.0 * TRADE_SETUP_PIP_SIZE,
  maxLookbackSec: 6 * 60 * 60,
  obMaxDelaySec: 60 * 60,
  // 0 = Check aus, als Messergebnis (analysis/dr-reichweite/ergebnis-close-check.txt, 21.09.2026):
  // über 930 Dealing Ranges trennt das Alter die zusätzlich gefundenen NICHT — das älteste Randband
  // ist bei 15 Pips das schlechteste, ein Reclaim-Kriterium trennt genauso wenig. Der Check kostet
  // 43 % der Setups und bringt dafür 3 Punkte Trefferquote (15 P: 59 statt 56 %). Auf Infinity
  // gesetzt ist das Verhalten bis 20.09.2026 zurück.
  closeCheckMaxAgeSec: 0,
};

// Bis Bug-Report Philip 2026-07-29 ("egal welcher M5 OB wo in welcher Code-Stelle von uns, sollten
// alle dieselbe Erkennungslogik haben") eine EIGENE, von detectOrderBlocks() unabhängige 3-Kerzen-
// FVG-Existenzprüfung ohne Mindestgröße. Jetzt direkte Wiederverwendung von detectOrderBlocks()
// (orderBlocks.ts) mit "5m" fest verdrahtet (detectSetupObs läuft ausschließlich auf M5-Kerzen,
// siehe Aufrufer in poi-watcher/index.ts) — dieselbe Änderung wie in der JS-Kopie (tradeSetup.js),
// aus demselben Grund: alle M5-OB-Erkennungen (Chart-Overlay, Trade-Setup-Frontend,
// Trade-Setup-Backend/Telegram-Alarme) sollen exakt dieselben Lücken als relevant ansehen.
export function detectSetupObs(candles: Candle[]): SetupOb[] {
  return detectOrderBlocks(candles, "5m").map((z) => ({ dir: z.dir, top: z.top, bottom: z.bottom, startTime: z.startTime, fvg: z.fvg }));
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

// Wie lange das Level schon stand, BEVOR es gesweept wurde — dasselbe Maß wie computeSweepAgeHours
// (ageTier.ts), das den Alarmtext und die Qualitätsmerkmale in analysis/dr-reichweite/ füttert.
function sweepAgeSec(ls: LiquidityLevel): number {
  return businessSecondsBetween(ls.pivotTime, ls.touchedTime ?? ls.pivotTime);
}

// Regel 2 (Philip 2026-09-21): der Close-Check disqualifiziert einen Sweep nur noch, solange das
// gesweepte Level JUNG war. Vorher galt er unbegrenzt, und genau das hat den schnellen Pfad bei
// einem klassischen Sweep-and-Reclaim ausgeschaltet (Setup #1617, 21.09.2026: einmal unter dem
// Level geschlossen und um 09:05 wieder darüber — der Alarm kam erst 15 Minuten später über Path A).
function sweepBrokenByClose(ls: LiquidityLevel, m5Candles: Candle[], dir: 1 | -1, params: TradeSetupParams): boolean {
  if (sweepAgeSec(ls) >= params.closeCheckMaxAgeSec) return false;
  return closesBeyondLevel(m5Candles, ls.touchedTime!, params.nowTime, ls.price, dir);
}

// Regel 3 (Philip 2026-09-21), Teil 1: ALLE Sweeps, die zu diesem OB gehören — nicht nur der, über
// den der Pfad das Setup gefunden hat. Bedingung ist dieselbe Zeitlage wie beim Finden (Touch vor
// der Impuls-Kerze, höchstens obMaxDelaySec davor); die Seite steckt schon in den übergebenen
// Arrays (Lows bei Long, Highs bei Short). Der Close-Check läuft hier BEWUSST NICHT mit: er
// entscheidet, ob der schnelle Pfad ein Setup überhaupt früh melden darf, nicht welche Kerzen zur
// Kraft-Zone gehören — und über alle Pfade soll für denselben OB dasselbe herauskommen (Regel 4).
function collectObSweeps(
  ob: SetupOb,
  ownLs: LiquidityLevel,
  h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[],
  params: TradeSetupParams,
): SetupSweep[] {
  const sweeps: SetupSweep[] = [{ level: ownLs, timeframe: h1Levels.includes(ownLs) ? "1H" : "5M" }];
  for (const [levels, timeframe] of [[h1Levels, "1H"], [m5Levels, "5M"]] as const) {
    for (const lvl of levels) {
      if (lvl === ownLs || !lvl.touched || lvl.touchedTime == null) continue;
      if (lvl.touchedTime > ob.startTime || ob.startTime - lvl.touchedTime > params.obMaxDelaySec) continue;
      // Abstand zu ownLs, NICHT zum ältesten: der älteste wird erst unten gekürt, und zwar aus
      // genau diesem Topf — gegen ihn zu filtern hieße, ein weit entferntes Level erst zum Anker
      // zu machen und dann alles Richtige wegzuwerfen. ownLs hat maxDistanceM5 & Co. schon passiert.
      if (Math.abs(lvl.price - ownLs.price) > params.maxSweepDistance) continue;
      sweeps.push({ level: lvl, timeframe });
    }
  }
  // Regel 3, Teil 2: ÄLTESTER zuerst ("Ältester Sweep ist der für die Strategie am
  // entscheidendsten") — sweeps[0] füllt ls_price/ls_pivot_time/ls_touched_time/ls_timeframe. Bei
  // gleichem Alter der früher entstandene Pivot, damit beide Laufzeiten dasselbe Level wählen.
  return sweeps.sort((a, b) => sweepAgeSec(b.level) - sweepAgeSec(a.level) || a.level.pivotTime - b.level.pivotTime);
}

// Path B (Chat 2026-07-26, Bug-Report "M5 OB wird nicht als Trade-Setup erkannt"): laut Philips
// Strategie reicht es AUCH, wenn sich der bestätigende M5-OB sofort (oder kurz) nach einem LS
// bildet, ohne dass sich zusätzlich noch ein eigenes, per period-5-Williams-Fraktal bestätigtes
// Protected-Pivot ausbildet (das braucht mindestens 5 M5-Kerzen/25min Bestätigungszeit). Ergänzt
// findProtectedFractal (Path A), ersetzt es NICHT — explizite Ansage von Philip: "Path A nicht
// rausschmeißen, es ist laut Strategie BEIDES möglich" (z.B. hält ein 1H-LS-Sweep auch dann, wenn
// zwischenzeitlich M5-Kerzen dagegen schließen, weil dort weiterhin nur Path A über das spätere
// Protected-Pivot zählt, siehe gbp_h1_uptrend_LQ_sweep_long_setup Replay-Beispiel 08.07.2026
// 11:50). Ohne fractal-Kandidat: der LS-Level selbst ist der Referenzpunkt, einzige Bedingung außer
// dem OB-Timing ist sweepBrokenByClose (siehe dort — seit 2026-09-21 altersabhängig statt
// unbegrenzt). Das ist der Pfad, der den Alarm trägt: er meldet, sobald Sweep und FVG stehen, ohne
// die 5 Kerzen Fraktal-Bestätigung. Gibt das AKTUELLSTE gültige (LS, OB)-Paar zurück (nicht die erste
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
    if (sweepBrokenByClose(ls, m5Candles, dir, params)) continue;
    const ob = findFirstSetupObAfter(setupObs, obDir, ls.touchedTime, params.obMaxDelaySec);
    if (!ob) continue;
    if (!best || ob.startTime > best.ob.startTime) best = { ls, ob };
  }
  return best;
}

// Erweitert die OB-Box um die tatsächliche Kraft-Zone zwischen Sweep und FVG (Chat 2026-07-29:
// "ich möchte die höheren Preise, die vor der FVG zustande kamen, mit dabei haben" — die
// FVG-nächstgelegene Kante war bisher exakt eine Kerze breit). Die FVG-anknüpfende Kante bleibt
// unangetastet (bottom bei Short/top bei Long, siehe deriveSetupEntryInvalidation in der JS-Kopie), die
// GEGENÜBERLIEGENDE Kante wird auf den Extremwert (höchstes High bei Short, tiefstes Low bei Long)
// aller M5-Kerzen zwischen dem Sweep-Touch (`ls.touchedTime`, inklusive) und der FVG-Impuls-Kerze
// (`ob.startTime`, inklusive — Philip: "Impulskerze, welche FVG beinhaltet, ist dabei") erweitert.
// Fenster-Start ist seit 2026-09-21 der FRÜHESTE Touch aller Sweeps dieses OB (Regel 3, siehe
// collectObSweeps): ein früherer Start ist eine Obermenge derselben Kerzen, das Extrem darüber kann
// nur gleich bleiben oder weiter weg rücken — die Invalidierung wird damit nie zu eng.
// Diese erweiterte Kante IST seit 2026-09-20 zugleich die Invalidierung des Setups (trade_setups.
// invalidation, siehe Migration 20260920140000): über 889 Path-A-Zeilen gemessen stimmt sie in
// 96 % auf unter 1 Pip mit dem später bestätigten Extrem-Fraktal überein, in 87 % punktgenau — der
// period-5-Pivot bestätigt also nur einen Preis, der beim Entstehen des OB längst feststeht. Wo
// beide auseinanderliegen, liegt die Kante in 30 von 33 Fällen WEITER weg, also nie zu eng.
function widenObForSweep(ob: SetupOb, fensterVonSec: number, dir: 1 | -1, m5Candles: Candle[]): SetupOb {
  const windowCandles = m5Candles.filter((c) => c.time >= fensterVonSec && c.time <= ob.startTime);
  if (windowCandles.length === 0) return ob;
  if (dir === 1) {
    return { ...ob, top: Math.max(ob.top, ...windowCandles.map((c) => c.high)) };
  }
  return { ...ob, bottom: Math.min(ob.bottom, ...windowCandles.map((c) => c.low)) };
}

// Gültiges Setup = ENTWEDER (Path A) ein aktuell gültiges "Protected High/Low" auf M5-Basis + der
// es sweepende H1- oder M5-LQ-Level, ODER (Path B) ein LS-Level, das seit dem Sweep strukturell
// nicht gebrochen wurde (siehe findImmediateLsSetup) — jeweils UND ein bestätigendes M5-OB, das
// zeitlich danach entstanden ist. dir: 1 = Short (Protected High, braucht bärisches M5-OB), -1 =
// Long (Protected Low, braucht bullisches M5-OB). m5Levels ist i.d.R. dieselbe Array-Referenz wie
// fractalLevels (ein Fraktal kann auch von einem anderen M5-Fraktal geswept werden). Treffen
// beide Pfade zu, gewinnt das AKTUELLERE (spätere obStartTime) — bei Gleichstand Path A, weil das
// einen echten Fraktal-Datensatz mitbringt. Genau dieser Gleichstand ist seit 2026-09-20 der
// Normalfall statt eines Sonderfalls: EIN Setup je bestätigender M5-OB, der Pfad ist nur noch
// Debug-Info (dieselbe Regel wie die Entduplizierung in der JS-Kopie). Fehlt Path A ein eigenes
// Fraktal (Path-B-Treffer), wird `fractal` auf `ls` gesetzt — dieselbe Semantik wie "der Level,
// der halten muss", nur ohne separat bestätigten Pivot; hält die DB-NOT-NULL-Spalten ohne
// Sonderfall funktionsfähig.
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

  // Regel 3+4: die Zahlen eines Setups hängen am OB, nicht am Pfad — deshalb rechnet dieselbe
  // Funktion sie für beide Pfade aus. Ein späterer Finder desselben OB kann sie damit nicht mehr
  // verändern (Philip: "die erste, die schnellste, trifft das Trade-Setup").
  const baueSetup = (ob: SetupOb, ownLs: LiquidityLevel, fractal: LiquidityLevel | null, pathType: "A" | "B"): DetectedTradeSetup => {
    const sweeps = collectObSweeps(ob, ownLs, h1Levels, m5Levels, params);
    const ls = sweeps[0].level;
    const fensterVon = Math.min(...sweeps.map((sw) => sw.level.touchedTime!));
    const widened = widenObForSweep(ob, fensterVon, dir, m5Candles);
    return { dir, fractal: fractal ?? ls, ls, sweeps, obTop: widened.top, obBottom: widened.bottom, obStartTime: widened.startTime, obFvg: widened.fvg, pathType };
  };

  let pathA: DetectedTradeSetup | null = null;
  const foundA = findProtectedFractal(fractalLevels, h1Levels, m5Levels, dir, params);
  if (foundA) {
    const ob = findFirstSetupObAfter(setupObs, obDir, foundA.fractal.pivotTime, params.obMaxDelaySec);
    if (ob) pathA = baueSetup(ob, foundA.ls, foundA.fractal, "A");
  }

  let pathB: DetectedTradeSetup | null = null;
  const foundB = findImmediateLsSetup(h1Levels, m5Levels, m5Candles, dir, setupObs, params);
  if (foundB) pathB = baueSetup(foundB.ob, foundB.ls, null, "B");

  if (pathA && pathB) return pathB.obStartTime > pathA.obStartTime ? pathB : pathA;
  return pathA ?? pathB;
}
