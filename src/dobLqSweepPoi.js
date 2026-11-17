import {instrumentConfig} from './instrumentConfig.js';

// POI-Art LQ-Sweep (Philip): der POI ist ein TS1.1-Setup aus trade_setups, keine eigene Sweep-Erkennung. Verbindung zum DOB: OB1
// oder OB2 hat mit dem TS1.1-OB mindestens eine gleiche Kante (≤ 1 Tick); als TS1.1-OB zählen die gespeicherte Box und das rohe
// M5-OB dahinter (ob_zone_id), weil TS1.1 die Box bis zum Sweep-Extrem aufweitet. „Nur Überlappung“ und „knapp daneben“ sind
// Merkmale für die Statistik, keine Regel; welche Stufe zählt, entscheidet poiMatchMode der Konfig. Deno-tauglich (Watcher).
export const DOB_LQ_MATCH_LEVELS=['edge','overlap','adjacent'];
// ponytail: feste Grenze für „knapp daneben“ (Mustertrades #138/#142: 0,84 und 0,18 USD); als ATR-Anteil, falls die Statistik trägt.
export const DOB_LQ_ADJACENT_MAX_USD=1;
// Ein TS1.1-OB kann nur zu einem DOB gehören, dessen OB1 höchstens so lange danach startet.
const MAX_AGE_SECONDS=24*3600;
const time=v=>v==null?null:typeof v==='number'?v:Date.parse(v)/1000;

// Zeile aus trade_setups (mit eingebettetem ob_zones(top,bottom)) → Eingabe der Erkennung.
export function dobTs11FromRow(row){
 const raw=row.ob_zones??row.ob_zone??null;
 return {id:row.id,direction:row.direction,top:Number(row.ob_top),bottom:Number(row.ob_bottom),
  rawTop:raw?.top==null?null:Number(raw.top),rawBottom:raw?.bottom==null?null:Number(raw.bottom),
  startTime:time(row.ob_start_time),lsPrice:row.ls_price==null?null:Number(row.ls_price),lsTouchedTime:time(row.ls_touched_time),
  lsTimeframe:row.ls_timeframe??null,detectorVersion:row.detector_version??null};
}

// Rang einer Verbindung (kleiner = stärker): Stufe, dann beide Kanten gleich vor einer (Philip verknüpft #135 mit dem TS1.1, das OB2
// exakt trifft), dann Abstand. Gemeinsam für die Wahl je Paar und über alle tragenden Paare eines Trades (Fill).
export const dobLqMatchRank=m=>DOB_LQ_MATCH_LEVELS.indexOf(m.match)*1e6+(m.matchedEdge==='both'?0:1e5)+m.gapUsd;
// Beste Verbindung eines TS1.1-OBs zu OB1/OB2 nach dobLqMatchRank; bei Gleichstand OB1.
export function dobLqSweepMatch(pair,ts,tick){
 const tsEdges=[ts.top,ts.bottom,ts.rawTop,ts.rawBottom].filter(Number.isFinite);
 const tsLow=Math.min(ts.bottom,ts.rawBottom??Infinity),tsHigh=Math.max(ts.top,ts.rawTop??-Infinity);
 let best=null;
 for(const [name,ob] of [['ob1',pair.firstOrderBlock],['ob2',pair.secondOrderBlock]]){
  const same=edge=>tsEdges.some(v=>Math.abs(v-edge)<=tick+1e-9);
  const top=same(ob.top),bottom=same(ob.bottom),gapUsd=Math.max(0,tsLow-ob.top,ob.bottom-tsHigh);
  const match=top||bottom?'edge':gapUsd===0?'overlap':gapUsd<=DOB_LQ_ADJACENT_MAX_USD?'adjacent':null;
  const candidate={match,matchedOb:name,matchedEdge:top&&bottom?'both':top?'top':bottom?'bottom':null,gapUsd:Math.round(gapUsd*100)/100};
  if(match&&(!best||dobLqMatchRank(candidate)<dobLqMatchRank(best)))best=candidate;
 }
 return best;
}

// Erkennung für checkDobTradeSetup: input.tradeSetups (dobTs11FromRow); schwächste noch zählende Stufe aus poiOptions.match (Lauf),
// sonst aus der Konfig (poiMatchMode, Watcher).
// Kausal: Sweep und TS1.1-OB liegen vor der Erkennung des DOB-Paars.
export function lqSweepPoi(input){
 const tick=instrumentConfig(input.instrument).tick,allowed=DOB_LQ_MATCH_LEVELS.indexOf(input.poiOptions?.match??input.guardrails?.poiMatchMode??'edge');
 const list=input.tradeSetups??[];
 return pair=>{
  let poi=null;
  for(const ts of list){
   if(ts.direction!==pair.direction||ts.startTime>pair.recognizedAt||(ts.lsTouchedTime??ts.startTime)>pair.recognizedAt
    ||ts.startTime<pair.firstOrderBlock.startTime-MAX_AGE_SECONDS)continue;
   const m=dobLqSweepMatch(pair,ts,tick);
   if(!m)continue;
   if(!poi||dobLqMatchRank(m)<dobLqMatchRank(poi))poi={kind:'ts11',tradeSetupId:ts.id,zone:{top:ts.top,bottom:ts.bottom},
    zoneStartTime:ts.startTime,lsPrice:ts.lsPrice,lsTouchedTime:ts.lsTouchedTime,lsTimeframe:ts.lsTimeframe,detectorVersion:ts.detectorVersion,...m};
  }
  return {poi,reason:poi&&DOB_LQ_MATCH_LEVELS.indexOf(poi.match)<=allowed?null:list.length?'noPoi':'missingTradeSetups'};
 };
}
