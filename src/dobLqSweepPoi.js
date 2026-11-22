import {instrumentConfig} from './instrumentConfig.js';
import {lsReactionSourceTimes} from './lsReactionContext.js';

// POI-Art LQ-Sweep (Philip): der POI ist ein LS-Reaktion-Setup (trade_setups, gefiltert wie im Chart: lsReactionRowVerdicts). Zum DOB: OB1
// oder OB2 hat mit dem LS-Reaktion-OB mindestens eine gleiche Kante (≤ 1 Tick); als LS-Reaktion-OB zählen die gespeicherte Box und das rohe
// M5-OB dahinter (ob_zone_id), weil LS-Reaktion die Box bis zum Sweep-Extrem aufweitet. „Nur Überlappung“ und „knapp daneben“ sind
// Merkmale für die Statistik, keine Regel; welche Stufe zählt, entscheidet poiMatchMode der Konfig. Deno-tauglich (Watcher).
export const DOB_LQ_MATCH_LEVELS=['edge','overlap','adjacent'];
// ponytail: feste Grenze für „knapp daneben“: XAU 1 USD (Mustertrades #138/#142: 0,84 und 0,18 USD), Forex 3 Pips (bei Kursen um
// 1,1–1,3 relativ etwa dieselbe Spanne wie 1 USD bei ~4000); als ATR-Anteil, falls die Statistik trägt.
export const dobLqAdjacentMax=instrument=>instrument==='XAUUSD'?1:3*instrumentConfig(instrument).pip;
// Ein LS-Reaktion-OB kann nur zu einem DOB gehören, dessen OB1 höchstens so lange danach startet.
const MAX_AGE_SECONDS=24*3600;
const time=v=>v==null?null:typeof v==='number'?v:Date.parse(v)/1000;

// Zeile aus trade_setups (mit eingebettetem ob_zones(top,bottom)) → Eingabe der Erkennung. knownAt: ab dann kennt auch der Chart das
// LS-Reaktion (OB + FVG mit C3-Schluss, wie die Trend-Policy); nicht created_at, das ist bei nachgetragenen Zeilen zu spät.
// verdict (lsReactionRowVerdicts): sein witness ist die bestandene LS-Reaktion-Quelle und ersetzt die Primär-LS der Zeile; ohne witness
// (altes Urteil, Array.map-Index) bleibt die Zeile.
export function dobLsReactionFromRow(row,verdict){
 const raw=row.ob_zones??row.ob_zone??null,w=Number.isFinite(verdict?.witness?.price)?verdict.witness:null;
 return {id:row.id,direction:row.direction,top:Number(row.ob_top),bottom:Number(row.ob_bottom),
  rawTop:raw?.top==null?null:Number(raw.top),rawBottom:raw?.bottom==null?null:Number(raw.bottom),
  startTime:time(row.ob_start_time),knownAt:lsReactionSourceTimes({obStartTime:time(row.ob_start_time)}).nativeGeometryKnownAt??Infinity,
  ...(w?{lsPrice:w.price,lsPivotTime:w.pivotTime,lsTouchedTime:w.touchedTime,lsTimeframe:w.timeframe,lsSourceKind:w.sourceKind}
   :{lsPrice:row.ls_price==null?null:Number(row.ls_price),lsPivotTime:time(row.ls_pivot_time),lsTouchedTime:time(row.ls_touched_time),
    lsTimeframe:row.ls_timeframe??null,lsSourceKind:'liquidity'})};
}

// Rang einer Verbindung (kleiner = stärker): Stufe, dann beide Kanten gleich vor einer (Philip verknüpft #135 mit dem LS-Reaktion, das OB2
// exakt trifft), dann Abstand. Gemeinsam für die Wahl je Paar und über alle tragenden Paare eines Trades (Fill).
export const dobLqMatchRank=m=>DOB_LQ_MATCH_LEVELS.indexOf(m.match)*1e6+(m.matchedEdge==='both'?0:1e5)+m.gapUsd;
// Beste Verbindung eines LS-Reaktion-OBs zu OB1/OB2 nach dobLqMatchRank; bei Gleichstand OB1.
export function dobLqSweepMatch(pair,ts,tick,adjacentMax=1){
 const tsEdges=[ts.top,ts.bottom,ts.rawTop,ts.rawBottom].filter(Number.isFinite);
 const tsLow=Math.min(ts.bottom,ts.rawBottom??Infinity),tsHigh=Math.max(ts.top,ts.rawTop??-Infinity);
 let best=null;
 for(const [name,ob] of [['ob1',pair.firstOrderBlock],['ob2',pair.secondOrderBlock]]){
  const same=edge=>tsEdges.some(v=>Math.abs(v-edge)<=tick+1e-9);
  const top=same(ob.top),bottom=same(ob.bottom),gapUsd=Math.max(0,tsLow-ob.top,ob.bottom-tsHigh);
  const match=top||bottom?'edge':gapUsd===0?'overlap':gapUsd<=adjacentMax+1e-9?'adjacent':null;
  // Abstand auf ganze Ticks gerundet (XAU Cent wie bisher, Forex Pipette).
  const scale=Math.round(1/tick),candidate={match,matchedOb:name,matchedEdge:top&&bottom?'both':top?'top':bottom?'bottom':null,gapUsd:Math.round(gapUsd*scale)/scale};
  if(match&&(!best||dobLqMatchRank(candidate)<dobLqMatchRank(best)))best=candidate;
 }
 return best;
}

