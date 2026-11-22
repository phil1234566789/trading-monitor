// LQ-Algo: Welcher Sweep vor einem Zeitpunkt hat die Bewegung ausgelöst? (Philip, Pseudochart „LS-Zuordnung kausal“.) Kandidaten sind alle
// Gegenseiten-LS (M5-Fraktal P5 und OB-Kante), die vor `before` berührt wurden, jüngste Sweep-Kerze zuerst. Eine Sweep-Kerze zählt, wenn
// mindestens ein LS an ihr gültig ist (assessLiquiditySourceValidity) und die LS-Reaktion IN ist, mit gehaltenem Extrem bis `before`.
// Alle gültigen LS dieser Kerze kommen mit (lsCount). Kein Zeitlimit: späte Reaktionen nach NY-Schluss sind normal (Philip).
import {detectLiquidityLevels,detectOrderBlockLiquidityLevels} from './liquidityDetection.js';
import {detectSetupObs} from './tradeSetup.js';
import {evaluateLiquiditySweepReaction,LS_REACTION_EXTREME_PERIOD} from './liquiditySweepReaction.js';
import {assessLiquiditySourceValidity} from './liquiditySourceOwnership.js';
import {createM5StructureContextResolver} from './m5StructureContext.js';
import {createCloseReactionCache} from './m5CloseReactionHistory.js';
import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {obMinimum} from './instrumentConfig.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';

const bar=t=>Math.floor(t/300)*300;

// m5Candles roh (inkl. Sessions, die markIgnoredCandles ausblendet), H1/D1 für den D1-Anker des Strukturkontexts.
// JSDoc, weil Deno die Defaults (= []) sonst als never[] liest.
/** @param {{instrument:string,m5Candles?:any[],h1Candles?:any[],d1Candles?:any[],sessionConfigs?:any[],settings?:object}} input */
export function createLiquiditySweepSelector({instrument,m5Candles=[],h1Candles=[],d1Candles=[],sessionConfigs=[],settings={}}){
 const configs=sessionConfigs.map(s=>({...s,instrument}));
 const marked=markIgnoredCandles(m5Candles,configs,s=>berlinOffsetMinutes(s*1000)),clean=marked.filter(c=>!c.ignored);
 const obs=detectSetupObs(marked,obMinimum(instrument,'5m')),pivots=detectLiquidityLevels(clean,LS_REACTION_EXTREME_PERIOD);
 const fractals=detectLiquidityLevels(clean,TRADE_SETUP_M5_FRACTAL_PERIOD),end=(clean.at(-1)?.time??0)+300;
 const anchors=buildHistoricalDailyAnchors(d1Candles,h1Candles),resolvers=new Map(),closeReactionCache=createCloseReactionCache();
 // Je Richtung die Sweep-Kerzen absteigend, jede mit ihren LS.
 const groups=Object.fromEntries([1,-1].map(dir=>{
  const levels=[...(dir===1?fractals.highs:fractals.lows),...detectOrderBlockLiquidityLevels(obs,marked,dir,end)]
   .filter(l=>l.touched&&Number.isFinite(l.touchedTime));
  const byBar=Map.groupBy(levels,l=>bar(l.touchedTime));
  return [dir,[...byBar].sort((a,b)=>b[0]-a[0]).map(([touch,list])=>({touch,levels:list}))];
 }));
 // Wie lsReactionRows: M5 nur ab dem Strukturstart des D1-Ankers, der beim Pivot galt (sonst baut jeder Kontext über Jahres-M5).
 const resolverFor=pivotTime=>{
  const anchor=anchors.filter(a=>a.knownAt<=pivotTime).sort((a,b)=>b.pivotTime-a.pivotTime)[0];
  const from=anchor?anchor.structureStartTime-86400:-Infinity;
  if(!resolvers.has(from))resolvers.set(from,createM5StructureContextResolver({instrument,m5Candles:m5Candles.filter(c=>c.time>=from),
   h1Candles,d1Candles,settings,sessionConfigs:configs}));
  return resolvers.get(from);
 };
 const reactions=new Map(),validity=new Map();
 const reactionOf=(dir,group)=>{
  const key=`${dir}:${group.touch}`;
  if(!reactions.has(key))reactions.set(key,evaluateLiquiditySweepReaction({dir,ls:{price:group.levels[0].price,touchedTime:group.touch}},{obs,candles:clean,pivots}));
  return reactions.get(key);
 };
 const validityOf=(dir,level,touch)=>{
  const key=`${dir}:${level.sourceKind??'liquidity'}:${level.pivotTime}:${level.price}:${touch}`;
  if(!validity.has(key)){
   const resolveContext=resolverFor(level.pivotTime),context=resolveContext(touch+300);
   validity.set(key,context.status!=='ready'?{status:'unknown',reason:context.reason}
    :assessLiquiditySourceValidity({setup:{dir,ls:level},context,resolveContext,closeReactionCache}));
  }
  return validity.get(key);
 };
 // dir: 1 = Short (Sweep der Hochs). before: Start von OB1; Umkehr-OB und gehaltenes Extrem müssen davor liegen.
 return function select({dir,before}){
  for(const group of groups[dir]??[]){
   if(group.touch>=before)continue;
   const reaction=reactionOf(dir,group);
   if(reaction.status!=='in'||reaction.reactionOb.startTime>before)continue;
   // Gehalten bis vor OB1 (wie holdUntil in evaluateLiquiditySweepReaction, hier einmal je Sweep-Kerze gerechnet).
   if(reaction.extremeBrokenAt!=null&&reaction.extremeBrokenAt<before)continue;
   // Pivot und OB-Kante am selben Preis sind ein LS (Philip: Zähler 1 in Fall 1 und 4); der Pivot steht vorn.
   const valid=[...new Map(group.levels.filter(l=>validityOf(dir,l,group.touch).status==='passed')
    .sort((a,b)=>(a.sourceKind==='orderBlock')-(b.sourceKind==='orderBlock')).map(l=>[l.price,l])).values()];
   if(!valid.length)continue;
   const primary=valid.reduce((a,b)=>b.pivotTime<a.pivotTime?b:a);
   return {touchTime:group.touch,reaction,levels:valid,primary,lsCount:valid.length};
  }
  return null;
 };
}
