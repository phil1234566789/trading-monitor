// Unveränderte Dashboard-Module, nur Import/Export für file:// gekapselt. Sourcepfade/SHA: ob-reaction-entry-source-manifest.json.
(function(root){const modules={"m1FvgEntryProjection.js":function(require,exports){
const {closedChecklistCandles}=require("tradeSetupChecklistTimeBasis.js");
const {m1FvgEntryCandidates}=require("m1FvgEntrySelection.js");
const {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult}=require("m1FvgEntrySequence.js");

const FIELDS=['time','open','high','low','close','ignored'];
function sameRows(a,b) {
  return a.length===b.length && a.every((row,i)=>FIELDS.every(key=>row[key]===b[i][key]));
}
function project(rows,candidates,variant) {
  const states=candidates.map(fvg=>m1FvgEntrySequence(fvg,variant));
  let active=[],next=0,stateVisits=0;
  if(variant==='retestReaction')for(const candle of rows){
    while(next<states.length && states[next].fvg.recognizedAt<=candle.time)active.push(states[next++]);
    active=active.filter(state=>{
      stateVisits++;
      advanceM1FvgEntrySequence(state,candle);
      return !state.result;
    });
  }
  const results=new Map(states.map(state=>[state.fvg.candleTime,m1FvgSequenceResult(state)]));
  const confirmationResults=new Map();
  // Mehrere FVGs derselben Bestätigung liefern denselben Entry; der früheste Ursprung bleibt der Beleg.
  for(const result of results.values())if(result.status==='ready'&&!confirmationResults.has(result.confirmationCandleTime))
    confirmationResults.set(result.confirmationCandleTime,result);
  return {candidates,results,confirmationResults,confirmations:[...new Set([...results.values()]
    .filter(result=>result.status==='ready').map(result=>result.confirmationCandleTime))],stateVisits};
}

// Chart-Farbwechsel, Hover und FVG-Auswahl dürfen nicht dieselben Retest-Sequenzen erneut auswerten.
function createM1FvgEntryProjection() {
  let saved=[],savedDirection,candidates=[],variants=new Map();
  return ({candles,evaluatedAt,direction,variant})=>{
    const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
    if(direction!==savedDirection || !sameRows(rows,saved)){
      saved=rows.map(row=>({...row}));savedDirection=direction;
      candidates=m1FvgEntryCandidates(rows,evaluatedAt,direction);
      variants.clear();
    }
    if(!variants.has(variant))variants.set(variant,project(rows,candidates,variant));
    return variants.get(variant);
  };
}

Object.assign(exports,{createM1FvgEntryProjection});
},
"tradeSetupChecklistTimeBasis.js":function(require,exports){
const { barSecondsFor, barSecondsForTimeframeCi }=require("timeframes.js");
const { closedCandleEnd }=require("closedCandlePrefix.js");

function checklistEvaluationTime(replayUntil, nowSec, m5Candles = []) {
  return closedReplayEvaluationTime(replayUntil, nowSec, m5Candles, '5m');
}

function closedReplayEvaluationTime(replayUntil, nowSec, candles, bar) {
  if (replayUntil == null) return nowSec;
  // Replay zeigt ganze Kerzen anhand ihrer Open-Time. Nur eine tatsächlich vorhandene,
  // inzwischen geschlossene Kerze darf den Wissensstand bis zu ihrem Schluss erweitern.
  const latest = closedChecklistCandles(candles, bar, nowSec)
    .findLast(c => c.time <= replayUntil);
  return latest ? latest.time + barSecondsFor(bar) : null;
}

// Neutraler Import für Evaluator, Sweeps und Targets; kein Modul muss dadurch
// seinen eigenen Aufrufer importieren oder eine andere Schlussgrenze verwenden.
function closedChecklistCandles(candles, bar, evaluatedAt) {
  const duration = barSecondsForTimeframeCi(bar);
  if (!Number.isFinite(evaluatedAt) || duration == null) return [];
  // Keine dauerhafte Sortiert-Markierung: Chart-Aufrufer dürfen Arrays korrigieren.
  // Der schnelle Archivpfad gibt weiterhin eine eigene, veränderbare Kopie zurück.
  const rows=candles??[];
  let sorted=true;
  for(let i=0;i<rows.length;i++)if(!Number.isFinite(rows[i]?.time)||(i>0&&rows[i-1].time>rows[i].time)){
    sorted=false;break;
  }
  if(sorted)return rows.slice(0,closedCandleEnd(rows,duration,evaluatedAt));
  return rows.filter(c => Number.isFinite(c.time) && c.time + duration <= evaluatedAt)
    .slice().sort((a, b) => a.time - b.time);
}

Object.assign(exports,{checklistEvaluationTime,closedReplayEvaluationTime,closedChecklistCandles});
},
"timeframes.js":function(require,exports){
const TIMEFRAMES = [
  { label: "1m", bar: "1m" },
  { label: "3m", bar: "3m" },
  { label: "5m", bar: "5m" },
  { label: "15m", bar: "15m" },
  { label: "1h", bar: "1H" },
  { label: "4h", bar: "4H" },
  { label: "1D", bar: "1D" },
];

// Bar-Dauer in Sekunden je TIMEFRAMES-Label — zentrale Quelle, u.a. für candleCache.js (Delta-
// Fetch-Größe) und PriceChart.vue (an den Kerzenschluss ausgerichtetes Polling, siehe Chat
// 2026-07-20: "mir reicht pro M1 Kerzenschluss ... nicht 30s zu spät gefetched").
const BAR_SECONDS = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1D": 86400 };

function barSecondsFor(label) {
  return BAR_SECONDS[label] ?? 60;
}

// Case-insensitive Variante von BAR_SECONDS: ob_zones/liquidity_levels' eigene `timeframe`-Spalte
// nutzt Grossbuchstaben ("1H"/"4H"/"5M"), Dashboard.vue's currentBar/m5_liquidity_level-Snapshots
// dagegen die TIMEFRAMES-Label-Schreibweise ("1h"/"4h"/"5m") — für den Pin-Kaskaden-Vergleich
// (Bug 2026-08-21: gepinnte 1h/4h-Objekte sollen auf jedem feineren/gleichen Timeframe sichtbar
// bleiben, nicht umgekehrt) beide Varianten gegen dieselbe Sekundenzahl auflösen.
const BAR_SECONDS_BY_UPPER = Object.fromEntries(Object.entries(BAR_SECONDS).map(([label, sec]) => [label.toUpperCase(), sec]));
function barSecondsForTimeframeCi(raw) {
  return BAR_SECONDS_BY_UPPER[String(raw).toUpperCase()] ?? null;
}

// Wie weit im Replay-Modus vorausgefetcht wird (siehe PriceChart.vue: fetchCandlesCached-Aufrufe),
// damit wiederholtes "+1 Kerze"-Klicken erstmal komplett aus dem Cache bedient wird (Chat
// 2026-07-23: 429 beim Replay-Klicken, vorher nur 4h). Aus 2500 M5-Kerzen abgeleitet (Twelve Data
// erlaubt bis 5000 Kerzen/Request, 2500 Historie + 2500 Lookahead in EINEM Request beim
// Replay-Einstieg, siehe TRADE_SETUP_M5_CANDLE_LIMIT) — dieselbe Sekundenzahl ergibt für 1H
// automatisch ~208 Kerzen Vorausschau (750000 / 3600), synchron zum selben Zeit-Fenster, ohne
// dass jede Timeframe ihre eigene Kerzenzahl braucht.
const REPLAY_LOOKAHEAD_SEC = 2500 * BAR_SECONDS["5m"];

Object.assign(exports,{TIMEFRAMES,barSecondsFor,barSecondsForTimeframeCi,REPLAY_LOOKAHEAD_SEC});
},
"closedCandlePrefix.js":function(require,exports){
function closedCandleEnd(candles,duration,evaluatedAt) {
  let lower=0,upper=candles.length;
  while(lower<upper){
    const mid=(lower+upper)>>>1;
    if(candles[mid].time+duration<=evaluatedAt)lower=mid+1;else upper=mid;
  }
  return lower;
}

// Nur für die unveränderliche, sortierte Archivserie eines Scanner-Aufrufs.
// Rücksprünge bilden einen neuen Präfix; frühere Snapshot-Arrays bleiben erhalten.
function createClosedCandlePrefix(candles,duration) {
  let count=-1,prefix;
  return evaluatedAt=>{
    const end=closedCandleEnd(candles,duration,evaluatedAt);
    if(end!==count){count=end;prefix=candles.slice(0,end);}
    return prefix;
  };
}

Object.assign(exports,{closedCandleEnd,createClosedCandlePrefix});
},
"m1FvgEntrySelection.js":function(require,exports){
const {confirmedM1Fvg,m1FvgBounds}=require("m1FairValueGap.js");
const {closedChecklistCandles}=require("tradeSetupChecklistTimeBasis.js");
const {detectOrderBlocks}=require("orderBlockDetection.js");
exports.M1_FVG_MIN_RETEST_FRACTION=require("m1FvgEntrySequence.js").M1_FVG_MIN_RETEST_FRACTION;
const {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult}=require("m1FvgEntrySequence.js");

function m1FvgEntryCandidates(candles,evaluatedAt,direction) {
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt),result=[];
  const directions=direction?[direction]:['long','short'];
  for(let end=3;end<=rows.length;end++)for(const side of directions){
    const fvg=confirmedM1Fvg(rows,side,end);
    const formation=rows.slice(end-4,end);
    const contiguous=formation.length===4 && formation.every((c,i)=>!c.ignored && (!i||c.time===formation[i-1].time+60));
    const orderBlock=fvg && contiguous ? detectOrderBlocks(formation,'1m',true)
      .find(z=>z.startTime===fvg.candleTime && z.dir===(side==='long'?1:-1)) ?? null : null;
    if(fvg)result.push({...fvg,...m1FvgBounds(side,fvg.gap,rows[end-1]),
      confirmationCandleTime:rows[end-1].time,confirmationPrice:rows[end-1].close,
      orderBlock:orderBlock?{...orderBlock,recognizedAt:fvg.recognizedAt,timeframe:'1M'}:null});
  }
  return result;
}

function matchM1FvgEntryCandidate(candidates,candles,time,price) {
  const candle=candles.find(c=>c.time===time);
  if(!candle || !Number.isFinite(price) || price<candle.low || price>candle.high)return null;
  return candidates.find(fvg=>fvg.candleTime===time) ?? null;
}

function m1FvgCardPrefill(result,armed,trade,symbol) {
  const target=result?.target;
  if(result?.status!=='ready'||!armed||!trade||!target
    ||typeof target.cardKey!=='string'||target.cardKey!==armed.cardKey||target.cardKey!==trade.cardKey
    ||target.draftToken!==armed.draftToken||target.id!==trade.id
    ||target.dealingRangeId!==trade.dealingRangeId||target.instrument!==trade.instrument
    ||target.direction!==trade.direction||symbol!==trade.instrument
    ||![result.entryTime,result.entryPrice].every(Number.isFinite)||result.entryPrice<=0)return null;
  return {entryTime:result.entryTime,entryPrice:result.entryPrice};
}

// Nur ein Formularvorschlag: keine Strategie-Gates, Stop-/Exit-Werte oder Journal-Schreibzugriffe.
function m1FvgEntryPrefill({candles,fvg,evaluatedAt,variant='immediate'}) {
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
  const selected=m1FvgEntryCandidates(rows,evaluatedAt,fvg?.direction)
    .find(item=>item.candleTime===fvg?.candleTime && item.recognizedAt===fvg?.recognizedAt);
  if(!selected)return {status:'unknown',reason:'FVG ist am gewählten Stand nicht bestätigt.'};
  const sequence=m1FvgEntrySequence(selected,variant);
  for(const candle of rows){advanceM1FvgEntrySequence(sequence,candle);if(sequence.result)break;}
  return m1FvgSequenceResult(sequence);
}

Object.assign(exports,{m1FvgEntryCandidates,matchM1FvgEntryCandidate,m1FvgCardPrefill,m1FvgEntryPrefill});
},
"m1FairValueGap.js":function(require,exports){
function m1FvgBounds(direction,gap,confirmation) {
  const bottom=direction==='short'?confirmation.high:confirmation.low-gap;
  return {bottom,top:bottom+gap};
}

function confirmedM1Fvg(rows,direction,end=rows.length) {
  if(!['short','long'].includes(direction))return null;
  const window=rows.slice(Math.max(0,end-3),end);
  if(window.length!==3 || window.some((c,i)=>c.ignored || ![c.time,c.high,c.low,c.close].every(Number.isFinite)
    || (i && c.time!==window[i-1].time+60)))return null;
  const [first,impulse,last]=window;
  const gap=direction==='short'?first.low-last.high:last.low-first.high;
  return gap>1e-9 ? {direction,candleTime:impulse.time,recognizedAt:last.time+60,gap} : null;
}

Object.assign(exports,{m1FvgBounds,confirmedM1Fvg});
},
"orderBlockDetection.js":function(require,exports){
// Reine Order-Block-Erkennung, extrahiert aus orderBlocks.js (Chat 2026-08-02) — bewusst OHNE
// jeden Browser-Import, damit dieses Modul auch außerhalb des Browsers (Deno, MCP-Server) direkt
// importierbar ist, ohne chartColors.js/chartZoom.js/chartTimeUtils.js (localStorage/
// import.meta.env) mitzuschleppen. Gleicher Schnitt wie bei liquidity.js → liquidityDetection.js
// (siehe dort/CLAUDE.md "MCP-Server") — orderBlocks.js selbst importiert detectOrderBlocks jetzt
// von hier und re-exportiert es, damit sich an dessen öffentlicher API nichts ändert.
//
// ACHTUNG DRITTE KOPIE (Bug-Report Philip 2026-09-05, beim Fix hier zunächst übersehen): Supabase
// Edge Functions bündeln nur Dateien innerhalb von supabase/functions/, ein Import von hier aus
// dem MCP-Server war deshalb nie möglich — es existiert eine physische Kopie in
// supabase/functions/trading-monitor-mcp/orderBlockDetection.js (von dataExport.ts/
// findTargetCandidates.js/backfillObZones.ts genutzt) UND die typisierte Variante
// supabase/functions/_shared/orderBlocks.ts (von poi-watcher/tradeSetup.ts genutzt). Bei
// Änderungen an der Erkennungslogik selbst IMMER ALLE DREI nachziehen.
const { PIP_SIZE }=require("pipConfig.js");

function candleTouchesOrderBlock(candle, zone) {
  return candle.low <= zone.top && candle.high >= zone.bottom;
}

function candleInvalidatesOrderBlock(candle, zone) {
  return zone.dir === 1 ? candle.low < zone.bottom : candle.high > zone.top;
}

const IRRELEVANT_PCT = 0.05; // Gap kleiner als das wird gar nicht erst als Zone angelegt (HTF: 15m/1h/4h/1D)

// Lower-TF (M1/M3/M5, siehe tv-indikator/src/calculations.pine: capMode=true) hat im Pine-Original
// gar KEINE Mindestgröße (jede positive Lücke bildet eine Zone) — Bug-Report Philip 2026-07-26:
// eine 0,01%-FVG auf M5 wurde von IRRELEVANT_PCT (für HTF gedacht, 0,05%) verschluckt, obwohl sie
// auf M5 durchaus tradebar ist. Statt komplett ohne Minimum (wie im Pine-Original) verlangt Philip
// explizit "mindestens 1 Pip" — ein Pip-Minimum statt Prozent, weil % vom Preis bei GBPUSD/EURUSDs
// enger Range (~1.3) für M5-Lücken viel zu grob ist (0,05% sind hier ~6-7 Pip).
// M5 auf 0,5 Pip abgesenkt (Bug-Report Philip 2026-07-28: eine 0,7-Pip-FVG um 12:30 EURUSD wurde
// vom 1-Pip-Minimum verschluckt) — M1/M3 bleiben bei 1 Pip, da nicht Anlass des Reports.
const LOWER_TF_LABELS = new Set(["1m", "3m", "5m"]);
const LOWER_TF_MIN_GAP_PIPS = { "1m": 1, "3m": 1, "5m": 0.5 };

// HTF (1H/4H) Pip-Minimum NUR für Forex (Bug-Report Philip 2026-07-30: eine 4,5-Pip-1H-FVG bei
// EURUSD wurde von der 0,05%-Prozent-Schwelle verschluckt, ~5,7 Pip bei diesem Kurs nötig) — nicht
// einfach an die Timeframe gehängt wie bei LOWER_TF_LABELS, sondern über ein explizites isForex-Flag
// (historisch: musste früher auch für BTCs ganz anderes Kursniveau unterscheidbar bleiben, siehe
// Git-Historie — heute läuft ausschließlich Forex durch diese Funktion, das Flag bleibt trotzdem
// explizit statt aus der Timeframe abgeleitet, da eine zukünftige Nicht-Forex-Instrument-Zone sonst
// stillschweigend ein für sie bedeutungsloses Pip-Minimum bekäme).
const HTF_FOREX_LABELS = new Set(["1H", "4H"]);
// 1H von 4 auf 1.5 gesenkt (Bug-Report Philip 2026-08-11: eine 1,5-Pip-1H-FVG bei GBPUSD am 10.08.
// 07:00 wurde vom alten 4-Pip-Minimum verschluckt). 4H von 8 auf 4 gesenkt: 8 Pip lag sogar ueber
// der abgeloesten Prozentschwelle (0,05% sind bei EURUSD ~5,7 Pip) und verschluckte tradebare
// 4H-Zonen, zuletzt eine 6,1-Pip-FVG bei EURUSD.
const HTF_FOREX_MIN_GAP_PIPS = { "1H": 1.5, "4H": 4 };

// Bug-Report Philip 2026-08-11, direkt im Anschluss an die 1,5-Pip-Absenkung oben: genau die Zone,
// die die Absenkung freischalten sollte, blieb trotzdem verschluckt — ihre Gap ist real EXAKT 1,5
// Pip (1.34919 - 1.34904), aber IEEE-754-Rundung liefert 0.00014999999999987246 statt 0.00015, also
// hauchdünn UNTER der ebenfalls float-berechneten Schwelle (1.5 * 0.0001 = 0.00015000000000000001).
// Epsilon statt exaktem >=, damit ein Gap, das auf Pip-Genauigkeit exakt der Schwelle entspricht,
// nicht von Rundungsrauschen ins "nicht relevant" kippt.
const GAP_EPSILON = 1e-9;

// FVG-Fenster über 4 Kerzen (c0..c2 + cur): bullisch, wenn cur.low über c1.high liegt (Gap),
// bärisch symmetrisch. Zone = C1-Kante bis zur gegenüberliegenden Kante von C2 (inkl. Wick) — siehe
// Pine-Kommentar "HTF-Modus" für die Herleitung. Gilt unverändert für HTF (15m/1h/4h/1D). Lower-TF
// (M1/M3/M5) erweitert seit Bug-Report Philip 2026-07-29 die NICHT-FVG-anknüpfende Kante zusätzlich
// auf den Extremwert über C1+C2+die Kerze davor — "zu eng, direkt auf der erstbesten Kerzen-Range".
//
// timeframe: TIMEFRAMES-Label (siehe timeframes.js, z.B. "5m"/"1H"/"4H") — entscheidet zusammen mit
// isForex, ob eine Pip- oder die Prozent-Mindestgröße gilt. undefined/unbekanntes Label fällt auf
// HTF-Prozent-Verhalten zurück (Altverhalten, falls je ohne Timeframe aufgerufen).
// isForex default true, weil bislang jeder Aufrufer entweder garantiert Forex ist (detectSetupObs,
// die Frontend-Forex-Zweige) oder das Flag explizit selbst setzt (poi-watcher, s.o.).
function detectOrderBlocks(candles, timeframe, isForex = true, minGapOverride = null) {
  const state=orderBlockState(timeframe,isForex,minGapOverride);
  advanceOrderBlocks(candles,state,3);
  return orderBlockSnapshot(candles,state);
}

function orderBlockState(timeframe,isForex,minGapOverride) {
  const isLowerTf = LOWER_TF_LABELS.has(timeframe);
  const isHtfForexPip = isForex && HTF_FOREX_LABELS.has(timeframe);
  // Gold-H1-Test: absoluter Preisabstand statt einer impliziten Forex-Pip-Umrechnung.
  const minGapAbs = minGapOverride ?? (isLowerTf
    ? LOWER_TF_MIN_GAP_PIPS[timeframe] * PIP_SIZE
    : isHtfForexPip
      ? HTF_FOREX_MIN_GAP_PIPS[timeframe] * PIP_SIZE
      : null);

  return {zones:[],isLowerTf,minGapAbs};
}

function advanceOrderBlocks(candles,state,from) {
  const {zones,isLowerTf,minGapAbs}=state;
  for (let i = Math.max(3,from); i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const cur = candles[i];
    // Anders als die Fraktal-Erkennung darf eine `ignored`-Kerze (Spread Hour, siehe
    // markIgnoredCandles in sessionOccurrences.js) hier NICHT einfach weggelassen werden: dann
    // rückten ihre Nachbarn zusammen und die Bewegung über die Lücke hinweg käme als FVG heraus,
    // die es nie gab. Also fällt das ganze Fenster aus, in dem so eine Kerze vorkommt.
    if (candles[i - 3].ignored || c1.ignored || c2.ignored || cur.ignored) continue;
    const refPrice = c1.close;

    const bullGap = cur.low - c1.high;
    const bearGap = c1.low - cur.high;
    const bullGapPct = (bullGap / refPrice) * 100;
    const bearGapPct = (bearGap / refPrice) * 100;
    // Ohne Mindestgröße bleibt eine echte positive Lücke Pflicht; Epsilon darf keine Null-FVG erzeugen.
    const bullRelevant = minGapAbs === 0 ? bullGap > 0
      : minGapAbs != null ? bullGap >= minGapAbs - GAP_EPSILON : bullGapPct >= IRRELEVANT_PCT;
    const bearRelevant = minGapAbs === 0 ? bearGap > 0
      : minGapAbs != null ? bearGap >= minGapAbs - GAP_EPSILON : bearGapPct >= IRRELEVANT_PCT;

    if (bullRelevant) {
      for (const z of zones) if (z.dir === 1 && z.active) z.active = false;
      // Lower-TF (Bug-Report Philip 2026-07-29: "M5 OB Code noch nicht perfekt ... die Kante, die
      // NICHT an die FVG anknüpft, ist zu eng, direkt auf der erstbesten Kerzen-Range") — bezieht
      // die Impuls-Kerze (c2) UND die 2 Kerzen davor mit ein (candles[i-3]/c1/c2), nimmt den
      // Extremwert. Die FVG-anknüpfende Kante (top hier) bleibt unverändert. HTF (15m/1h/4h/1D)
      // bleibt bei der alten, engen Box — Philip: "die sind eher, das bleibt so wie es ist".
      const bottom = isLowerTf ? Math.min(candles[i - 3].low, c1.low, c2.low) : c2.low;
      zones.push({
        top: c1.high,
        bottom,
        dir: 1,
        fvg: bullGap,
        active: true,
        touched: false,
        invalidated: false,
        retested: false,
        retestedAt: null,
        startTime: c2.time,
        endTime: cur.time,
      });
    } else if (bearRelevant) {
      for (const z of zones) if (z.dir === -1 && z.active) z.active = false;
      const top = isLowerTf ? Math.max(candles[i - 3].high, c1.high, c2.high) : c2.high;
      zones.push({
        top,
        bottom: c1.low,
        dir: -1,
        fvg: bearGap,
        active: true,
        touched: false,
        invalidated: false,
        retested: false,
        retestedAt: null,
        startTime: c2.time,
        endTime: cur.time,
      });
    }

    // Gültigkeits-/Touched-Regeln laufen für alle bestehenden Zonen gegen die aktuelle Kerze.
    for (const z of zones) {
      if (z.invalidated) continue;
      // Den ersten Kontakt separat erhalten: eine spätere Invalidierung darf das Zeichenende nicht ersetzen.
      if (z.touchedTime == null && candleTouchesOrderBlock(cur, z)) z.touchedTime = cur.time;
      const wasTouched = z.touched; // vor der Pruefung dieser Kerze festhalten

      // Einfache Preisüberschreitung invalidiert (Wick genügt, kein Kerzenschluss nötig) — anders
      // als bei einem LQ-Sweep, wo ein Wick über/unter das Level plus schnelle Rückkehr GERADE FÜR
      // den Sweep spricht (Philip 05.09.2026: eine OB verliert bei jeder Überschreitung sämtliche
      // Relevanz, unabhängig davon ob die Kerze wieder zurückschließt).
      if (candleInvalidatesOrderBlock(cur, z)) {
        z.invalidated = true;
        z.endTime = cur.time;
        continue;
      }

      if (!z.touched && candleTouchesOrderBlock(cur, z)) z.touched = true;
      // Auf genau der Kerze, die den Touch ausloest, soll endTime noch mitwachsen (sonst
      // friert die Box eine Kerze zu frueh ein) — danach (wasTouched war schon true) nicht mehr.
      if (!wasTouched) z.endTime = cur.time;
    }
  }

}

function orderBlockSnapshot(candles,state) {
  const {isLowerTf}=state,zones=state.zones.map(z=>({...z}));
  // "Retest bestätigt" (siehe orderblöcke.md#retest-status, Philip 05.09.2026) — nur für touched &&
  // !invalidated relevant. Lower-TF (M1/M3/M5): eine gleichgerichtete FVG entsteht NACH dem Touch
  // (z.endTime, das bei touched-Zonen auf den Touch-Zeitpunkt eingefroren ist) — die Reaktion hat
  // sich in einem eigenen Impuls entladen. HTF (1H/4H): eine spätere Kerze DERSELBEN Timeframe
  // schließt komplett außerhalb der Zone — kein FVG-Nachweis nötig/üblich auf HTF, ein sauberer
  // Kerzenschluss reicht als Beleg für eine abgeschlossene, entschiedene Reaktion.
  for (const z of zones) {
    if (!z.touched || z.invalidated) continue;
    if (isLowerTf) {
      // zones ist chronologisch (Push-Reihenfolge) — find() liefert damit automatisch die
      // ZEITLICH ERSTE bestätigende FVG, nicht irgendeine spätere.
      const confirming = zones.find((other) => other.dir === z.dir && other.startTime > z.endTime);
      z.retested = confirming != null;
      z.retestedAt = confirming?.startTime ?? null;
    } else {
      const confirming = candles.find((c) => c.time > z.endTime && (c.close < z.bottom || c.close > z.top));
      z.retested = confirming != null;
      z.retestedAt = confirming?.time ?? null;
    }
  }

  return zones;
}


Object.assign(exports,{candleTouchesOrderBlock,candleInvalidatesOrderBlock,detectOrderBlocks,orderBlockState,advanceOrderBlocks,orderBlockSnapshot});
},
"pipConfig.js":function(require,exports){
// Zentrale Pip-Größe für GBPUSD/EURUSD (Chat 2026-07-30) — vorher 3x unabhängig dupliziert:
// orderBlocks.js (PIP_SIZE), dataExport.js (PIP_SIZE), PriceChart.vue (TRADE_SETUP_PIP_SIZE).
// Alle drei importieren jetzt von hier, damit ein künftiger dritter FX-Pair mit anderer Pip-Größe
// nicht an drei Stellen einzeln nachgezogen werden muss. Siehe PIP-SETTINGS.md für die Übersicht
// aller Pip-/Pixel-Schwellwerte im Repo.
const PIP_SIZE = 0.0001; // gilt für beide unterstützten FX-Paare (GBPUSD/EURUSD)

const { instrumentConfig }=require("instrumentConfig.js");
function toPips(priceDiff, instrument) {
  return priceDiff / instrumentConfig(instrument).pip;
}

function fromPips(pips, instrument) {
  return pips * instrumentConfig(instrument).pip;
}

Object.assign(exports,{PIP_SIZE,toPips,fromPips});
},
"instrumentConfig.js":function(require,exports){
// Tick/Anzeige und Strategieabstände sind getrennt: Gold-Schwellen stammen aus dem September-Test.
function instrumentConfig(symbol) {
  return symbol === 'XAUUSD'
    ? { precision: 2, tick: 0.01, pip: 0.01, strategyScale: 15000,
        minFvg: { '5m': 0, '1H': 2.53, '4H': 6.19 }, dobMaxPositiveZoneGap: 2 }
    : { precision: 5, tick: 0.00001, pip: 0.0001, strategyScale: 1, minFvg: {}, dobMaxPositiveZoneGap: null };
}

function strategyDistance(forexPriceDistance, symbol) {
  return forexPriceDistance * instrumentConfig(symbol).strategyScale;
}

function obMinimum(symbol, timeframe) {
  return instrumentConfig(symbol).minFvg[timeframe] ?? null;
}

Object.assign(exports,{instrumentConfig,strategyDistance,obMinimum});
},
"m1FvgEntrySequence.js":function(require,exports){
const {candleTouchesOrderBlock,candleInvalidatesOrderBlock}=require("orderBlockDetection.js");
const {isGoldInstrument}=require("goldChartPolicy.js");
const {goldM1ClosureCovered}=require("goldWeekendGap.js");
const M1_FVG_MIN_RETEST_FRACTION=.5;

function qualifiedFvgRetest(candle,fvg) {
  if(!candleTouchesOrderBlock(candle,fvg))return false;
  const height=fvg.top-fvg.bottom;
  const level=fvg.direction==='short'?fvg.bottom+height*M1_FVG_MIN_RETEST_FRACTION
    :fvg.top-height*M1_FVG_MIN_RETEST_FRACTION;
  const tolerance=Number.EPSILON*Math.max(Math.abs(fvg.top),Math.abs(fvg.bottom),1)*8;
  const half=fvg.direction==='short'?candle.high+tolerance>=level:candle.low-tolerance<=level;
  const full=fvg.direction==='short'?candle.high+tolerance>=fvg.top:candle.low-tolerance<=fvg.bottom;
  // Voll gefüllte FVGs brauchen den zugehörigen OB derselben Entstehung, keinen beliebigen Nachbarn.
  if(half && full && !fvg.orderBlock)return null;
  return half && (!full || candleTouchesOrderBlock(candle,fvg.orderBlock));
}

// Ohne instrument bleibt jede Lücke unknown; nur XAU kennt seine Marktschlüsse (goldWeekendGap.js).
function m1FvgEntrySequence(fvg,variant,instrument) {
  const state={fvg,variant,instrument,next:fvg.recognizedAt,retest:null,result:null};
  if(variant==='immediate')state.result=readyFvgEntry(state,{time:fvg.confirmationCandleTime,close:fvg.confirmationPrice});
  else if(variant!=='retestReaction')state.result={status:'unknown',reason:'Unbekannte Entry-Variante.'};
  return state;
}
function readyFvgEntry(state,candle) {
  return {status:'ready',entryTime:candle.time+60,entryPrice:candle.close,
    confirmationCandleTime:candle.time,fvg:state.fvg,variant:state.variant,
    ...(state.retest?{retestCandleTime:state.retest.time}:{})};
}
function advanceM1FvgEntrySequence(state,candle) {
  if(state.result || candle.time<state.fvg.recognizedAt)return;
  if(candle.time!==state.next&&!(isGoldInstrument(state.instrument)&&goldM1ClosureCovered(state.next,candle.time))){state.result={status:'unknown',reason:'M1-Historie zwischen FVG und Reaktion ist lückenhaft.'};return;}
  state.next=candle.time+60;
  if(candle.ignored)return;
  // Ein gebrochener Ursprungs-OB kann keine spätere Reaktionskerze mehr bestätigen.
  if(state.fvg.orderBlock && candleInvalidatesOrderBlock(candle,state.fvg.orderBlock)){
    state.result={status:'invalid',reason:'Der zugehörige M1-OB wurde vor dem Entry durch einen Docht gebrochen.'};return;
  }
  if(!state.retest){
    const qualified=qualifiedFvgRetest(candle,state.fvg);
    if(qualified===null)state.result={status:'unknown',reason:'Vollständige FVG-Füllung: Der zugehörige M1-OB ist aus dem Vierkerzen-Vorlauf nicht belegt.'};
    else if(qualified)state.retest=candle;
    return;
  }
  if(state.fvg.direction==='short'?candle.close<candle.open:candle.close>candle.open)state.result=readyFvgEntry(state,candle);
}
function m1FvgSequenceResult(state) {
  return state.result ?? {status:'pending',reason:state.retest?'Zusätzliche Richtungskerze nach dem Retest ist noch nicht geschlossen.'
    :'Die bestätigte FVG wurde am gewählten Stand noch nicht mindestens 50 % retestet (bei vollständiger Füllung ist derselbe Kerzenkontakt mit dem zugehörigen M1-OB erforderlich).'};
}

Object.assign(exports,{M1_FVG_MIN_RETEST_FRACTION,m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult});
},
"goldChartPolicy.js":function(require,exports){
// Gold nutzt denselben nativen FXCM-Archivfeed; fehlende Historie ist kein Broker-Live-Fallback.
const { barSecondsFor }=require("timeframes.js");

const isGoldInstrument = symbol => symbol === 'XAUUSD';
const GOLD_CHART_BARS = ['1m', '3m', '5m', '1h', '4h', '1D'];
function goldChartSelection(bar, replayTime, now = Date.now()) {
  const selectedBar = GOLD_CHART_BARS.includes(bar) ? bar : '5m';
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
  // Grobe native FXCM-Bars behalten ihre Tagesgrenzen; nur M1/M3 brauchen feinere Replay-Schritte.
  const seconds = Math.min(300, barSecondsFor(selectedBar));
  const end = Math.floor(now / (seconds * 1000)) * seconds - seconds;
  return { bar: selectedBar, replayTime: replayTime >= start && replayTime <= end ? replayTime : end };
}

Object.assign(exports,{isGoldInstrument,GOLD_CHART_BARS,goldChartSelection});
},
"goldWeekendGap.js":function(require,exports){
const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
const REOPEN=18*60;
// FXCM liefert die 18:00-Minute nach einer Pause nie (Archiv 01.01.–14.11.2026: 0× 18:00, 221× 18:01).
const M1_REOPEN=REOPEN+1;

function clock(at) {
  const parts=Object.fromEntries(newYorkClock.formatToParts(at*1000).map(p=>[p.type,p.value]));
  return {day:parts.weekday,minutes:Number(parts.hour)*60+Number(parts.minute)};
}

// FXCM XAU-Wochenschluss 16:45 New York bis Sonntag18:00; beide US-DST-Grenzen folgen der Zone.
function closedAt(at,reopen) {
  const {day,minutes}=clock(at);
  return day==='Sat' || day==='Fri' && minutes>=16*60+45 || day==='Sun' && minutes<reopen;
}

function goldWeekendGapCovered(from, to, reopen=REOPEN) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return false;
  if (from === to) return true;
  // Unter drei Tagen können beide geschlossenen Grenzen nur zum selben Wochenende gehören.
  return to-from <= 3*86400 && closedAt(from,reopen) && closedAt(to-0.001,reopen);
}

// Fehlende M1-Minuten [from,to) liegen komplett im Wochenende oder in der Tagespause Mo–Do ab 17:00 New York.
function goldM1ClosureCovered(from, to) {
  if (goldWeekendGapCovered(from,to,M1_REOPEN)) return true;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to-from > (M1_REOPEN-17*60)*60) return false;
  const start=clock(from),end=clock(to-0.001);
  return ['Mon','Tue','Wed','Thu'].includes(start.day) && start.day===end.day && start.minutes>=17*60 && end.minutes<M1_REOPEN;
}

Object.assign(exports,{goldWeekendGapCovered,goldM1ClosureCovered});
},
"fvgCandleTint.js":function(require,exports){
// Färbt die Impuls-Kerzen der bestätigenden FVGs ein (Test Philip 2026-09-23). Die FVG ist das
// einzige Stück eines Trade-Setups, das im Chart bisher gar nicht markiert war — LS-Linie,
// Fraktal-Linie und OB-Box gibt es, die Lücke selbst nicht, obwohl der Telegram-Alarm ihre Größe
// seit 2026-09-23 nennt.
//
// Bewusst eine reine Funktion ohne Chart- und ohne chartColors-Bezug (die Farbe kommt als
// Parameter): lightweight-charts nimmt Farben pro Datenpunkt entgegen, die Einfärbung ist damit
// nichts weiter als eine Umformung der Kerzenliste — und ohne Browser testbar.

// setup.obStartTime ist der Zeitpunkt der MITTLEREN Impuls-Kerze (siehe detectSetupObs/
// orderBlocks.js), also genau der Kerze, die die Lücke aufreißt.
function fvgCandleTimes(setups) {
  return new Set((setups ?? []).filter((s) => s?.obStartTime != null).map((s) => s.obStartTime));
}

// Nur auf dem M5-Chart: ein Setup ist immer M5-basiert, auf 1h/4h träfe obStartTime entweder gar
// keine Kerze oder — wenn der Stundenanfang zufällig auf denselben Unix-Wert fällt — die falsche.
function tintFvgCandles(candles, setups, bar, farbe) {
  if (bar !== "5m" || !farbe) return candles;
  return tintCandleTimes(candles, fvgCandleTimes(setups), farbe);
}

function tintM1FvgCandle(candles, fvg, bar, farbe) {
  if (bar !== '1m' || !fvg || !farbe) return candles;
  return tintCandleTimes(candles, new Set([fvg.candleTime]), farbe);
}

function tintM1FvgCandidates(candles, candidates, bar, farbe) {
  if(bar!=='1m' || !farbe)return candles;
  return tintCandleTimes(candles,new Set(candidates.map(fvg=>fvg.candleTime)),farbe);
}

function tintCandleTimes(candles, zeiten, farbe) {
  if (zeiten.size === 0) return candles;
  return candles.map((c) => (zeiten.has(c.time) ? { ...c, color: farbe, wickColor: farbe } : c));
}

// Ein goldener Impuls kann gleichzeitig eine andere FVG bestätigen: dann bleibt Gold im Körper.
function tintManualFvgConfirmation(candles,preview,bar,color) {
  return tintManualFvgConfirmations(candles,preview?.status==='ready'?[preview.confirmationCandleTime]:[],bar,color);
}
function tintManualFvgConfirmations(candles,times,bar,color) {
  if(bar!=='1m'||!times?.length||!color)return candles;
  const selected=new Set(times);
  return candles.map(c=>selected.has(c.time)
    ?{...c,...(c.color?{}:{color,wickColor:color}),borderColor:color}:c);
}

Object.assign(exports,{fvgCandleTimes,tintFvgCandles,tintM1FvgCandle,tintM1FvgCandidates,tintManualFvgConfirmation,tintManualFvgConfirmations});
}},cache={};function require(id){if(!cache[id]){cache[id]={};modules[id](require,cache[id]);}return cache[id];}root.OBReactionEntrySource={...require("m1FvgEntryProjection.js"),...require("fvgCandleTint.js")};})(globalThis);