// Erkennung für checkDobTradeSetup: input.tradeSetups (dobLsReactionFromRow); schwächste noch zählende Stufe aus poiOptions.match (Lauf),
// sonst aus der Konfig (poiMatchMode, Watcher).
// Kausal: Sweep und LS-Reaktion sind bei Erkennung des DOB-Paars schon bekannt; ein früher erkanntes Paar bekommt den POI auch später nicht
// (live käme der Alarm zu spät, der Lauf darf ihn nicht als rechtzeitig zählen).
// Mit liquiditySweepSelector (Lauf v2, Watcher) bleibt die Geometrie Torwächter, der LS kommt aber kausal aus dem LQ-Algo (causalLs).
export function lqSweepPoi(input){
 const geometric=geometricLqSweepPoi(input);
 if(!input.liquiditySweepSelector)return geometric;
 const lsOf=causalLs(input.liquiditySweepSelector);
 return pair=>{const r=geometric(pair);return r.poi?{...r,poi:{...r.poi,...lsOf(pair)}}:r;};
}

// ponytail: Platzhalter, bis die POI↔DOB-Kopplung über den Marktstruktur-Baustein kommt (Pseudochart mit Philip): ob ein DOB einen POI hat,
// entscheidet vorerst die Kanten-Geometrie zu einer bestandenen LS-Reaktion bis 24 h vor OB1 (hält die Trade-Menge auf v1-Niveau).
function geometricLqSweepPoi(input){
 const tick=instrumentConfig(input.instrument).tick,adjacentMax=dobLqAdjacentMax(input.instrument),allowed=DOB_LQ_MATCH_LEVELS.indexOf(input.poiOptions?.match??input.guardrails?.poiMatchMode??'edge');
 const list=input.tradeSetups??[];
 return pair=>{
  let poi=null;
  for(const ts of list){
   if(ts.direction!==pair.direction||ts.knownAt>pair.recognizedAt||(ts.lsTouchedTime??ts.startTime)>pair.recognizedAt
    ||ts.startTime<pair.firstOrderBlock.startTime-MAX_AGE_SECONDS)continue;
   const m=dobLqSweepMatch(pair,ts,tick,adjacentMax);
   if(!m)continue;
   // kind 'ts11' (= dob_trade_setups.poi_kind): Persistierter Wert aus der TS1.1-Zeit, bewusst nicht umbenannt (Altzeilen/Links/Toggles), Baustein heißt LS-Reaktion.
   if(!poi||dobLqMatchRank(m)<dobLqMatchRank(poi))poi={kind:'ts11',tradeSetupId:ts.id,zone:{top:ts.top,bottom:ts.bottom},
    zoneStartTime:ts.startTime,lsPrice:ts.lsPrice,lsPivotTime:ts.lsPivotTime,lsTouchedTime:ts.lsTouchedTime,lsTimeframe:ts.lsTimeframe,
    lsSourceKind:ts.lsSourceKind,...m};
  }
  return {poi,reason:poi&&DOB_LQ_MATCH_LEVELS.indexOf(poi.match)<=allowed?null:list.length?'noPoi':'missingTradeSetups'};
 };
}

// Welcher LS (Philip, „LS-Zuordnung kausal“): der jüngste gültige, gehaltene Sweep vor OB1 aus dem LQ-Algo (liquiditySweepSelection.js),
// alle gültigen LS der Sweep-Kerze plus Zähler (WR-Hypothese „mehr Level = besser“). Kein Sweep: lsSource 'none' und kein LS, kein stiller
// Rückfall auf den LS der geometrischen LS-Reaktion. error: IN später als 3 h Marktzeit nach dem Touch (Fill bricht ab).
function causalLs(select){
 const memo=new Map();
 return pair=>{
  const dir=pair.direction==='short'?1:-1,before=pair.firstOrderBlock.startTime,key=`${dir}:${before}`;
  if(!memo.has(key))memo.set(key,select({dir,before}));
  const s=memo.get(key);
  if(!s)return {lsSource:'none',lsPrice:null,lsPivotTime:null,lsTouchedTime:null,lsTimeframe:null,lsSourceKind:null,lsCount:0,lsLevels:[],error:null};
  return {lsSource:'causal',lsPrice:s.primary.price,lsPivotTime:s.primary.pivotTime,lsTouchedTime:s.touchTime,lsTimeframe:'5M',
   lsSourceKind:s.primary.sourceKind??'liquidity',lsCount:s.lsCount,reactionObStart:s.reaction.reactionOb.startTime,
   lsLevels:s.levels.map(l=>({price:l.price,pivotTime:l.pivotTime,sourceKind:l.sourceKind??'liquidity'})),error:s.error};
 };
}
