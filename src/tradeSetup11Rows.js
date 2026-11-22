import {tradeSetupFromRow} from './tradeSetupRow.js';
import {filterTradeSetup11Candidates} from './tradeSetup11.js';
import {detectSetupObs,hasUninterruptedSweepReaction,TRADE_SETUP_OB_SWEEP_PROFILE} from './tradeSetup.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {obMinimum} from './instrumentConfig.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';

export {TRADE_SETUP_11_VERSION} from './tradeSetup11.js';

// trade_setups-Zeilen → TS1.1-Urteil je Zeilen-ID, mit denselben Schritten wie der Chart (usePriceChartTradeSetups: Sweep-Reaktion
// ununterbrochen; usePriceChartTradeSetup11: Trend-Policy). Nur 'passed' ist TS1.1. Das Urteil hängt nur an Kerzen bis zur
// Setup-Erkennung, ist also für evaluatedAt ≥ Erkennung stabil (Watcher cacht es, Läufe rechnen alle Zeilen auf einmal).
// rows brauchen die Spalten von tradeSetupFromRow (inkl. trade_setup_sweeps, created_at); sessionConfigs = Sessions des Instruments.
export function tradeSetup11RowVerdicts({rows=[],instrument,m5Candles=[],h1Candles=[],d1Candles=[],evaluatedAt,settings={},sessionConfigs=[]}){
 const configs=sessionConfigs.map(s=>({...s,instrument}));
 const marked=markIgnoredCandles(closedChecklistCandles(m5Candles,'5m',evaluatedAt),configs,s=>berlinOffsetMinutes(s*1000));
 const obs=detectSetupObs(marked,obMinimum(instrument,'5m')),clean=marked.filter(c=>!c.ignored);
 const anchors=buildHistoricalDailyAnchors(d1Candles,h1Candles),verdicts=new Map(),byStart=new Map();
 for(const row of rows){
  const setup=tradeSetupFromRow(row);
  if(!hasUninterruptedSweepReaction(setup,obs,clean)){verdicts.set(row.id,{status:'unmet',reason:'sweepReactionInterrupted'});continue;}
  const from=m5Start(anchors,[row])??-Infinity;
  if(!byStart.has(from))byStart.set(from,[]);
  byStart.get(from).push(setup);
 }
 // Der Kontext-Resolver baut je Setup-Zeitpunkt einen Kontext über alle übergebenen M5: mit Jahres-M5 quadratisch (Läufe hingen
 // Stunden). Darum je Ankerstart nur die M5 ab dort; das Urteil bleibt gleich (Test tradeSetup11Rows).
 for(const [from,setups] of byStart){
  const result=filterTradeSetup11Candidates({setups,instrument,m5Candles:m5Candles.filter(c=>c.time>=from),h1Candles,d1Candles,evaluatedAt,
   settings,sessionConfigs:configs,sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE});
  for(const a of result.assessments)verdicts.set(a.setup.tradeSetupId,{status:a.status,reason:a.reason,
   ...(a.status==='passed'?{witness:oldestPassedSource(a.passedSources)}:{})});
 }
 return verdicts;
}

// LS des TS1.1 für den DOB: die bestandene Quelle mit dem ältesten Strukturpunkt (Philip 22.11.), nicht die Primär-LS der Zeile,
// die selbst durchgefallen sein kann (#46127: 4130,02 nach dem Range-Low). null, wenn das Setup ohne eigene Quelle bestand.
export function oldestPassedSource(sources=[]){
 const oldest=sources.filter(s=>Number.isFinite(s?.level?.pivotTime)).reduce((a,b)=>b.level.pivotTime<a.level.pivotTime?b:a,
  sources.find(s=>Number.isFinite(s?.level?.pivotTime)));
 if(!oldest)return null;
 const {price,pivotTime,touchedTime,sourceKind}=oldest.level;
 return {price,pivotTime,touchedTime,timeframe:oldest.timeframe,sourceKind:sourceKind??'liquidity'};
}

function m5Start(anchors,rows){
 const times=rows.map(r=>Date.parse(r.ls_pivot_time??r.ob_start_time)/1000).filter(Number.isFinite);
 if(!times.length)return null;
 const at=Math.min(...times),anchor=anchors.filter(a=>a.knownAt<=at).sort((a,b)=>b.pivotTime-a.pivotTime)[0];
 return anchor?anchor.structureStartTime-86400:null;
}

// Ab wann M5 nötig ist: Strukturstart des D1-Ankers, der beim frühesten Sweep der Zeilen galt, minus 1 Tag Puffer. Mehr M5 ändert
// das Urteil nicht, kostet aber Rechenzeit (15000 M5 sprengen das Edge-Limit). null = kein Anker, dann bleibt das Urteil unknown.
export function tradeSetup11M5Start({rows=[],h1Candles=[],d1Candles=[]}){
 return m5Start(buildHistoricalDailyAnchors(d1Candles,h1Candles),rows);
}
